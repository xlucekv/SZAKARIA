import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

import report from './modules/report.js';
import reportSetchannel from './modules/report_setchannel.js';

export default {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Zgłoś użytkownika administracji serwera lub skonfiguruj kanał zgłoszeń.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('file')
                .setDescription('Zgłoś użytkownika zespołowi moderacji serwera.')
                .addUserOption(option =>
                    option
                        .setName('uzytkownik')
                        .setDescription('Użytkownik, którego chcesz zgłosić.')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option
                        .setName('powod')
                        .setDescription('Powód zgłoszenia (opisz go szczegółowo).')
                        .setRequired(true)
                        .setMaxLength(500),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('setchannel')
                .setDescription('Ustaw kanał, na który będą wysyłane zgłoszenia użytkowników. (Wymagane: Zarządzanie serwerem)')
                .addChannelOption(option =>
                    option
                        .setName('kanal')
                        .setDescription('Kanał tekstowy, na który mają trafiać zgłoszenia.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        ),
    category: 'Utility',

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'file') {
            return await report.execute(interaction, config, client);
        }

        if (subcommand === 'setchannel') {
            return await reportSetchannel.execute(interaction, config, client);
        }

        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nieznana podkomenda.' });
    },
};
