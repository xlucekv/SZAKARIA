import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getGuildGiveaways, saveGiveaway } from '../../utils/giveaways.js';
import { 
    selectWinners,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("greroll")
        .setDescription("Losuje ponownie zwycięzcę/ów dla zakończonego konkursu.")
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("ID wiadomości zakończonego konkursu.")
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
                "Nie masz uprawnień 'Zarządzanie serwerem', aby przeprowadzić ponowne losowanie konkursu.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Rozpoczęcie ponownego losowania konkursu przez ${interaction.user.tag} na serwerze ${interaction.guildId}`);

        const messageId = interaction.options.getString("messageid");

        if (!messageId || !/^\d+$/.test(messageId)) {
            throw new TitanBotError(
                'Invalid message ID format',
                ErrorTypes.VALIDATION,
                'Podaj prawidłowe ID wiadomości.',
                { providedId: messageId }
            );
        }

        const giveaways = await getGuildGiveaways(
            interaction.client,
            interaction.guildId,
        );

        const giveaway = giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            throw new TitanBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Nie znaleziono konkursu o podanym ID wiadomości w bazie danych.",
                { messageId, guildId: interaction.guildId }
            );
        }

        if (!giveaway.isEnded && !giveaway.ended) {
            throw new TitanBotError(
                `Giveaway still active: ${messageId}`,
                ErrorTypes.VALIDATION,
                "Ten konkurs jest nadal aktywny. Użyj komendy `/gend`, aby go najpierw zakończyć.",
                { messageId, status: 'active' }
            );
        }

        const participants = giveaway.participants || [];

        if (participants.length < giveaway.winnerCount) {
            throw new TitanBotError(
                `Insufficient participants for reroll: ${participants.length} < ${giveaway.winnerCount}`,
                ErrorTypes.VALIDATION,
                "Zbyt mało zgłoszeń, aby wybrać wymaganą liczbę zwycięzców.",
                { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
            );
        }

        const newWinners = selectWinners(
            participants,
            giveaway.winnerCount,
        );

        const updatedGiveaway = {
            ...giveaway,
            winnerIds: newWinners,
            rerolledAt: new Date().toISOString(),
            rerolledBy: interaction.user.id
        };

        const channel = await interaction.client.channels.fetch(
            giveaway.channelId,
        ).catch(err => {
            logger.warn(`Nie udało się pobrać kanału ${giveaway.channelId}:`, err.message);
            return null;
        });

        if (!channel || !channel.isTextBased()) {
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            logger.warn(`Nie znaleziono kanału dla konkursu ${messageId}, ale zapisano nowych zwycięzców w bazie danych`);

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Ponowne losowanie zakończone",
                        "Nowi zwycięzcy zostali wybrani i zapisani w bazie danych. Nie odnaleziono kanału, aby wysłać ogłoszenie.",
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        const message = await channel.messages
            .fetch(messageId)
            .catch(err => {
                logger.warn(`Nie udało się pobrać wiadomości ${messageId}:`, err.message);
                return null;
            });

        if (!message) {
            await saveGiveaway(
                interaction.client,
                interaction.guildId,
                updatedGiveaway,
            );

            const winnerMentions = newWinners
                .map((id) => `<@${id}>`)
                .join(", ");

            const existingPingMsg = giveaway.winnerPingMessageId
                ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
                : null;
            
            if (existingPingMsg) {
                await existingPingMsg.edit({
                    content: `🔄 **PONOWNE LOSOWANIE KONKURSU** 🔄 Nowi zwycięzcy nagrody **${giveaway.prize}**: ${winnerMentions}!`,
                });
            } else {
                const newPingMsg = await channel.send({
                    content: `🔄 **PONOWNE LOSOWANIE KONKURSU** 🔄 Nowi zwycięzcy nagrody **${giveaway.prize}**: ${winnerMentions}!`,
                });
                updatedGiveaway.winnerPingMessageId = newPingMsg.id;
            }

            logger.info(`Konkurs wylosowany ponownie (wiadomość nie została znaleziona, ale wysłano powiadomienie): ${messageId}`);

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Wylosowano ponownie konkurs: ${giveaway.prize}`,
                        channelId: giveaway.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: 'Nagroda',
                                value: giveaway.prize || 'Tajemnicza nagroda!',
                                inline: true
                            },
                            {
                                name: 'Nowi zwycięzcy',
                                value: winnerMentions,
                                inline: false
                            },
                            {
                                name: 'Wszystkie zgłoszenia',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Błąd podczas logowania ponownego losowania konkursu:', logError);
            }

            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Losowanie zakończone",
                        `Nowi zwycięzcy zostali ogłoszeni na kanale ${channel}. (Oryginalna wiadomość nie została odnaleziona).`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        await saveGiveaway(
            interaction.client,
            interaction.guildId,
            updatedGiveaway,
        );

        const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
        const newRow = createGiveawayButtons(true);

        await message.edit({
            content: "🔄 **KONKURS WYLOSOWANY PONOWNIE** 🔄",
            embeds: [newEmbed],
            components: [newRow],
        });

        const winnerMentions = newWinners
            .map((id) => `<@${id}>`)
            .join(", ");

        const existingPingMsg = giveaway.winnerPingMessageId
            ? await channel.messages.fetch(giveaway.winnerPingMessageId).catch(() => null)
            : null;
            
        if (existingPingMsg) {
            await existingPingMsg.edit({
                content: `🔄 **NOWI ZWYCIĘZCY** 🔄 GRATULACJE ${winnerMentions}! Jesteście nowymi zwycięzcami konkursu na **${giveaway.prize}**! Skontaktujcie się z hostem <@${giveaway.hostId}>, aby odebrać nagrodę.`,
            });
        } else {
            const newPingMsg = await channel.send({
                content: `🔄 **NOWI ZWYCIĘZCY** 🔄 GRATULACJE ${winnerMentions}! Jesteście nowymi zwycięzcami konkursu na **${giveaway.prize}**! Skontaktujcie się z hostem <@${giveaway.hostId}>, aby odebrać nagrodę.`,
            });
            updatedGiveaway.winnerPingMessageId = newPingMsg.id;
        }

        logger.info(`Konkurs pomyślnie wylosowany ponownie: ${messageId} z liczbą nowych zwycięzców: ${newWinners.length}`);

        try {
            await logEvent({
                client: interaction.client,
                guildId: interaction.guildId,
                eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                data: {
                    description: `Wylosowano ponownie konkurs: ${giveaway.prize}`,
                    channelId: giveaway.channelId,
                    userId: interaction.user.id,
                    fields: [
                        {
                            name: 'Nagroda',
                            value: giveaway.prize || 'Tajemnicza nagroda!',
                            inline: true
                        },
                        {
                            name: 'Nowi zwycięzcy',
                            value: winnerMentions,
                            inline: false
                        },
                        {
                            name: 'Wszystkie zgłoszenia',
                            value: participants.length.toString(),
                            inline: true
                        }
                    ]
                }
            });
        } catch (logError) {
            logger.debug('Błąd podczas logowania zdarzenia ponownego losowania konkursu:', logError);
        }

        return InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    "Ponowne losowanie udane ✅",
                    `Pomyślnie wylosowano ponownie konkurs dla **${giveaway.prize}** na kanale ${channel}. Wybrano ${newWinners.length} nowego/ych zwycięzcę/ów.`
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
