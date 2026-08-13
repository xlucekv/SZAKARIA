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
    const selectedValue = interaction.values?.[0]?.toLowerCase() || 'inne';
    const guild = interaction.guild;
    const user = interaction.user;

    const CATEGORY_CONFIGS = {
      rekrutacja: {
        title: '` 📝 ` | Rekrutacja do Klanu SZAK',
        prefix: 'rekrutacja',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user} w podaniu do klanu **SZAK**. Odpowiedz na poniższe pytania:\n\n` +
          `* \` 🪖 \` | Podaj swój **nick** z gry Minecraft.\n` +
          `* \` 🎂 \` | Ile masz **lat** (wiek)?\n` +
          `* \` ⚔️ \` | Jakie posiadasz **itemy**?\n` +
          `* \` 📸 \` | Wyślij **zdjęcie** scoreboarda oraz swoich itemów.\n` +
          `* \` ⏱️ \` | Jak długo grasz na wersji **1.16**\n` +
          `* \` 🏰 \` | W jakich **klanach** grałeś wcześniej?\n` +
          `* \` ⏳ \` | Oczekuj na odpowiedź od **Administracji**.`
      },
      pytanie: {
        title: '` ❓ ` | Pytanie i Pomoc',
        prefix: 'pytanie',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user} w sekcji pytań klanu **SZAK**.\n\n` +
          `* \` 💬 \` | Opisz dokładnie swoje **pytanie** lub problem.\n` +
          `* \` 🖼️ \` | Jeśli to konieczne, załącz **zrzut ekranu**.\n` +
          `* \` ⏳ \` | Oczekuj na odpowiedź od **Administracji**.`
      },
      nieobecnosc: {
        title: '` ⏰ ` | Zgłoszenie Nieobecności',
        prefix: 'nieobecnosc',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user}! Zgłoś swoją planowaną przerwę od gry:\n\n` +
          `* \` 📅 \` | Podaj **datę** rozpoczęcia i końca nieobecności.\n` +
          `* \` 💬 \` | Podaj krótki **powód** swojej przerwy.\n` +
          `* \` ⏳ \` | Zgłoszenie zostanie odnotowane przez **Administrację**.`
      },
      skarga: {
        title: '` 🚨 ` | Skarga / Incydent',
        prefix: 'skarga',
        color: 0xe74c3c,
        description: 
          `> Witaj ${user} w panelu skarg klanu **SZAK**.\n\n` +
          `* \` 👤 \` | Podaj **nick gracza**, którego dotyczy zgłoszenie.\n` +
          `* \` 📂 \` | Koniecznie załącz **dowody** (screeny lub wideo).\n` +
          `* \` 🔒 \` | Zgłoszenie rozpatrzy poufnie **Administracja**.`
      },
      wspolpraca: {
        title: '` 🤝 ` | Współpraca / Sojusze',
        prefix: 'wspolpraca',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user}! Kontakt dla klanów i sojuszy:\n\n` +
          `* \` 🏰 \` | Podaj nazwę swojego **klanu** lub projektu.\n` +
          `* \` 📜 \` | Przedstaw szczegóły i warunki **współpracy**.\n` +
          `* \` ⏳ \` | Oczekuj na kontakt ze strony **Administracji**.`
      },
      zbiorki: {
        title: '` 💎 ` | Zbiórki Klanowe',
        prefix: 'zbiorki',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user} w panelu zbiórek klanowych:\n\n` +
          `* \` 📦 \` | Określ **przedmioty** lub wkład, który zgłaszasz.\n` +
          `* \` 🖼️ \` | Załącz **screeny** potwierdzające wpłatę/przekazanie.\n` +
          `* \` ⏳ \` | Oczekuj na weryfikację przez **Administrację**.`
      },
      inne: {
        title: '` 🎫 ` | Inne / Tickets',
        prefix: 'ticket',
        color: 0x8e44ad,
        description: 
          `> Witaj ${user} w prywatnym kanale wsparcia **SZAK**:\n\n` +
          `* \` 📝 \` | Opisz szczegółowo **sprawę**, z którą przychodzisz.\n` +
          `* \` 📎 \` | Załącz przydatne **materiały** lub informacje.\n` +
          `* \` ⏳ \` | Oczekuj na odpowiedź od **Administracji**.`
      }
    };

    const categoryConfig = CATEGORY_CONFIGS[selectedValue] || CATEGORY_CONFIGS.inne;
    
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
