import puppeteer from 'puppeteer';
import renderWelcomeLetter from './renderWelcomeLetter.js';

export default async function generateWelcomeLetter(data) {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 734, height: 1062 });
        await page.emulateMediaType('print');
        await page.setContent(renderWelcomeLetter(data), { waitUntil: 'load' });
        await page.evaluate(async () => {
            await document.fonts.ready;
            for (const img of document.images) {
                await img.decode();
            }
        });
        // Fit the complete content, including unusually long customer details, without clipping.
        const fits = await page.evaluate(() => {
            const letter = document.querySelector('.letter');
            const maxHeight = 281 * 96 / 25.4;
            letter.style.minHeight = '0';
            for (const size of [10.5, 10, 9.5, 9]) {
                document.body.style.fontSize = `${size}pt`;
                if (letter.getBoundingClientRect().height <= maxHeight && letter.scrollWidth <= letter.clientWidth) {
                    letter.style.minHeight = '281mm';
                    return true;
                }
            }
            return false;
        });
        if (!fits) throw new Error('Welcome letter content exceeds one page');
        return Buffer.from(await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true }));
    } finally {
        await browser.close();
    }
}
