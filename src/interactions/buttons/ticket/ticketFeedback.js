import { MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { closeTicket } from '../../../services/ticket.js';

export const data = {
    name: 'ticket_close_request',
    customId: 'ticket_close_request',
};

export async function execute(interaction, client, args) {
    try {
        const PERM_TICKET_ROLE_ID = '1259904096689979505';
        const member = interaction.member;

        // 1. Sprawdzamy, czy użytkownik posiada rolę "perm ticket"
        const hasPermTicketRole = member?.roles?.cache?.has(PERM_TICKET_ROLE_ID);

        if (!hasPermTicketRole) {
            return await interaction.reply({
                content: '> `❌` | **Brak uprawnień!** Tylko osoby z rangą **perm ticket** mogą zamykać zgłoszenia.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // 2. Jeśli ma uprawnienia, wyświetlamy komunikat o zamykaniu
        await interaction.reply({
            content: 'Zgloszenie zostanie zamkniete za 3 sekundy...'
        });

        // 3. Czekamy 3 sekundy i wywołujemy zamknięcie ticketa
        setTimeout(async () => {
            try {
                const reason = "Zamknięto przyciskiem przez uprawnionego użytkownika.";
                await closeTicket(interaction.channel, interaction.user, reason);

                logger.info('Ticket closed successfully via button after countdown', {
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    channelId: interaction.channel.id,
                    channelName: interaction.channel.name,
                    guildId: interaction.guildId
                });
            } catch (err) {
                logger.error('Błąd w timeout podczas zamykania ticketa:', err);
            }
        }, 3000);

    } catch (error) {
        logger.error('Błąd podczas obsługi przycisku zamykania ticketu:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '> `❌` | Wystąpił błąd podczas zamykania zgłoszenia.',
                flags: [MessageFlags.Ephemeral]
            }).catch(() => {});
        }
    }
}

export default {
    name: 'ticket_close_request',
    customId: 'ticket_close_request',
    data,
    execute
};
