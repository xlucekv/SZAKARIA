import { successEmbed } from '../../../utils/embeds.js';
import { getCollection, updateDeposit } from '../../../services/collectionService.js';

export default {
    id: 'modal_deposit',
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.customId.replace('modal_deposit_', '');
        const rawAmount = interaction.fields.getTextInputValue('deposit_amount');
        const amount = parseInt(rawAmount, 10);

        if (isNaN(amount) || amount <= 0) {
            return await interaction.editReply({ content: 'Podaj poprawną, dodatnią liczbę!' });
        }

        const collection = await getCollection(messageId);
        if (!collection) {
            return await interaction.editReply({ content: 'Nie znaleziono aktywnej zbiórki dla tej wiadomości.' });
        }

        const userId = interaction.user.id;
        const updatedCollection = await updateDeposit(messageId, userId, amount);

        const channel = await interaction.guild.channels.fetch(collection.channelId);
        const message = await channel.messages.fetch(messageId);

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

        await message.edit({ embeds: [updatedEmbed] });

        await interaction.editReply({
            content: `Pomyślnie dodano wpłatę: **${amount}**!`
        });
    }
};
