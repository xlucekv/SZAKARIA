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

// Dedykowane instrukcje dla poszczególnych kategorii
const CATEGORY_CONFIGS = {
  rekrutacja: {
    title: '⚔️ | Zgłoszenie: Rekrutacja',
    color: 0x3498db,
    description: 
      `> Dziękujemy za chęć dołączenia do klanu **SZAK**!\n\n` +
      `🪖 | Podaj swój nick z gry oraz link do profilu (np. Wargaming/Steam)\n` +
      `📝 | Podaj swój wiek oraz krótko opisz swoje doświadczenie w grze\n` +
      `⏳ | Oczekuj na odpowiedź od Rekrutera lub Dowództwa`
  },
  pomoc: {
    title: '❓ | Zgłoszenie: Pomoc / Pytanie',
    color: 0x2ecc71,
    description: 
      `> Masz pytanie lub potrzebujesz wsparcia technicznego/organizacyjnego?\n\n` +
      `💬 | Opisz szczegółowo, w czym możemy Ci pomóc\n` +
      `🖼️ | Załącz zrzuty ekranu, jeśli sprawa dotyczy problemu technicznego\n` +
      `⏳ | Oczekuj na odpowiedź od Administracji`
  },
  skarga: {
    title: '⚠️ | Zgłoszenie: Skarga / Incydent',
    color: 0xe74c3c,
    description: 
      `> Oficjalne zgłoszenie naruszenia regulaminu lub konfliktu.\n\n` +
      `👤 | Podaj nick / ID osoby, której dotyczy zgłoszenie\n` +
      `📂 | Przedstaw przebieg sytuacji oraz **koniecznie załącz dowody** (screeny/wideo)\n` +
      `🔒 | Sprawa zostanie rozpatrzona poufnie przez Zarząd klanu`
  },
  default: {
    title: '📌 | Zgłoszenie: Sprawa Ogólna',
    color: 0x2b2d31,
    description: 
      `> Witaj w prywatnym kanale zgłoszeniowym klanu **SZAK**.\n\n` +
      `📝 | Opisz dokładnie sprawę, z którą do nas przychodzisz\n` +
      `📎 | Załącz wszelkie przydatne materiały lub informacje\n` +
      `⏳ | Oczekuj na odpowiedź od członka zespołu`
  }
};

export async function execute(interaction, client, args) {
  try {
    const selectedValue = interaction.values?.[0]?.toLowerCase() || 'default';
    const guild = interaction.guild;
    const user = interaction.user;

    const categoryConfig = CATEGORY_CONFIGS[selectedValue] || CATEGORY_CONFIGS.default;

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
      .setColor(categoryConfig.color)
      .setTitle(categoryConfig.title)
      .setDescription(categoryConfig.description)
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
