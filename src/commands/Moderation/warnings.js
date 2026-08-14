import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logEvent } from '../../utils/moderation.js';
import { logger } from '../../utils/logger.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Wyświetl wszystkie ostrzeżenia użytkownika")
        .addUserOption((o) =>
            o
                .setName("uzytkownik")
                .setRequired(true)
                .setDescription("Użytkownik, którego ostrzeżenia chcesz sprawdzić"),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    category: "moderation",

    async execute(interaction, config, client) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Warnings interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'warnings',
            });
            return;
        }

        const target = interaction.options.getUser("uzytkownik");
        const guildId = interaction.guildId;

        const validWarnings = await WarningService.getWarnings(guildId, target.id);
        const totalWarns = validWarnings.length;

        if (totalWarns === 0) {
            const noWarnsDescription = `> \`👤\` | **Użytkownik:** ${target.tag} (\`${target.id}\`)\n` +
                                       `> \`✅\` | **Informacja:** Ten użytkownik nie posiada żadnych zarejestrowanych ostrzeżeń.`;

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    createEmbed({
                        title: "Ostrzeżenia Użytkownika",
                        description: noWarnsDescription,
                    }).setColor(getColor('success')),
                ],
            });
            return;
        }

        const description = `> \`👤\` | **Użytkownik:** ${target.tag} (\`${target.id}\`)\n` +
                            `> \`📊\` | **Łączna liczba ostrzeżeń:** ${totalWarns}`;

        const embed = createEmbed({
            title: "Ostrzeżenia Użytkownika",
            description: description,
        }).setColor(getColor('warning'));

        const warningFields = validWarnings
            .map((w, i) => {
                const discordTimestamp = Math.floor(w.timestamp / 1000);
                return {
                    name: `[#${i + 1}] Powód: ${w.reason.substring(0, 100)}`,
                    value: `**Moderator:** <@${w.moderatorId}>\n**Data:** <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>)`,
                    inline: false,
                };
            })
            .slice(0, 25);

        embed.addFields(warningFields);

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`warning_delete_specific:${target.id}:${interaction.user.id}`)
                .setLabel('Usuń konkretne ostrzeżenie')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`warning_clear_all:${target.id}:${interaction.user.id}`)
                .setLabel('Usuń wszystkie ostrzeżenia')
                .setStyle(ButtonStyle.Danger),
        );

        await logEvent({
            client,
            guild: interaction.guild,
            event: {
                action: "Warnings Viewed",
                target: `${target.tag} (${target.id})`,
                executor: `${interaction.user.tag} (${interaction.user.id})`,
                reason: `Viewed ${totalWarns} warnings`,
                metadata: {
                    userId: target.id,
                    moderatorId: interaction.user.id,
                    totalWarnings: totalWarns,
                },
            },
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], components: [actionRow] });
    },
};
