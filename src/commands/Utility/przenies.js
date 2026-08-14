import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('przenies')
        .setDescription('Przenosi wszystkich użytkowników z kanałów głosowych na Twój kanał')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),
    
    category: 'Utility',

    async execute(interaction) {
        const targetChannel = interaction.member?.voice?.channel;

        if (!targetChannel) {
            return await interaction.reply({
                content: `> \`❌\` | **Użytkownik:** ${interaction.user.tag}\n> Musisz być na kanale głosowym, aby kogoś tutaj zwołać!`,
                ephemeral: true,
            });
        }

        const guild = interaction.guild;
        const voiceChannels = guild.channels.cache.filter(c => c.isVoiceBased());
        
        let movedCount = 0;

        await interaction.deferReply({ ephemeral: true });

        for (const [channelId, channel] of voiceChannels) {
            for (const [memberId, member] of channel.members) {
                if (member.user.bot || memberId === interaction.member.id) continue;
                
                try {
                    await member.voice.setChannel(targetChannel);
                    movedCount++;
                } catch (err) {
                    console.error(`Nie udało się przenieść użytkownika ${member.user.tag}:`, err);
                }
            }
        }

        await interaction.editReply({
            content: `> \`✅\` | **Przenoszenie zakończone!** Przeniesiono **${movedCount}** osób na kanał **${targetChannel.name}**.`
        });
    },
};
