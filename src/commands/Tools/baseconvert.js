import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getColor } from '../../config/bot.js';

const BASE_ALPHABETS = {
    'BIN': { base: 2, prefix: '0b', name: 'Dwójkowy (Binary)', alphabet: '01' },
    'OCT': { base: 8, prefix: '0o', name: 'Ósemkowy (Octal)', alphabet: '0-7' },
    'DEC': { base: 10, prefix: '', name: 'Dziesiętny (Decimal)', alphabet: '0-9' },
    'HEX': { base: 16, prefix: '0x', name: 'Szesnastkowy (Hexadecimal)', alphabet: '0-9A-F' },
    'B64': { base: 64, prefix: 'b64:', name: 'Base64', alphabet: 'A-Za-z0-9+/=' },
    'B36': { base: 36, prefix: '', name: 'Base36', alphabet: '0-9A-Z' },
    'B58': { base: 58, prefix: '', name: 'Base58', alphabet: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' },
    'B62': { base: 62, prefix: '', name: 'Base62', alphabet: '0-9A-Za-z' },
};

const BASE_NAMES = Object.entries(BASE_ALPHABETS).map(([key, { name }]) => ({ name: `${key} (${name})`, value: key }));
const BASE_CHARSETS = {
    BIN: '01',
    OCT: '01234567',
    DEC: '0123456789',
    HEX: '0123456789ABCDEF',
    B36: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    B58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    B62: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
};

function parseBigIntFromBase(value, baseKey) {
    if (baseKey === 'B64') {
        const bytes = Buffer.from(value, 'base64');
        return bytes.reduce((acc, byte) => (acc * 256n) + BigInt(byte), 0n);
    }

    const charset = BASE_CHARSETS[baseKey];
    if (!charset) {
        throw new Error(`Unsupported base: ${baseKey}`);
    }

    const normalized = ['BIN', 'OCT', 'DEC', 'HEX', 'B36'].includes(baseKey)
        ? value.toUpperCase()
        : value;

    let result = 0n;
    const base = BigInt(charset.length);

    for (const char of normalized) {
        const digit = charset.indexOf(char);
        if (digit < 0) {
            throw new Error(`Invalid character '${char}' for base ${baseKey}`);
        }
        result = (result * base) + BigInt(digit);
    }

    return result;
}

function formatBigIntToBase(value, baseKey) {
    if (baseKey === 'B64') {
        if (value === 0n) {
            return Buffer.from([0]).toString('base64');
        }

        const bytes = [];
        let n = value;
        while (n > 0n) {
            bytes.unshift(Number(n & 0xffn));
            n >>= 8n;
        }

        return Buffer.from(bytes).toString('base64');
    }

    const charset = BASE_CHARSETS[baseKey];
    if (!charset) {
        throw new Error(`Unsupported base: ${baseKey}`);
    }

    if (value === 0n) {
        return '0';
    }

    const base = BigInt(charset.length);
    let n = value;
    let output = '';

    while (n > 0n) {
        const index = Number(n % base);
        output = charset[index] + output;
        n /= base;
    }

    return output;
}

export default {
    data: new SlashCommandBuilder()
        .setName('baseconvert')
        .setDescription('Kowersja liczb między różnymi systemami liczbowymi')
        .addStringOption(option =>
            option.setName('liczba')
                .setDescription('Liczba do przekonwertowania')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('z')
                .setDescription('Źródłowy system/format')
                .setRequired(true)
                .addChoices(...BASE_NAMES))
        .addStringOption(option =>
            option.setName('na')
                .setDescription('Docelowy system/format (domyślnie: wszystkie)')
                .setRequired(false)
                .addChoices(...BASE_NAMES)),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`BaseConvert interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'baseconvert'
            });
            return;
        }

        const numberStr = interaction.options.getString('liczba').trim();
        const fromBase = interaction.options.getString('z');
        const toBase = interaction.options.getString('na');

        const { prefix: fromPrefix, name: fromName } = BASE_ALPHABETS[fromBase];

        const cleanNumber = fromPrefix && numberStr.startsWith(fromPrefix)
            ? numberStr.slice(fromPrefix.length)
            : numberStr;

        if (!cleanNumber) {
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Musisz podać liczbę do przekonwertowania.\n\n**Przykład:** `/baseconvert liczba:1010 z:BIN na:DEC`',
            });
        }

        const alphabet = BASE_ALPHABETS[fromBase].alphabet;
        const regex = new RegExp(`^[${alphabet}]+$`, 'i');

        if (!regex.test(cleanNumber)) {
            let examples = '';
            if (fromBase === 'BIN') {
                examples = '\n\n**Prawidłowe:** 101, 1010, 11111 | **Nieprawidłowe:** 5 (cyfra 5 nie jest dozwolona)';
            } else if (fromBase === 'OCT') {
                examples = '\n\n**Prawidłowe:** 77, 123, 755 | **Nieprawidłowe:** 8 (dozwolone tylko 0-7)';
            } else if (fromBase === 'DEC') {
                examples = '\n\n**Prawidłowe:** 42, 123, 999 | **Nieprawidłowe:** 12.34 (brak ułamków)';
            } else if (fromBase === 'HEX') {
                examples = '\n\n**Prawidłowe:** FF, A1B2, DEADBEEF | **Nieprawidłowe:** G (tylko 0-9, A-F)';
            }
            logger.warn(`Invalid base conversion input: ${cleanNumber} for base ${fromBase}`);
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: `Podano: \`${cleanNumber}\`\n\nPrawidłowe znaki: \`${alphabet}\`${examples}`,
            });
        }

        let decimalValue;
        try {
            if (fromBase === 'B64') {
                decimalValue = parseBigIntFromBase(cleanNumber, fromBase);
            } else {
                decimalValue = parseBigIntFromBase(cleanNumber, fromBase);
            }
        } catch (error) {
            logger.error('Base conversion parse error:', error);
            return replyUserError(interaction, {
                type: ErrorTypes.VALIDATION,
                message: 'Liczba jest zbyt duża do przetworzenia.\n\nSpróbuj z mniejszą liczbą.',
            });
        }

        if (toBase) {
            const { prefix: toPrefix, name: toName } = BASE_ALPHABETS[toBase];
            let result;

            try {
                result = formatBigIntToBase(decimalValue, toBase);

                const embed = successEmbed(
                    '🔄 Wynik konwersji systemów liczbowych',
                    `**Z systemu ${fromName} (${fromBase}):** \`${fromPrefix}${cleanNumber}\`\n` +
                    `**Na system ${toName} (${toBase}):** \`${toPrefix}${result}\`\n` +
                    `**Wartość dziesiętna:** \`${decimalValue.toLocaleString()}\``
                );
                embed.setColor(getColor('success'));

                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

            } catch (error) {
                logger.error(`Base conversion error to ${toName}:`, error);
                await replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message: 'Wynik byłby zbyt duży lub niekompatybilny.\n\nSpróbuj z mniejszą liczbą lub innym systemem docelowym.',
                });
            }

        } else {
            let description = `**Wprowadzono (${fromName}):** \`${fromPrefix}${cleanNumber}\`\n`;
            description += `**Wartość dziesiętna:** \`${decimalValue.toLocaleString()}\`\n\n`;

            for (const [baseKey, { prefix, name }] of Object.entries(BASE_ALPHABETS)) {
                if (baseKey === fromBase) continue;

                try {
                    let value = formatBigIntToBase(decimalValue, baseKey);

                    description += `**${name} (${baseKey}):** \`${prefix}${value}\`\n`;
                } catch (error) {
                    description += `**${name} (${baseKey}):** *Zbyt duża wartość do przekonwertowania*\n`;
                }
            }

            const embed = successEmbed(
                '🔄 Wyniki konwersji systemów liczbowych',
                description
            );
            embed.setColor(getColor('primary'));

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    },
};
