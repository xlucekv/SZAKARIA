import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription("Zdejmij przerwę (timeout) użytkownikowi")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik, któremu chcesz zdjąć przerwę")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Untimeout interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'untimeout',
            });
            return;
        }

        const targetUser = interaction.options.getUser("uzytkownik");
        const member = interaction.options.getMember("uzytkownik");

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Musisz wskazać użytkownika, któremu chcesz zdjąć przerwę.',
                { subtype: 'invalid_user' },
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "Wskazany użytkownik nie znajduje się obecnie na tym serwerze.",
            );
        }

        await ModerationService.removeTimeoutUser({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
        });

        const description = `> \`🔓\` | **Zdjęto przerwę użytkownikowi:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                            `> \`💬\` | **Informacja:** Użytkownik może ponownie pisać i dołączać do kanałów głosowych.`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Przerwa Zdjęta",
                    description,
                ),
            ],
        });
    },
};
