import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
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

    async execute(interaction) {
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
            // Generowanie linku audio z Google TTS dla języka polskiego
            const url = googleTTS.getAudioUrl(text, {
                lang: 'pl',
                slow: false,
                host: 'https://translate.google.com',
            });

            // Dołączenie do kanału głosowego użytkownika
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            const player = createAudioPlayer();
            const resource = createAudioResource(url);

            connection.subscribe(player);
            player.play(resource);

            // Gdy bot skończy mówić, automatycznie opuszcza kanał
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            // Obsługa błędów odtwarzacza
            player.on('error', error => {
                console.error('Błąd odtwarzacza audio:', error);
                connection.destroy();
            });

            await interaction.editReply({ content: `Weszłam na kanał i powiedziałam: "${text}"` });
        } catch (error) {
            console.error('Błąd TTS / Voice:', error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas próby wygenerowania lub odtworzenia mowy.' });
        }
    },
};
