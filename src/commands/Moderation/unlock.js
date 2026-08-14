import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription(
            "Odblokowuje obecny kanał (pozwala roli @everyone ponownie wysyłać wiadomości).",
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unlock interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unlock'
            });
            return;
        }

        const channel = interaction.channel;
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentPermissions = channel.permissionsFor(everyoneRole);
            if (
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    true ||
                currentPermissions.has(PermissionFlagsBits.SendMessages) ===
                    null
            ) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `Kanał ${channel} nie jest zablokowany (wszyscy mogą już wysyłać wiadomości).` 
                });
            }

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: true },
                {
                    type: 0,
                    reason: `Kanał odblokowany przez ${interaction.user.tag}`,
                },
            );

            await logEvent({
                client,
                guild: interaction.guild,
                event: {
                    action: "Channel Unlocked",
                    target: channel.toString(),
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    metadata: {
                        channelId: channel.id,
                        category: channel.parent?.name || 'None'
                    }
                }
            });

            const description = `> \`🔓\` | **Kanał został odblokowany:** ${channel}\n` +
                                `> \`💬\` | **Informacja:** Każdy może ponownie pisać na tym kanale.`;

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Kanał Odblokowany",
                        description,
                    ),
                ],
            });
        } catch (error) {
            logger.error('Unlock command error:', error);
            await replyUserError(interaction, { 
                type: ErrorTypes.PERMISSION, 
                message: 'Wystąpił błąd podczas próby odblokowania kanału. Sprawdź uprawnienia bota (wymagane: \'Zarządzanie kanałami\').' 
            });
        }
    }
};
