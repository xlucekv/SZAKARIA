// ticket.js

import {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  AttachmentBuilder,
} from 'discord.js';
import { buildStandardLogEmbed, formatLogLine } from '../utils/logging/logEmbeds.js';
import { getGuildConfig } from './config/guildConfig.js';
import { getTicketData, saveTicketData, getOpenTicketCountForUser, incrementTicketCounter } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { createEmbed } from '../utils/embeds.js';
import { logTicketEvent } from '../utils/ticket/ticketLogging.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';
import { ensureTypedServiceError, wrapServiceBoundary } from '../utils/serviceErrorBoundary.js';
import { PRIORITY_MAP } from '../utils/helpers.js';

const TICKET_DELETE_DELAY_MS = 3000;
const TICKET_DELETE_DELAY_SECONDS = Math.floor(TICKET_DELETE_DELAY_MS / 1000);
const TICKET_SERVICE = 'ticketService';

function ticketUserError(message, userMessage, type = ErrorTypes.VALIDATION, context = {}) {
  throw createError(message, type, userMessage, { service: TICKET_SERVICE, ...context });
}

function requireTicket(ticketData, channel) {
  if (!ticketData) {
    ticketUserError('Nie znaleziono danych zgłoszenia', 'To nie jest kanał zgłoszenia.', ErrorTypes.VALIDATION, { channelId: channel?.id, guildId: channel?.guild?.id });
  }
  return ticketData;
}

function rethrowTicketError(error, operation, userMessage, context = {}) {
  throw ensureTypedServiceError(error, {
    service: TICKET_SERVICE,
    operation,
    message: `Operacja zgłoszenia nie powiodła się: ${operation}`,
    userMessage,
    context,
  });
}

function buildTicketControlRow({ claimedBy = null } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(claimedBy ? 'Przejęte' : 'Przejmij')
      .setStyle(claimedBy ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setEmoji('🙋')
      .setDisabled(!!claimedBy),
    new ButtonBuilder()
      .setCustomId('ticket_pin')
      .setLabel('Przypnij')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📌'),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Zamknij')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );
}

export const getUserTicketCount = wrapServiceBoundary(async function getUserTicketCount(guildId, userId) {
  return await getOpenTicketCountForUser(guildId, userId);
}, {
  service: TICKET_SERVICE,
  operation: 'getUserTicketCount',
  userMessage: 'Nie udało się pobrać liczby otwartych zgłoszeń.',
  context: {},
});

export async function createTicket(guild, member, categoryId, reason = 'Brak powodu', priority = 'none') {
  try {
    const config = await getGuildConfig(guild.client, guild.id);
    const ticketConfig = config.tickets || {};
    
    const maxTicketsPerUser = config.maxTicketsPerUser ?? 3;
    const currentTicketCount = await getUserTicketCount(guild.id, member.id);
    
    if (currentTicketCount >= maxTicketsPerUser) {
      ticketUserError(`Osiągnięto limit zgłoszeń dla ${member.id}`, `Osiągnąłeś limit otwartych zgłoszeń (${maxTicketsPerUser}). Zamknij istniejące zgłoszenie przed otwarciem nowego.`, ErrorTypes.VALIDATION);
    }
    
    let category = categoryId ? guild.channels.cache.get(categoryId) : guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('tickets'));
    
    const ticketNumber = await getNextTicketNumber(guild.id);
    let channelName = `zgłoszenie-${ticketNumber}`;
    
    if (priority !== 'none') {
      const priorityInfo = PRIORITY_MAP[priority];
      if (priorityInfo) channelName = `${priorityInfo.emoji} ${channelName}`;
    }
    
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
        ...(config.ticketStaffRoleId ? [{ id: config.ticketStaffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] }] : []),
      ],
    });
    
    const ticketData = { id: channel.id, userId: member.id, guildId: guild.id, createdAt: new Date().toISOString(), status: 'open', claimedBy: null, priority: priority || 'none', reason };
    await saveTicketData(guild.id, channel.id, ticketData);
    
    const priorityInfo = PRIORITY_MAP[priority] || PRIORITY_MAP.none;
    const embed = createEmbed({
      title: `Zgłoszenie #${ticketNumber}`,
      description: `${member.toString()}, dziękujemy za kontakt!\n\n**Powód:** ${reason}\n**Priorytet:** ${priorityInfo.emoji} ${priorityInfo.label}`,
      color: priorityInfo.color,
      fields: [
        { name: 'Status', value: '🟢 Otwarte', inline: true },
        { name: 'Opiekun', value: 'Brak', inline: true },
        { name: 'Utworzono', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      ],
    });
    
    const row = buildTicketControlRow();
    if (ticketConfig.enablePriority) {
      row.addComponents(
        new ButtonBuilder().setCustomId('ticket_priority:low').setLabel('Niski').setStyle(ButtonStyle.Secondary).setEmoji('🔵'),
        new ButtonBuilder().setCustomId('ticket_priority:high').setLabel('Wysoki').setStyle(ButtonStyle.Danger).setEmoji('🔴')
      );
    }
    
    await channel.send({ content: `${member.toString()}${config.ticketStaffRoleId ? ` <@&${config.ticketStaffRoleId}>` : ''}`, embeds: [embed], components: [row] });
    
    console.log(`> ✅ | **Utworzono nowe zgłoszenie!**`);
    return { channel, ticketData };
  } catch (error) {
    rethrowTicketError(error, 'createTicket', 'Nie udało się utworzyć zgłoszenia.');
  }
}

