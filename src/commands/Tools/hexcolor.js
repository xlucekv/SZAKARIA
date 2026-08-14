import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { getColor } from '../../config/bot.js';

import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('hexcolor')
        .setDescription('Wygeneruj losowy kolor HEX z podglądem')
        .addStringOption(option =>
            option.setName('kolor')
                .setDescription('Konkretny kolor HEX (np. #FF5733 lub FF5733)')
                .setRequired(false)),

    async execute(interaction) {
        await InteractionHelper.safeExecute(
            interaction,
            async () => {
                let hexColor = interaction.options.getString('kolor');
                let isRandom = false;

                if (!hexColor) {
                    isRandom = true;
                    hexColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                } else {
                    hexColor = hexColor.replace('#', '');
                    if (!/^[0-9A-Fa-f]{3,6}$/.test(hexColor)) {
                        return await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Podaj poprawny kod HEX.\n\n**Poprawne formaty:**\n• `#FF5733` (ze znakiem #)\n• `FF5733` (bez znaku #)\n• `F57` (skrócony format 3-cyfrowy)\n\n**Niepoprawne:** `#GG5733` (G nie jest cyfrą heksadecymalną)' });
                    }

                    if (hexColor.length === 3) {
                        hexColor = hexColor.split('').map(c => c + c).join('');
                    }

                    hexColor = '#' + hexColor.toUpperCase();
                }

                const r = parseInt(hexColor.slice(1, 3), 16);
                const g = parseInt(hexColor.slice(3, 5), 16);
                const b = parseInt(hexColor.slice(5, 7), 16);

                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                const textColor = brightness > 128 ? '#000000' : '#FFFFFF';

                const colorPreviewUrl = `https://dummyimage.com/200x100/${hexColor.replace('#', '')}/${textColor.replace('#', '')}?text=${encodeURIComponent(hexColor)}`;

                const colorName = getColorName(hexColor);

                const embed = successEmbed(
                    '🎨 Informacje o kolorze',
                    `**HEX:** \`${hexColor}\`\n` +
                    `**RGB:** \`rgb(${r}, ${g}, ${b})\`\n` +
                    `**HSL:** \`${rgbToHsl(r, g, b)}\`\n` +
                    `**Nazwa:** ${colorName || 'Niestandardowy kolor'}`
                )
                    .setColor(hexColor)
                    .setImage(colorPreviewUrl);

                if (isRandom) {
                    embed.setFooter({ text: 'Losowo wygenerowany kolor' });
                }

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            },
            'Nie udało się wygenerować informacji o kolorze. Spróbuj ponownie.',
            {
                autoDefer: true,
                deferOptions: { flags: MessageFlags.Ephemeral }
            }
        );
    },
};

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function getColorName(hex) {
    const colors = {
        '#FF0000': 'Czerwony',
        '#00FF00': 'Zielony',
        '#0000FF': 'Niebieski',
        '#FFFF00': 'Żółty',
        '#FF00FF': 'Magenta',
        '#00FFFF': 'Cyjan',
        '#000000': 'Czarny',
        '#FFFFFF': 'Biały',
        '#808080': 'Szary',
        '#FFA500': 'Pomarańczowy',
        '#800080': 'Fioletowy',
        '#A52A2A': 'Brązowy',
        '#FFC0CB': 'Różowy',
        '#008000': 'Ciemnozielony',
        '#000080': 'Granatowy',
        '#FFD700': 'Złoty',
        '#C0C0C0': 'Srebrny',
        '#FF6347': 'Pomidorowy',
        '#40E0D0': 'Turkusowy',
        '#E6E6FA': 'Lawendowy'
    };
    
    if (colors[hex.toUpperCase()]) {
        return colors[hex.toUpperCase()];
    }
    
    const hexValue = parseInt(hex.replace('#', ''), 16);
    let closestColor = '';
    let minDistance = Infinity;
    
    for (const [colorHex, name] of Object.entries(colors)) {
        const colorValue = parseInt(colorHex.replace('#', ''), 16);
        const distance = Math.abs(hexValue - colorValue);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = name;
        }
    }
    
    return minDistance < 1000000 ? `Zbliżony do: ${closestColor}` : null;
}
