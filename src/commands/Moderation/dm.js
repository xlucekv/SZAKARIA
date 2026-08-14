import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { sanitizeMarkdown } from '../../utils/validation.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("dm")
        .setDescription("Wyślij prywatną wiadomość (DM) do użytkownika (Tylko Administracja)")
        .addUserOption(option =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik, do którego chcesz wysłać wiadomość")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("wiadomosc")
                .setDescription("Treść wiadomości do wysłania")
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("anonimowo")
                .setDescription("Wyślij wiadomość anonimowo (domyślnie: false)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`DM interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'dm'
            });
            return;
        }

        const targetUser = interaction.options.getUser("uzytkownik");
        const message = interaction.options.getString("wiadomosc");
        const anonymous = interaction.options.getBoolean("anonimowo") || false;

        try {
            if (message.length > 2000) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Wiadomość nie może przekraczać 2000 znaków.' 
                });
            }

            if (targetUser.bot) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Nie możesz wysyłać prywatnych wiadomości do botów.' 
                });
            }

            const sanitized = sanitizeMarkdown(message);
            const dmChannel = await targetUser.createDM();
            
            await dmChannel.send({
                embeds: [
                    successEmbed(
                        anonymous ? "Wiadomość od Administracji" : `Wiadomość od ${interaction.user.tag}`,
                        `> \`💬\` | ${sanitized}`
                    ).setFooter({
                        text: `Nie możesz odpowiedzieć na tę wiadomość. | ID Logu: ${interaction.id}`
                    })
                ]
            });

            await logEvent({
                client: interaction.client,
                guild: interaction.guild,
                event: {
                    action: "DM Sent",
                    target: `${targetUser.tag} (${targetUser.id})`,
                    executor: `${interaction.user.tag} (${interaction.user.id})`,
                    reason: `Anonimowo: ${anonymous ? 'Tak' : 'Nie'}`,
                    metadata: {
                        userId: targetUser.id,
                        moderatorId: interaction.user.id,
                        anonymous,
                        messageLength: sanitized.length
                    }
                }
            });

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    successEmbed(
                        "Wysłano wiadomość PW",
                        `> \`📬\` | **Użytkownik:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                        `> \`🕵️\` | **Anonimowo:** ${anonymous ? 'Tak' : 'Nie'}\n` +
                        `> \`✅\` | Wiadomość została pomyślnie dostarczona.`
                    ),
                ],
            });
        } catch (error) {
            logger.error('DM command error:', error);
            
            if (error.code === 50007) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: `Nie udało się wysłać wiadomości do ${targetUser.tag}. Użytkownik może mieć wyłączone prywatne wiadomości (DM).` 
                });
            }
            
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: `Wystąpił błąd podczas wysyłania wiadomości: ${error.message}` 
            });
        }
    }
};
