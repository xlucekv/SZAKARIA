import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import dashboard from './modules/logging_dashboard.js';
import channel from './modules/logging_channel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('logging')
        .setDescription('Zarządzaj logowaniem na serwerze — kanały, filtry i kategorie zdarzeń.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('dashboard')
                .setDescription('Otwórz panel logowania — ustaw kanały, filtry i przełączaj kategorie.')
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('channel')
                .setDescription('Szybko ustaw kanał logów bez otwierania panelu.')
                .addStringOption((option) =>
                    option
                        .setName('destination')
                        .setDescription('Który typ logów chcesz skonfigurować.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Audit (moderacja, wiadomości, członkowie…)', value: 'audit' },
                            { name: 'Applications (podania)', value: 'applications' },
                            { name: 'Reports (zgłoszenia)', value: 'reports' },
                        )
                )
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('Kanał tekstowy dla logów.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('disable')
                        .setDescription('Ustaw na True, aby wyczyścić ten kanał logów.')
                        .setRequired(false)
                )
        ),
    category: 'Logging',

    async execute(interaction, config, client) {
        try {
            const hasPermission = await checkUserPermissions(
                interaction,
                PermissionFlagsBits.ManageGuild,
                'Potrzebujesz uprawnienia **Zarządzanie Serwerem**, aby użyć tej komendy.'
            );
            if (!hasPermission) return;

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'dashboard') {
                return await dashboard.execute(interaction, config, client);
            }

            if (subcommand === 'channel') {
                return await channel.execute(interaction, config, client);
            }

            await replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Ta podkomenda nie została rozpoznana.',
            });
        } catch (error) {
            logger.error('Błąd w komendzie logging:', error);
            await replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: 'Wystąpił nieoczekiwany błąd podczas wykonywania tej komendy.',
            }).catch(() => {});
        }
    },
};
