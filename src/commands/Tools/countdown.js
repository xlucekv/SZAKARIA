import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createControlButtons, formatTime, startCountdown } from '../../handlers/countdownButtons.js';

const activeCountdowns = new Map();

export { activeCountdowns };

export default {
    data: new SlashCommandBuilder()
        .setName("countdown")
        .setDescription("Uruchom minutnik (odliczanie)")
        .addIntegerOption((option) =>
            option
                .setName("minuty")
                .setDescription("Liczba minut do odliczenia (0-1440)")
                .setMinValue(0)
                .setMaxValue(1440)
                .setRequired(false),
        )
        .addIntegerOption((option) =>
            option
                .setName("sekundy")
                .setDescription("Liczba sekund do odliczenia (0-59)")
                .setMinValue(0)
                .setMaxValue(59)
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("tytul")
                .setDescription("Opcjonalny tytuł dla odliczania")
                .setRequired(false),
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Countdown interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'countdown'
            });
            return;
        }

        const minutes = interaction.options.getInteger("minuty") || 0;
        const seconds = interaction.options.getInteger("sekundy") || 0;
        const title = interaction.options.getString("tytul") || "Minutnik";

        const totalSeconds = minutes * 60 + seconds;

        if (totalSeconds <= 0) {
            throw new Error("Podaj czas trwania wynoszący co najmniej 1 sekundę.");
        }

        if (totalSeconds > 86400) {
            throw new Error("Odliczanie nie może być dłuższe niż 24 godziny.");
        }

        const endTime = Date.now() + totalSeconds * 1000;
        const countdownId = `${interaction.channelId}-${Date.now()}`;

        const row = createControlButtons(countdownId);

        const initialEmbed = successEmbed(
            `⏱️ ${title}`,
            `Pozostały czas: **${formatTime(totalSeconds)}**`,
        );

        const message = await interaction.channel.send({
            embeds: [initialEmbed],
            components: [row],
        });

        const countdownData = {
            message,
            endTime,
            remainingTime: totalSeconds * 1000,
            isPaused: false,
            title,
            lastUpdate: Date.now(),
            interval: null,
        };

        activeCountdowns.set(countdownId, countdownData);
        startCountdown(countdownId, countdownData, activeCountdowns);

        await InteractionHelper.safeEditReply(interaction, {
            content: "✅ Odliczanie rozpoczęte!",
            flags: MessageFlags.Ephemeral,
        });
    },
};
