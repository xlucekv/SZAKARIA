import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import googleTTS from 'google-tts-api';

export default {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('Bot wchodzi na Twój kanał głosowy i wypowiada wpisany tekst')
        .addStringOption(option =>
            option.setName('tekst')
                .setDescription('Tekst, który bot ma powiedzieć')
                .setRequired(true)
                .setMaxLength(200),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Connect),
    
    category: 'Utility',

    async execute(interaction, _config, client) {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return await interaction.reply({
                content: 'Musisz być na kanale głosowym, żebym mógł tam wejść!',
                ephemeral: true,
            });
        }

        const text = interaction.options.getString('tekst');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Generowanie linku audio Google TTS
            const url = googleTTS.getAudioUrl(text, {
                lang: 'pl',
                slow: false,
                host: 'https://translate.google.com',
            });

            // Wykorzystanie managera Riffy / Lavalink wgranego w bota
            const player = client.riffy.createConnection({
                guildId: interaction.guild.id,
                voiceChannel: channel.id,
                textChannel: interaction.channel.id,
                deaf: true,
            });

            player.connect();
            player.play({ track: url });

            await interaction.editReply({ content: `Weszłam na kanał i powiedziałam: "${text}"` });
        } catch (error) {
            console.error('Błąd TTS Riffy:', error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas próby odtworzenia mowy przez Lavalink.' });
        }
    },
};
