import { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getFromDb, setInDb } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import crypto from 'crypto';

function generateShareId() {
    return crypto.randomBytes(16).toString('hex');
}

export default {
    data: new SlashCommandBuilder()
        .setName("todo")
        .setDescription("Zarządzaj swoją osobistą listą zadań")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Dodaj zadanie do swojej listy zadań")
                .addStringOption(option =>
                    option
                        .setName("zadanie")
                        .setDescription("Zadanie do dodania")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("Wyświetl swoją listę zadań")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("complete")
                .setDescription("Oznacz zadanie jako ukończone")
                .addIntegerOption(option =>
                    option
                        .setName("numer")
                        .setDescription("Numer zadania do ukończenia")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Usuń zadanie ze swojej listy zadań")
                .addIntegerOption(option =>
                    option
                        .setName("numer")
                        .setDescription("Numer zadania do usunięcia")
                        .setRequired(true)
                )
        )
        .addSubcommandGroup(group => 
            group
                .setName("share")
                .setDescription("Zarządzaj udostępnionymi listami zadań")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("create")
                        .setDescription("Utwórz nową udostępnioną listę zadań")
                        .addStringOption(option =>
                            option
                                .setName("nazwa")
                                .setDescription("Nazwa udostępnionej listy")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("add")
                        .setDescription("Dodaj członka do udostępnionej listy")
                        .addStringOption(option =>
                            option
                                .setName("id_listy")
                                .setDescription("ID udostępnionej listy")
                                .setRequired(true)
                        )
                        .addUserOption(option =>
                            option
                                .setName("uzytkownik")
                                .setDescription("Użytkownik do dodania do listy")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("view")
                        .setDescription("Wyświetl udostępnioną listę zadań")
                        .addStringOption(option =>
                            option
                                .setName("id_listy")
                                .setDescription("ID udostępnionej listy")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("addtask")
                        .setDescription("Dodaj zadanie do udostępnionej listy zadań")
                        .addStringOption(option =>
                            option
                                .setName("id_listy")
                                .setDescription("ID udostępnionej listy")
                                .setRequired(true)
                        )
                        .addStringOption(option =>
                            option
                                .setName("zadanie")
                                .setDescription("Zadanie do dodania")
                                .setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName("remove")
                        .setDescription("Usuń zadanie z udostępnionej listy zadań")
                        .addStringOption(option =>
                            option
                                .setName("id_listy")
                                .setDescription("ID udostępnionej listy")
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName("numer")
                                .setDescription("Numer zadania do usunięcia")
                                .setRequired(true)
                        )
                )
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),
    category: "Utility",

    async execute(interaction, config, client) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();
        const shareSubcommand = interaction.options.getSubcommandGroup() === 'share' ? interaction.options.getSubcommand() : null;

        async function getOrCreateSharedList(listId, creatorId = null, listName = null) {
            const listKey = `shared_todo_${listId}`;
            let listData = await getFromDb(listKey, null);
            
            if (!listData || (listData.ok === false && listData.error)) {
                if (creatorId) {
                    listData = {
                        id: listId,
                        name: listName,
                        creatorId,
                        members: [creatorId],
                        tasks: [],
                        nextId: 1,
                        createdAt: new Date().toISOString()
                    };
                    await setInDb(listKey, listData);
                } else {
                    return null;
                }
            }
            
            if (listData) {
                if (!Array.isArray(listData.tasks)) listData.tasks = [];
                if (!listData.nextId) listData.nextId = 1;
                if (!Array.isArray(listData.members)) listData.members = [];
            }
            
            return listData;
        }

        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Todo interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'todo'
            });
            return;
        }

        if (shareSubcommand) {
            switch (shareSubcommand) {
                case 'create': {
                    const listName = interaction.options.getString('nazwa');
                    const listId = generateShareId();

                    await getOrCreateSharedList(listId, userId, listName);

                    const userSharedLists = await getFromDb(`user_shared_lists_${userId}`, []);
                    const sharedListsArray = Array.isArray(userSharedLists) ? userSharedLists : [];
                    if (!sharedListsArray.includes(listId)) {
                        sharedListsArray.push(listId);
                        await setInDb(`user_shared_lists_${userId}`, sharedListsArray);
                    }

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(
                                "Utworzono udostępnioną listę",
                                `Utworzono udostępnioną listę "${listName}" o ID: \`${listId}\`\n` +
                                `Użyj \`/todo share add id_listy:${listId} uzytkownik:@nazwa_użytkownika\`, aby dodać członków.`
                            )
                        ]
                    });
                }

                case 'add': {
                    const listId = interaction.options.getString('id_listy');
                    const memberToAdd = interaction.options.getUser('uzytkownik');

                    const listData = await getOrCreateSharedList(listId);
                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono udostępnionej listy.' });
                    }

                    if (listData.creatorId !== userId) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Tylko twórca listy może dodawać członków.' });
                    }

                    if (!listData.members.includes(memberToAdd.id)) {
                        listData.members.push(memberToAdd.id);
                        await setInDb(`shared_todo_${listId}`, listData);

                        const memberLists = await getFromDb(`user_shared_lists_${memberToAdd.id}`, []);
                        const memberListsArray = Array.isArray(memberLists) ? memberLists : [];
                        if (!memberListsArray.includes(listId)) {
                            memberListsArray.push(listId);
                            await setInDb(`user_shared_lists_${memberToAdd.id}`, memberListsArray);
                        }

                        return await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                successEmbed('Dodano członka', 
                                    `Dodano ${memberToAdd.username} do udostępnionej listy "${listData.name}"`
                                )
                            ]
                        });
                    } else {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Użytkownik jest już członkiem tej listy.' });
                    }
                }

                case 'view': {
                    const listId = interaction.options.getString('id_listy');
                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono udostępnionej listy.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie masz dostępu do tej listy.' });
                    }

                    if (listData.tasks.length === 0) {
                        const memberList = listData.members.map(memberId => {
                            const member = interaction.guild.members.cache.get(memberId);
                            return member ? member.user.username : `<@${memberId}>`;
                        }).join(',');

                        const owner = interaction.guild.members.cache.get(listData.creatorId);
                        const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                        return await InteractionHelper.safeEditReply(interaction, {
                            embeds: [
                                successEmbed(
                                    `📋 **${listData.name}**\n\n` +
                                    `👑 **Właściciel:** ${ownerName}\n` +
                                    `👥 **Członkowie:** ${memberList}\n\n` +
                                    `*Ta lista jest obecnie pusta. Użyj przycisku "Dodaj zadanie", aby dodać nowe zadanie!*`,
                                    `Udostępniona lista (ID: \`${listId}\`)`
                                )
                            ],
                            components: [
                                new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`shared_todo_add_${listId}`)
                                        .setLabel('Dodaj zadanie')
                                        .setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder()
                                        .setCustomId(`shared_todo_complete_${listId}`)
                                        .setLabel('Ukończ zadanie')
                                        .setStyle(ButtonStyle.Success),
                                    new ButtonBuilder()
                                        .setCustomId(`shared_todo_remove_${listId}`)
                                        .setLabel('Usuń zadanie')
                                        .setStyle(ButtonStyle.Danger)
                                )
                            ]
                        });
                    }

                    const taskList = listData.tasks
                        .map(task => 
                            `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                            `\`[${new Date(task.createdAt).toLocaleDateString()}]` +
                            (task.completed ? `• Ukończone przez ${task.completedBy}` : '') + '`'
                        )
                        .join('\n');

                    const memberList = listData.members.map(memberId => {
                        const member = interaction.guild.members.cache.get(memberId);
                        return member ? member.user.username : `<@${memberId}>`;
                    }).join(',');

                    const owner = interaction.guild.members.cache.get(listData.creatorId);
                    const ownerName = owner ? owner.user.username : `<@${listData.creatorId}>`;

                    const fullListDisplay = `📋 **${listData.name}**\n\n` +
                        `👑 **Właściciel:** ${ownerName}\n` +
                        `👥 **Członkowie:** ${memberList}\n\n` +
                        `**Zadania:**\n${taskList}`;

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed(`Udostępniona lista (ID: \`${listId}\`)`, fullListDisplay)
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_add_${listId}`)
                                    .setLabel('Dodaj zadanie')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_complete_${listId}`)
                                    .setLabel('Ukończ zadanie')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId(`shared_todo_remove_${listId}`)
                                    .setLabel('Usuń zadanie')
                                    .setStyle(ButtonStyle.Danger)
                            )
                        ]
                    });
                }

                case 'addtask': {
                    const listId = interaction.options.getString('id_listy');
                    const taskText = interaction.options.getString('zadanie');

                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono udostępnionej listy.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie masz dostępu do tej listy.' });
                    }

                    const newTask = {
                        id: listData.nextId++,
                        text: taskText,
                        completed: false,
                        createdAt: new Date().toISOString(),
                        createdBy: userId
                    };

                    listData.tasks.push(newTask);
                    await setInDb(`shared_todo_${listId}`, listData);

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Dodano zadanie', `Dodano "${taskText}" do udostępnionej listy "${listData.name}"`)
                        ]
                    });
                }

                case 'remove': {
                    const listId = interaction.options.getString('id_listy');
                    const taskNumber = interaction.options.getInteger('numer');

                    const listData = await getOrCreateSharedList(listId);

                    if (!listData) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono udostępnionej listy.' });
                    }

                    if (!listData.members.includes(userId)) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie masz dostępu do tej listy.' });
                    }

                    const taskIndex = listData.tasks.findIndex(task => task.id === taskNumber);
                    if (taskIndex === -1) {
                        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono zadania.' });
                    }

                    const [removedTask] = listData.tasks.splice(taskIndex, 1);
                    await setInDb(`shared_todo_${listId}`, listData);

                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [
                            successEmbed('Usunięto zadanie', `Usunięto "${removedTask.text}" z udostępnionej listy "${listData.name}".`)
                        ]
                    });
                }
            }
            return;
        }

        const dbKey = `todo_${userId}`;

        const userData = await getFromDb(dbKey, {
            tasks: [],
            nextId: 1
        });

        if (!userData.tasks) userData.tasks = [];
        if (!userData.nextId) userData.nextId = 1;

        switch (subcommand) {
            case 'add': {
                const taskText = interaction.options.getString('zadanie');

                const newTask = {
                    id: userData.nextId++,
                    text: taskText,
                    completed: false,
                    createdAt: new Date().toISOString()
                };

                userData.tasks.push(newTask);
                await setInDb(dbKey, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed(
                            "Dodano zadanie",
                            `Dodano "${taskText}" do Twojej listy zadań.`
                        ),
                    ],
                });
            }

            case 'list': {
                if (userData.tasks.length === 0) {
                    return await InteractionHelper.safeEditReply(interaction, {
                        embeds: [successEmbed('Twoja lista zadań jest pusta!', "Twoja lista zadań")],
                    });
                }

                const taskList = userData.tasks
                    .map(task => 
                        `${task.completed ? '✅' : '📝'} #${task.id} ${task.text}` +
                        `\`[${new Date(task.createdAt).toLocaleDateString()}]\``
                    )
                    .join('\n');

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Twoja lista zadań', taskList)
                    ],
                });
            }

            case 'complete': {
                const taskNumber = interaction.options.getInteger('numer');
                const task = userData.tasks.find(t => t.id === taskNumber);

                if (!task) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono zadania.' });
                }

                if (task.completed) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: `Zadanie #${task.id} zostało już ukończone.` });
                }

                task.completed = true;
                await setInDb(`todo_${userId}`, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Ukończono zadanie', `Oznaczono "${task.text}" jako ukończone!`)
                    ],
                });
            }

            case 'remove': {
                const taskNumber = interaction.options.getInteger('numer');
                const taskIndex = userData.tasks.findIndex(t => t.id === taskNumber);

                if (taskIndex === -1) {
                    return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nie znaleziono zadania.' });
                }

                const [removedTask] = userData.tasks.splice(taskIndex, 1);
                await setInDb(`todo_${userId}`, userData);

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [
                        successEmbed('Usunięto zadanie', `Usunięto "${removedTask.text}" z Twojej listy zadań.`)
                    ],
                });
            }

            default:
                return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nieprawidłowa podkomenda.' });
        }
    },
};
