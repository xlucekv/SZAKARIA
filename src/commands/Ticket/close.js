import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { closeTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("close")
        .setDescription("Zamyka aktualne zgłoszenie.")
        .setDMPermission(false)
        .addStringOption((option) =>
            option
                .setName("powod")
                .setDescription("Powód zamknięcia zgłoszenia.")
                .setRequired(false),
        ),

    async execute(interaction, guildConfig, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferred) {
            return;
        }

        const permissionContext = await getTicketPermissionContext({ client, interaction });
        if (!permissionContext.ticketData) {
            return await replyUserError(interaction, { 
                type: ErrorTypes.VALIDATION, 
                message: '> `❌` | Ta komenda może być używana tylko na aktywnym kanale zgłoszenia.' 
            });
        }

        // Sprawdzamy, czy użytkownik posiada rolę "perm ticket" (ID: 1259904096689979505)
        const PERM_TICKET_ROLE_ID = '1259904096689979505';
        const member = interaction.member;
        const hasPermTicketRole = member?.roles?.cache?.has(PERM_TICKET_ROLE_ID);

        if (!hasPermTicketRole) {
            return await replyUserError(interaction, { 
                type: ErrorTypes.PERMISSION, 
                message: '> `❌` | Tylko osoby z rangą **perm ticket** mogą zamykać zgłoszenia.' 
            });
        }

        const reason =
            interaction.options?.getString("powod") ||
            "Zamknięto przez komendę bez podania powodu.";

        await closeTicket(interaction.channel, interaction.user, reason);

        await InteractionHelper.safeEditReply(interaction, {
            content: `> \`🔒\` | Zgłoszenie zostało pomyślnie zamknięte.\n> \`📝\` | **Powód:** ${reason}`
        });

        logger.info('Ticket closed successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            reason: reason,
            commandName: 'close'
        });
    },
};
