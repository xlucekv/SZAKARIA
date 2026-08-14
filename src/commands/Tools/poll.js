import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const MAX_OPTIONS = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Stwórz klanowe głosowanie')
        .addStringOption(option =>
            option.setName('pytanie')
                .setDescription('Pytanie w ankiecie')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('czas')
                .setDescription('Czas trwania (np. 1m = 1 minuta, 2h = 2 godziny, 1d = 1 dzień - min. 1m)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja1')
                .setDescription('Pierwsza opcja')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja2')
                .setDescription('Druga opcja')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opcja3')
                .setDescription('Trzecia opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja4')
                .setDescription('Czwarta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja5')
                .setDescription('Piąta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja6')
                .setDescription('Szósta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja7')
                .setDescription('Siódmą opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja8')
                .setDescription('Ósma opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja9')
                .setDescription('Dziewiąta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('opcja10')
                .setDescription('Dziesiąta opcja (opcjonalnie)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('anonimowa')
                .setDescription('Czy ankieta ma być anonimowa (domyślnie: fałsz)')
                .setRequired(false)
        ),

    category: 'Utility',

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const question = interaction.options.getString('pytanie');
        const rawDuration = interaction.options.getString('czas').trim();
        const isAnonymous = interaction.options.getBoolean('anonimowa') || false;

        const options = [];
        for (let i = 1; i <= MAX_OPTIONS; i++) {
            const option = interaction.options.getString(`opcja${i}`);
            if (option) options.push(option);
        }

        if (options.length < 2) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Musisz podać co najmniej 2 opcje do ankiety.'
            });
        }

        const parseDurationToMs = (input) => {
            const match = input.match(/^(\d+)([mhd])$/i);
            if (!match) return null;

            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            if (unit === 'm') return value * 60 * 1000;
            if (unit === 'h') return value * 60 * 60 * 1000;
            if (unit === 'd') return value * 24 * 60 * 60 * 1000;

            return null;
        };

        const durationMs = parseDurationToMs(rawDuration);
        if (!durationMs || durationMs < 60 * 1000) {
            return await InteractionHelper.safeEditReply(interaction, {
                content: '❌ Minimalny czas trwania ankiety to **1 minuta** (użyj formatu np. `1m`, `2h`, `1d`).'
            });
        }

        const formatDurationText = (input) => {
            const match = input.match(/^(\d+)([mhd])$/i);
            if (!match) return input;

            const value = parseInt(match[1], 10);
            const unit = match[2].toLowerCase();

            if (unit === 'm') {
                if (value === 1) return '1 minuta';
                if (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) return `${value} minuty`;
                return `${value} minut`;
            }
            if (unit === 'h') {
                if (value === 1) return '1 godzina';
                if (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)) return `${value} godziny`;
                return `${value} godzin`;
            }
            if (unit === 'd') {
                if (value === 1) return '1 dzień';
                return `${value} dni`;
            }

            return input;
        };

        const durationFormatted = formatDurationText(rawDuration);
        const optionsFormatted = options.map((option, index) => `> \`${EMOJIS[index]}\` ${option}`).join('\n');

        let pollMessage = `## 📊 **Klanowe Głosowanie**\n` +
                          `- 💬 **Pytanie:** ${question}\n` +
                          `- ⏳ **Czas trwania:** ${durationFormatted}\n` +
                          `- 👤 **Autor:** ${interaction.user} ${isAnonymous ? '*(Ankieta anonimowa)*' : ''}\n\n` +
                          `${optionsFormatted}`;

        // Tworzenie przycisków (maksymalnie 5 w jednym rzędzie, Discord pozwala na max 5 rzędów)
        const rows = [];
        let currentRow = new ActionRowBuilder();

        options.forEach((_, index) => {
            if (currentRow.components.length === 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }

            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_opt_${index}`)
                    .setEmoji(EMOJIS[index])
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        const message = await interaction.channel.send({ 
            content: pollMessage, 
            components: rows 
        });

        await InteractionHelper.safeEditReply(interaction, {
            content: '✅ Ankieta została pomyślnie utworzona!'
        });

        // Struktura przechowująca głosy: mapowanie index opcji -> Set user ID
        const votesMap = new Map();
        options.forEach((_, index) => votesMap.set(index, new Set()));

        // Kolektor interakcji przycisków
        const collector = message.createMessageComponentCollector({ time: durationMs });

        collector.on('collect, async (i) => {
            const optionIndex = parseInt(i.customId.replace('poll_opt_', ''), 10);
            const userId = i.user.id;

            // Sprawdzamy czy użytkownik już gdzieś głosował (1 głos na użytkownika)
            let previousVoteIndex = -1;
            for (const [idx, userSet] of votesMap.entries()) {
                if (userSet.has(userId)) {
                    previousVoteIndex = idx;
                    break;
                }
            }

            if (previousVoteIndex === optionIndex) {
                // Jeśli kliknął to samo, cofamy głos (przełącznik)
                votesMap.get(optionIndex).delete(userId);
                await i.reply({ content: '❌ Twój głos został wycofany.', flags: MessageFlags.Ephemeral });
            } else {
                if (previousVoteIndex !== -1) {
                    votesMap.get(previousVoteIndex).delete(userId);
                }
                votesMap.get(optionIndex).add(userId);
                await i.reply({ content: `✅ Twój głos został zapisany na opcję **${EMOJIS[optionIndex]}**!`, flags: MessageFlags.Ephemeral });
            }
        });

        const getVotesWord = (count) => {
            if (count === 1) return '1 głos';
            if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return `${count} głosy`;
            return `${count} głosów`;
        };

        // Zakończenie ankiety po czasie
        collector.on('end', async () => {
            try {
                const fetchedMsg = await message.channel.messages.fetch(message.id).catch(() => null);
                if (!fetchedMsg) return;

                let resultsText = '';
                let maxVotes = -1;
                let winningOptionIndex = -1;

                options.forEach((option, index) => {
                    const userSet = votesMap.get(index) || new Set();
                    const count = userSet.size;

                    // Budujemy listę osób, które zaznaczyły tę opcję (jeśli ankieta nie była anonimowa lub zawsze pokazujemy w wynikach)
                    let votersList = '';
                    if (!isAnonymous && count > 0) {
                        const names = Array.from(userSet).map(id => `<@${id}>`).join(', ');
                        votersList = `\n  ↳ *Głosujący: ${names}*`;
                    }

                    resultsText = resultsText ? `${resultsText}\n- \`${EMOJIS[index]}\` ${option} — **${getVotesWord(count)}**${votersList}` : `- \`${EMOJIS[index]}\` ${option} — **${getVotesWord(count)}**${votersList}`;

                    if (count > maxVotes) {
                        maxVotes = count;
                        winningOptionIndex = index;
                    }
                });

                let closedContent = `## 📊 **Wyniki Głosowania**\n` +
                                    `- 💬 **Pytanie:** ${question}\n` +
                                    `- 🏁 **Status:** Zakończone\n\n` +
                                    `- 📈 **Wyniki:**\n${resultsText}\n\n`;

                if (maxVotes > 0 && winningOptionIndex !== -1) {
                    closedContent += `- 🏆 **Wygrana opcja:** \`${EMOJIS[winningOptionIndex]}\` ${options[winningOptionIndex]} (${getVotesWord(maxVotes)})\n`;
                } else {
                    closedContent += `- ❌ **Brak oddanych głosów w ankiecie.**\n`;
                }

                // Edytujemy wiadomość, usuwamy przyciski (components: [])
                await fetchedMsg.edit({ content: closedContent, components: [] });

                // Usunięcie wiadomości po 24 godzinach od zakończenia
                setTimeout(async () => {
                    try {
                        const finalMsg = await message.channel.messages.fetch(message.id).catch(() => null);
                        if (finalMsg) {
                            await finalMsg.delete().catch(() => {});
                        }
                    } catch (err) {
                        console.error('Błąd podczas usuwania zakończonej ankiety:', err);
                    }
                }, 24 * 60 * 60 * 1000);

            } catch (err) {
                console.error('Błąd podczas kończenia ankiety przyciskowej:', err);
            }
        });
    },
};
