import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Zbanuj użytkownika na serwerze")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik do zbanowania")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option.setName("powod").setDescription("Powód bana"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const user = interaction.options.getUser("uzytkownik");
        const reason = interaction.options.getString("powod") || "Brak podanego powodu";

        if (!user) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Musisz wskazać użytkownika do zbanowania.',
                { subtype: 'invalid_user' },
            );
        }

        if (user.id === interaction.user.id) {
            throw new TitanBotError(
                'Cannot ban self',
                ErrorTypes.VALIDATION,
                'Nie możesz zbanować samego siebie.',
            );
        }
        if (user.id === client.user.id) {
            throw new TitanBotError(
                'Cannot ban bot',
                ErrorTypes.VALIDATION,
                'Nie możesz zbanować bota.',
            );
        }

        const result = await ModerationService.banUser({
            guild: interaction.guild,
            user,
            moderator: interaction.member,
            reason,
        });

        await InteractionHelper.universalReply(interaction, {
            embeds: [
                successEmbed(
                    `Zbanowano użytkownika`,
                    `> \`🚫\` | **Użytkownik:** ${user.tag} (\`${user.id}\`)\n` +
                    `> \`📝\` | **Powód:** ${reason}\n` +
                    `> \`📑\` | **Sprawa:** #${result.caseId}`
                ),
            ],
        });
    },
};
