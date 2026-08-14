import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logModerationAction } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { ModerationService } from '../../services/moderation/moderationService.js';
import { TitanBotError, replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("massban")
        .setDescription("Zbanuj wielu użytkowników jednocześnie")
        .addStringOption(option =>
            option
                .setName("uzytkownicy")
                .setDescription("Identyfikatory ID lub wzmianki użytkowników (rozdzielone spacjami lub przecinkami)")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("powod")
                .setDescription("Powód masowego bana")
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option
                .setName("usun_dni")
                .setDescription("Liczba dni wiadomości do usunięcia (0-7)")
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    category: "moderation",
    abuseProtection: { maxAttempts: 3, windowMs: 60_000 },

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Massban interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'massban'
            });
            return;
        }

        const usersInput = interaction.options.getString("uzytkownicy");
        const reason = interaction.options.getString("powod") || "Masowy ban - Brak podanego powodu";
        const deleteDays = interaction.options.getInteger("usun_dni") || 0;

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
                    message: 'Nie możesz uwzględnić samego siebie w masowym banie.' 
                });
            }

            if (userIds.includes(client.user.id)) {
                return await replyUserError(interaction, { 
                    type: ErrorTypes.UNKNOWN, 
                    message: 'Nie możesz uwzględnić bota w masowym banie.' 
                });
            }

            const results = {
                successful: [],
                failed: [],
                skipped: []
            };

            for (const userId of userIds) {
                try {
                    const user = await client.users.fetch(userId).catch(() => null);
                    
                    if (!user) {
                        results.failed.push({ userId, reason: "Nie znaleziono użytkownika" });
                        continue;
                    }

                    const member = await interaction.guild.members.fetch(userId).catch(() => null);
                    
                    if (member) {
                        const modCheck = ModerationService.validateHierarchy(interaction.member, member, 'ban');
                        if (!modCheck.valid) {
                            results.skipped.push({
                                user: user.tag,
                                userId,
                                reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'ban'),
                            });
                            continue;
                        }

                        const botCheck = ModerationService.validateBotHierarchy(member, 'ban');
                        if (!botCheck.valid) {
                            results.skipped.push({
                                user: user.tag,
                                userId,
                                reason: ModerationService.buildHierarchySkipReason(interaction.member, member, 'ban', 'bot'),
                            });
                            continue;
                        }
                    }

                    await interaction.guild.members.ban(userId, {
                        reason: reason,
                        deleteMessageSeconds: deleteDays * 24 * 60 * 60
                    });

                    results.successful.push({
                        user: user.tag,
                        userId
                    });

                    await logModerationAction({
                        client,
                        guild: interaction.guild,
                        event: {
                            action: "Member Banned",
                            target: `${user.tag} (${user.id})`,
                            executor: `${interaction.user.tag} (${interaction.user.id})`,
                            reason: `${reason} (Mass Ban)`,
                            metadata: {
                                userId: user.id,
                                moderatorId: interaction.user.id,
                                massBan: true,
                                permanent: true
                            }
                        }
                    });

                } catch (error) {
                    logger.error(`Failed to ban user ${userId}:`, error);
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
                description += `> \`✅\` | **Zbanowano pomyślnie (${results.successful.length}):**\n`;
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
                        "Masowy Ban Zakończony",
                        description
                    )
                ]
            });

        } catch (error) {
            logger.error("Error in massban command:", error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'Wystąpił błąd podczas wykonywania masowego bana. Spróbuj ponownie później.' 
            });
        }
    }
};
