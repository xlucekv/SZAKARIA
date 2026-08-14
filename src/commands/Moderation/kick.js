import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Wyrzuć użytkownika z serwera")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik do wyrzucenia")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("powod").setDescription("Powód wyrzucenia"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const targetUser = interaction.options.getUser("uzytkownik");
        const member = interaction.options.getMember("uzytkownik");
        const reason = interaction.options.getString("powod") || "Brak podanego powodu";

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Musisz wskazać użytkownika do wyrzucenia.',
                { subtype: 'invalid_user' },
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot kick self",
                ErrorTypes.VALIDATION,
                "Nie możesz wyrzucić samego siebie.",
            );
        }

        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot kick bot",
                ErrorTypes.VALIDATION,
                "Nie możesz wyrzucić bota.",
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "Wskazany użytkownik nie znajduje się obecnie na tym serwerze.",
                { subtype: 'user_not_found' },
            );
        }

        const result = await ModerationService.kickUser({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
            reason,
        });

        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    "Wyrzucono użytkownika",
                    `> \`👢\` | **Użytkownik:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                    `> \`📝\` | **Powód:** ${reason}\n` +
                    `> \`📑\` | **Sprawa:** #${result.caseId}`
                ),
            ],
        });
    },
};
