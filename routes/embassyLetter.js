import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import getPin from '../utility/getPin.js';
import getBalance from '../utility/getBalance.js';
import numberToWords from '../utility/numberToWords.js';
import getClientDetails from '../utility/getClientDetails.js';
import generatePDF from '../utility/generatePDF.js';
import transporter from '../utility/transporter.js';
import path from 'path';
import handlebars from 'handlebars';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.use(requireVendorBasicAuth);

router.post('/generate-and-send', async (req, res) => {
    try {
        const { mobileNumOrPin, country, employerName, email } = req.body;
        if (!mobileNumOrPin || !country) {
            return res.status(400).json({ message: 'mobileNumOrPin and country are required' });
        }

        const pin = await getPin(mobileNumOrPin);
        if (!pin) {
            const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
            return res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        }

        const pool = await connectToDatabase('PFA');

        // 1. Fetch diplomatic mission details for the country
        const missionRes = await pool.request()
            .input('country', sql.VarChar(100), country.trim())
            .query(`
                SELECT TOP 1 *
                FROM diplomatic_missions
                WHERE LOWER(LTRIM(RTRIM(country))) = LOWER(@country)
            `);

        const mission = missionRes.recordset[0];
        if (!mission) {
            return res.status(404).json({ message: `Diplomatic mission details not found for country: ${country}` });
        }

        // 2. Fetch employee / client details
        const employee = await getClientDetails(pin);
        if (!employee) {
            return res.status(404).json({ message: 'Employee record not found for the provided PIN' });
        }

        const userEmail = email || employee.email;
        if (!userEmail) {
            return res.status(404).json({ message: 'No email address found for this account' });
        }

        const clientName = employee.fullName || 'Customer';

        // 3. Fetch balance and convert to words
        const balance = await getBalance(pin);
        const numericBal = Number(balance) || 0;
        const formattedBalance = numericBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const balanceInWords = numberToWords(numericBal);

        // 4. Format letter date
        const now = new Date();
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const letterDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

        // 5. Load adhoc statement branding assets and compile template
        const templatePath = path.join(__dirname, "../adhoc_statement_template/templates/embassy-letter.hbs");
        const cssPath = path.join(__dirname, "../adhoc_statement_template/public/css/embassy-letter.css");
        const logoPath = path.join(__dirname, "../adhoc_statement_template/public/img/norren-logo.png");
        const footerPath = path.join(__dirname, "../adhoc_statement_template/public/img/footer.png");
        const watermarkPath = path.join(__dirname, "../adhoc_statement_template/public/img/watermark.svg");
        const signaturePath = path.join(__dirname, "../adhoc_statement_template/public/img/bilk_sign.png");

        const logoUrl = fs.existsSync(logoPath) ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}` : "";
        const bannerUrl = fs.existsSync(footerPath) ? `data:image/png;base64,${fs.readFileSync(footerPath).toString("base64")}` : "";
        const watermarkSvg = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath, "utf8") : "";
        const signatureUrl = fs.existsSync(signaturePath) ? `data:image/png;base64,${fs.readFileSync(signaturePath).toString("base64")}` : "";

        const templateSource = fs.readFileSync(templatePath, "utf8");
        const template = handlebars.compile(templateSource);

        const templateData = {
            watermarkSvg,
            logoUrl,
            bannerUrl,
            signatureUrl,
            letterDate,
            recipientTitle: mission.recipient_title,
            missionName: mission.name,
            street: mission.street,
            area: mission.area,
            state: mission.state,
            salutation: mission.salutation || 'Dear Sir/Madam,',
            clientName,
            pin,
            employerName: employerName || employee.EMPLOYER_NAME || '',
            formattedBalance,
            balanceInWords
        };

        let finalHtml = template(templateData);

        if (fs.existsSync(cssPath)) {
            const cssContent = fs.readFileSync(cssPath, "utf8");
            finalHtml = finalHtml.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/i, `<style>${cssContent}</style>`);
        }

        // 6. Generate PDF
        const pdfPath = path.join(__dirname, "../statements", `${pin}_embassy_letter.pdf`);
        await generatePDF(finalHtml, pdfPath);

        // 7. Send email with attachment
        const fname = employee.FIRSTNAME || clientName.split(" ")[0] || "Customer";
        const mailOptions = {
            from: `Norrenberger Pensions <noreply-npl@norrenpensions.com>`,
            to: userEmail,
            subject: `Embassy Letter - Confirmation of Retirement Savings (${pin})`,
            html: `<b>Dear ${fname},</b><br>
               <p>Thank you for choosing Norrenberger Pensions Managers Limited.</p>
               <p>Kindly find attached your Embassy Letter of Confirmation of Retirement Savings.</p>`,
            attachments: [{ filename: `${pin}_embassy_letter.pdf`, path: pdfPath }]
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log("Embassy letter email sent successfully:", info.messageId, info.response);

            return res.status(200).json({
                code: 200,
                message: `Embassy letter generated and sent successfully to ${userEmail}`,
                recipient: userEmail
            });
        } finally {
            if (fs.existsSync(pdfPath)) {
                try {
                    fs.unlinkSync(pdfPath);
                } catch (e) {
                    console.error("Error deleting PDF file:", e);
                }
            }
        }

    } catch (error) {
        console.error('Error generating embassy letter: ', error);
        return res.status(500).json({ message: 'An error occurred while generating embassy letter' });
    }
});

export default router;