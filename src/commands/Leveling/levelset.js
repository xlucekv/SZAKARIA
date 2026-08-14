import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { setUserLevel, getLevelingConfig } from '../../services/leveling/leveling.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('levelset')
    .setDescription('Ustaw konkretny poziom dla użytkownika')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Użytkownik, któremu chcesz ustawić poziom')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Poziom do ustawienia (0-1000)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(1000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const hasPermission = await checkUserPermissions(
      interaction,
      PermissionFlagsBits.ManageGuild,
      'Potrzebujesz uprawnienia **Zarządzanie Serwerem**, aby użyć tej komendy.'
    );
    if (!hasPermission) return;

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);
    if (!levelingConfig?.enabled) {
      return await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          createEmbed({
            title: 'System Poziomów',
            description: 'System poziomów jest obecnie wyłączony na tym serwerze.',
            color: 'warning',
          }),
        ],
      });
    }

    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');

    // Walidacja: Blokada ustawiania poziomów botom
    if (targetUser.bot) {
      return await replyUserError(interaction, {
        type: ErrorTypes.VALIDATION,
        message: 'Nie można zarządzać poziomami botów.',
      });
    }

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new TitanBotError(
        `User ${targetUser.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'Wskazany użytkownik nie znajduje się na tym serwerze.'
      );
    }

    const userData = await setUserLevel(client, interaction.guildId, targetUser.id, newLevel);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'Ustawiono poziom',
          description:
            `Pomyślnie ustawiono poziom użytkownika ${targetUser} na **${newLevel}**.\n\n` +
            `**Całkowite XP:** ${userData.totalXp}`,
          color: 'success',
        }),
      ],
    });

    logger.info(
      `[ADMIN] Użytkownik ${interaction.user.tag} (ID: ${interaction.user.id}) ustawił poziom ${targetUser.tag} (ID: ${targetUser.id}) na ${newLevel} na serwerze ${interaction.guildId}`
    );
  },
};
