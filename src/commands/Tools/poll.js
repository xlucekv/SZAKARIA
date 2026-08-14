import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Stwórz klanowe głosowanie po przecinku')
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
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const question = interaction.options.getString('pytanie');
        const optionsInput = interaction.options.getString('opcje').split(',').map(o => o.trim()).filter(Boolean);

        if (optionsInput.length < 2 || optionsInput.length > 10) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: `> \`❌\` | **Użytkownik:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n> Podaj od 2 do 10 opcji oddzielonych przecinkami!`
            });
        }

        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        const optionsFormatted = optionsInput.map((o, i) => `> • \`${emojis[i]}\` ┃ **${o}**`).join('\n');

        const pollMessage = `> \`📊\` | **Klanowe Głosowanie**\n\n` +
                            `> • \`💬\` | **Pytanie:** *${question}*\n\n` +
                            `${optionsFormatted}\n\n` +
                            `> ━━━━━━━━━━━━━━━━━━━━\n` +
                            `> \`👤\` | **Inicjator:** ${interaction.user.tag} (\`${interaction.user.id}\`)`;

        // Wysyłamy ankietę na kanał
        const msg = await interaction.channel.send({ content: pollMessage });

        // Dodajemy reakcje
        for (let i = 0; i < optionsInput.length; i++) {
            await msg.react(emojis[i]);
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Potwierdzenie dla twórcy ankiety
        await InteractionHelper.safeEditReply(interaction, {
            content: `> \`✅\` | Ankieta została pomyślnie utworzona!`
        });
    },
};
