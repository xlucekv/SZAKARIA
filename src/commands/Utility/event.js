import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Stwórz zaproszenie na klanową zbiórkę lub wydarzenie')
        .addStringOption(option =>
            option.setName('tytul')
                .setDescription('Nazwa wydarzenia')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('czas')
                .setDescription('Kiedy się odbędzie (np. Dzisiaj o 20:00, Piątek 19:30)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Dodatkowe informacje lub wymagania (opcjonalnie)')
                .setRequired(false)
        ),

    category: 'Utility',

    async execute(interaction) {
        const title = interaction.options.getString('tytul');
        const time = interaction.options.getString('czas');
        const description = interaction.options.getString('opis');

        let eventMessage = `## 📢 **Klanowe Wydarzenie**\n` +
                           `> \`🎯\` **Nazwa:** ${title}\n` +
                           `> \`⏰\` **Termin:** ${time}\n`;

        if (description) {
            eventMessage += `> \`💬\` **Opis:** ${description}\n`;
        }

        eventMessage += `\n> \`👤\` **Organizator:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n\n` +
                        `### Deklaracje udziału:\n` +
                        `- \`✅\` **Będę:** (0)\n` +
                        `- \`❌\` **Nie będę:** (0)\n` +
                        `- \`❓\` **Niezdecydowani:** (0)`;

        await interaction.reply({
            content: eventMessage,
        });
    },
};
