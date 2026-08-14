import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("masskick")
        .setDescription("Wyrzuć wielu użytkowników z serwera jednocześnie")
        .addStringOption(option =>
            option
                .setName("uzytkownicy")
                .setDescription("Identyfikatory ID lub wzmianki użytkowników (rozdzielone spacjami lub przecinkami)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("powod")
                .setDescription("Powód masowego wyrzucenia")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    category: "moderation",
    abuseProtection: { maxAttempts: 3, windowMs: 60_000 },

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Masskick interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'masskick'
            });
            return;
        }

        const usersInput = interaction.options.getString("uzytkownicy");
        const reason = interaction.options.getString("powod") || "Masowe wyrzucenie - Brak podanego powodu";

        try {
            const userIds = usersInput
                .replace(/<@!?(\d+)>/g, '$1')
                .split(/[\s,]+/)
                .filter(id => id && /^\d+$/.test(id))
                .slice(0, 20);

            if (userIds.length === 0) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.VALIDATION, 
                    message: 'Podaj prawidłowe ID użytkowników lub wzmianki. Maksymalnie 20 osób naraz.' 
                });
            }

            if (userIds.includes(interaction.user.id)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Nie możesz uwzględnić samego siebie w masowym wyrzuceniu.' 
                });
            }

            if (userIds.includes(client.user.id)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Nie możesz uwzględnić bota w masowym wyrzuceniu.' 
                });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const userId of userIds) {
                try {
                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    
                    if (!member) {
                        results.failed.push({ userId, reason: "Użytkownik nie znajduje się na serwerze" });
                        continue;
                    }

                    const modCheck = ModerationService.validateHierarchy(interaction.member, member, 'kick');
                    if (!modCheck.valid) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'kick'),
                        });
                        continue;
                    }

                    const botCheck = ModerationService.validateBotHierarchy(member, 'kick');
                    if (!botCheck.valid) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'kick', 'bot'),
                        });
                        continue;
                    }

                    if (!member.kickable) {
                        results.skipped.push({
                            user: member.user.tag,
                            userId,
                            reason: 'Użytkownik ma uprawnienia Administratora, zarządzaną rolę lub bot nie posiada uprawnień do wyrzucania',
                        });
                        continue;
                    }

                    await member.kick(reason);

                    results.successful.push({
                        user: member.user.tag,
                        userId
                    });

                    await logModerationAction({
                        client,
                        guild: interaction.guild,
                        event: {
                            action: "Member Kicked",
                            target: `${member.user.tag} (${member.user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `${reason} (Mass Kick)`,
                            metadata: {
                                userId: member.user.id,
                                moderatorId: interaction.user.id,
                                massKick: true
                            }
                        }
                    });

                } catch (error) {
                    logger.error(`Failed to kick user ${userId}:`, error);
                    const failReason = error instanceof TitanBotError
                        ? (error.userMessage || error.message)
                        : (error.message || "Nieznany błąd");
                    results.failed.push({ 
                        userId, 
                        reason: failReason,
                    });
                }
            }

            let description = `> \`📝\` | **Powód:** ${reason}\n\n`;
            
            if (results.successful.length > 0) {
                description += `> \`✅\` | **Wyrzucono pomyślnie (${results.successful.length}):**\n`;
                results.successful.forEach(result => {
                    description += `• ${result.user} (\`${result.userId}\`)\n`;
                });
                description += '\n';
            }

            if (results.skipped.length > 0) {
                description += `> \`⚠️\` | **Pominięto (${results.skipped.length}):**\n`;
                results.skipped.forEach(result => {
                    description += `• ${result.user} — ${result.reason}\n`;
                });
                description += '\n';
            }

            if (results.failed.length > 0) {
                description += `> \`❌\` | **Błędy (${results.failed.length}):**\n`;
                results.failed.forEach(result => {
                    description += `• \`${result.userId}\` — ${result.reason}\n`;
                });
            }

            const embedBuilder = results.successful.length > 0 ? successEmbed : warningEmbed;
            
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    embedBuilder(
                        "Masowe Wyrzucenie Zakończone",
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Error in masskick command:", error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'Wystąpił błąd podczas wykonywania masowego wyrzucenia. Spróbuj ponownie później.' 
            });
        }
    }
};
