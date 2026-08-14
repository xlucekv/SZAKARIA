import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { getLeaderboard, getLevelingConfig, getXpForLevel } from '../../services/leveling/leveling.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../../src/config/botConfig.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Wyświetla ranking poziomów na serwerze')
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    // Odraczamy odpowiedź (defer)
    await InteractionHelper.safeDefer(interaction);

    const levelingConfig = await getLevelingConfig(client, interaction.guildId);

    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setColor(getColor('warning'))
            .setDescription('System poziomów jest obecnie wyłączony na tym serwerze.')
        ]
      });
      return;
    }

    const leaderboard = await getLeaderboard(client, interaction.guildId, 10);

    if (!leaderboard || leaderboard.length === 0) {
      throw new TitanBotError(
        'Nie znaleziono danych rankingu',
        ErrorTypes.DATABASE,
        'Brak danych o poziomach. Zacznij pisać na czacie, aby zdobywać XP!'
      );
    }

    // Masowe pobranie członków w JEDNYM zapytaniu API (optymalizacja)
    const userIds = leaderboard.map((u) => u.userId);
    const fetchedMembers = await interaction.guild.members
      .fetch({ user: userIds })
      .catch(() => new Map());

    const leaderboardRows = leaderboard.map((user, index) => {
      const member = fetchedMembers.get(user.userId);
      const userMention = member?.user ? `${member.user}` : `<@${user.userId}>`;
      const xpForNextLevel = getXpForLevel(user.level + 1);

      let rankPrefix;
      if (index === 0) rankPrefix = '🥇';
      else if (index === 1) rankPrefix = '🥈';
      else if (index === 2) rankPrefix = '🥉';
      else rankPrefix = `**${index + 1}.**`;

      return `${rankPrefix} ${userMention} — Poziom **${user.level}** (${user.xp}/${xpForNextLevel} XP)`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏆 Ranking Poziomów')
      .setColor(getColor('success'))
      .setDescription(`Top **${leaderboard.length}** najbardziej aktywnych członków na serwerze:`)
      .addFields({
        name: 'Klasyfikacja',
        value: leaderboardRows.join('\n')
      })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Wyświetlono ranking dla serwera ${interaction.guildId}`);
  }
};
