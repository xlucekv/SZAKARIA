import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderation/moderationService.js';

const durationChoices = [
    { name: "5 minut", value: 5 },
    { name: "10 minut", value: 10 },
    { name: "30 minut", value: 30 },
    { name: "1 godzina", value: 60 },
    { name: "6 godzin", value: 360 },
    { name: "1 dzień", value: 1440 },
    { name: "1 tydzień", value: 10080 },
];

export default {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Nałóż przerwę (timeout) użytkownikowi na określony czas.")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik, który ma otrzymać przerwę")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("czas")
                .setDescription("Czas trwania przerwy")
                .setRequired(true)
                .addChoices(...durationChoices),
        )
        .addStringOption((option) =>
            option
                .setName("powod")
                .setDescription("Powód nałożenia przerwy"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Timeout interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'timeout',
            });
            return;
        }

        const targetUser = interaction.options.getUser("uzytkownik");
        const member = interaction.options.getMember("uzytkownik");
        const durationMinutes = interaction.options.getInteger("czas");
        const reason = interaction.options.getString("powod") || "Brak podanego powodu";

        if (!targetUser) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Musisz wskazać użytkownika, któremu chcesz nałożyć przerwę.',
                { subtype: 'invalid_user' },
            );
        }

        if (targetUser.id === interaction.user.id) {
            throw new TitanBotError(
                "Cannot timeout self",
                ErrorTypes.VALIDATION,
                "Nie możesz nałożyć przerwy samemu sobie.",
            );
        }
        if (targetUser.id === client.user.id) {
            throw new TitanBotError(
                "Cannot timeout bot",
                ErrorTypes.VALIDATION,
                "Nie możesz nałożyć przerwy botowi.",
            );
        }
        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "Wskazany użytkownik nie znajduje się obecnie na tym serwerze.",
            );
        }

        const durationMs = durationMinutes * 60 * 1000;
        const result = await ModerationService.timeoutUser({
            guild: interaction.guild,
            member,
            moderator: interaction.member,
            durationMs,
            reason,
        });

        const durationDisplay =
            durationChoices.find((c) => c.value === durationMinutes)
                ?.name || `${durationMinutes} min`;

        const description = `> \`👤\` | **Użytkownik:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                            `> \`⏱️\` | **Czas trwania:** ${durationDisplay}\n` +
                            `> \`📝\` | **Powód:** ${reason}\n` +
                            `> \`🆔\` | **Sprawa:** #${result.caseId}`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Przerwa Nałożona",
                    description,
                ),
            ],
        });
    },
};
