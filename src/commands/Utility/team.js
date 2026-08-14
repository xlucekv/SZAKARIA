import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('event')
        .setDescription('Ogłoś start serwerów lub klanowe wydarzenie z systemem zapisów')
        .addStringOption(option =>
            option.setName('tytul')
                .setDescription('Tytuł wydarzenia (np. Start Sezonu / Wojna Klanu)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('dzien')
                .setDescription('Dzień (np. 15)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('miesiac')
                .setDescription('Miesiąc (np. 08 lub sierpień)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('rok')
                .setDescription('Rok (np. 2026)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('godzina')
                .setDescription('Godzina w formacie HH:MM (np. 20:00)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('opis')
                .setDescription('Dodatkowe informacje lub wymagania (opcjonalnie)')
                .setRequired(false)
        ),

    category: 'Utility',

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        if (!deferSuccess) return;

        const title = interaction.options.getString('tytul');
        const dayStr = interaction.options.getString('dzien');
        const monthStr = interaction.options.getString('miesiac');
        const yearStr = interaction.options.getString('rok');
        const timeStr = interaction.options.getString('godzina');
        const description = interaction.options.getString('opis');

        // Próba obliczenia dokładnego czasu wydarzenia, aby usunąć wiadomość godzinę po nim
        const parseMonthToNumber = (m) => {
            const cleaned = m.trim().toLowerCase();
            const months = {
                'styczeń': 1, 'styczenia': 1, '1': 1, '01': 1,
                'luty': 2, 'lutego': 2, '2': 2, '02': 2,
                'marzec': 3, 'marca': 3, '3': 3, '03': 3,
                'kwiecień': 4, 'kwietnia': 4, '4': 4, '04': 4,
                'maj': 5, 'maja': 5, '5': 5, '05': 5,
                'czerwiec': 6, 'czerwca': 6, '6': 6, '06': 6,
                'lipiec': 7, 'lipca': 7, '7': 7, '07': 7,
                'sierpień': 8, 'sierpnia': 8, '8': 8, '08': 8,
                'wrzesień': 9, 'września': 9, '9': 9, '09': 9,
                'październik': 10, 'października': 10, '10': 10,
                'listopad': 11, 'listopada': 11, '11': 11,
                'grudzień': 12, 'grudnia': 12, '12': 12
            };
            return months[cleaned] || parseInt(cleaned, 10);
        };

        const day = parseInt(dayStr, 10);
        const month = parseMonthToNumber(monthStr);
        const year = parseInt(yearStr, 10);
        const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);

        if (!isNaN(day) && !isNaN(month) && !isNaN(year) && timeMatch) {
            const hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            
            // Tworzymy obiekt daty wydarzenia
            const eventDate = new Date(year, month - 1, day, hours, minutes, 0);
            
            // Dodajemy 1 godzinę do czasu wydarzenia jako moment usunięcia wiadomości
            const deleteTime = eventDate.getTime() + (60 * 60 * 1000);
            const delay = deleteTime - Date.now();

            if (delay > 0 && delay < 2147483647) { // Limit setTimeout w JS to ok. 24.8 dni
                setTimeout(async () => {
                    try {
                        const fetchedMsg = await interaction.channel.messages.fetch(message.id).catch(() => null);
                        if (fetchedMsg) {
                            await fetchedMsg.delete().catch(() => {});
                        }
                    } catch (err) {
                        console.error('Błąd podczas automatycznego usuwania wydarzenia:', err);
                    }
                }, delay);
            }
        }

        const formattedTermin = `${dayStr}.${monthStr}.${yearStr} o ${timeStr}`;

        // Struktury do przechowywania ID użytkowników, którzy kliknęli przyciski
        const goingSet = new Set();
        const notGoingSet = new Set();
        const maybeSet = new Set();

        const buildContent = () => {
            let content = `## 📢 **Klanowe Wydarzenie**\n` +
                          `> \`👤\` **Autor:** ${interaction.user} (\`${interaction.user.id}\`)\n` +
                          `> \`🎯\` **Nazwa:** ${title}\n` +
                          `> \`⏰\` **Termin:** ${formattedTermin}\n`;

            if (description) {
                content += `> \`💬\` **Opis:** ${description}\n`;
            }

            const getNames = (set) => {
                if (set.size === 0) return '*(brak)*';
                return Array.from(set).map(id => `<@${id}>`).join(', ');
            };

            content += `\n### Uczestnicy:\n` +
                       `- \`✅\` **Będę (${goingSet.size}):** ${getNames(goingSet)}\n` +
                       `- \`❌\` **Nie będę (${notGoingSet.size}):** ${getNames(notGoingSet)}\n` +
                       `- \`❓\` **Niezdecydowani (${maybeSet.size}):** ${getNames(maybeSet)}`;

            return content;
        };

        // Tworzenie rzędu przycisków
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('event_yes')
                .setLabel('Będę')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('event_no')
                .setLabel('Nie będę')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('event_maybe')
                .setLabel('Niezdecydowany')
                .setEmoji('❓')
                .setStyle(ButtonStyle.Secondary)
        );

        const message = await interaction.channel.send({
            content: buildContent(),
            components: [row]
        });

        await InteractionHelper.safeEditReply(interaction, {
            content: `> \`✅\` | **Użytkownik:** ${interaction.user.tag} (\`${interaction.user.id}\`)\n> Powiadomienie o wydarzeniu zostało pomyślnie utworzone!`
        });

        // Kolektor interakcji przycisków
        const collector = message.createMessageComponentCollector();

        collector.on('collect', async (i) => {
            const userId = i.user.id;

            // Usuwamy użytkownika ze wszystkich list, żeby nie mógł być w kilku naraz
            goingSet.delete(userId);
            notGoingSet.delete(userId);
            maybeSet.delete(userId);

            let statusText = '';
            if (i.customId === 'event_yes') {
                goingSet.add(userId);
                statusText = `> \`✅\` | **Użytkownik:** ${i.user.tag} (\`${i.user.id}\`)\n> Zapisano: **Będziesz** na wydarzeniu!`;
            } else if (i.customId === 'event_no') {
                notGoingSet.add(userId);
                statusText = `> \`❌\` | **Użytkownik:** ${i.user.tag} (\`${i.user.id}\`)\n> Zapisano: **Nie będziesz** na wydarzeniu.`;
            } else if (i.customId === 'event_maybe') {
                maybeSet.add(userId);
                statusText = `> \`❓\` | **Użytkownik:** ${i.user.tag} (\`${i.user.id}\`)\n> Zapisano: Status **Niezdecydowany**.`;
            }

            // Aktualizujemy wiadomość na kanale
            await message.edit({
                content: buildContent(),
                components: [row]
            }).catch(() => {});

            await i.reply({
                content: statusText,
                flags: MessageFlags.Ephemeral
            });
        });
    },
};
