import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { getColor } from '../../config/bot.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('randomuser')
        .setDescription('Wybierz losowego użytkownika z serwera')
        .addRoleOption(option =>
            option.setName('rola')
                .setDescription('Ogranicz wybór do użytkowników z tą rolą')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('boty')
                .setDescription('Uwzględnij boty w wyborze (domyślnie: fałsz)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('online')
                .setDescription('Wybieraj tylko spośród użytkowników online (domyślnie: fałsz)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('wspomnij')
                .setDescription('Oznacz/wspomnij wybranego użytkownika (domyślnie: fałsz)')
                .setRequired(false)),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`RandomUser interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'randomuser'
            });
            return;
        }

        if (!interaction.guild) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Ta komenda może być używana tylko na serwerze.',
            });
        }

        const role = interaction.options.getRole('rola');
        const includeBots = interaction.options.getBoolean('boty') || false;
        const onlineOnly = interaction.options.getBoolean('online') || false;
        const shouldMention = interaction.options.getBoolean('wspomnij') || false;

        let members = interaction.guild.members.cache.filter(member => {
            if (member.user.bot && !includeBots) return false;

            if (onlineOnly && member.presence?.status === 'offline') return false;

            if (role && !member.roles.cache.has(role.id)) return false;

            return true;
        });

        let memberArray = Array.from(members.values());

        if (!includeBots) {
            memberArray = memberArray.filter(member => !member.user.bot);
        }

        if (memberArray.length === 0) {
            let errorMessage = 'Nie znaleziono użytkowników spełniających Twoje filtry:';
            if (role) errorMessage = `Żaden użytkownik nie posiada roli **${role.name}**.`;
            if (onlineOnly) errorMessage = 'Żaden użytkownik nie jest obecnie online.';
            if (role && onlineOnly) errorMessage = `Żaden członek z rolą **${role.name}** nie jest online.`;

            return replyUserError(interaction, {
                type: ErrorTypes.USER_INPUT,
                message: errorMessage + '\n\nSpróbuj dostosować filtry.',
            });
        }

        const randomIndex = Math.floor(Math.random() * memberArray.length);
        const selectedMember = memberArray[randomIndex];

        const user = selectedMember.user;
        const joinDate = selectedMember.joinedAt;
        const roles = selectedMember.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .slice(0, 10);

        const embed = successEmbed(
            '🎲 Wybrano losowego użytkownika',
            shouldMention ? `${selectedMember}` : `**${user.username}**`
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: 'Nazwa użytkownika', value: user.username, inline: true },
            { name: 'Bot', value: user.bot ? 'Tak' : 'Nie', inline: true },
            { name: `Role (${roles.length})`, value: roles.length > 0 ? roles.slice(0, 5).join('') + (roles.length > 5 ? `+${roles.length - 5} więcej` : '') : 'Brak ról', inline: false }
        )
        .setColor('primary');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`randomuser_${interaction.user.id}_again`)
                    .setLabel('🎲 Losuj innego użytkownika')
                    .setStyle(ButtonStyle.Primary)
            );

        const response = await interaction.editReply({
            content: shouldMention ? `${selectedMember}, zostałeś/aś wybrany/a!` : null,
            embeds: [embed],
            components: [row],
            allowedMentions: { users: shouldMention ? [user.id] : [] }
        });

        const filter = (i) => i.customId === `randomuser_${interaction.user.id}_again` && i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 300000 });

        collector.on('collect', async (i) => {
            try {
                let newMembers = interaction.guild.members.cache.filter(member => {
                    if (member.user.bot && !includeBots) return false;

                    if (onlineOnly && member.presence?.status === 'offline') return false;

                    if (role && !member.roles.cache.has(role.id)) return false;

                    return true;
                });

                let newMemberArray = Array.from(newMembers.values());

                if (!includeBots) {
                    newMemberArray = newMemberArray.filter(member => !member.user.bot);
                }

                if (newMemberArray.length === 0) {
                    await replyUserError(i, {
                        type: ErrorTypes.USER_INPUT,
                        message: 'Nie znaleziono użytkowników spełniających kryteria.',
                    });
                    return;
                }

                const newRandomIndex = Math.floor(Math.random() * newMemberArray.length);
                const newSelectedMember = newMemberArray[newRandomIndex];
                const newUser = newSelectedMember.user;

                const newRoles = newSelectedMember.roles.cache
                    .filter(r => r.id !== interaction.guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map(r => r.toString())
                    .slice(0, 10);

                const newEmbed = successEmbed(
                    '🎲 Wybrano losowego użytkownika',
                    shouldMention ? `${newSelectedMember}` : `**${newUser.username}**`
                )
                .setThumbnail(newUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: 'Nazwa użytkownika', value: newUser.username, inline: true },
                    { name: 'Bot', value: newUser.bot ? 'Tak' : 'Nie', inline: true },
                    { name: `Role (${newRoles.length})`, value: newRoles.length > 0 ? newRoles.slice(0, 5).join('') + (newRoles.length > 5 ? `+${newRoles.length - 5} więcej` : '') : 'Brak ról', inline: false }
                )
                .setColor(newSelectedMember.displayHexColor || '#3498db');

                await i.update({
                    content: shouldMention ? `${newSelectedMember}, zostałeś/aś wybrany/a!` : null,
                    embeds: [newEmbed],
                    components: [row],
                    allowedMentions: { users: shouldMention ? [newUser.id] : [] }
                });

            } catch (error) {
                logger.error('Button interaction error:', error);
                await i.reply({
                    content: 'Wystąpił błąd podczas wybierania kolejnego użytkownika.',
                    flags: ['Ephemeral']
                });
            }
        });

        collector.on('end', () => {
            const disabledRow = ActionRowBuilder.from(row).setComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true)
            );

            interaction.editReply({ components: [disabledRow] }).catch(console.error);
        });
    },
};
