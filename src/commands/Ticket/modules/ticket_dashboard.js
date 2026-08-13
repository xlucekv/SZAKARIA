import { getColor } from '../../../config/bot.js';
import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    RoleSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    UserSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    ComponentType,
    EmbedBuilder,
} from 'discord.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../../utils/errorHandler.js';
import { getGuildConfig, setGuildConfig } from '../../../services/config/guildConfig.js';
import { getGuildTicketStats } from '../../../utils/database/tickets.js';
import { getUserTicketCount } from '../../../services/ticket.js';
import {
    getTicketPanelStatus,
    messageHasButtonCustomId,
    formatPanelStatusField,
} from '../../../utils/panelStatus.js';
import { startDashboardSession } from '../../../utils/dashboardSession.js';

function buildButtonRow(guildConfig, guildId, disabled = false, panelStatus = null) {
    const dmEnabled = guildConfig.dmOnClose !== false;
    const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const buttons = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`ticket_cfg_repost_${guildId}`)
                .setLabel('Wyślij panel ponownie')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌')
                .setDisabled(disabled),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_dm_toggle_${guildId}`)
            .setLabel('PW po zamknięciu')
            .setStyle(dmEnabled ? ButtonStyle.Success : ButtonStyle.Danger)
            .setEmoji(dmEnabled ? '📬' : '📭')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_staff_role_btn_${guildId}`)
            .setLabel('Rola Administracji')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️')
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`ticket_cfg_delete_${guildId}`)
            .setLabel('Usuń system')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
            .setDisabled(disabled),
    );

    return new ActionRowBuilder().addComponents(buttons);
}

async function persistPanelMessageId(client, guildId, guildConfig, messageId) {
    if (!messageId || guildConfig.ticketPanelMessageId === messageId) return;
    guildConfig.ticketPanelMessageId = messageId;
    if (client.db) {
        await setGuildConfig(client, guildId, guildConfig);
    }
}

function buildPanelEmbed(config) {
    const defaultDesc = 
        'Witaj w centrum pomocy i rekrutacji **Klanu SZAK**.\n\n' +
        '• Wybierz kategorię zgłoszenia z poniższego menu.\n' +
        '• Wypełnij formularz i opisz dokładnie swoją sprawę.\n' +
        '• Oczekuj na odpowiedź od **Administracji**.\n\n' +
        '*Prosimy o cierpliwość i nieotwieranie wielu ticketów bez potrzeby.*';

    return new EmbedBuilder()
        .setTitle('Centrum Pomocy & Rekrutacji')
        .setDescription(config.ticketPanelMessage || defaultDesc)
        .setColor('#ff9900');
}

function buildPanelButtonRow(config) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel(config.ticketButtonLabel || 'Stwórz Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩'),
    );
}

async function repostTicketPanel(client, guild, guildConfig, guildId) {
    const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
    if (!channel) {
        throw new TitanBotError(
            'Kanał panelu nie istnieje',
            ErrorTypes.CONFIGURATION,
            '> `❌` | Skonfigurowany kanał dla panelu zgłoszeń już nie istnieje. Ustaw nowy kanał z poziomu panelu.',
        );
    }

    const sentPanel = await channel.send({
        embeds: [buildPanelEmbed(guildConfig)],
        components: [buildPanelButtonRow(guildConfig)],
    });

    await persistPanelMessageId(client, guildId, guildConfig, sentPanel.id);
    return sentPanel;
}

