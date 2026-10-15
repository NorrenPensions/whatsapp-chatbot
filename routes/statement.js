import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';
import getMobilePhoneVariants from '../utility/mobileNumVariants.js';
import getPin from '../utility/getPin.js';
import generatePDF from '../utility/generatePDF.js';
import transporter from '../utility/transporter.js';
import path from 'path';
import handlebars from 'handlebars';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const sendStatement = async (req, res) => {
    const { pin, from, to } = req.body;

    if (!pin || !from || !to) {
        return res.status(400).json({ error: "PIN, from, and to are required" });
    }

    try {
        const pool = await connectToDatabase('PFA');

        const userEmailRes = await pool.request()
            .input('PIN', pin)
            .query(`SELECT EMAIL FROM PFA.dbo.EMPLOYEES WHERE PIN = @PIN`);

        const userEmail = userEmailRes.recordset[0]?.EMAIL;
        console.log("userEmail: ", userEmail);

        if (!userEmail) {
            return res.status(404).json({ error: 'No user email found for the provided PIN' });
        }

        // 1. Run stored procedure
        const request = pool.request();
        request.input("PIN", sql.VarChar(30), pin);
        request.input("DATEFROM", sql.VarChar(30), from);
        request.input("DATETO", sql.VarChar(30), to);
        await request.execute("[PFA].[dbo].[proc_adhoc_statement]");

        // Gain/Loss on Mandatory
        const mandGainLossRes = await pool.request()
            .input('PIN', sql.VarChar(30), pin)
            .execute("[PFA].[dbo].[sp_GetCurrentValueOfMandatory]")

        const mandGainLoss = mandGainLossRes.recordset?.[0]?.['Gain/Loss'] ?? 0;

        const mandBalance = mandGainLossRes.recordset?.[0]?.['Balance'] ?? 0;

        // Gain/Loss on PPP
        const pppGainLossRes = await pool.request()
            .input('PIN', sql.VarChar(30), pin)
            .execute("[PFA].[dbo].[sp_GetCurrentValueOfPPP]")

        const pppGainLoss = pppGainLossRes.recordset?.[0]?.['Gain/Loss'] ?? 0;

        const pppBalance = pppGainLossRes.recordset?.[0]?.['Balance'] ?? 0;

        // Total Gain/Loss
        const totalGainLoss = mandGainLoss + pppGainLoss;

        // Total Balance
        const totalBalance = mandBalance + pppBalance;

        // 2. Fetch header
        const headerResult = await pool.request()
            .input('pin', sql.VarChar(30), pin)
            .query(`SELECT * FROM PFA.dbo.ADHOC_STATEMENT_HEADER WHERE PIN = @pin`);

        if (headerResult.recordset.length === 0) {
            return res.status(404).json({ error: 'No statement header found for the provided PIN' });
        }

        const dbHeader = headerResult.recordset[0];

        // 3. Fetch body
        const bodyResult = await pool.request()
            .input('pin', sql.VarChar(30), pin)
            .query(`SELECT * FROM PFA.dbo.ADHOC_STATEMENT_BODY WHERE PIN = @pin ORDER BY SN, CONTDATE, TRANS_DATE, DESCR DESC`);

        const dbBody = bodyResult.recordset;

        // Formatter functions
        const formatAmount = (val) => {
            if (val === undefined || val === null) return '0.00';
            const num = parseFloat(val);
            if (isNaN(num)) return '0.00';
            if (num < 0) {
                return `(${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
            }
            return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const formatUnits = (val) => {
            if (val === undefined || val === null) return '0.0000';
            const num = parseFloat(val);
            if (isNaN(num)) return '0.0000';
            return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        };

        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const formatEndLabel = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return '';
            return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        };

        // Format Header
        const header = {
            fullname: dbHeader.FULLNAME || '',
            addresses: dbHeader.ADDRESSES || '',
            employerName: dbHeader.EMPLOYER_NAME || '',
            states: dbHeader.STATES || '',
            dofc: dbHeader.DOFC || '',
            fund: dbHeader.FUND || '',
            pin: dbHeader.PIN || '',
            mandCont: formatAmount(dbHeader.MAND_CONT),
            volCont: formatAmount(dbHeader.VOL_CONT),
            preactNsitfCont: formatAmount(dbHeader.PREACTNSITF_CONT),
            totalCont: formatAmount(dbHeader.TOTAL_CONT),
            mandWtdr: formatAmount(dbHeader.MAND_WTDR),
            volWtdr: formatAmount(dbHeader.VOL_WTDR),
            preactNsitfWtdr: formatAmount(dbHeader.PREACTNSITF_WTDR),
            totalWtdr: formatAmount(dbHeader.TOTAL_WTDR),
            mandNet: formatAmount(dbHeader.MAND_NET),
            volNet: formatAmount(dbHeader.VOL_NET),
            preactNsitfNet: formatAmount(dbHeader.PREACTNSITF_NET),
            totalNet: formatAmount(dbHeader.TOTAL_NET),
            mandGrowth: formatAmount(mandGainLoss),
            volGrowth: formatAmount(pppGainLoss),
            preactNsitfGrowth: formatAmount(dbHeader.PREACTNSITF_GROWTH),
            totalGrowth: formatAmount(totalGainLoss),
            mandBal: formatAmount(mandBalance),
            volBal: formatAmount(pppBalance),
            preactNsitfBal: formatAmount(dbHeader.PREACTNSITF_BAL),
            totalBal: formatAmount(totalBalance),
            mandUnits: formatUnits(dbHeader.MAND_UNITS),
            volUnits: formatUnits(dbHeader.VOL_UNITS),
            preactNsitfUnits: formatUnits(dbHeader.PREACTNSITF_UNITS),
            totalUnits: formatUnits(dbHeader.TOTAL_UNITS),
            unitPrice: formatUnits(dbHeader.UNIT_PRICE)
        };

        // Format Body and Group them
        const body = [];
        let lastHeader = null;

        dbBody.forEach((row) => {
            const isGainLoss = row.DESCR && row.DESCR.toLowerCase().includes("gain/loss");

            if (row.HEADER && row.HEADER.trim() !== "") {
                const currentHeader = row.HEADER.trim();
                if (currentHeader !== lastHeader) {
                    body.push({ isGroupHeader: true, header: currentHeader });
                    lastHeader = currentHeader;
                }
            }

            body.push({
                descr: row.DESCR || "",
                transDate: row.TRANS_DATE || "",
                mandatory: formatAmount(row.MANDATORY),
                voluntary: formatAmount(row.VOLUNTARY),
                preactNsitf: formatAmount(row.PREACTNSITF),
                total: formatAmount(row.TOTAL),
                remark: row.REMARK || "",
                isFinal: isGainLoss
            });
        });

        // 4. Compile and render Handlebars template
        const templatePath = path.join(__dirname, "../adhoc_statement_template/templates/adhoc-statement.hbs");
        const cssPath = path.join(__dirname, "../adhoc_statement_template/public/css/adhoc-statement.css");
        const logoPath = path.join(__dirname, "../adhoc_statement_template/public/img/norren-logo.png");
        const footerPath = path.join(__dirname, "../adhoc_statement_template/public/img/footer.png");
        const watermarkPath = path.join(__dirname, "../adhoc_statement_template/public/img/watermark.png");

        const logoUrl = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}` : "";
        const bannerUrl = fs.existsSync(footerPath) ? `data:image/png;base64,${fs.readFileSync(footerPath).toString("base64")}` : "";
        const watermarkUrl = fs.existsSync(watermarkPath) ? `data:image/png;base64,${fs.readFileSync(watermarkPath).toString("base64")}` : "";

        const templateSource = fs.readFileSync(templatePath, "utf8");
        const template = handlebars.compile(templateSource);

        const templateData = {
            statementEndLabel: formatEndLabel(to),
            logoUrl,
            bannerUrl,
            watermarkUrl,
            header,
            body
        };

        let finalHtml = template(templateData);

        if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, "utf8");
            finalHtml = finalHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/i, `<style>${cssContent}</style>`);
        }

        // 5. Generate PDF
        const pdfPath = path.join(__dirname, "../statements", `${pin}_statement.pdf`);
        await generatePDF(finalHtml, pdfPath);

        // 6. Send email with attachment
        const fname = dbHeader.FULLNAME ? dbHeader.FULLNAME.split(" ")[0] : "Customer";

        const mailOptions = {
            from: `Norrenberger Pensions <noreply-npl@norrenpensions.com>`,
            to: userEmail,
            subject: "E-Statement",
            html: `<b>Dear ${fname},</b><br>
               <p>Thank you for choosing Norrenberger Pensions Managers LTD.</p>
               <p>Kindly find attached e-statement.</p>`,
            attachments: [{ filename: `${pin}_statement.pdf`, path: pdfPath }]
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log("Statement email sent successfully:", info.messageId, info.response);

            return res.status(200).json({
                code: 200,
                message: `Statement generated and sent successfully to ${userEmail}`,
                recipient: userEmail
            });
        } finally {
            if (fs.existsSync(pdfPath)) {
                try {
                    fs.unlinkSync(pdfPath); // Delete PDF after sending email
                } catch (e) {
                    console.error("Error deleting PDF file:", e);
                }
            }
        }

    } catch (error) {
        console.error("Error generating and sending statement:", error);
        if (typeof Sentry !== 'undefined') Sentry.captureException(error);
        return res.status(500).json({ error: "An error occurred while generating and sending the statement." });
    }
};

router.post('/send-statement', async (req, res) => {
    const { mobileNumOrPin, dateTo, dateFrom } = req.body;

    const pin = await getPin(mobileNumOrPin);

    req.body.pin = pin;
    req.body.from = dateFrom;
    req.body.to = dateTo;

    return sendStatement(req, res);
});

export default router;