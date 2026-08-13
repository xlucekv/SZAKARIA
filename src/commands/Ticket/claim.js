import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getTicketPermissionContext } from '../../utils/ticket/ticketPermissions.js';
import { claimTicket } from '../../services/ticket.js';

export default {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Przejmuje otwarte zgłoszenie i przypisuje je do Ciebie.")
        .setDMPermission(false),

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

        if (!permissionContext.canManageTicket) {
            return await replyUserError(interaction, { 
                type: ErrorTypes.PERMISSION, 
                message: '> `❌` | Wymagasz uprawnienia `Zarządzanie kanałami` lub roli **Administracji**, aby przejąć zgłoszenie.' 
            });
        }

        await claimTicket(interaction.channel, interaction.user);

        await InteractionHelper.safeEditReply(interaction, {
            content: `> \`📌\` | Pomyślnie przejęto to zgłoszenie i przypisano je do ${interaction.user}.`
        });

        logger.info('Ticket claimed successfully', {
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            channelId: interaction.channel.id,
            channelName: interaction.channel.name,
            guildId: interaction.guildId,
            commandName: 'claim'
        });
    },
};