export async function closeTicket(channel, closer, reason = 'Brak powodu') {
  try {
    const ticketData = requireTicket(await getTicketData(channel.guild.id, channel.id), channel);
    ticketData.status = 'closed';
    await saveTicketData(channel.guild.id, channel.id, ticketData);

    const closeEmbed = createEmbed({
      title: 'Zgłoszenie zamknięte',
      description: `To zgłoszenie zostało zamknięte przez ${closer}.\n**Powód:** ${reason}`,
      color: '#e74c3c'
    });
    
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_reopen').setLabel('Otwórz ponownie').setStyle(ButtonStyle.Success).setEmoji('🔓'),
      new ButtonBuilder().setCustomId('ticket_delete').setLabel('Usuń zgłoszenie').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );
    
    await channel.send({ embeds: [closeEmbed], components: [controlRow] });
    console.log(`> ✅ | **Zgłoszenie zostało zamknięte!**`);
    return ticketData;
  } catch (error) {
    rethrowTicketError(error, 'closeTicket', 'Nie udało się zamknąć zgłoszenia.');
  }
}

export async function claimTicket(channel, claimer) {
  try {
    const ticketData = requireTicket(await getTicketData(channel.guild.id, channel.id), channel);
    if (ticketData.claimedBy) ticketUserError('Zgłoszenie już przejęte', 'To zgłoszenie jest już zajęte.');
    
    ticketData.claimedBy = claimer.id;
    await saveTicketData(channel.guild.id, channel.id, ticketData);
    
    const claimEmbed = createEmbed({
      title: 'Zgłoszenie przejęte',
      description: `🎉 ${claimer} przejął to zgłoszenie!`,
      color: '#2ecc71'
    });
    
    await channel.send({ embeds: [claimEmbed] });
    console.log(`> ✅ | **Zgłoszenie zostało przejęte!**`);
    return ticketData;
  } catch (error) {
    rethrowTicketError(error, 'claimTicket', 'Nie udało się przejąć zgłoszenia.');
  }
}

export async function reopenTicket(channel, reopener) {
  try {
    const ticketData = requireTicket(await getTicketData(channel.guild.id, channel.id), channel);
    ticketData.status = 'open';
    await saveTicketData(channel.guild.id, channel.id, ticketData);
    
    const reopenEmbed = createEmbed({
      title: 'Zgłoszenie otwarte ponownie',
      description: `🔓 ${reopener} otworzył ponownie to zgłoszenie!`,
      color: '#2ecc71'
    });
    
    await channel.send({ embeds: [reopenEmbed] });
    console.log(`> ✅ | **Zgłoszenie zostało ponownie otwarte!**`);
    return ticketData;
  } catch (error) {
    rethrowTicketError(error, 'reopenTicket', 'Nie udało się otworzyć zgłoszenia.');
  }
}

export async function updateTicketPriority(channel, priority, updater) {
  try {
    const ticketData = requireTicket(await getTicketData(channel.guild.id, channel.id), channel);
    const priorityInfo = PRIORITY_MAP[priority];
    
    ticketData.priority = priority;
    await saveTicketData(channel.guild.id, channel.id, ticketData);
    
    const updateEmbed = createEmbed({
      title: 'Priorytet zaktualizowany',
      description: `📊 Priorytet zgłoszenia zmieniony na **${priorityInfo.emoji} ${priorityInfo.label}** przez ${updater}`,
      color: priorityInfo.color
    });
    
    await channel.send({ embeds: [updateEmbed] });
    console.log(`> ✅ | **Priorytet został zaktualizowany!**`);
    return ticketData;
  } catch (error) {
    rethrowTicketError(error, 'updateTicketPriority', 'Nie udało się zaktualizować priorytetu.');
  }
}
