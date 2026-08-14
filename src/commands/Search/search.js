import { SlashCommandBuilder } from 'discord.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

import searchDefine from './modules/search_define.js';
import searchGoogle from './modules/search_google.js';
import searchUrban from './modules/search_urban.js';

export default {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Przeszukuj sieć oraz słowniki')
        .addSubcommand(subcommand =>
            subcommand
                .setName('define')
                .setDescription('Wyszukaj definicję słowa')
                .addStringOption(option =>
                    option.setName('slowo')
                        .setDescription('Słowo do wyszukania')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('google')
                .setDescription('Wyszukaj w Google')
                .addStringOption(option =>
                    option.setName('zapytanie')
                        .setDescription('Co chcesz wyszukać?')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('urban')
                .setDescription('Wyszukaj definicję w Urban Dictionary')
                .addStringOption(option =>
                    option.setName('haslo')
                        .setDescription('Hasło do wyszukania w Urban Dictionary')
                        .setRequired(true))
        ),

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'define':
                return await searchDefine.execute(interaction, config, client);
            case 'google':
                return await searchGoogle.execute(interaction, config, client);
            case 'urban':
                return await searchUrban.execute(interaction, config, client);
            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nieznana podkomenda.' });
        }
    }
};
