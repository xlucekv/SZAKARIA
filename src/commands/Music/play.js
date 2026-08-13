import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { playQuery, replyMusicSuccess } from '../../services/music/musicActions.js';

export default {
    slashOnly: true,
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Odtwórz utwór lub dodaj go do kolejki')
        .addStringOption((opt) =>
            opt.setName('query').setDescription('Nazwa utworu lub adres URL').setRequired(true),
        ),

    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });
        const result = await playQuery(client, interaction, interaction.options.getString('query'));
        await replyMusicSuccess(interaction, result.embed);
    },
};
