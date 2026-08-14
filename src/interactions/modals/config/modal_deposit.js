import { successEmbed } from '../../../utils/embeds.js';
import { getCollection, updateDeposit } from '../../../services/collectionService.js';

export default {
    id: 'modal_deposit',
    name: 'modal_deposit',
    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const rawAmount = interaction.fields.getTextInputValue('deposit_amount');
            const amount = parseInt(rawAmount, 10);

            if (isNaN(amount) || amount <= 0) {
                return await interaction.editReply({ content: 'Podaj poprawną, dodatnią liczbę!' });
            }

            // Pobieramy ostatnią aktywną zbiórkę z tego kanału lub bazy powiązaną z użytkownikiem
            // Pobieramy wiadomość bezpośrednio przez ostatnią interakcję w cache kanału
            const channelMessages = await interaction.channel.messages.fetch({ limit: 10 });
            const collectionMessage = channelMessages.find(m => m.embeds.length > 0 && m.embeds[0].title?.startsWith('Zbiórka'));

            if (!collectionMessage) {
                return await interaction.editReply({ content: 'Nie znaleziono aktywnej wiadomości zbiórki na tym kanale.' });
            }

            const messageId = collectionMessage.id;
            const collection = await getCollection(messageId);
            
            if (!collection) {
                return await interaction.editReply({ content: 'Nie znaleziono danych tej zbiórki w bazie.' });
            }

            const userId = interaction.user.id;
            const updatedCollection = await updateDeposit(messageId, userId, amount);

            const guild = interaction.guild;
            let totalSum = 0;

            const listText = Object.entries(updatedCollection.deposits)
                .map(([uId, val]) => {
                    totalSum += val;
                    const member = guild.members.cache.get(uId);
                    const nameTag = member ? `${member}` : `<@${uId}>`;
                    
                    if (val > 0) {
                        return `[+] ${nameTag} — **${val}**`;
                    }
                    return `[-] ${nameTag}`;
                })
                .join('\n');

            const updatedEmbed = successEmbed(
                `Zbiórka — ${collection.title}`,
                `**Lista członków:**\n\n${listText}\n\n**Suma:**\n\`\`\`ansi\n\u001b[1;32m${totalSum}\u001b[0m ${collection.title}\n\`\`\``
            );

            await collectionMessage.edit({ embeds: [updatedEmbed] });

            await interaction.editReply({
                content: `Pomyślnie dodano wpłatę: **${amount}**!`
            });
        } catch (error) {
            console.error('Krytyczny błąd w modal_deposit:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Wystąpił błąd: ${error.message}` });
            }
        }
    }
};
