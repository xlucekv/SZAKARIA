import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("Wyświetl awatar wybranego użytkownika")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription(
                    "Użytkownik, którego awatar chcesz zobaczyć (domyślnie Ty)",
                ),
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("uzytkownik") || interaction.user;
        const avatarUrl = user.displayAvatarURL({ size: 2048, dynamic: true });

        const embed = createEmbed({ 
            title: `Awatar użytkownika ${user.username}`, 
            description: `[Link do pobrania](${avatarUrl})` 
        })
            .setImage(avatarUrl);

        await InteractionHelper.safeReply(interaction, { embeds: [embed] });
        logger.info(`Avatar command executed`, {
            userId: interaction.user.id,
            targetUserId: user.id,
            guildId: interaction.guildId
        });
    }
};
