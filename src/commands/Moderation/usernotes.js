import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, infoEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getFromDb, setInDb, getUserNotesKey } from '../../utils/database.js';
import { sanitizeInput } from '../../utils/validation.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName("usernotes")
        .setDescription("Zarządzaj notatkami o użytkownikach na potrzeby moderacji")
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Dodaj notatkę przypisaną do użytkownika")
                .addUserOption(option =>
                    option
                        .setName("uzytkownik")
                        .setDescription("Użytkownik, do którego chcesz dodać notatkę")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("notatka")
                        .setDescription("Treść notatki")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("typ")
                        .setDescription("Typ notatki")
                        .addChoices(
                            { name: "Ostrzeżenie (Warning)", value: "warning" },
                            { name: "Pozytywna (Positive)", value: "positive" },
                            { name: "Neutralna (Neutral)", value: "neutral" },
                            { name: "Alert (Alert)", value: "alert" }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("Wyświetl notatki użytkownika")
                .addUserOption(option =>
                    option
                        .setName("uzytkownik")
                        .setDescription("Użytkownik, którego notatki chcesz zobaczyć")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Usuń konkretną notatkę użytkownika")
                .addUserOption(option =>
                    option
                        .setName("uzytkownik")
                        .setDescription("Użytkownik, któremu chcesz usunąć notatkę")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName("indeks")
                        .setDescription("Numer/indeks notatki do usunięcia")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("clear")
                .setDescription("Usuń wszystkie notatki użytkownika")
                .addUserOption(option =>
                    option
                        .setName("uzytkownik")
                        .setDescription("Użytkownik, którego notatki chcesz wyczyścić")
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    category: "moderation",

    async execute(interaction, config, client) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("uzytkownik");
        const guildId = interaction.guild.id;

        if (subcommand !== "view" && subcommand !== "remove" && subcommand !== "clear" && subcommand !== "add") {
            return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Wybierz poprawną podkomendę.' });
        }

        let notes = [];
        if (targetUser) {
            const notesKey = getUserNotesKey(guildId, targetUser.id);
            notes = await getFromDb(notesKey, []);
        }

        try {
            switch (subcommand) {
                case "add":
                    return await handleAddNote(interaction, targetUser, notes, guildId);
                case "view":
                    return await handleViewNotes(interaction, targetUser, notes);
                case "remove":
                    return await handleRemoveNote(interaction, targetUser, notes, guildId);
                case "clear":
                    return await handleClearNotes(interaction, targetUser, notes, guildId);
                default:
                    return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Wybierz poprawną podkomendę.' });
            }
        } catch (error) {
            logger.error(`Error in usernotes command (${subcommand}):`, error);
            return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Wystąpił błąd podczas przetwarzania żądania. Spróbuj ponownie później.' });
        }
    }
};

async function handleAddNote(interaction, targetUser, notes, guildId) {
    let note = interaction.options.getString("notatka").trim();
    const type = interaction.options.getString("typ") || "neutral";

    if (note.length > 1000) {
        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Treść notatki może mieć maksymalnie 1000 znaków.' });
    }

    if (note.length === 0) {
        return await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Notatka nie może być pusta.' });
    }

    note = sanitizeInput(note);

    const noteData = {
        id: Date.now(),
        content: note,
        type: type,
        author: interaction.user.tag,
        authorId: interaction.user.id,
        timestamp: new Date().toISOString()
    };

    notes.push(noteData);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(type);

    const description = `> ${typeInfo.emoji} | **Użytkownik:** ${targetUser.tag} (\`${targetUser.id}\`)\n` +
                        `> \`🏷️\` | **Typ:** ${typeInfo.label}\n` +
                        `> \`💬\` | **Treść:** ${note}\n` +
                        `> \`🛡️\` | **Moderator:** ${interaction.user.tag}\n` +
                        `> \`📊\` | **Łączna liczba notatek:** ${notes.length}`;

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                "Dodano Notatkę",
                description
            )
        ]
    });
}

async function handleViewNotes(interaction, targetUser, notes) {
    if (notes.length === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "Brak Notatek",
                    `> \`📝\` | Użytkownik **${targetUser.tag}** nie posiada żadnych notatek.`
                ),
            ],
        });
    }

    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let description = `> \`👤\` | **Notatki dla:** ${targetUser.tag} (\`${targetUser.id}\`)\n\n`;

    sortedNotes.forEach((note, index) => {
        const typeInfo = getNoteTypeInfo(note.type);
        const date = new Date(note.timestamp).toLocaleDateString("pl-PL");
        description += `> ${typeInfo.emoji} **Notatka #${index + 1}** [${typeInfo.label}] - \`${date}\`\n`;
        description += `> \`💬\` ${note.content}\n`;
        description += `> \`👤\` *Dodana przez ${note.author}*\n\n`;
    });

    if (description.length > 4000) {
        description = description.substring(0, 3900) + "\n> \`...\` *(obcięto treść ze względu na limit znaków)*";
    }

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            infoEmbed(
                `Notatki Użytkownika (${notes.length})`,
                description
            )
        ]
    });
}

async function handleRemoveNote(interaction, targetUser, notes, guildId) {
    const index = interaction.options.getInteger("indeks") - 1;

    if (index < 0 || index >= notes.length) {
        return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: `Podaj prawidłowy indeks notatki (1-${notes.length}).` });
    }

    const sortedNotes = [...notes].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const removedNote = sortedNotes[index];
    const originalIndex = notes.indexOf(removedNote);
    notes.splice(originalIndex, 1);

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const typeInfo = getNoteTypeInfo(removedNote.type);

    const description = `> ${typeInfo.emoji} | **Usunięto notatkę #${index + 1} dla:** ${targetUser.tag}\n` +
                        `> \`💬\` | **Usunięta treść:** ${removedNote.content}\n` +
                        `> \`📊\` | **Pozostałe notatki:** ${notes.length}`;

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                "Usunięto Notatkę",
                description
            )
        ]
    });
}

async function handleClearNotes(interaction, targetUser, notes, guildId) {
    const noteCount = notes.length;

    if (noteCount === 0) {
        return InteractionHelper.safeReply(interaction, {
            embeds: [
                infoEmbed(
                    "Brak Notatek",
                    `> \`📝\` | Użytkownik **${targetUser.tag}** nie posiada żadnych notatek do usunięcia.`
                ),
            ],
        });
    }

    notes.length = 0;

    const notesKey = getUserNotesKey(guildId, targetUser.id);
    await setInDb(notesKey, notes);

    const description = `> \`🗑️\` | **Wyczyszczono wszystkie notatki użytkownika:** ${targetUser.tag}\n` +
                        `> \`📊\` | **Usuniętych notatek:** ${noteCount}`;

    return InteractionHelper.safeReply(interaction, {
        embeds: [
            successEmbed(
                "Wyczyszczono Notatki",
                description
            )
        ]
    });
}

function getNoteTypeInfo(type) {
    const types = {
        warning: { emoji: "⚠️", label: "Ostrzeżenie", color: "#FF6B6B" },
        positive: { emoji: "✅", label: "Pozytywna", color: "#51CF66" },
        neutral: { emoji: "📝", label: "Neutralna", color: "#74C0FC" },
        alert: { emoji: "🚨", label: "Alert", color: "#FFD43B" }
    };

    return types[type] || types.neutral;
}
