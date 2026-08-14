import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Losowo dzieli osoby z Twojego kanału głosowego na dwie drużyny'),
    
    category: 'Utility',

    async execute(interaction) {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return await interaction.reply({
                content: `> \`❌\` | **Użytkownik:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n> Musisz być na kanale głosowym, aby użyć tej komendy!`,
                ephemeral: true,
            });
        }

        const members = Array.from(channel.members.values()).filter(m => !m.user.bot);
        
        if (members.length < 2) {
            return await interaction.reply({
                content: `> \`⚠️\` | **Użytkownik:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n> Musisz mieć przynajmniej 2 osoby na kanale, aby stworzyć drużyny!`,
                ephemeral: true,
            });
        }

        members.sort(() => Math.random() - 0.5);

        const mid = Math.floor(members.length / 2);
        const team1 = members.slice(0, mid);
        const team2 = members.slice(mid);

        const team1List = team1.map(m => `> • \`🔹\` | **${m.displayName}**`).join('\n');
        const team2List = team2.map(m => `> • \`🔸\` | **${m.displayName}**`).join('\n');

        const teamOutput = `## \`⚔️\` | **Losowanie składów zakończone!**\n\n` +
                           `> **Drużyna A:**\n${team1List}\n\n` +
                           `> **Drużyna B:**\n${team2List}\n\n` +
                           `> \`👤\` | **Autor:** ${interaction.user.tag} (\`${interaction.user.id}\`)`;

        await interaction.reply({ content: teamOutput });
    },
};
