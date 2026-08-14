import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

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
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=pl&client=tw-ob`;

            let player = client.riffy.players.get(interaction.guild.id);

            if (!player) {
                player = client.riffy.createConnection({
                    guildId: interaction.guild.id,
                    voiceChannel: channel.id,
                    textChannel: interaction.channel.id,
                    deaf: true,
                });
            }

            if (!player.connected) {
                player.connect();
            }

            const resolve = await client.riffy.resolve({
                query: ttsUrl,
                requester: interaction.user,
            });

            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                return await interaction.editReply({ content: 'Nie udało się wygenerować strumienia audio dla tego tekstu.' });
            }

            const track = resolve.tracks[0];
            player.queue.add(track);

            if (!player.playing && !player.paused) {
                player.play();
            }

            await interaction.editReply({ content: `Weszłam na kanał i powiedziałam: "${text}"` });

            // Zabezpieczenie: Odczytanie dokładnego czasu audio (z Lavalink) 
            // Jeśli Lavalink odczyta czas jako 0 (stream), szacujemy czas z długości tekstu (~150ms na znak)
            const trackDuration = track.info.length > 0 ? track.info.length : text.length * 150; 
            
            // Ustawienie timera: Czas trwania nagrania + 2000 milisekund (2 sekundy)
            setTimeout(() => {
                const currentPlayer = client.riffy.players.get(interaction.guild.id);
                // Niszczymy odtwarzacz (bot opuszcza kanał)
                if (currentPlayer) {
                    currentPlayer.destroy();
                }
            }, trackDuration + 2000);

        } catch (error) {
            console.error('Błąd TTS Riffy:', error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas próby odtworzenia mowy.' });
        }
    },
};
