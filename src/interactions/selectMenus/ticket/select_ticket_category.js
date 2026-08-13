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

// Konfiguracja idealnie odzwierciedlająca wygląd ze zdjęcia
const CATEGORY_CONFIGS = {
  rekrutacja: {
    title: '` ⚔️ ` | Panel Rekrutacji Klanu SZAK',
    color: 0x8e44ad, // Fioletowy/Purpurowy jak ze zdjęcia
    description: 
      `> Witaj w oficjalnej rekrutacji klanu **SZAK**.\n\n` +
      `* ` + '` 🪖 `' + ` | **Podaj swój nick z Minecrafta**\n` +
      `* ` + '` 📝 `' + ` | **Wiek, doświadczenie oraz styl gry (PvP/Budowanie)**\n` +
      `* ` + '` ⏳ `' + ` | **Oczekuj na odpowiedź od Rekrutera lub Lidera**`
  },
  pomoc: {
    title: '` ❓ ` | Pomoc i Sprawy Techniczne',
    color: 0x8e44ad,
    description: 
      `> Witaj w sekcji pomocy klanu **SZAK**.\n\n` +
      `* ` + '` 💬 `' + ` | **Opisz dokładnie problem z serwerem/bazą**\n` +
      `* ` + '` 🖼️ `' + ` | **Załącz zrzuty ekranu, jeśli to konieczne**\n` +
      `* ` + '` ⏳ `' + ` | **Oczekuj na odpowiedź od Administracji**`
  },
  skarga: {
    title: '` ⚠️ ` | Skarga / Incydent',
    color: 0x8e44ad,
    description: 
      `> Witaj w oficjalnym panelu skarg klanu **SZAK**.\n\n` +
      `* ` + '` 👤 `' + ` | **Podaj nick gracza, którego dotyczy zgłoszenie**\n` +
      `* ` + '` 📂 `' + ` | **Koniecznie załącz dowody (screeny lub wideo)**\n` +
      `* ` + '` 🔒 `' + ` | **Zgłoszenie rozpatrzy poufnie Zarząd klanu**`
  },
  default: {
    title: '` 📌 ` | Sprawa Ogólna',
    color: 0x8e44ad,
    description: 
      `> Witaj w prywatnym kanale wsparcia klanu **SZAK**.\n\n` +
      `* ` + '` 📝 `' + ` | **Opisz szczegółowo sprawę, z którą przychodzisz**\n` +
      `* ` + '` 📎 `' + ` | **Załącz przydatne materiały lub informacje**\n` +
      `* ` + '` ⏳ `' + ` | **Oczekuj na odpowiedź od zespołu**`
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
      .setFooter({ 
        text: 'SZAK Tickets • Support System', 
        iconURL: guild.iconURL() || undefined 
      })
      .setTimestamp();

    const closeButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close_request:')
        .setLabel('Zamknij zgłoszenie')
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
