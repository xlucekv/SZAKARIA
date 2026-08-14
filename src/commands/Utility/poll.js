import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Stwórz klanowe głosowanie')
        .addStringOption(option => option.setName('pytanie').setDescription('O co chcesz zapytać?').setRequired(true))
        .addStringOption(option => option.setName('opcje').setDescription('Podaj opcje oddzielone przecinkami, np: Tak, Nie, Może').setRequired(true)),

    async execute(interaction) {
        const question = interaction.options.getString('pytanie');
        const optionsInput = interaction.options.getString('opcje').split(',').map(o => o.trim());

        if (optionsInput.length < 2 || optionsInput.length > 10) {
            return await interaction.reply({ content: '> `❌` | Proszę podaj od 2 do 10 opcji!', ephemeral: true });
        }

        const pollEmbed = new EmbedBuilder()
            .setTitle(`📊 Klanowe Głosowanie`)
            .setDescription(`**${question}**\n\n${optionsInput.map((o, i) => `${i + 1}️⃣ - ${o}`).join('\n')}`)
            .setColor('#2b2d31')
            .setFooter({ text: `Głosowanie zainicjowane przez ${interaction.user.tag}` });

        const msg = await interaction.reply({ embeds: [pollEmbed], fetchReply: true });

        // Automatyczne dodawanie reakcji
        for (let i = 0; i < optionsInput.length; i++) {
            const reaction = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i];
            await msg.react(reaction);
        }
    },
};
