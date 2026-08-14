import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const MAX_OPTIONS = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Stwórz klanowe głosowanie')
        .addStringOption(option =>
            option.setName('pytanie')
                .setDescription('Pytanie w ankiecie')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcja1')
                .setDescription('Pierwsza opcja')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcja2')
                .setDescription('Druga opcja')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcja3')
                .setDescription('Trzecia opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja4')
                .setDescription('Czwarta opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja5')
                .setDescription('Piąta opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja6')
                .setDescription('Szósta opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja7')
                .setDescription('Siódmą opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja8')
                .setDescription('Ósma opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja9')
                .setDescription('Dziewiąta opcja (opcjonalnie)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('opcja10')
                .setDescription('Dziesiąta opcja (opcjonalnie)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('anonimowa')
                .setDescription('Czy ankieta ma być anonimowa (domyślnie: fałsz)')
                .setRequired(false)),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const question = interaction.options.getString('pytanie');
        const isAnonymous = interaction.options.getBoolean('anonimowa') || false;

        const options = [];
        for (let i = 1; i <= MAX_OPTIONS; i++) {
            const option = interaction.options.getString(`opcja${i}`);
            if (option) options.push(option);
        }

        if (options.length < 2) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Musisz podać co najmniej 2 opcje do ankiety.'
            });
        }

        // Formatowanie opcji bez kresek cytatu, ładnie pod sobą
        const optionsFormatted = options.map((option, index) => `${EMOJIS[index]} **${option}**`).join('\n\n');

        const pollMessage = `📊 **Klanowe Głosowanie**\n` +
                            `💬 **Pytanie:** ${question}\n\n` +
                            `${optionsFormatted}\n\n` +
                            `━━━━━━━━━━━━━━━━━━━━\n` +
                            `👤 **Autor:** ${interaction.user} ${isAnonymous ? '*(Ankieta anonimowa)*' : ''}`;

        // Wysyłamy wiadomość bezpośrednio na kanał
        const message = await interaction.channel.send({ content: pollMessage });

        // Dodajemy reakcje pod wiadomością
        for (let i = 0; i < options.length; i++) {
            await message.react(EMOJIS[i]);
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        await InteractionHelper.safeEditReply(interaction, {
            content: '✅ Ankieta została pomyślnie utworzona!'
        });
    },
};
