import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, warningEmbed } from '../../../utils/embeds.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';

export default {
    customId: 'select_ticket_category',
    async execute(interaction, config, client) {
        // Natychmiastowa odpowiedź dla Discorda, żeby uniknąć błędu "brak odpowiedzi"
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        const category = interaction.values[0];
        const guild = interaction.guild;
        const user = interaction.user;

        const guildConfig = await getGuildConfig(client, guild.id);
        const staffRoleId = guildConfig?.ticketStaffRoleId;

        // Nazwa tworzonego kanału w zależności od opcji
        const channelName = `ticket-${category}-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');

        // Domyślne uprawnienia do nowego kanału
        const permissionOverwrites = [
            {
                id: guild.id, // UKRYJ dla reszty serwera
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id, // POKAŻ dla gracza
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory
                ],
            },
            {
                id: client.user.id, // POKAŻ dla bota
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ManageMessages
                ],
            }
        ];

        // Dostęp dla Roli Administracji / Dowództwa
        if (staffRoleId && guild.roles.cache.has(staffRoleId)) {
            permissionOverwrites.push({
                id: staffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory
                ],
            });
        }

        try {
            // Utwórz prywatny kanał
            const ticketChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                permissionOverwrites: permissionOverwrites,
            });

            // Przycisk do zamykania ticketu
            const closeButton = new ButtonBuilder()
                .setCustomId('ticket_close')
                .setLabel('Zamknij zgłoszenie')
                .setEmoji('🔒')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(closeButton);

            const welcomeEmbed = createEmbed({
                title: `🎫 Zgłoszenie: ${category.toUpperCase()}`,
                description: `Witaj ${user}! Dziękujemy za kontakt z klanem **SZAK**.\n\nOpisz dokładnie swój problem lub sprawę, a ktoś z Administracji / Dowództwa odezwie się tak szybko, jak to możliwe.`,
                color: '#ff9900'
            });

            const staffMention = staffRoleId ? `<@&${staffRoleId}>` : '';
            await ticketChannel.send({
                content: `${user} ${staffMention}`,
                embeds: [welcomeEmbed],
                components: [row]
            });

            // Potwierdzenie dla użytkownika w ukrytej wiadomości
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        'Utworzono Zgłoszenie',
                        `Twoje zgłoszenie zostało utworzone na kanale: ${ticketChannel}`
                    )
                ]
            });

        } catch (error) {
            logger.error('Błąd podczas tworzenia kanału ticketu:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    warningEmbed(
                        'Błąd Systemu',
                        'Nie udało się utworzyć kanału ticketu. Upewnij się, że bot ma uprawnienie `Zarządzanie kanałami`.'
                    )
                ]
            });
        }
    }
};
