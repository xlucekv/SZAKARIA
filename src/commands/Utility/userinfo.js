import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Uzyskaj szczegółowe informacje o użytkowniku")
        .addUserOption((option) =>
            option
                .setName("uzytkownik")
                .setDescription("Użytkownik do sprawdzenia (domyślnie Ty)"),
        ),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`UserInfo interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'userinfo'
            });
            return;
        }

        const user = interaction.options.getUser("uzytkownik") || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        const createdTimestamp = Math.floor(user.createdAt.getTime() / 1000);
        const joinedTimestamp = member?.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;

        const embed = createEmbed({ title: `Informacje o użytkowniku: ${user.username}` })
            .setThumbnail(user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "ID", value: user.id, inline: true },
                { name: "Bot", value: user.bot ? "Tak" : "Nie", inline: true },
                {
                    name: "Role",
                    value:
                        member && member.roles.cache.size > 1
                            ? member.roles.cache
                                  .map((r) => r.name)
                                  .slice(0, 5)
                                  .join(", ")
                            : "Brak",
                    inline: true,
                },
                {
                    name: "Konto utworzono",
                    value: `<t:${createdTimestamp}:R>`,
                    inline: false,
                },
                {
                    name: "Dołączono do serwera",
                    value: joinedTimestamp ? `<t:${joinedTimestamp}:R>` : "Brak na serwerze",
                    inline: false,
                },
                {
                    name: "Najwyższa rola",
                    value: member?.roles?.highest?.name || "Brak",
                    inline: true,
                },
            );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        logger.info(`UserInfo command executed`, {
            userId: interaction.user.id,
            targetUserId: user.id,
            guildId: interaction.guildId
        });
    },
};
