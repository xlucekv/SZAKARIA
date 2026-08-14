import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Tworzy panel zarządzania biletami'),
    
    category: 'Utility',

    async execute(interaction) {
        await interaction.reply({
            content: '> 🎫 | Panel biletów jest w budowie!',
            ephemeral: true,
        });
    },
};
