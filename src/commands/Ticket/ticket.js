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
        .setDescription("Zarządza klanowym systemem zgłoszeń.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Tworzy klanowy panel zgłoszeń na wskazanym kanale.")
                .addChannelOption((option) =>
                    option
                        .setName("panel_channel")
                        .setDescription("Kanał, na którym zostanie wysłany panel.")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("panel_message")
                        .setDescription("Własna wiadomość/opis panelu (opcjonalnie).")
                        .setRequired(false)
                )
                .addRoleOption((option) =>
                    option
                        .setName("staff_role")
                        .setDescription("Rola administracji/dowództwa z dostępem do ticketów.")
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("max_tickets_per_user")
                        .setDescription("Maksymalna liczba otwartych ticketów na gracza (domyślnie: 3)")
                        .setMinValue(1)
                        .setMaxValue(10)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName("dm_on_close")
                        .setDescription("Czy wysyłać wiadomość PW po zamknięciu ticketu? (domyślnie: true)")
                        .setRequired(false)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Otwiera interaktywny panel zarządzania systemem ticketów")
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
                message: 'Brak uprawnień! Wymagane uprawnienie: `Zarządzanie kanałami`.' 
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
                    message: `Na tym serwerze istnieje już aktywny system zgłoszeń (panel w <#${existingConfig.ticketPanelChannelId}>).\n\nUżyj \`/ticket dashboard\`, aby go edytować lub usunąć.` 
                });
            }

            const panelChannel = interaction.options.getChannel("panel_channel");
            const staffRole = interaction.options.getRole("staff_role");
            const customMessage = interaction.options.getString("panel_message");
            const maxTicketsPerUser = interaction.options.getInteger("max_tickets_per_user") || 3;
            const dmOnClose = interaction.options.getBoolean("dm_on_close") !== false;

            // Idealny wygląd opisu wzorowany 1:1 na profesjonalnym układzie
            const defaultDescription = 
                'Witaj w centrum pomocy i rekrutacji **Klanu SZAK**.\n\n' +
                '• 📁 ┃ Wybierz kategorię zgłoszenia z poniższego menu.\n' +
                '• 📝 ┃ Wypełnij formularz i opisz dokładnie swoją sprawę.\n' +
                '• ⏳ ┃ Oczekuj na odpowiedź od Dowództwa lub Administracji.\n\n' +
                '*Prosimy o cierpliwość i nieotwieranie wielu ticketów bez potrzeby.*';

            const setupEmbed = createEmbed({ 
                title: "🎫 ┃ Centrum Pomocy & Rekrutacji", 
                description: customMessage || defaultDescription,
                color: '#ff9900' // Klanowy pomarańczowy akcent
            });

            // Rozwijane menu z polskimi nazwami i opisami pod spodem
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_ticket_category')
                .setPlaceholder('👉 Wybierz kategorię zgłoszenia...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Rekrutacja')
                        .setValue('rekrutacja')
                        .setDescription('Złóż podanie i dołącz w szeregi klanu SZAK.')
                        .setEmoji('📝'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Pytanie')
                        .setValue('pytanie')
                        .setDescription('Masz pytanie dotyczące klanu, gier lub serwera?')
                        .setEmoji('❓'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Nieobecność')
                        .setValue('nieobecnosc')
                        .setDescription('Zgłoś planowaną dłuższą przerwę od gry.')
                        .setEmoji('⏰'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Skarga')
                        .setValue('skarga')
                        .setDescription('Zgłoś naruszenie regulaminu lub niewłaściwe zachowanie.')
                        .setEmoji('🚨'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Współpraca')
                        .setValue('wspolpraca')
                        .setDescription('Kontakt dla innych klanów, sojuszy i propozycji.')
                        .setEmoji('🤝'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Zbiórki')
                        .setValue('zbiorki')
                        .setDescription('Sprawy związane z wkładem w klan i zbiórkami.')
                        .setEmoji('💎'),

                    new StringSelectMenuOptionBuilder()
                        .setLabel('Inne / Tickets')
                        .setValue('tickets')
                        .setDescription('Pozostałe kwestie niepasujące do powyższych kategorii.')
                        .setEmoji('🎫')
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
                    });
                }

                let successMessage = `Panel zgłoszeń został wysłany na kanał ${panelChannel}.\n\n`;
                if (staffRole) {
                    successMessage += `**Rola z dostępem:** <@&${staffRole.id}>\n`;
                }
                successMessage += `**Limit ticketów na osobę:** ${maxTicketsPerUser}`;

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Panel Zgłoszeń Skonfigurowany",
                            successMessage,
                        ),
                    ],
                });

            } catch (error) {
                logger.error('Ticket setup error', {
                    error: error.message,
                    stack: error.stack,
                    guildId: interaction.guildId,
                });
                
                await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Nie udało się wysłać panelu zgłoszeń. Sprawdź uprawnienia bota.' 
                }).catch(() => {});
            }
        }
    }
};
