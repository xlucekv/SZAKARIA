import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, warningEmbed } from '../../utils/embeds.js';
import { getConfirmationButtons } from '../../utils/components.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    slashOnly: true,
    data: new SlashCommandBuilder()
        .setName('wipedata')
        .setDescription('Usuń wszystkie swoje dane osobowe z bota (nieodwracalne)'),

    async execute(interaction, guildConfig, client) {
        const warningMessage = 
            `> \`⚠️\` | **TA AKCJA JEST NIEODWRACALNA!**\n\n` +
            `Spowoduje to trwale usunięcie **WSZYSTKICH** Twoich danych z tego serwera, w tym:\n` +
            `• 💰 Stan konta ekonomii (portfel i bank)\n` +
            `• 📊 Poziomy oraz punkty XP\n` +
            `• 🎒 Przedmioty z ekwipunku\n` +
            `• 🛍️ Zakupy ze sklepu\n` +
            `• 🎂 Informacje o urodzinach\n` +
            `• 🔢 Dane liczników\n` +
            `• 📋 Wszystkie inne dane osobowe\n\n` +
            `**Tego kroku nie można cofnąć. Czy jesteś absolutnie pewien/pewna?**`;

        const embed = warningEmbed('Usuwanie wszystkich danych', warningMessage);

        const confirmButtons = getConfirmationButtons('wipedata');

        await InteractionHelper.safeReply(interaction, {
            embeds: [embed],
            components: [confirmButtons],
            flags: MessageFlags.Ephemeral
        });

        logger.info(`Wipedata command executed - confirmation prompt shown`, {
            userId: interaction.user.id,
            guildId: interaction.guildId
        });
    }
};
