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
const STAFF_ROLE_ID = 'TUTAJ_WKLIN_ID_ROLI_ADMINISTRACJI';

// MAPOWANIE KATEGORII (ID Twoich kategorii z Discorda)
const CATEGORIES = {
    'rekrutacja': { name: 'Rekrutacja', categoryId: 'ID_KATEGORII_REKRUTACJA' },
    'pytanie': { name: 'Pytanie', categoryId: 'ID_KATEGORII_PYTANIE' },
    'nieobecnosc': { name: 'Nieobecność', categoryId: 'ID_KATEGORII_NIEOBECNOSC' },
    'skarga': { name: 'Skarga', categoryId: 'ID_KATEGORII_SKARGA' },
    'wspolpraca': { name: 'Współpraca', categoryId: 'ID_KATEGORII_WSPOLPRACA' },
    'zbiorki': { name: 'Zbiórki', categoryId: 'ID_KATEGORII_ZBIORKI' },
    'tickets': { name: 'Inne / Ogólne', categoryId: 'ID_KATEGORII_TICKETS' }
};

client.once('ready', () => {
    console.log(`🐺 Bot ${client.user.tag} jest gotowy!`);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-tickets') {
            
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

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ Panel ticketów został wysłany!', ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_category') {
        const selectedKey = interaction.values[0];
        const categoryConfig = CATEGORIES[selectedKey];

        const channelName = `ticket-${interaction.user.username}`;
        
        const ticketChannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryConfig.categoryId !== 'ID_KATEGORII_...' ? categoryConfig.categoryId : null,
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
            .setColor('#2b2d31')
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
