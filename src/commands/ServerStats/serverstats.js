import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

import { handleCreate } from './modules/serverstats_create.js';
import { handleList } from './modules/serverstats_list.js';
import { handleUpdate } from './modules/serverstats_update.js';
import { handleDelete } from './modules/serverstats_delete.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("serverstats")
        .setDescription("Zarządzaj statystykami serwera śledzącymi liczbę członków i kanałów")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription("Utwórz nowy kanał ze statystykami w wybranej kategorii")
                .addStringOption(option =>
                    option
                        .setName("typ")
                        .setDescription("Typ statystyk do śledzenia")
                        .setRequired(true)
                        .addChoices(
                            { name: "użytkownicy + boty", value: "members" },
                            { name: "tylko użytkownicy", value: "members_only" },
                            { name: "tylko boty", value: "bots" }
                        )
                )
                .addStringOption(option =>
                    option
                        .setName("typ_kanalu")
                        .setDescription("Typ kanału utworzonego dla tego licznika")
                        .setRequired(true)
                        .addChoices(
                            { name: "kanał głosowy (zalecany)", value: "voice" },
                            { name: "kanał tekstowy", value: "text" }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName("kategoria")
                        .setDescription("Kategoria, w której zostanie utworzony kanał ze statystykami")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildCategory)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Wyświetl listę wszystkich liczników statystyk na tym serwerze")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("update")
                .setDescription("Zaktualizuj istniejący licznik statystyk")
                .addStringOption(option =>
                    option
                        .setName("id_licznika")
                        .setDescription("ID licznika do zaktualizowania")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("typ")
                        .setDescription("Nowy typ licznika")
                        .setRequired(false)
                        .addChoices(
                            { name: "użytkownicy + boty", value: "members" },
                            { name: "tylko użytkownicy", value: "members_only" },
                            { name: "tylko boty", value: "bots" }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Usuń istniejący licznik statystyk")
                .addStringOption(option =>
                    option
                        .setName("id_licznika")
                        .setDescription("ID licznika do usunięcia")
                        .setRequired(true)
                )
        ),

    async execute(interaction, guildConfig, client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case "create":
                await handleCreate(interaction, client);
                break;
            case "list":
                await handleList(interaction, client);
                break;
            case "update":
                await handleUpdate(interaction, client);
                break;
            case "delete":
                await handleDelete(interaction, client);
                break;
            default:
                await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Nieznana podkomenda.' });
        }
    }
};
