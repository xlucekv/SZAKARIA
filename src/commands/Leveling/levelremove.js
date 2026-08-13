import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { removeLevels, getUserLevelData, getLevelingConfig } from '../../services/leveling/leveling.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('levelremove')
    .setDescription('Usuń poziomy użytkownikowi')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Użytkownik, któremu chcesz usunąć poziomy')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Liczba poziomów do usunięcia')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const hasPermission = await checkUserPermissions(
      interaction,
      PermissionFlagsBits.ManageGuild,
      'Potrzebujesz uprawnienia Zarządzanie Serwerem, aby użyć tej komendy.'
    );
    if (!hasPermission) return;

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);
    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor('#f1c40f')
            .setDescription('System poziomów jest obecnie wyłączony na tym serwerze.')
        ],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const levelsToRemove = interaction.options.getInteger('levels');

    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new TitanBotError(
        `User ${targetUser.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'Wskazany użytkownik nie znajduje się na tym serwerze.'
      );
    }

    const userData = await getUserLevelData(client, interaction.guildId, targetUser.id);
    if (userData.level === 0) {
      throw new TitanBotError(
        `User ${targetUser.id} is already at minimum level`,
        ErrorTypes.VALIDATION,
        `${targetUser.tag} ma już poziom 0 i nie można mu usunąć więcej poziomów.`
      );
    }

    const updatedData = await removeLevels(client, interaction.guildId, targetUser.id, levelsToRemove);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'Usunięto poziomy',
          description: `Pomyślnie usunięto ${levelsToRemove} poziomów użytkownikowi ${targetUser.tag}.\n**Nowy poziom:** ${updatedData.level}`,
          color: 'success'
        })
      ]
    });

    logger.info(
      `[ADMIN] Użytkownik ${interaction.user.tag} usunął ${levelsToRemove} poziomów użytkownikowi ${targetUser.tag} na serwerze ${interaction.guildId}`
    );
  }
};
