const ONES = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

/**
 * Converts a 3-digit number chunk (1-999) to words.
 * @param {number} n 
 * @returns {string}
 */
function convertChunk(n) {
    let str = '';
    const hundred = Math.floor(n / 100);
    const remainder = n % 100;

    if (hundred > 0) {
        str += ONES[hundred] + ' Hundred';
        if (remainder > 0) {
            str += ' and ';
        }
    }

    if (remainder > 0) {
        if (remainder < 20) {
            str += ONES[remainder];
        } else {
            const ten = Math.floor(remainder / 10);
            const unit = remainder % 10;
            str += TENS[ten];
            if (unit > 0) {
                str += '-' + ONES[unit];
            }
        }
    }

    return str;
}

/**
 * Converts an integer into words.
 * @param {number} n 
 * @returns {string}
 */
function convertInteger(n) {
    if (n === 0) return 'Zero';

    const chunks = [];
    let temp = n;
    let scaleIndex = 0;

    while (temp > 0) {
        const chunk = temp % 1000;
        if (chunk > 0) {
            const chunkStr = convertChunk(chunk);
            const scale = SCALES[scaleIndex];
            chunks.unshift(scale ? `${chunkStr} ${scale}` : chunkStr);
        }
        temp = Math.floor(temp / 1000);
        scaleIndex++;
    }

    return chunks.join(', ');
}

/**
 * Converts a number or balance into words.
 * Handles both monetary balance representation (Naira and Kobo) and general numbers.
 *
 * @param {number|string} amount - Numeric value or formatted string to convert
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.currency=true] - Whether to include currency words (Naira / Kobo)
 * @param {string} [options.unit='Naira'] - Main currency unit
 * @param {string} [options.subunit='Kobo'] - Fractional currency unit
 * @param {boolean} [options.showOnly=true] - Whether to append "Only" at the end of currency
 * @returns {string} The balance / number written in words
 */
function numberToWords(amount, options = {}) {
    const {
        currency = true,
        unit = 'Naira',
        subunit = 'Kobo',
        showOnly = true
    } = options;

    if (amount === undefined || amount === null || amount === '') {
        return '';
    }

    const num = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : Number(amount);
    if (isNaN(num)) {
        return '';
    }

    const isNegative = num < 0;
    const absNum = Math.abs(num);
    const intPart = Math.floor(absNum);
    const decPart = Math.round((absNum - intPart) * 100);

    const intWords = convertInteger(intPart);

    if (!currency) {
        let result = (isNegative ? 'Minus ' : '') + intWords;
        if (decPart > 0) {
            result += ` point ${convertChunk(decPart).toLowerCase()}`;
        }
        return result;
    }

    let result = '';
    if (isNegative) {
        result += 'Minus ';
    }

    if (intPart > 0) {
        result += `${intWords} ${unit}`;
    } else if (decPart === 0) {
        result += `Zero ${unit}`;
    }

    if (decPart > 0) {
        const decWords = convertChunk(decPart);
        if (intPart > 0) {
            result += `, ${decWords} ${subunit}`;
        } else {
            result += `${decWords} ${subunit}`;
        }
    }

    if (showOnly) {
        result += ' Only';
    }

    return result;
}

export { numberToWords, numberToWords as amountToWords, numberToWords as balanceToWords };
export default numberToWords;
