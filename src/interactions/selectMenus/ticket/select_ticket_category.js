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

// Konfiguracja kategorii ze zbalansowanym pogrubieniem słów
const CATEGORY_CONFIGS = {
  rekrutacja: {
    title: '` 📝 ` | Rekrutacja do Klanu SZAK',
    prefix: 'rekrutacja',
    color: 0x8e44ad,
    description: 
      `> Witaj w oficjalnym panelu rekrutacji klanu **SZAK**.\n\n` +
      `* ` + '` 🪖 `' + ` | Podaj swój **nick** z gra Minecraft.\n` +
      `* ` + '` 📝 `' + ` | Napisz swój **wiek**, doświadczenie oraz styl gry.\n` +
      `* ` + '` ⏳ `' + ` | Oczekuj na odpowiedź od **Rekrutera** lub **Lidera**.`
  },
  pytanie: {
    title: '` ❓ ` | Pytanie i Pomoc',
    prefix: 'pytanie',
    color: 0x8e44ad,
    description: 
      `> Witaj w sekcji pytań klanu **SZAK**.\n\n` +
      `* ` + '` 💬 `' + ` | Opisz dokładnie swoje **pytanie** lub problem.\n` +
      `* ` + '` 🖼️ `' + ` | Jeśli to konieczne, załącz **zrzut ekranu**.\n` +
      `* ` + '` ⏳ `' + ` | Oczekuj na odpowiedź od **Administracji**.`
  },
  nieobecnosc: {
    title: '` ⏰ ` | Zgłoszenie Nieobecności',
    prefix: 'nieobecnosc',
    color: 0x8e44ad,
    description: 
      `> Panel zgłaszania planowanej przerwy od gry w klanie **SZAK**.\n\n` +
      `* ` + '` 📅 `' + ` | Podaj **datę** rozpoczęcia i końca nieobecności.\n` +
      `* ` + '` 💬 `' + ` | Podaj krótki **powód** swojej przerwy.\n` +
      `* ` + '` ⏳ `' + ` | Zgłoszenie zostanie odnotowane przez **Zarząd**.`
  },
  skarga: {
    title: '` 🚨 ` | Skarga / Incydent',
    prefix: 'skarga',
    color: 0xe74c3c,
    description: 
      `> Witaj w panelu skarg klanu **SZAK**.\n\n` +
      `* ` + '` 👤 `' + ` | Podaj **nick gracza**, którego dotyczy zgłoszenie.\n` +
      `* ` + '` 📂 `' + ` | Koniecznie załącz **dowody** (screeny lub wideo).\n` +
      `* ` + '` 🔒 `' + ` | Zgłoszenie rozpatrzy poufnie **Zarząd klanu**.`
  },
  wspolpraca: {
    title: '` 🤝 ` | Współpraca / Sojusze',
    prefix: 'wspolpraca',
    color: 0x8e44ad,
    description: 
      `> Kontakt dla innych klanów, sojuszy i propozycji.\n\n` +
      `* ` + '` 🏰 `' + ` | Podaj nazwę swojego **klanu** lub projektu.\n` +
      `* ` + '` 📜 `' + ` | Przedstaw szczegóły i warunki **współpracy**.\n` +
      `* ` + '` ⏳ `' + ` | Oczekuj na kontakt ze strony **Lidera**.`
  },
  zbiorki: {
    title: '` 💎 ` | Zbiórki Klanowe',
    prefix: 'zbiorki',
    color: 0x8e44ad,
    description: 
      `> Sprawy związane z wkładem w klan i zbiórkami.\n\n` +
      `* ` + '` 📦 `' + ` | Określ **przedmioty** lub wkład, który zgłaszasz.\n` +
      `* ` + '` 🖼️ `' + ` | Załącz **screeny** potwierdzające wpłatę/przekazanie.\n` +
      `* ` + '` ⏳ `' + ` | Oczekuj na weryfikację przez **Skarbnika**.`
  },
  inne: {
    title: '` 🎫 ` | Inne / Tickets',
    prefix: 'ticket',
    color: 0x8e44ad,
    description: 
      `> Pozostałe kwestie niepasujące do powyższych kategorii.\n\n` +
      `* ` + '` 📝 `' + ` | Opisz szczegółowo **sprawę**, z którą przychodzisz.\n` +
      `* ` + '` 📎 `' + ` | Załącz przydatne **materiały** lub informacje.\n` +
      `* ` + '` ⏳ `' + ` | Oczekuj na odpowiedź od **zespołu**.`
  }
};

export async function execute(interaction, client, args) {
  try {
    const selectedValue = interaction.values?.[0]?.toLowerCase() || 'inne';
    const guild = interaction.guild;
    const user = interaction.user;

    const categoryConfig = CATEGORY_CONFIGS[selectedValue] || CATEGORY_CONFIGS.inne;
    
    // Tworzenie dynamicznej nazwy kanału: np. rekrutacja-nick
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const channelName = `${categoryConfig.prefix}-${cleanUsername}`;

    const existingChannel = guild.channels.cache.find(c => c.name === channelName);
    if (existingChannel) {
      return await interaction.reply({
        content: `❌ Posiadasz już otwarte zgłoszenie w tej kategorii: ${existingChannel}`,
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
