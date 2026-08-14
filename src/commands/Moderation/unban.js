import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Cofnij bana użytkownikowi na serwerze")
        .addStringOption(option =>
            option
                .setName("uzytkownik")
                .setDescription("ID lub wzmianka użytkownika do odbanowania")
                .setRequired(true),
        )
        .addStringOption(option =>
            option.setName("powod")
                .setDescription("Powód cofnięcia bana")
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Unban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'unban',
            });
            return;
        }

        const rawTarget = interaction.options.getString("uzytkownik");
        const targetId = rawTarget.replace(/[<@!>]/g, '').trim();

        if (!/^\d{17,20}$/.test(targetId)) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: 'Podaj prawidłowe ID użytkownika lub wzmiankę.',
            });
        }

        const targetUser = await client.users.fetch(targetId).catch(() => null);
        if (!targetUser) {
            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: `Nie znaleziono użytkownika o ID \`${targetId}\`.`,
            });
        }

        const reason = interaction.options.getString("powod") || "Brak podanego powodu";

        const result = await ModerationService.unbanUser({
            guild: interaction.guild,
            user: targetUser,
            moderator: interaction.member,
            reason,
        });

        const description = `> \`👤\` | **Użytkownik:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                            `> \`📝\` | **Powód:** ${reason}\n` +
                            `> \`🆔\` | **Sprawa:** #${result.caseId}`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Ban Cofnięty",
                    description,
                ),
            ],
        });
    },
};
