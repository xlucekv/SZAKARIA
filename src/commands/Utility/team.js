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

        for (let i = members.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [members[i], members[j]] = [members[j], members[i]];
        }

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

        setTimeout(async () => {
            try {
                const message = await interaction.fetchReply().catch(() => null);
                if (message) {
                    await message.delete().catch(() => {});
                }
            } catch (err) {
                console.error('Błąd podczas usuwania wiadomości z drużynami:', err);
            }
        }, 60 * 1000);
    },
};
