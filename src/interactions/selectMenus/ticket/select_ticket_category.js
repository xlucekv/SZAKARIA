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

// Dedykowane opisy Minecraft bez emotek z nagłówkami markdown
const CATEGORY_CONFIGS = {
  rekrutacja: {
    title: 'ZGLOSZENIE: REKRUTACJA DO KLANU',
    color: 0x3498db,
    description: 
      `# REKRUTACJA DO KLANU SZAK\n` +
      `> Dziekujemy za chec dolaczenia do naszej ekipy Minecraft!\n\n` +
      `* **NICK MINECRAFT:** Podaj swoj dokladny nick z gry.\n` +
      `* **WIEK I DOSWIADCZENIE:** Podaj swoj wiek oraz jak dlugo grasz w MC.\n` +
      `* **PVP / BUDOWANIE:** W czym czujesz sie najlepiej?\n` +
      `* **OCZEKIWANIE:** Poczekaj na odpowiedz od Lidera lub Rekrutera.`
  },
  pomoc: {
    title: 'ZGLOSZENIE: POMOC / PYTANIE',
    color: 0x2ecc71,
    description: 
      `# POMOC I SPRAWY TECHNICZNE\n` +
      `> Masz pytanie dotyczace klanu, bazy lub serwera?\n\n` +
      `* **OPIS PROBLEMU:** Napisz dokladnie, w czym mozemy Ci pomoc.\n` +
      `* **ZALACZNIKI:** Jesli sprawa dotyczy bledu lub bazy, wrzuc zrzut ekranu.\n` +
      `* **OCZEKIWANIE:** Administracja klanowa odpowie tak szybko, jak to mozliwe.`
  },
  skarga: {
    title: 'ZGLOSZENIE: SKARGA / ZLAMANIE REGULAMINU',
    color: 0xe74c3c,
    description: 
      `# SKARGA / INCYDENT W MINECRAFT\n` +
      `> Zgloszenie naruszenia zasad klanu, kradziezy lub sojuszu.\n\n` +
      `* **OBWINIONY GRACZ:** Podaj nick gracza.\n` +
      `* **DOWODY (WYMAGANE):** Wklej link do nagrania lub screeny.\n` +
      `* **POUFANOSC:** Zgloszenie widzi tylko Zarzad klanu SZAK.`
  },
  default: {
    title: 'ZGLOSZENIE: SPRAWA OGOLNA',
    color: 0x2b2d31,
    description: 
      `# SPRAWA OGOLNA - KLAN SZAK\n` +
      `> Witaj w prywatnym kanale zgloszeniowym.\n\n` +
      `* **SZCZEGOLY:** Opisz sprawe, z ktora przychodzisz.\n` +
      `* **INFORMACJE:** Podaj wszelkie przydatne szczegoly.\n` +
      `* **OCZEKIWANIE:** Poczekaj na odpowiedz od czlonka Administracji.`
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
        content: `Posiadasz juz otwarte zgloszenie: ${existingChannel}`,
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
      .setFooter({ text: 'SZAK Minecraft Clan System', iconURL: guild.iconURL() || undefined })
      .setTimestamp();

    const closeButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close_request:')
        .setLabel('Zamknij zgloszenie')
        .setStyle(ButtonStyle.Danger)
    );

    await ticketChannel.send({
      content: `${user}`,
      embeds: [embed],
      components: [closeButton]
    });

    await interaction.editReply({
      content: `Pomyslnie utworzono Twoje zgloszenie: ${ticketChannel}`
    });

  } catch (error) {
    logger.error('Błąd podczas tworzenia ticketu:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Wystapil blad podczas tworzenia kanalu zgloszenia.',
        flags: [64]
      }).catch(() => {});
    } else {
      await interaction.editReply({
        content: 'Wystapil blad podczas tworzenia kanalu zgloszenia.'
      }).catch(() => {});
    }
  }
}

export default {
  data,
  customId: 'select_ticket_category',
  execute
};
