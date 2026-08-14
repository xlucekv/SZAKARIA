import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { saveCollection } from '../../services/collectionService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('zbiorka')
        .setDescription('Stwórz nową zbiórkę klanową dla wybranej roli')
        .addStringOption(option =>
            option.setName('tytul')
                .setDescription('Nazwa zbiórki (np. Smocze Odłamki)')
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('rola')
                .setDescription('Rola klanowa, dla której robimy zbiórkę')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    category: 'Community',

    async execute(interaction, config, client) {
        await interaction.deferReply({ ephemeral: true });

        const title = interaction.options.getString('tytul');
        const targetRole = interaction.options.getRole('rola');
        const guild = interaction.guild;

        await guild.members.fetch();
        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(targetRole.id) && !member.user.bot);

        if (membersWithRole.size === 0) {
            return await interaction.editReply({
                content: `Brak użytkowników z rangą **${targetRole.name}** na serwerze.`
            });
        }

        const deposits = {};
        membersWithRole.forEach(member => {
            deposits[member.id] = 0;
        });

        // Używamy bezpiecznych znaków [-] zamiast emotek
        const listText = membersWithRole.map(member => `[-] ${member}`).join('\n');

        const embed = successEmbed(
            `Zbiórka — ${title}`,
            `**Lista członków (${targetRole.name}):**\n\n${listText}\n\n**Suma:**\n\`\`\`ansi\n\u001b[1;32m0\u001b[0m ${title}\n\`\`\``
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('zbiorka_deposit')
                .setLabel('Zgłoś wpłatę')
                .setStyle(ButtonStyle.Primary)
        );

        const message = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await saveCollection(message.id, {
            title,
            deposits,
            roleId: targetRole.id,
            channelId: interaction.channelId
        });

        await interaction.editReply({
            content: `Pomyślnie utworzono panel zbiórki dla roli **${targetRole.name}**!`
        });
    }
};
