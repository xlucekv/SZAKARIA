import { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ID Twojej roli administracji
const STAFF_ROLE_ID = '1259904096689979505';

// MAPOWANIE KATEGORII
const CATEGORIES = {
    'rekrutacja': { name: 'Rekrutacja', categoryId: '1526235563110432809' },
    'pytanie': { name: 'Pytanie', categoryId: '1526235669377191977' },
    'nieobecnosc': { name: 'Nieobecność', categoryId: '1526235719260049470' },
    'skarga': { name: 'Skarga', categoryId: '1526235791226044477' },
    'wspolpraca': { name: 'Współpraca', categoryId: '1526235863019946094' },
    'zbiorki': { name: 'Zbiórki', categoryId: '1530653502416883884' },
    'tickets': { name: 'Tickets / Inne', categoryId: '1537429848912429148' }
};

client.once('ready', () => {
    console.log(`🐺 Bot ${client.user.tag} jest gotowy!`);
});

// Reagowanie na zwykłą wiadomość !setup-tickets
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup-tickets') {
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('🐺 CENTRUM REKRUTACJI & POMOCY | Klan SZAK ⚔️')
            .setDescription(
                '• `📝` ┃ Wybierz z poniższego menu **kategorię**, która Cię interesuje.\n' +
                '• `🎯` ┃ Zostanie utworzony prywatny kanał do rozmowy z administracją.\n\n' +
                '• `📜` ┃ **Przed otwarciem:** przygotuj się na ewentualne pytania!'
            );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_ticket_category')
            .setPlaceholder('👉 Wybierz kategorię zgłoszenia...')
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('Rekrutacja').setValue('rekrutacja').setEmoji('📝'),
                new StringSelectMenuOptionBuilder().setLabel('Pytanie').setValue('pytanie').setEmoji('❓'),
                new StringSelectMenuOptionBuilder().setLabel('Nieobecność').setValue('nieobecnosc').setEmoji('⏰'),
                new StringSelectMenuOptionBuilder().setLabel('Skarga').setValue('skarga').setEmoji('🚨'),
                new StringSelectMenuOptionBuilder().setLabel('Współpraca').setValue('wspolpraca').setEmoji('🤝'),
                new StringSelectMenuOptionBuilder().setLabel('Zbiórki').setValue('zbiorki').setEmoji('💎'),
                new StringSelectMenuOptionBuilder().setLabel('Inne / Tickets').setValue('tickets').setEmoji('🎫')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await message.channel.send({ embeds: [embed], components: [row] });
        if (message.deletable) await message.delete();
    }
});

// Obsługa interakcji (Menu Rozwijane i Przyciski)
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
        const selectedKey = interaction.values[0];
        const categoryConfig = CATEGORIES[selectedKey];

        const channelName = `ticket-${interaction.user.username}`;
        
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryConfig.categoryId,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    id: STAFF_ROLE_ID,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
            ],
        });

        const closeButton = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('🔒 Zamknij Ticket')
            .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle(`🎫 Kategoria: ${categoryConfig.name}`)
            .setDescription(`Witaj ${interaction.user}! Opisz tutaj swoją sprawę, a administracja odpowie najszybciej jak to możliwe.`);

        await ticketChannel.send({ embeds: [welcomeEmbed], components: [row] });
        await interaction.reply({ content: `✅ Utworzono Twój ticket: ${ticketChannel}`, ephemeral: true });
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Ten ticket zostanie usunięty za 5 sekund...');
        setTimeout(() => interaction.channel.delete(), 5000);
    }
});

client.login(process.env.DISCORD_TOKEN);
