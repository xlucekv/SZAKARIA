import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Udziel ostrzeżenia użytkownikowi")
        .addUserOption((o) =>
            o
                .setName("uzytkownik")
                .setRequired(true)
                .setDescription("Użytkownik, który ma otrzymać ostrzeżenie"),
        )
        .addStringOption((o) =>
            o
                .setName("powod")
                .setRequired(true)
                .setDescription("Powód udzielenia ostrzeżenia"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Warn interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'warn'
            });
            return;
        }

        const target = interaction.options.getUser("uzytkownik");
        const member = interaction.options.getMember("uzytkownik");
        const reason = interaction.options.getString("powod");
        const moderator = interaction.user;
        const guildId = interaction.guildId;

        if (!target) {
            throw new TitanBotError(
                'Missing target user',
                ErrorTypes.USER_INPUT,
                'Musisz wskazać użytkownika, któremu chcesz dać ostrzeżenie.',
                { subtype: 'invalid_user' },
            );
        }

        if (!reason) {
            throw new TitanBotError(
                'Missing warning reason',
                ErrorTypes.VALIDATION,
                'Musisz podać powód udzielenia ostrzeżenia.',
                { subtype: 'missing_required' },
            );
        }

        if (!member) {
            throw new TitanBotError(
                "Target not found",
                ErrorTypes.USER_INPUT,
                "Wskazany użytkownik nie znajduje się obecnie na tym serwerze."
            );
        }

        ModerationService.assertModerationHierarchy(interaction.member, member, 'warn');

        const { id, totalCount } = await WarningService.addWarning({
            guildId,
            userId: target.id,
            moderatorId: moderator.id,
            reason,
            timestamp: Date.now()
        });

        await logModerationAction({
            client,
            guild: interaction.guild,
            event: {
                action: "User Warned",
                target: `${target.tag} (${target.id})`,
                executor: `${moderator.tag} (${moderator.id})`,
                reason,
                metadata: {
                    userId: target.id,
                    moderatorId: moderator.id,
                    totalWarns: totalCount,
                    warningNumber: totalCount,
                    warningId: id
                }
            }
        });

        const description = `> \`⚠️\` | **Udzielono ostrzeżenia:** ${target.tag} (\`${target.id}\`)\n` +
                            `> \`📝\` | **Powód:** ${reason}\n` +
                            `> \`📊\` | **Łączna liczba ostrzeżeń:** ${totalCount}`;

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [
                successEmbed(
                    "Ostrzeżenie Udzielone",
                    description,
                ),
            ],
        });
    }
};
