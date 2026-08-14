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
                .setDescription('Godzina (np. 20:00)')
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
        const day = interaction.options.getString('dzien');
        const month = interaction.options.getString('miesiac');
        const year = interaction.options.getString('rok');
        const time = interaction.options.getString('godzina');
        const description = interaction.options.getString('opis');

        const formattedTermin = `${day}.${month}.${year} o ${time}`;

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