function formatCloseDuration(ms) {
    if (ms == null) return '`Brak danych`';
    const hours = Math.floor(ms / 3_600_000);
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function buildDashboardEmbed(config, guild, panelStatus = null, ticketStats = null) {
    const panelChannel = config.ticketPanelChannelId ? `<#${config.ticketPanelChannelId}>` : '`Brak`';
    const staffRole = config.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}>` : '`Brak`';
    const ticketLogsChannel = config.ticketLogsChannelId ? `<#${config.ticketLogsChannelId}>` : '`Brak`';
    const transcriptChannel = config.ticketTranscriptChannelId ? `<#${config.ticketTranscriptChannelId}>` : '`Brak`';

    const openCategoryChannel = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId) : null;
    const openCategory = openCategoryChannel ? openCategoryChannel.toString() : '`Brak`';
    
    const closedCategoryChannel = config.ticketClosedCategoryId ? guild.channels.cache.get(config.ticketClosedCategoryId) : null;
    const closedCategory = closedCategoryChannel ? closedCategoryChannel.toString() : '`Brak`';

    const rawMsg = config.ticketPanelMessage || 'Witaj w centrum pomocy klanowej. Kliknij przycisk poniżej...';
    const panelMsg = `\`${rawMsg.length > 60 ? rawMsg.substring(0, 60) + '…' : rawMsg}\``;
    const btnLabel = `\`${config.ticketButtonLabel || 'Stwórz Ticket'}\``;

    let panelStatusValue = formatPanelStatusField(panelStatus);

    const openTickets = ticketStats ? String(ticketStats.openCount) : '`—`';
    const avgCloseTime = ticketStats ? formatCloseDuration(ticketStats.avgCloseTimeMs) : '`—`';
    const feedbackSummary = ticketStats?.feedbackCount
        ? `${ticketStats.avgRating}/5 (${ticketStats.feedbackCount} ocen)`
        : '`Brak ocen`';

    return new EmbedBuilder()
        .setTitle('🎫 Panel Zarządzania Systemem Zgłoszeń')
        .setDescription(`Zarządzaj ustawieniami ticketów na serwerze **${guild.name}**.\nWybierz opcję z poniższego menu, aby zmienić dane ustawienie.`)
        .setColor(getColor('info'))
        .addFields(
            { name: 'Status Panelu', value: panelStatusValue, inline: false },
            { name: 'Kanał Panelu', value: panelChannel, inline: true },
            { name: 'Rola Administracji', value: staffRole, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Kategoria Otwartych', value: openCategory, inline: true },
            { name: 'Kategoria Zamkniętych', value: closedCategory, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Wiadomość Panelu', value: panelMsg, inline: false },
            { name: 'Etykieta Przycisków', value: btnLabel, inline: true },
            { name: 'Max Ticketów/Gracz', value: String(config.maxTicketsPerUser || 3), inline: true },
            { name: 'PW po zamknięciu', value: config.dmOnClose !== false ? 'Włączone' : 'Wyłączone', inline: true },
            { name: 'Kanał Logów', value: ticketLogsChannel, inline: true },
            { name: 'Kanał Transkrypcji', value: transcriptChannel, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Otwarte Tickety', value: openTickets, inline: true },
            { name: 'Śr. Czas Zamknięcia', value: avgCloseTime, inline: true },
            { name: 'Ocena Odbioru', value: feedbackSummary, inline: true },
        )
        .setFooter({ text: 'Wybierz opcję poniżej • Panel wygaśnie po 10 minutach bezczynności' })
        .setTimestamp();
}

function buildSelectMenu(guildId) {
    return new StringSelectMenuBuilder()
        .setCustomId(`ticket_config_${guildId}`)
        .setPlaceholder('👉 Wybierz ustawienie do skonfigurowania...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Edytuj treść panelu')
                .setDescription('Zmień wiadomość wyświetlaną na panelu zgłoszeń')
                .setValue('panel_message')
                .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Edytuj etykietę przycisku')
                .setDescription('Zmień napis na przycisku otwierającym zgłoszenie')
                .setValue('button_label')
                .setEmoji('🏷️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Kategoria otwartych ticketów')
                .setDescription('Kategoria, w której będą tworzone nowe kanały')
                .setValue('open_category')
                .setEmoji('📁'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Kategoria zamkniętych ticketów')
                .setDescription('Kategoria, do której będą przenoszone zamknięte zgłoszenia')
                .setValue('closed_category')
                .setEmoji('📂'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ustaw limit ticketów na gracza')
                .setDescription('Ogranicz maksymalną liczbę aktywnych ticketów na osobę')
                .setValue('max_tickets')
                .setEmoji('🔢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ustaw kanał logów ticketów')
                .setDescription('Kanał ze zdarzeniami (otwarcie, zamknięcie, oceny)')
                .setValue('logs_channel')
                .setEmoji('🎫'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Ustaw kanał transkrypcji')
                .setDescription('Kanał, na który będą wysyłane wygenerowane archiwa chatu')
                .setValue('transcript_channel')
                .setEmoji('📜'),
        );
}

async function refreshDashboard(rootInteraction, guildConfig, guildId, client) {
    const panelStatus = client
        ? await getTicketPanelStatus(client, rootInteraction.guild, guildConfig)
        : null;
    const ticketStats = client ? await getGuildTicketStats(guildId) : null;

    if (panelStatus?.recoveredId) {
        await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
    }

    const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);
    const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
    await InteractionHelper.safeEditReply(rootInteraction, {
        embeds: [buildDashboardEmbed(guildConfig, rootInteraction.guild, panelStatus, ticketStats)],
        components: [buttonRow, selectRow],
    }).catch(() => {});
}

async function updateLivePanel(client, guild, config, guildId) {
    if (!config.ticketPanelChannelId) return false;
    try {
        const panelStatus = await getTicketPanelStatus(client, guild, config);
        if (panelStatus.recoveredId) {
            await persistPanelMessageId(client, guildId, config, panelStatus.recoveredId);
        }
        if (!panelStatus.exists || !panelStatus.message) return false;

        await panelStatus.message.edit({
            embeds: [buildPanelEmbed(config)],
            components: [buildPanelButtonRow(config)],
        });
        return true;
    } catch (error) {
        logger.warn('Failed to update live ticket panel:', error.message);
        return false;
    }
}

export default {
    prefixOnly: false,
    async execute(interaction, config, client) {
        try {
            const guildId = interaction.guild.id;
            const guildConfig = await getGuildConfig(client, guildId);

            if (!guildConfig.ticketPanelChannelId) {
                throw new TitanBotError(
                    'System zgłoszeń nie skonfigurowany',
                    ErrorTypes.CONFIGURATION,
                    '> `❌` | System zgłoszeń nie został jeszcze skonfigurowany. Użyj najpierw komendy `/ticket setup`.',
                );
            }

            const panelStatus = await getTicketPanelStatus(client, interaction.guild, guildConfig);
            if (panelStatus.recoveredId) {
                await persistPanelMessageId(client, guildId, guildConfig, panelStatus.recoveredId);
            }

            const ticketStats = await getGuildTicketStats(guildId);

            const selectRow = new ActionRowBuilder().addComponents(buildSelectMenu(guildId));
            const buttonRow = buildButtonRow(guildConfig, guildId, false, panelStatus);

            await startDashboardSession({
                interaction,
                embeds: [buildDashboardEmbed(guildConfig, interaction.guild, panelStatus, ticketStats)],
                components: [buttonRow, selectRow],
                selectMenuId: `ticket_config_${guildId}`,
                buttonMatcher: (customId) =>
                    customId === `ticket_cfg_repost_${guildId}` ||
                    customId === `ticket_cfg_dm_toggle_${guildId}` ||
                    customId === `ticket_cfg_staff_role_btn_${guildId}` ||
                    customId === `ticket_cfg_delete_${guildId}`,
                onSelect: async (selectInteraction) => {
                    const selectedOption = selectInteraction.values[0];
                    switch (selectedOption) {
                        case 'panel_message':
                            await handlePanelMessage(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'button_label':
                            await handleButtonLabel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'open_category':
                            await handleOpenCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'closed_category':
                            await handleClosedCategory(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'max_tickets':
                            await handleMaxTickets(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'logs_channel':
                            await handleLogsChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                        case 'transcript_channel':
                            await handleTranscriptChannel(selectInteraction, interaction, guildConfig, guildId, client);
                            break;
                    }
                },
                onButton: async (btnInteraction) => {
                    if (btnInteraction.customId === `ticket_cfg_repost_${guildId}`) {
                        await handleRepostPanel(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_dm_toggle_${guildId}`) {
                        await handleDmOnClose(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_staff_role_btn_${guildId}`) {
                        await handleStaffRole(btnInteraction, interaction, guildConfig, guildId, client);
                    } else if (btnInteraction.customId === `ticket_cfg_delete_${guildId}`) {
                        await handleDeleteSystem(btnInteraction, interaction, guildConfig, guildId, client);
                    }
                },
            });
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            logger.error('Unexpected error in ticket_config:', error);
            throw new TitanBotError(
                `Błąd konfiguracji zgłoszeń: ${error.message}`,
                ErrorTypes.UNKNOWN,
                '> `❌` | Wystąpił błąd podczas otwierania panelu zarządzania ticketami.',
            );
        }
    },
};

async function handlePanelMessage(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_panel_msg')
        .setTitle('📝 Edytuj wiadomość panelu')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('panel_msg_input')
                    .setLabel('Treść wiadomości panelu')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(
                        guildConfig.ticketPanelMessage ||
                            'Witaj w centrum pomocy klanu. Wybierz kategorię poniżej...',
                    )
                    .setMaxLength(2000)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Wprowadź treść opisu panelu zgłoszeń...'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_panel_msg' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newMessage = submitted.fields.getTextInputValue('panel_msg_input').trim();
    guildConfig.ticketPanelMessage = newMessage;
    await setGuildConfig(client, guildId, guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

    let statusNote = panelUpdated
        ? '\n> `🔄` | Aktywny panel na kanale został zaktualizowany.'
        : '\n> `⚠️` | **Uwaga:** Nie odnaleziono aktywnego panelu na kanale. Użyj opcji **Wyślij panel ponownie** w panelu.';

    await submitted.reply({
        content: `> \`✅\` | **Wiadomość panelu została zmieniona.**${statusNote}`,
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleButtonLabel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_btn_label')
        .setTitle('🏷️ Edytuj etykietę przycisku')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('btn_label_input')
                    .setLabel('Etykieta przycisku (max 80 znaków)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(guildConfig.ticketButtonLabel || 'Stwórz Ticket')
                    .setMaxLength(80)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('Stwórz Ticket'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_btn_label' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newLabel = submitted.fields.getTextInputValue('btn_label_input').trim();
    guildConfig.ticketButtonLabel = newLabel;
    await setGuildConfig(client, guildId, guildConfig);

    const panelUpdated = await updateLivePanel(client, rootInteraction.guild, guildConfig, guildId);

    let statusNote = panelUpdated
        ? '\n> `🔄` | Przycisk na aktywnym panelu został zaktualizowany.'
        : '\n> `⚠️` | **Uwaga:** Nie odnaleziono aktywnego panelu na kanale. Użyj opcji **Wyślij panel ponownie** w panelu.';

    await submitted.reply({
        content: `> \`✅\` | Zmieniono etykietę przycisku na \`${newLabel}\`.${statusNote}`,
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleStaffRole(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('ticket_cfg_staff_role')
        .setPlaceholder('Wybierz rolę administracji...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    await selectInteraction.followUp({
        content: `> \`🛡️\` | **Rola Administracji**\n> Obecna rola: ${guildConfig.ticketStaffRoleId ? `<@&${guildConfig.ticketStaffRoleId}>` : '`Brak`'}\n\nWybierz rolę, która ma posiadać dostęp do obsługi zgłoszeń.`,
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_staff_role',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        await roleInteraction.deferUpdate();
        const role = roleInteraction.roles.first();

        guildConfig.ticketStaffRoleId = role.id;
        await setGuildConfig(client, guildId, guildConfig);

        await roleInteraction.followUp({
            content: `> \`✅\` | Rola administracji została ustawiona na ${role}.`,
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Czas minął. Nie wybrano żadnej roli.',
            }).catch(() => {});
        }
    });
}

async function handleOpenCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_open_cat')
        .setPlaceholder('Wybierz kategorię...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    await selectInteraction.followUp({
        content: `> \`📁\` | **Kategoria otwartych ticketów**\n> Obecna: ${guildConfig.ticketCategoryId ? `<#${guildConfig.ticketCategoryId}>` : '`Brak`'}\n\nWybierz kategorię, w której będą tworzone nowe kanały zgłoszeń.`,
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_open_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketCategoryId = category.id;
        await setGuildConfig(client, guildId, guildConfig);

        await catInteraction.followUp({
            content: `> \`✅\` | Nowe tickety będą od teraz tworzone w kategorii **${category.name}**.`,
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Czas minął. Nie wybrano żadnej kategorii.',
            }).catch(() => {});
        }
    });
}

async function handleClosedCategory(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_closed_cat')
        .setPlaceholder('Wybierz kategorię...')
        .addChannelTypes(ChannelType.GuildCategory)
        .setMaxValues(1);

    await selectInteraction.followUp({
        content: `> \`📂\` | **Kategoria zamkniętych ticketów**\n> Obecna: ${guildConfig.ticketClosedCategoryId ? `<#${guildConfig.ticketClosedCategoryId}>` : '`Brak`'}\n\nWybierz kategorię, do której trafiają zamknięte zgłoszenia.`,
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const catCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_closed_cat',
        time: 60_000,
        max: 1,
    });

    catCollector.on('collect', async catInteraction => {
        await catInteraction.deferUpdate();
        const category = catInteraction.channels.first();

        guildConfig.ticketClosedCategoryId = category.id;
        await setGuildConfig(client, guildId, guildConfig);

        await catInteraction.followUp({
            content: `> \`✅\` | Zamknięte zgłoszenia będą teraz przenoszone do kategorii **${category.name}**.`,
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    catCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Czas minął. Nie wybrano żadnej kategorii.',
            }).catch(() => {});
        }
    });
}

async function handleMaxTickets(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    const modal = new ModalBuilder()
        .setCustomId('ticket_cfg_max_tickets')
        .setTitle('Maksymalna liczba ticketów')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('max_tickets_input')
                    .setLabel('Limit aktywnych ticketów na gracza (1–10)')
                    .setStyle(TextInputStyle.Short)
                    .setValue(String(guildConfig.maxTicketsPerUser || 3))
                    .setMaxLength(2)
                    .setMinLength(1)
                    .setRequired(true)
                    .setPlaceholder('3'),
            ),
        );

    await selectInteraction.showModal(modal);

    const submitted = await selectInteraction
        .awaitModalSubmit({
            filter: i =>
                i.customId === 'ticket_cfg_max_tickets' && i.user.id === selectInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const raw = submitted.fields.getTextInputValue('max_tickets_input').trim();
    const newMax = parseInt(raw, 10);

    if (Number.isNaN(newMax) || newMax < 1 || newMax > 10) {
        await replyUserError(submitted, {
            type: ErrorTypes.VALIDATION,
            message: '> `❌` | Podana wartość musi być liczbą całkowitą przedziału **1** a **10**.',
        });
        return;
    }

    guildConfig.maxTicketsPerUser = newMax;
    await setGuildConfig(client, guildId, guildConfig);

    await submitted.reply({
        content: `> \`✅\` | Zaktualizowano limit ticketów. Każdy gracz może posiadać maksymalnie **${newMax}** otwartych ticketów naraz.`,
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleDmOnClose(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    await btnInteraction.deferUpdate();

    const newState = guildConfig.dmOnClose === false;
    guildConfig.dmOnClose = newState;
    await setGuildConfig(client, guildId, guildConfig);

    await btnInteraction.followUp({
        content: `> \`📬\` | Wiadomości PW po zamknięciu zgłoszenia zostały **${newState ? 'włączone' : 'wyłączone'}**.`,
        flags: MessageFlags.Ephemeral,
    });

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleLogsChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_logs_channel')
        .setPlaceholder('Wybierz kanał...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        content: `> \`🎫\` | **Kanał logów zgłoszeń**\n> Wybierz kanał, na który będą wysyłane powiadomienia o zdarzeniach dotyczących ticketów.`,
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_logs_channel',
        time: 60_000,
        max: 1,
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketLogsChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);

        await channelInteraction.followUp({
            content: `> \`✅\` | Logi systemu ticketów będą od teraz wysyłane na kanał ${channel}.`,
            flags: MessageFlags.Ephemeral,
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Nie wybrano żadnego kanału. Ustawienia nie zostały zmienione.',
            }).catch(() => {});
        }
    });
}

async function handleTranscriptChannel(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('ticket_cfg_transcript_channel')
        .setPlaceholder('Wybierz kanał dla transkrypcji...')
        .addChannelTypes(ChannelType.GuildText)
        .setMaxValues(1);

    await selectInteraction.followUp({
        content: `> \`📜\` | **Ustawienia transkrypcji**\n> Wybierz kanał, na który będą automatycznie wysyłane transkrypcje po usunięciu ticketów.`,
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        flags: MessageFlags.Ephemeral
    });

    const collector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.ChannelSelect,
        filter: i => i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_transcript_channel',
        time: 60_000,
        max: 1
    });

    collector.on('collect', async channelInteraction => {
        await channelInteraction.deferUpdate();
        const channel = channelInteraction.channels.first();

        guildConfig.ticketTranscriptChannelId = channel.id;
        await setGuildConfig(client, guildId, guildConfig);

        await channelInteraction.followUp({
            content: `> \`✅\` | Transkrypcje będą od teraz wysyłane na kanał ${channel}.`,
            flags: MessageFlags.Ephemeral
        });

        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Nie wybrano żadnego kanału. Ustawienia nie zostały zmienione.',
            }).catch(() => {});
        }
    });
}

async function handleCheckUser(selectInteraction, rootInteraction, guildConfig, guildId, client) {
    await selectInteraction.deferUpdate();

    const userSelect = new UserSelectMenuBuilder()
        .setCustomId('ticket_cfg_check_user')
        .setPlaceholder('Wybierz użytkownika do sprawdzenia...')
        .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);

    await selectInteraction.followUp({
        content: `> \`🔍\` | **Sprawdzanie limitu gracza**\n> Wybierz użytkownika z listy poniżej, aby zobaczyć jego aktywne zgłoszenia.`,
        components: [row],
        flags: MessageFlags.Ephemeral,
    });

    const userCollector = rootInteraction.channel.createMessageComponentCollector({
        componentType: ComponentType.UserSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'ticket_cfg_check_user',
        time: 60_000,
        max: 1,
    });

    userCollector.on('collect', async userInteraction => {
        await userInteraction.deferUpdate();
        const targetUser = userInteraction.users.first();
        const maxTickets = guildConfig.maxTicketsPerUser || 3;
        const openCount = await getUserTicketCount(guildId, targetUser.id);
        const atLimit = openCount >= maxTickets;

        const limitStatus = atLimit 
            ? '> `⚠️` | **Ten użytkownik osiągnął już swój limit ticketów!**'
            : '> `✅` | **Ten użytkownik może otwierać kolejne zgłoszenia.**';

        await userInteraction.followUp({
            content: `> \`👤\` | **Status zgłoszeń użytkownika:** ${targetUser}\n` +
                     `> \`📊\` | **Otwarte tickety:** \`${openCount}\` / \`${maxTickets}\` (Pozostało: \`${Math.max(0, maxTickets - openCount)}\`)\n\n` +
                     limitStatus,
            flags: MessageFlags.Ephemeral,
        });
    });

    userCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: '> `❌` | Nie wybrano użytkownika.',
            }).catch(() => {});
        }
    });
}

