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
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('czas')
                .setDescription('Czas trwania (np. 1m = 1 minuta, 2h = 2 godziny, 1d = 1 dzień)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja1')
                .setDescription('Pierwsza opcja')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja2')
                .setDescription('Druga opcja')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja3')
                .setDescription('Trzecia opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja4')
                .setDescription('Czwarta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja5')
                .setDescription('Piąta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja6')
                .setDescription('Szósta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja7')
                .setDescription('Siódmą opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja8')
                .setDescription('Ósma opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja9')
                .setDescription('Dziewiąta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja10')
                .setDescription('Dziesiąta opcja (opcjonalnie)')
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
        const rawDuration = interaction.options.getString('czas').trim();
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

        // Tłumaczenie skrótów na pełny format
        const formatDuration = (input) => {
            const match = input.match(/^(\d+)([mhd])$/i);
            if (!match) return input; // Jeśli wpisano coś innego, zwracamy oryginał

            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            if (unit === 'm') {
                if (value === 1) return '1 minuta';
                if (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) return `${value} minuty`;
                return `${value} minut`;
            }
            if (unit === 'h') {
                if (value === 1) return '1 godzina';
                if (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) return `${value} godziny`;
                return `${value} godzin`;
            }
            if (unit === 'd') {
                if (value === 1) return '1 dzień';
                return `${value} dni`;
            }

            return input;
        };

        const durationFormatted = formatDuration(rawDuration);
        const optionsFormatted = options.map((option, index) => `> \`${EMOJIS[index]}\` ${option}`).join('\n');

        let pollMessage = `## 📊 **Klanowe Głosowanie**\n` +
                          `> \`💬\` **Pytanie:** ${question}\n` +
                          `> \`⏳\` **Czas trwania:** ${durationFormatted}\n\n` +
                          `${optionsFormatted}\n\n` +
                          `> \`👤\` **Autor:** ${interaction.user} ${isAnonymous ? '*(Ankieta anonimowa)*' : ''}`;

        const message = await interaction.channel.send({ content: pollMessage });

        for (let i = 0; i < options.length; i++) {
            await message.react(EMOJIS[i]);
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        await InteractionHelper.safeEditReply(interaction, {
            content: '✅ Ankieta została pomyślnie utworzona!'
        });
    },
};
