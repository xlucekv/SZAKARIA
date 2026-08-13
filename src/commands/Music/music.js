import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    skipTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    shuffleQueue,
    setLoopMode,
    setVolume,
    seekTrack,
    removeFromQueue,
    moveInQueue,
    clearQueue,
    setTwentyFourSeven,
    leaveVoiceChannel,
    replyMusicSuccess,
} from '../../services/music/musicActions.js';
import { deferMusicCommand } from '../../services/music/prefixSupport.js';

export default {
    category: 'Music',
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Zarządzaj odtwarzaniem, kolejką oraz ustawieniami sesji głosowej')
        .addSubcommand((sub) =>
            sub.setName('pause').setDescription('Wstrzymaj odtwarzanie'),
        )
        .addSubcommand((sub) =>
            sub.setName('resume').setDescription('Wznów odtwarzanie'),
        )
        .addSubcommand((sub) =>
            sub.setName('skip').setDescription('Pomiń bieżący utwór'),
        )
        .addSubcommand((sub) =>
            sub.setName('stop').setDescription('Zatrzymaj odtwarzanie i wyczyść kolejkę'),
        )
        .addSubcommand((sub) =>
            sub.setName('shuffle').setDescription('Pomieszaj kolejkę utworów'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('loop')
                .setDescription('Ustaw tryb powtarzania')
                .addStringOption((opt) =>
                    opt
                        .setName('mode')
                        .setDescription('Tryb powtarzania')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Wyłączony', value: 'none' },
                            { name: 'Utwór', value: 'track' },
                            { name: 'Kolejka', value: 'queue' },
                        ),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('volume')
                .setDescription('Ustaw głośność odtwarzania')
                .addIntegerOption((opt) =>
                    opt.setName('level').setDescription('Głośność (0-100)').setRequired(true).setMinValue(0).setMaxValue(100),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('seek')
                .setDescription('Przewiń do wybranego momentu w bieżącym utworze')
                .addIntegerOption((opt) =>
                    opt.setName('seconds').setDescription('Pozycja w sekundach').setRequired(true).setMinValue(0),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Usuń utwór z kolejki')
                .addIntegerOption((opt) =>
                    opt.setName('position').setDescription('Pozycja w kolejce').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('move')
                .setDescription('Przenieś utwór w kolejce')
                .addIntegerOption((opt) =>
                    opt.setName('from').setDescription('Obecna pozycja').setRequired(true).setMinValue(1),
                )
                .addIntegerOption((opt) =>
                    opt.setName('to').setDescription('Nowa pozycja').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub.setName('clear').setDescription('Wyczyść całą kolejkę'),
        )
        .addSubcommand((sub) =>
            sub.setName('leave').setDescription('Rozłącz bota z kanału głosowego'),
        )
        .addSubcommand((sub) =>
            sub
                .setName('247')
                .setDescription('Przełącz tryb 24/7 (pozostań na kanale głosowym, gdy jest pusty)')
                .addBooleanOption((opt) =>
                    opt.setName('enabled').setDescription('Włącz lub wyłącz tryb 24/7').setRequired(true),
                ),
        ),

    async execute(interaction, config, client) {
        await deferMusicCommand(interaction);
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'pause': {
                const embed = await pausePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'resume': {
                const embed = await resumePlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'skip': {
                const embed = await skipTrack(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'stop': {
                const embed = await stopPlayback(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'shuffle': {
                const embed = await shuffleQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'loop': {
                const embed = await setLoopMode(client, interaction, interaction.options.getString('mode'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'volume': {
                const embed = await setVolume(client, interaction, interaction.options.getInteger('level'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'seek': {
                const embed = await seekTrack(client, interaction, interaction.options.getInteger('seconds'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'remove': {
                const embed = await removeFromQueue(client, interaction, interaction.options.getInteger('position'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'move': {
                const embed = await moveInQueue(
                    client,
                    interaction,
                    interaction.options.getInteger('from'),
                    interaction.options.getInteger('to'),
                );
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'clear': {
                const embed = await clearQueue(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case 'leave': {
                const embed = await leaveVoiceChannel(client, interaction);
                await replyMusicSuccess(interaction, embed);
                break;
            }
            case '247': {
                const embed = await setTwentyFourSeven(client, interaction, interaction.options.getBoolean('enabled'));
                await replyMusicSuccess(interaction, embed);
                break;
            }
            default:
                await InteractionHelper.safeEditReply(interaction, {
                    content: 'Nieznana podkomenda muzyczna.',
                });
        }
    },
};
