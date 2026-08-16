import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { closeTicket } from '../../../services/ticket.js';

export const data = {
    customId: 'ticket_close_request',
};

export async function execute(interaction, client, args) {
    try {
        const PERM_TICKET_ROLE_ID = '1259904096689979505';
        const member = interaction.member;

        // Sprawdzamy, czy użytkownik posiada rolę "perm ticket"
        const hasPermTicketRole = member?.roles?.cache?.has(PERM_TICKET_ROLE_ID);

        if (!hasPermTicketRole) {
            return await interaction.reply({
                content: '> `❌` | Tylko osoby z rangą **perm ticket** mogą zamykać zgłoszenia.',
                flags: [MessageFlags.Ephemeral] // Widoczne tylko dla użytkownika, który kliknął
            });
        }

        // Jeśli ma uprawnienia, kontynuujemy zamykanie ticketa
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const reason = "Zamknięto przyciskiem przez uprawnionego użytkownika.";
        await closeTicket(interaction.channel, interaction.user, reason);

        await interaction.editReply({
            content: `> \`🔒\` | Zgłoszenie zostało pomyślnie zamknięte.`
        });

        logger.info('Ticket closed successfully via button', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId
        });

    } catch (error) {
        logger.error('Błąd podczas zamykania ticketu przyciskiem:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '> `❌` | Wystąpił błąd podczas zamykania zgłoszenia.',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        } else {
            await interaction.editReply({
                content: '> `❌` | Wystąpił błąd podczas zamykania zgłoszenia.'
            }).catch(() => {});
        }
    }
}

export default {
    data,
    customId: 'ticket_close_request',
    execute
};
