import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Stwórz klanowe głosowanie')
        .addStringOption(option => 
            option.setName('pytanie')
                .setDescription('O co chcesz zapytać?')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('opcje')
                .setDescription('Podaj opcje oddzielone przecinkami, np: Tak, Nie, Może')
                .setRequired(true)
        ),

    category: 'Utility',

    async execute(interaction) {
        const question = interaction.options.getString('pytanie');
        const optionsInput = interaction.options.getString('opcje').split(',').map(o => o.trim());

        if (optionsInput.length < 2 || optionsInput.length > 10) {
            return await interaction.reply({ 
                content: `> \`❌\` | **Użytkownik:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n> Proszę podaj od 2 do 10 opcji oddzielonych przecinkami!`, 
                ephemeral: true 
            });
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const optionsFormatted = optionsInput.map((o, i) => `> ${emojis[i]} ┃ **${o}**`).join('\n');

        const pollMessage = `> \`📊\` | **Klanowe Głosowanie**\n\n` +
                            `> **Pytanie:** *${question}*\n\n` +
                            `${optionsFormatted}\n\n` +
                            `> ━━━━━━━━━━━━━━━━━━━━\n` +
                            `> \`👤\` | **Inicjator:** ${interaction.user.tag} (\`${interaction.user.id}\`)`;

        await interaction.deferReply();
        const msg = await interaction.editReply({ content: pollMessage });

        for (let i = 0; i < optionsInput.length; i++) {
            await msg.react(emojis[i]);
        }
    },
};
