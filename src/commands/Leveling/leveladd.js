import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { checkUserPermissions } from '../../utils/permissionGuard.js';
import { addLevels, getLevelingConfig } from '../../services/leveling/leveling.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leveladd')
    .setDescription('Dodaj poziomy wybranemu użytkownikowi')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Użytkownik, któremu chcesz dodać poziomy')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Liczba poziomów do dodania (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
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
    const levelsToAdd = interaction.options.getInteger('levels');

    // Walidacja: Blokada dodawania poziomów botom
    if (targetUser.bot) {
      return await replyUserError(interaction, {
        type: ErrorTypes.VALIDATION,
        message: 'Nie można dodawać poziomów botom.',
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

    const userData = await addLevels(client, interaction.guildId, targetUser.id, levelsToAdd);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [
        createEmbed({
          title: 'Dodano poziomy',
          description:
            `Pomyślnie dodano **${levelsToAdd}** ${levelsToAdd === 1 ? 'poziom' : 'poziomów'} dla użytkownika ${targetUser}.\n\n` +
            `**Nowy poziom:** ${userData.level}`,
          color: 'success',
        }),
      ],
    });

    logger.info(
      `[ADMIN] Użytkownik ${interaction.user.tag} (ID: ${interaction.user.id}) dodał ${levelsToAdd} lvl dla ${targetUser.tag} (ID: ${targetUser.id}) na serwerze ${interaction.guildId}`
    );
  },
};
