import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/leveling/leveling.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import levelDashboard from './modules/level_dashboard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Zarządzaj systemem poziomów')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Skonfiguruj system poziomów — to także go włącza')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Kanał, na którym będą wysyłane powiadomienia o awansie')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_min')
                        .setDescription('Minimalna liczba XP za wiadomość (domyślnie: 15)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_max')
                        .setDescription('Maksymalna liczba XP za wiadomość (domyślnie: 25)')
                        .setMinValue(1)
                        .setMaxValue(500)
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('message')
                        .setDescription(
                            'Wiadomość awansu. Użyj {user} i {level} jako zmiennych (domyślna w użyciu)',
                        )
                        .setMaxLength(500)
                        .setRequired(false),
                )
                .addIntegerOption((option) =>
                    option
                        .setName('xp_cooldown')
                        .setDescription('Czas w sekundach między przyznaniem XP temu samemu użytkownikowi (domyślnie: 60)')
                        .setMinValue(0)
                        .setMaxValue(3600)
                        .setRequired(false),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Otwórz interaktywny panel konfiguracji poziomów'),
        ),
    category: 'Leveling',

    async execute(interaction, config, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral,
        });
        if (!deferred) return;

        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Potrzebujesz uprawnienia **Zarządzanie Serwerem**, aby użyć tej komendy.' });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'dashboard') {
            return levelDashboard.execute(interaction, config, client);
        }

        if (subcommand === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const xpMin = interaction.options.getInteger('xp_min') ?? 15;
            const xpMax = interaction.options.getInteger('xp_max') ?? 25;
            const message =
                interaction.options.getString('message') ??
                '{user} awansował na poziom {level}!';
            const xpCooldown = interaction.options.getInteger('xp_cooldown') ?? 60;

            if (xpMin > xpMax) {
                return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: `Minimalna ilość XP (**${xpMin}**) nie może być większa niż maksymalna ilość XP (**${xpMax}**).` });
            }

            if (!botHasPermission(channel, ['SendMessages', 'EmbedLinks'])) {
                throw new TitanBotError(
                    'Bot missing permissions in the specified channel',
                    ErrorTypes.PERMISSION,
                    `Potrzebuję uprawnień **Wyysłanie wiadomości** oraz **Osadzanie linków** na kanale ${channel}, aby wysyłać powiadomienia o awansach.`,
                );
            }

            const existingConfig = await getLevelingConfig(client, interaction.guildId);

            if (existingConfig.configured) {
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `System poziomów jest już skonfigurowany na tym serwerze (powiadomienia trafiają na <#${existingConfig.levelUpChannel}>).\n\nUżyj komendy \`/level dashboard\`, aby dostosować ustawienia.` });
            }

            const newConfig = {
                ...existingConfig,
                configured: true,
                enabled: true,
                levelUpChannel: channel.id,
                xpRange: { min: xpMin, max: xpMax },
                xpCooldown: xpCooldown,
                levelUpMessage: message,
                announceLevelUp: true,
            };

            await saveLevelingConfig(client, interaction.guildId, newConfig);

            logger.info(`Skonfigurowano system poziomów na serwerze ${interaction.guildId}`, {
                channelId: channel.id,
                xpMin,
                xpMax,
                xpCooldown,
                userId: interaction.user.id,
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: 'Skonfigurowano system poziomów',
                        description:
                            `System poziomów został pomyślnie **włączony** i jest gotowy do działania.\n\n` +
                            `**Kanał powiadomień:** ${channel}\n` +
                            `**XP za wiadomość:** ${xpMin} – ${xpMax}\n` +
                            `**Przerwa (Cooldown):** ${xpCooldown}s\n` +
                            `**Wiadomość awansu:** \`${message}\`\n\n` +
                            `Użyj \`/level dashboard\`, aby w każdej chwili zmienić te ustawienia.`,
                        color: 'success',
                    }),
                ],
            });
        }
    },
};
