import { createEmbed } from '../../../utils/embeds.js';
import { getGuildConfig } from '../../../services/config/guildConfig.js';
import { logEvent, EVENT_TYPES, resolveLogChannel } from '../../../services/loggingService.js';
import { formatLogLine, resolveUserAuthor } from '../../../utils/logging/logEmbeds.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export default {
    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferSuccess) {
            logger.warn('Report interaction defer failed', { userId: interaction.user.id, guildId: interaction.guildId });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const guildId = interaction.guildId;

        const guildConfig = await getGuildConfig(client, guildId);
        const reportChannelId = resolveLogChannel(guildConfig, 'reports');

        if (!reportChannelId) {
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Kanał do zgłoszeń nie został skonfigurowany. Poproś moderatora o użycie `/logging dashboard` lub `/logging channel`.' });
        }

        const ownerMention = interaction.guild.ownerId
            ? `<@${interaction.guild.ownerId}> Nowe zgłoszenie!`
            : 'Nowe zgłoszenie!';

        await logEvent({
            client,
            guildId,
            eventType: EVENT_TYPES.REPORT_FILE,
            content: ownerMention,
            data: {
                title: 'Zgłoszenie Użytkownika',
                lines: [
                    formatLogLine('Zgłoszony użytkownik', `${targetUser.tag} (\`${targetUser.id}\`)`),
                    formatLogLine('Zgłaszający', `${interaction.user.tag} (\`${interaction.user.id}\`)`),
                    formatLogLine('Kanał', interaction.channel.toString()),
                ],
                blockFields: [{ name: 'Powód', value: reason }],
                author: await resolveUserAuthor(client, targetUser.id),
                thumbnail: targetUser.displayAvatarURL(),
            },
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [createEmbed({
                title: 'Zgłoszenie wysłane',
                description: `Twoje zgłoszenie dotyczące użytkownika **${targetUser.tag}** zostało pomyślnie wysłane do zespołu moderacji. Dziękujemy!`,
            })],
        });

        logger.info('Report submitted', {
            userId: interaction.user.id,
            reportedUserId: targetUser.id,
            guildId,
            reasonLength: reason.length,
        });
    },
};
