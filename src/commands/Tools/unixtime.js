import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unixtime')
        .setDescription('Pobierz aktualny znacznik czasu Unix (timestamp)'),

    async execute(interaction) {
        await InteractionHelper.safeExecute(
            interaction,
            async () => {
                const now = new Date();
                const unixTimestamp = Math.floor(now.getTime() / 1000);

                const embed = successEmbed(
                    '⏱️ Aktualny znacznik czasu Unix',
                    `**Sekundy od epoki Uniksa:** \`${unixTimestamp}\`\n` +
                    `**Milisekundy od epoki Uniksa:** \`${now.getTime()}\`\n\n` +
                    `**Czytelne dla człowieka (UTC):** ${now.toUTCString()}\n` +
                    `**Ciąg ISO:** ${now.toISOString()}`
                );
                embed.setColor(getColor('success'));

                await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                });
            },
            'Nie udało się pobrać znacznika czasu Unix. Spróbuj ponownie.',
            {
                autoDefer: true,
                deferOptions: { flags: MessageFlags.Ephemeral }
            }
        );
    },
};
