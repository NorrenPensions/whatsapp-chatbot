import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

/**
 * Generates a PDF file from an HTML string and writes it to disk.
 *
 * @param {string} htmlContent - Rendered HTML content
 * @param {string} outputPath - File system path where the PDF will be saved
 * @param {object} [options={}] - Optional Puppeteer page.pdf options override
 */
async function generatePDF(htmlContent, outputPath, options = {}) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'load' });

        await page.pdf({
            path: outputPath,
            format: "A4",
            landscape: false,
            margin: { top: "5mm", right: "5mm", bottom: "5mm", left: "5mm" },
            printBackground: true,
            ...options
        });
    } finally {
        await browser.close();
    }
}

export default generatePDF;
