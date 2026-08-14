import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    endGiveaway as endGiveawayService,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("gend")
        .setDescription("Kończy aktywny konkurs natychmiast i wybiera zwycięzcę/ów.")
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("ID wiadomości konkursowej do zakończenia.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    category: 'Utility',

    async execute(interaction, guildConfig, client) {
        // Bezpieczne odroczenie odpowiedzi na wypadek dłuższej operacji bazy danych / sieci
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

        if (!interaction.inGuild()) {
            throw new TitanBotError(
                'Giveaway command used outside guild',
                ErrorTypes.VALIDATION,
                'Ta komenda może być używana tylko na serwerze.',
                { userId: interaction.user.id }
            );
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new TitanBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "Nie masz uprawnień 'Zarządzanie serwerem', aby zakończyć konkurs.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Rozpoczęcie ręcznego kończenia konkursu przez ${interaction.user.tag} na serwerze ${interaction.guildId}`);

        const messageId = interaction.options.getString("messageid");

        if (!messageId || !/^\d+$/.test(messageId)) {
            throw new TitanBotError(
                'Invalid message ID format',
                ErrorTypes.VALIDATION,
                'Podaj prawidłowe ID wiadomości.',
                { providedId: messageId }
            );
        }

        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Nie znaleziono konkursu o podanym ID wiadomości w bazie danych.",
                { messageId, guildId: interaction.guildId }
            );
        }

        const endResult = await endGiveawayService(
            interaction.client,
            giveaway,
            interaction.guildId,
            interaction.user.id
        );

        const updatedGiveaway = endResult.giveaway;
        const winners = endResult.winners;

        const channel = await interaction.client.channels.fetch(
            updatedGiveaway.channelId,
        ).catch(err => {
            logger.warn(`Nie udało się pobrać kanału ${updatedGiveaway.channelId}:`, err.message);
            return null;
        });

        if (!channel || !channel.isTextBased()) {
            throw new TitanBotError(
                `Channel not found: ${updatedGiveaway.channelId}`,
                ErrorTypes.VALIDATION,
                "Nie można odnaleźć kanału, na którym odbywał się konkurs. Stan konkursu został zaktualizowany.",
                { channelId: updatedGiveaway.channelId, messageId }
            );
        }

        const message = await channel.messages
            .fetch(messageId)
            .catch(err => {
                logger.warn(`Nie udało się pobrać wiadomości ${messageId}:`, err.message);
                return null;
            });

        if (!message) {
            throw new TitanBotError(
                `Message not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Nie można odnaleźć wiadomości konkursu. Stan konkursu został zaktualizowany.",
                { messageId, channelId: updatedGiveaway.channelId }
            );
        }

        await saveGiveaway(
            interaction.client,
            interaction.guildId,
            updatedGiveaway,
        );

        const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
        const newRow = createGiveawayButtons(true);

        await message.edit({
            content: "🎉 **KONKURS ZAKOŃCZONY** 🎉",
            embeds: [newEmbed],
            components: [newRow],
        });

        if (winners.length > 0) {
            const winnerMentions = winners
                .map((id) => `<@${id}>`)
                .join(", ");
            const winnerPingMsg = await channel.send({
                content: `🎉 GRATULACJE ${winnerMentions}! Wygraliście konkurs na **${updatedGiveaway.prize}**! Skontaktujcie się z hostem <@${updatedGiveaway.hostId}>, aby odebrać nagrodę.`,
            });
            updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
            await saveGiveaway(interaction.client, interaction.guildId, updatedGiveaway);

            logger.info(`Konkurs zakończony z liczbą zwycięzców (${winners.length}): ${messageId}`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                    data: {
                        description: `Konkurs zakończony z ${winners.length} zwycięzcą/ami`,
                        channelId: channel.id,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: 'Nagroda',
                                value: updatedGiveaway.prize || 'Tajemnicza nagroda!',
                                inline: true
                            },
                            {
                                name: 'Zwycięzcy',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: 'Uczestnicy',
                                value: endResult.participantCount.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Błąd podczas logowania zdarzenia zwycięzców konkursu:', logError);
            }
        } else {
            await channel.send({
                content: `Konkurs na **${updatedGiveaway.prize}** zakończył się bez prawidłowych zgłoszeń.`,
            });
            logger.info(`Konkurs zakończony bez zwycięzców: ${messageId}`);
        }

        logger.info(`Konkurs pomyślnie zakończony przez ${interaction.user.tag}: ${messageId}`);

        return InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    "Konkurs zakończony ✅",
                    `Pomyślnie zakończono konkurs dla **${updatedGiveaway.prize}** na kanale ${channel}. Wybrano ${winners.length} zwycięzcę/ów spośród ${endResult.participantCount} uczestników.`
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
