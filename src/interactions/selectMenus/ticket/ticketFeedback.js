import { EmbedBuilder } from 'discord.js';
import { getTicketData, saveTicketData } from '../../../utils/database.js';
import { logger } from '../../../utils/logger.js';
import { getColor } from '../../../config/bot.js';
import { logTicketFeedback } from '../../../utils/ticket/ticketLogging.js';

export const data = {
    name: 'ticket_feedback',
};

const STAR_LABELS = {
    '1': '⭐ 1 — Słabo',
    '2': '⭐ 2 — Poniżej oczekiwań',
    '3': '⭐ 3 — Średnio',
    '4': '⭐ 4 — Dobrze',
    '5': '⭐ 5 — Wyśmienicie',
};

export async function execute(interaction, client, args) {
        
    const [guildId, channelId] = args;

    if (!guildId || !channelId) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('⚠️ Nieprawidłowy link opinii')
                    .setDescription('Ten link opinii wydaje się być uszkodzony lub niepełny.')
                    .setColor(getColor('error')),
            ],
            components: [],
        });
        return;
    }

    let ticketData;
    try {
        ticketData = await getTicketData(guildId, channelId);
    } catch (err) {
        logger.warn('ticketFeedback: failed to load ticket data', { guildId, channelId, error: err.message });
    }

    if (!ticketData) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('⚠️ Nie znaleziono zgłoszenia')
                    .setDescription('Nie udało się znaleźć zgłoszenia powiązanego z tą ankietą.')
                    .setColor(getColor('error')),
            ],
            components: [],
        });
        return;
    }

    if (interaction.user.id !== ticketData.userId) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('❌ Brak uprawnień')
                    .setDescription('Tylko osoba, która utworzyła zgłoszenie, może przesłać do niego opinię.')
                    .setColor(getColor('error')),
            ],
            ephemeral: true,
        });
        return;
    }

    if (ticketData.feedback?.rating) {
        await interaction.update({
            embeds: [
                new EmbedBuilder()
                    .setTitle('✅ Opinia została już wysłana')
                    .setDescription(`To zgłoszenie zostało już przez Ciebie ocenione na **${STAR_LABELS[String(ticketData.feedback.rating)]}**.\nDziękujemy za Twoją opinię!`)
                    .setColor(getColor('success')),
            ],
            components: [],
        });
        return;
    }

    const rating = parseInt(interaction.values[0], 10);
    const ratingLabel = STAR_LABELS[String(rating)] ?? `${rating} gwiazdek`;

    try {
        ticketData.feedback = {
            rating,
            submittedAt: new Date().toISOString(),
        };
        await saveTicketData(guildId, channelId, ticketData);
    } catch (err) {
        logger.error('ticketFeedback: failed to save feedback', { guildId, channelId, rating, error: err.message });
    }

    try {
        await logTicketFeedback({
            client: interaction.client,
            guildId,
            ticketNumber: ticketData.id,
            ticketChannelId: channelId,
            userId: interaction.user.id,
            rating,
        });
    } catch (err) {
        logger.warn('ticketFeedback: failed to send log', { guildId, channelId, error: err.message });
    }

    const thankYouEmbed = new EmbedBuilder()
        .setTitle('✅ Dziękujemy za opinię!')
        .setDescription(`Oceniono jakość wsparcia na **${ratingLabel}**.\n\nTwoja opinia została zapisana i pomaga nam się rozwijać!`)
        .setColor(getColor('success'))
        .setFooter({ text: 'SZAK Tickets • Support System' })
        .setTimestamp();

    await interaction.update({
        embeds: [thankYouEmbed],
        components: [],
    });

    logger.info('Ticket feedback submitted', {
        guildId,
        channelId,
        userId: interaction.user.id,
        rating,
    });
}

export default {
    data,
    name: 'ticket_feedback',
    execute
};
