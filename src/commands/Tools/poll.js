import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

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
        )
        .addStringOption(option =>
            option.setName('czas')
                .setDescription('Czas trwania ankiety, np. 2h, 1d (opcjonalnie)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('anonimowa')
                .setDescription('Czy ankieta ma być anonimowa (domyślnie: fałsz)')
                .setRequired(false)
        ),

    category: 'Utility',

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const question = interaction.options.getString('pytanie');
        const optionsInput = interaction.options.getString('opcje').split(',').map(o => o.trim()).filter(Boolean);
        const duration = interaction.options.getString('czas');
        const isAnonymous = interaction.options.getBoolean('anonimowa') || false;

        if (optionsInput.length < 2 || optionsInput.length > 10) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Podaj od 2 do 10 opcji oddzielonych przecinkami!'
            });
        }

        const optionsFormatted = optionsInput.map((o, i) => `> \`${EMOJIS[i]}\` ${o}`).join('\n');

        let pollMessage = `## 📊 **Klanowe Głosowanie**\n` +
                          `- 💬 **Pytanie:** ${question}\n`;

        if (duration) {
            pollMessage += `- ⏳ **Czas trwania:** ${duration}\n`;
        }

        pollMessage += `\n${optionsFormatted}\n\n` +
                      `👤 **Autor:** ${interaction.user} ${isAnonymous ? '*(Ankieta anonimowa)*' : ''}`;

        const message = await interaction.channel.send({ content: pollMessage });

        for (let i = 0; i < optionsInput.length; i++) {
            await message.react(EMOJIS[i]);
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        await InteractionHelper.safeEditReply(interaction, {
            content: '✅ Ankieta została pomyślnie utworzona!'
        });
    },
};
