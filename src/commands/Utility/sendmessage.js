import { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('sendmessage')
        .setDescription('Otwiera okno wysyłania jednorazowej wiadomości DM do wszystkich')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    category: 'Admin',

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('send_global_dm_modal')
            .setTitle('Wiadomość globalna do wszystkich');

        const messageInput = new TextInputBuilder()
            .setCustomId('dm_content')
            .setLabel('Treść wiadomości do wysłania:')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Wpisz tutaj treść ogłoszenia...')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(messageInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },

    async handleModal(interaction) {
        if (!interaction.isModalSubmit() || interaction.customId !== 'send_global_dm_modal') return;

        const text = interaction.fields.getTextInputValue('dm_content');
        await interaction.reply({ content: `> \`⏳\` | Rozpoczynam wysyłanie wiadomości do użytkowników...`, ephemeral: true });

        const guild = interaction.guild;
        await guild.members.fetch();

        let successCount = 0;
        let failCount = 0;

        for (const [memberId, member] of guild.members.cache) {
            if (member.user.bot) continue;

            try {
                await member.send({
                    content: `> \`📢\` | **Wiadomość z serwera ${guild.name}:**\n\n${text}`
                });
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        await interaction.editReply({
            content: `> \`✅\` | **Rozesłano wiadomości!**\n> • Dostarczono: **${successCount}**\n> • Nie udało się (zamknięte PW): **${failCount}**`
        });
    }
};
