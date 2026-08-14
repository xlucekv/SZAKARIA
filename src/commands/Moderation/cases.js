import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getModerationCases } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('cases')
        .setDescription('Wyświetl historię spraw moderacyjnych i logi')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('filtr')
                .setDescription('Filtruj sprawy według typu lub użytkownika')
                .addChoices(
                    { name: 'Wszystkie sprawy', value: 'all' },
                    { name: 'Bany', value: 'Member Banned' },
                    { name: 'Kicki', value: 'Member Kicked' },
                    { name: 'Wyciszenia', value: 'Member Timed Out' },
                    { name: 'Ostrzeżenia', value: 'User Warned' }
                )
        )
        .addUserOption(option =>
            option.setName('uzytkownik')
                .setDescription('Filtruj sprawy dla konkretnego użytkownika')
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Liczba spraw do pobrania (domyślnie: 10)')
                .setMinValue(1)
                .setMaxValue(50)
        ),

    category: 'moderation',

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Cases interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'cases'
            });
            return;
        }

        try {
            const filterType = interaction.options.getString('filtr') || 'all';
            const targetUser = interaction.options.getUser('uzytkownik');
            const limit = interaction.options.getInteger('limit') || 10;

            const filters = {
                limit,
                action: filterType === 'all' ? undefined : filterType,
                userId: targetUser?.id
            };

            const cases = await getModerationCases(interaction.guild.id, filters);

            if (!cases || cases.length === 0) {
                const noCasesMsg = targetUser 
                    ? `Nie znaleziono żadnych spraw moderacyjnych dla użytkownika **${targetUser.tag}**.`
                    : `Nie znaleziono żadnych spraw moderacyjnych na tym serwerze.`;
                
                return await interaction.editReply({
                    content: `> \`⚠️\` | ${noCasesMsg}`
                });
            }

            const CASES_PER_PAGE = 5;
            const totalPages = Math.ceil(cases.length / CASES_PER_PAGE);
            let currentPage = 1;

            const createCasesEmbed = (page) => {
                const startIndex = (page - 1) * CASES_PER_PAGE;
                const endIndex = startIndex + CASES_PER_PAGE;
                const pageCases = cases.slice(startIndex, endIndex);

                const embed = createEmbed({
                    title: '📋 Sprawy Moderacyjne',
                    description: `> \`📊\` | Wyświetlanie spraw dla serwera **${interaction.guild.name}**\n> \`📖\` | **Strona ${page} z ${totalPages}**`
                });

                pageCases.forEach(case_ => {
                    const date = new Date(case_.createdAt).toLocaleDateString('pl-PL');
                    const time = new Date(case_.createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                    
                    embed.addFields({
                        name: `Sprawa #${case_.caseId} — ${case_.action}`,
                        value: `> \`👤\` | **Użytkownik:** ${case_.target}\n` +
                               `> \`🛡️\` | **Moderator:** ${case_.executor}\n` +
                               `> \`📅\` | **Data:** ${date} o ${time}\n` +
                               `> \`📝\` | **Powód:** ${case_.reason || 'Brak podanego powodu'}`,
                        inline: false
                    });
                });

                embed.setFooter({
                    text: `Wszystkich spraw: ${cases.length} | Filtr: ${filterType}${targetUser ? ` | Użytkownik: ${targetUser.tag}` : ''}`
                });

                return embed;
            };

            const createNavigationRow = (page) => {
                const row = new ActionRowBuilder();
                
                const prevButton = new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('⬅️ Poprzednia')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 1);

                const pageInfoButton = new ButtonBuilder()
                    .setCustomId('page_info')
                    .setLabel(`Strona ${page}/${totalPages}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const nextButton = new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Następna ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === totalPages);

                row.addComponents(prevButton, pageInfoButton, nextButton);
                return row;
            };

            const message = await interaction.editReply({ 
                embeds: [createCasesEmbed(currentPage)], 
                components: [createNavigationRow(currentPage)]
            });

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({
                        content: '> `❌` | Nie możesz używać tych przycisków. Użyj komendy `/cases`, aby wygenerować własny podgląd.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                await buttonInteraction.deferUpdate();

                const { customId } = buttonInteraction;

                if (customId === 'prev_page' && currentPage > 1) {
                    currentPage--;
                } else if (customId === 'next_page' && currentPage < totalPages) {
                    currentPage++;
                }

                await interaction.editReply({
                    embeds: [createCasesEmbed(currentPage)],
                    components: [createNavigationRow(currentPage)]
                });
            });

            collector.on('end', async () => {
                const disabledRow = createNavigationRow(currentPage);
                disabledRow.components.forEach(button => button.setDisabled(true));
                
                try {
                    await message.edit({
                        components: [disabledRow]
                    });
                } catch (error) {
                    // Ignoruj błąd, jeśli wiadomość została usunięta
                }
            });

        } catch (error) {
            logger.error('Error in cases command:', error);
            return await replyUserError(interaction, { 
                type: ErrorTypes.UNKNOWN, 
                message: 'Wystąpił błąd podczas pobierania spraw moderacyjnych. Spróbuj ponownie później.' 
            });
        }
    }
};
