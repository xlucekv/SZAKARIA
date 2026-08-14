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

            if (!player.connected) player.connect();

            const resolve = await client.riffy.resolve({
                query: ttsUrl,
                requester: interaction.user,
            });

            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                return await interaction.editReply({ content: 'Nie udało się wygenerować strumienia audio.' });
            }

            const track = resolve.tracks[0];
            player.queue.add(track);
            player.play();

            await interaction.editReply({ content: `Powiedziałam: "${text}"` });

            // Nasłuchiwanie zakończenia utworu zamiast timera
            player.once('trackEnd', () => {
                setTimeout(() => {
                    const activePlayer = client.riffy.players.get(interaction.guild.id);
                    if (activePlayer) activePlayer.destroy();
                }, 2000); // Wyjdzie 2 sekundy po zakończeniu mówienia
            });

        } catch (error) {
            console.error('Błąd TTS:', error);
            await interaction.editReply({ content: 'Wystąpił błąd podczas odtwarzania.' });
        }
    },
};
