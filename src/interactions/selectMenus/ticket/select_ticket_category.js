import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits, 
  ChannelType 
} from 'discord.js';
import { logger } from '../../../utils/logger.js';

export const data = {
  customId: 'select_ticket_category',
};

export async function execute(interaction, client, args) {
  try {
    const selectedCategory = interaction.values?.[0] || 'Ogólne';
    const guild = interaction.guild;
    const user = interaction.user;

    const channelName = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const existingChannel = guild.channels.cache.find(c => c.name === channelName);
    if (existingChannel) {
      return await interaction.reply({
        content: `❌ Posiadasz już otwarte zgłoszenie: ${existingChannel}`,
        flags: [64]
      });
    }

    await interaction.deferReply({ flags: [64] });

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory
          ],
        },
        {
          id: client.user?.id || interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages
          ],
        }
      ],
    });

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`📌 Zgłoszenie: ${selectedCategory.toUpperCase()}`)
      .setDescription(
        `Witaj ${user}! Dziękujemy za kontakt z klanem **SZAK**.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📝 **Jak nam pomóc w szybszym rozpatrzeniu?**\n` +
        `• Opisz szczegółowo swój problem lub cel zgłoszenia.\n` +
        `• Jeśli sprawa tego wymaga, załącz zrzuty ekranu lub powiązane linki.\n` +
        `• Dowództwo / Administracja odpowie w tym kanale tak szybko, jak to możliwe.\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({ text: 'SZAK System Zgłoszeń', iconURL: guild.iconURL() || undefined })
      .setTimestamp();

    const closeButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close_request:')
        .setLabel('Zamknij zgłoszenie')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `${user}`,
      embeds: [embed],
      components: [closeButton]
    });

    await interaction.editReply({
      content: `✅ Pomyślnie utworzono Twoje zgłoszenie: ${ticketChannel}`
    });

  } catch (error) {
    logger.error('Błąd podczas tworzenia ticketu:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas tworzenia kanału zgłoszenia.',
        flags: [64]
      }).catch(() => {});
    } else {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas tworzenia kanału zgłoszenia.'
      }).catch(() => {});
    }
  }
}

export default {
  data,
  customId: 'select_ticket_category',
  execute
};
