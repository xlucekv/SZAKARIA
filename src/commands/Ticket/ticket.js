import { getColor } from '../../config/bot.js';
import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    PermissionsBitField, 
    ChannelType, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    MessageFlags 
} from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import ticketConfig from './modules/ticket_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Manages the server's ticket system.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Sets up the ticket creation panel in a specified channel.")
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription("The channel where the ticket panel will be sent.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription("The main message/description for the ticket panel.")
                        .setRequired(false)
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription("The role that can access tickets (optional).")
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Maximum number of tickets a user can create (default: 3)")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Send DM to user when their ticket is closed (default: true)")
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Open the interactive ticket system dashboard")
        ),
    category: "ticket",

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) return;

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            logger.warn('Ticket command permission denied', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ticket'
            });
            return await replyUserError(interaction, { 
                type: ErrorTypes.PERMISSION, 
                message: 'You need the `Manage Channels` permission for this action.' 
            });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "dashboard") {
            return ticketConfig.execute(interaction, config, client);
        }

        if (subcommand === "setup") {
            const existingConfig = await getGuildConfig(client, interaction.guildId);
            if (existingConfig?.ticketPanelChannelId) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `This server already has a ticket system set up (panel in <#${existingConfig.ticketPanelChannelId}>).\n\nOnly one ticket system is supported per server. Use \`/ticket dashboard\` to edit or update the existing setup, or select **Delete System** from the dashboard to remove it and start fresh.` 
                });
            }

            const panelChannel = interaction.options.getChannel("panel_channel");
            const staffRole = interaction.options.getRole("staff_role");
            const customMessage = interaction.options.getString("panel_message");
            const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
            const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

            const defaultDescription = 
                '• `📝` ┃ Wybierz z poniższego menu **kategorię**, która Cię interesuje.\n' +
                '• `🎯` ┃ Zostanie utworzony prywatny kanał do rozmowy z administracją.\n\n' +
                '• `📜` ┃ **Przed otwarciem:** przygotuj się na ewentualne pytania!';

            const setupEmbed = createEmbed({ 
                title: "🐺 CENTRUM REKRUTACJI & POMOCY | Klan SZAK ⚔️", 
                description: customMessage || defaultDescription,
                color: '#ff9900'
            });

            // Tworzenie menu wyboru z Waszymi 7 kategoriami
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket_category')
                .setPlaceholder('👉 Wybierz kategorię zgłoszenia...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Rekrutacja').setValue('rekrutacja').setEmoji('📝'),
                    new StringSelectMenuOptionBuilder().setLabel('Pytanie').setValue('pytanie').setEmoji('❓'),
                    new StringSelectMenuOptionBuilder().setLabel('Nieobecność').setValue('nieobecnosc').setEmoji('⏰'),
                    new StringSelectMenuOptionBuilder().setLabel('Skarga').setValue('skarga').setEmoji('🚨'),
                    new StringSelectMenuOptionBuilder().setLabel('Współpraca').setValue('wspolpraca').setEmoji('🤝'),
                    new StringSelectMenuOptionBuilder().setLabel('Zbiórki').setValue('zbiorki').setEmoji('💎'),
                    new StringSelectMenuOptionBuilder().setLabel('Inne / Tickets').setValue('tickets').setEmoji('🎫')
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            try {
                const sentPanel = await panelChannel.send({
                    embeds: [setupEmbed],
                    components: [row],
                });

                if (client.db && interaction.guildId) {
                    const currentConfig = existingConfig || {};
                    currentConfig.ticketStaffRoleId = staffRole ? staffRole.id : null;
                    currentConfig.ticketPanelChannelId = panelChannel.id;
                    currentConfig.ticketPanelMessageId = sentPanel?.id || null;
                    currentConfig.maxTicketsPerUser = maxTicketsPerUser;
                    currentConfig.dmOnClose = dmOnClose;

                    await setGuildConfig(client, interaction.guildId, currentConfig);
                    logger.info('Ticket configuration saved', {
                        guildId: interaction.guildId,
                        staffRoleId: staffRole?.id,
                        maxTickets: maxTicketsPerUser,
                        dmOnClose: dmOnClose,
                    });
                } else {
                    logger.error('Ticket setup: database unavailable, panel sent but configuration was NOT saved', {
                        guildId: interaction.guildId,
                    });
                }

                let successMessage = `The ticket creation panel with categories has been sent to ${panelChannel}.\n\n`;
                if (staffRole) {
                    successMessage += `**${staffRole.name}** role will have access to tickets.\n`;
                }
                successMessage += `**Max Tickets Per User:** ${maxTicketsPerUser}\n**DM on Close:** ${dmOnClose ? 'Enabled' : 'Disabled'}`;

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Ticket Panel Set Up",
                            successMessage,
                        ),
                    ],
                });

            } catch (error) {
                logger.error('Ticket setup error', {
                    error: error.message,
                    stack: error.stack,
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    commandName: 'ticket_setup'
                });
                
                if (interaction.deferred || interaction.replied) {
                    await replyUserError(interaction, { 
                        type: ErrorTypes.UNKNOWN, 
                        message: 'Could not send the ticket panel or save configuration. Check bot permissions.' 
                    }).catch(err => {
                        logger.error('Failed to send error reply', { error: err.message });
                    });
                } else {
                    await handleInteractionError(interaction, error, {
                        commandName: 'ticket_setup',
                        source: 'ticket_setup_command'
                    });
                }
            }
        }
    }
};
