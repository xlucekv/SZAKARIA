import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default {
    id: 'zbiorka_deposit',
    name: 'zbiorka_deposit',
    async execute(interaction, client) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_deposit_${interaction.message.id}`)
            .setTitle('Zgłoś wpłatę do zbiórki');

        const amountInput = new TextInputBuilder()
            .setCustomId('deposit_amount')
            .setLabel('Ile wpłaciłeś/aś?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Wpisz liczbę, np. 5')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(row);

        return await interaction.showModal(modal);
    }
};
