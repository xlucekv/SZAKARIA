import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { saveCollection } from '../../services/collectionService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('zbiorka')
        .setDescription('Stwórz nową zbiórkę klanową dla rangi Szak')
        .addStringOption(option =>
            option.setName('tytul')
                .setDescription('Nazwa zbiórki (np. Smocze Odłamki)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    category: 'Community',

    async execute(interaction, config, client) {
        await interaction.deferReply({ ephemeral: true });

        const title = interaction.options.getString('tytul');
        const guild = interaction.guild;

        const szakRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'szak');

        if (!szakRole) {
            return await interaction.editReply({
                content: 'Nie znaleziono na serwerze roli o nazwie **Szak**.'
            });
        }

        await guild.members.fetch();
        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(szakRole.id) && !member.user.bot);

        if (membersWithRole.size === 0) {
            return await interaction.editReply({
                content: 'Brak użytkowników z rangą **Szak** na serwerze.'
            });
        }

        const deposits = {};
        membersWithRole.forEach(member => {
            deposits[member.id] = 0;
        });

        const listText = membersWithRole.map(member => `❌ ${member}`).join('\n');

        const embed = successEmbed(
            `📦 Zbiórka — ${title}`,
            `**Lista członków klanu:**\n\n${listText}\n\n**Suma:** 0 ${title}`
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('zbiorka_deposit')
                .setLabel('Zgłoś wpłatę')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💰')
        );

        const message = await interaction.channel.send({
            embeds: [embed],
            components: [row]
        });

        await saveCollection(message.id, {
            title,
            deposits,
            roleId: szakRole.id,
            channelId: interaction.channelId
        });

        await interaction.editReply({
            content: 'Pomyślnie utworzono panel zbiórki!'
        });
    }
};