async function handleRepostPanel(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    await btnInteraction.deferUpdate();

    const panelStatus = await getTicketPanelStatus(client, rootInteraction.guild, guildConfig);
    if (panelStatus.exists) {
        await btnInteraction.followUp({
            content: '> `ℹ️` | Panel zgłoszeń jest już aktywny i znajduje się na skonfigurowanym kanale.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => {});
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    const sentPanel = await repostTicketPanel(client, rootInteraction.guild, guildConfig, guildId);

    let responseMsg = `> \`📌\` | Nowy panel zgłoszeń został pomyślnie wysłany na kanał <#${guildConfig.ticketPanelChannelId}>.`;
    if (sentPanel.url) {
        responseMsg += `\n> \`🔗\` | [Przejdź do panelu](${sentPanel.url})`;
    }

    await btnInteraction.followUp({
        content: responseMsg,
        flags: MessageFlags.Ephemeral,
    }).catch(() => {});

    await refreshDashboard(rootInteraction, guildConfig, guildId, client);
}

async function handleDeleteSystem(btnInteraction, rootInteraction, guildConfig, guildId, client) {
    const deleteModal = new ModalBuilder()
        .setCustomId('ticket_delete_confirm_modal')
        .setTitle('Usuwanie systemu zgłoszeń')
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('delete_confirmation')
                    .setLabel('Wpisz "DELETE" aby potwierdzić')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('DELETE')
                    .setMaxLength(6)
                    .setMinLength(6)
                    .setRequired(true)
            )
        );

    await btnInteraction.showModal(deleteModal);

    const submitted = await btnInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'ticket_delete_confirm_modal' && i.user.id === btnInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    const confirmation = submitted.fields.getTextInputValue('delete_confirmation').trim();

    if (confirmation !== 'DELETE') {
        await replyUserError(submitted, { 
            type: ErrorTypes.UNKNOWN, 
            message: '> `❌` | Musisz wpisać dokładnie **DELETE**, aby potwierdzić usunięcie systemu.' 
        });
        await refreshDashboard(rootInteraction, guildConfig, guildId, client);
        return;
    }

    await submitted.deferUpdate();

    const keysToDelete = [
        'ticketPanelChannelId',
        'ticketPanelMessageId',
        'ticketStaffRoleId',
        'ticketCategoryId',
        'ticketClosedCategoryId',
        'ticketPanelMessage',
        'ticketButtonLabel',
        'maxTicketsPerUser',
        'dmOnClose',
    ];

    if (guildConfig.ticketPanelChannelId) {
        try {
            const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null);
            if (panelChannel) {
                if (guildConfig.ticketPanelMessageId) {
                    const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPanelMessageId).catch(() => null);
                    if (panelMessage) await panelMessage.delete().catch(() => {});
                } else {
                    const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
                    if (messages) {
                        const found = messages.find(
                            m => m.author.id === client.user.id && messageHasButtonCustomId(m, 'create_ticket'),
                        );
                        if (found) await found.delete().catch(() => {});
                    }
                }
            }
        } catch (panelDeleteError) {
            logger.warn('Could not delete ticket panel message:', panelDeleteError.message);
        }
    }

    try {
        const { pgConfig } = await import('../../../config/database/postgres.js');
        if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db.isAvailable()) {
            await client.db.db.pool.query(
                `DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
                [guildId]
            );
        }
    } catch (ticketDeleteError) {
        logger.warn('Could not clear ticket records from database:', ticketDeleteError.message);
    }

    for (const key of keysToDelete) {
        delete guildConfig[key];
    }
    await setGuildConfig(client, guildId, guildConfig);

    await submitted.followUp({
        content: '> `🗑️` | **System zgłoszeń został pomyślnie usunięty.**\n> Użyj `/ticket setup`, aby skonfigurować go od nowa.',
        flags: MessageFlags.Ephemeral,
    });

    await InteractionHelper.safeEditReply(rootInteraction, {
        content: '> `⚠️` | **System zgłoszeń został usunięty.** Konfiguracja panelu została wyczyszczona.',
        embeds: [],
        components: [],
    }).catch(() => {});
}
