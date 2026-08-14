import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("shorten")
        .setDescription("Skróć adres URL za pomocą serwisu is.gd")
        .addStringOption(option =>
            option
                .setName("url")
                .setDescription("Adres URL do skrócenia")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("custom")
                .setDescription("Niestandardowa końcówka URL (opcjonalnie)")
                .setRequired(false)
        )
        .setDMPermission(false),
    category: "Tools",

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, {
            flags: MessageFlags.Ephemeral
        });
        if (!deferSuccess) {
            logger.warn(`Shorten interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'shorten'
            });
            return;
        }

        const url = interaction.options.getString("url");
        const custom = interaction.options.getString("custom");

        try {
            new URL(url);
        } catch (e) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Nieprawidłowy format URL. Pamiętaj o uwzględnieniu http:// lub https://',
            });
        }

        if (custom && !/^[a-zA-Z0-9_-]+$/.test(custom)) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Niestandardowy URL może zawierać tylko litery, cyfry, podkreślenia i myślniki.',
            });
        }

        let apiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;
        if (custom) {
            apiUrl += `&shorturl=${encodeURIComponent(custom)}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response;
        try {
            response = await fetch(apiUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'TitanBot URL Shortener/1.0'
                }
            });
        } catch (networkError) {
            const message = networkError?.name === 'AbortError'
                ? 'Przekroczono czas oczekiwania na odpowiedź serwisu skracającego. Spróbuj ponownie za chwilę.'
                : 'Nie można w tej chwili połączyć się z serwisem skracającym URL. Spróbuj ponownie później.';
            return replyUserError(interaction, {
                type: ErrorTypes.NETWORK,
                message,
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Serwis skracający zwrócił kod HTTP ${response.status}. Spróbuj ponownie później.`,
            });
        }

        const shortUrl = await response.text();

        try {
            new URL(shortUrl);
        } catch (e) {
            if (shortUrl.includes("already exists")) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Ta niestandardowa końcówka URL jest już zajęta. Spróbuj innej.',
                });
            } else if (shortUrl.includes("invalid")) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Nieprawidłowy adres URL. Pamiętaj o uwzględnieniu http:// lub https://',
                });
            }
            return replyUserError(interaction, {
                type: ErrorTypes.UNKNOWN,
                message: `Skracanie adresu URL nie powiodło się: ${shortUrl}`,
            });
        }

        const embed = successEmbed('URL Skrócony', `Oto Twój skrócony adres URL: ${shortUrl}`);
        embed.setColor(getColor('success'));
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
        });
    },
};
