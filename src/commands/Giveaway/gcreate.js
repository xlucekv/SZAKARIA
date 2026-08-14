import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { saveGiveaway } from '../../utils/giveaways.js';
import { 
    parseDuration, 
    validatePrize, 
    validateWinnerCount,
    createGiveawayEmbed, 
    createGiveawayButtons 
} from '../../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { botConfig } from '../../config/bot.js';

const GIVEAWAY_MIN_WINNERS = botConfig.giveaways?.minimumWinners ?? 1;
const GIVEAWAY_MAX_WINNERS = botConfig.giveaways?.maximumWinners ?? 10;

export default {
    data: new SlashCommandBuilder()
        .setName("gcreate")
        .setDescription("Rozpoczyna nowy konkurs (giveaway) na wskazanym kanale.")
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription("Czas trwania konkursu (np. 1h, 30m, 5d).")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("winners")
                .setDescription("Liczba zwycięzców do wylosowania.")
                .setMinValue(GIVEAWAY_MIN_WINNERS)
                .setMaxValue(GIVEAWAY_MAX_WINNERS)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("prize")
                .setDescription("Nagroda, która jest rozdawana.")
                .setRequired(true)
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Kanał, na którym pojawi się konkurs (domyślnie obecny).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    category: 'Utility', // Zachowanie spójności kategorii

    async execute(interaction, guildConfig, client) {
        // Bezpieczne odłożenie odpowiedzi na wypadek dłuższej operacji (baza danych / sieć)
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
                "Nie masz uprawnień 'Zarządzanie serwerem', aby rozpocząć konkurs.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Rozpoczęcie tworzenia konkursu przez ${interaction.user.tag} na serwerze ${interaction.guildId}`);

        const durationString = interaction.options.getString("duration");
        const winnerCount = interaction.options.getInteger("winners");
        const prize = interaction.options.getString("prize");
        const targetChannel = interaction.options.getChannel("channel") || interaction.channel;

        const durationMs = parseDuration(durationString);
        validateWinnerCount(winnerCount);
        const prizeName = validatePrize(prize);

        if (!targetChannel.isTextBased()) {
            throw new TitanBotError(
                'Target channel is not text-based',
                ErrorTypes.VALIDATION,
                'Wskazany kanał musi być kanałem tekstowym.',
                { channelId: targetChannel.id, channelType: targetChannel.type }
            );
        }

        const endTime = Date.now() + durationMs;

        const initialGiveawayData = {
            messageId: "placeholder",
            channelId: targetChannel.id,
            guildId: interaction.guildId,
            prize: prizeName,
            hostId: interaction.user.id,
            endTime: endTime,
            endsAt: endTime,
            winnerCount: winnerCount,
            participants: [],
            isEnded: false,
            ended: false,
            createdAt: new Date().toISOString()
        };

        const embed = createGiveawayEmbed(initialGiveawayData, "active");
        const row = createGiveawayButtons(false);

        // Wysłanie wiadomości konkursowej na docelowy kanał
        const giveawayMessage = await targetChannel.send({
            content: "🎉 **NOWY KONKURS** 🎉",
            embeds: [embed],
            components: [row],
        });

        initialGiveawayData.messageId = giveawayMessage.id;
        const saved = await saveGiveaway(
            interaction.client,
            interaction.guildId,
            initialGiveawayData,
        );

        if (!saved) {
            logger.warn(`Nie udało się zapisać konkursu w bazie danych: ${giveawayMessage.id}`);
        }

        // Logowanie zdarzenia w systemie logów serwera
        try {
            await logEvent({
                client: interaction.client,
                guildId: interaction.guildId,
                eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                data: {
                    description: `Utworzono konkurs: ${prizeName}`,
                    channelId: targetChannel.id,
                    userId: interaction.user.id,
                    fields: [
                        { name: 'Nagroda', value: prizeName, inline: true },
                        { name: 'Zwycięzcy', value: winnerCount.toString(), inline: true },
                        { name: 'Czas trwania', value: durationString, inline: true },
                        { name: 'Kanał', value: targetChannel.toString(), inline: true }
                    ]
                }
            });
        } catch (logError) {
            logger.debug('Błąd podczas logowania zdarzenia utworzenia konkursu:', logError);
        }

        logger.info(`Konkurs pomyślnie utworzony: ${giveawayMessage.id} na kanale ${targetChannel.name}`);

        // Ephemeralna informacja zwrotna dla administratora
        await InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    `Konkurs uruchomiony! 🎉`,
                    `Nowy konkurs na **${prizeName}** został pomyślnie rozpoczęty na kanale ${targetChannel} i potrwa przez **${durationString}**.`
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
