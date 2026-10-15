import { Router } from 'express';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import getPin from '../utility/getPin.js';
import getWelcomeLetterData from '../utility/welcomeLetterData.js';
import generateWelcomeLetter from '../utility/generateWelcomeLetter.js';
import transporter from '../utility/transporter.js';

export function createWelcomeLetterRouter({ authenticate = requireVendorBasicAuth, resolvePin = getPin, fetchData = getWelcomeLetterData, generate = generateWelcomeLetter, sendMail = options => transporter.sendMail(options) } = {}) {
    const router = Router();
    router.use(authenticate);
    router.post(['/generate', '/generate-and-send'], async (req, res) => {
        const input = req.body?.mobileNumOrPin;
        if (typeof input !== 'string' || !/^(?:PEN\d{12}|234\d{10})$/i.test(input.trim())) {
            return res.status(400).json({ message: 'mobileNumOrPin must be an RSA PIN (PEN followed by 12 digits) or a mobile number (234 followed by 10 digits)' });
        }
        try {
            const pin = await resolvePin(input.trim().toUpperCase());
            if (!pin) return res.status(404).json({ message: 'Customer not found' });
            const data = await fetchData(pin);
            if (!data) return res.status(404).json({ message: 'Customer not found' });
            const recipient = typeof data.email === 'string' ? data.email.trim() : '';
            if (!recipient) return res.status(404).json({ message: 'No registered email address found for this customer' });
            if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient)) {
                return res.status(422).json({ message: 'The registered email address is invalid' });
            }
            const pdf = await generate(data);
            const info = await sendMail({
                from: 'Norrenberger Pensions <noreply-npl@norrenpensions.com>',
                to: recipient, // 'bilkisu.ogirima@norrenpensions.com',
                subject: 'Welcome to Norrenberger Pensions - Certificate of Registration',
                text: `Dear ${data.firstName || 'Customer'},\n\nThank you for choosing Norrenberger Pensions Limited. Please find attached your welcome letter and Certificate of Registration.\n\nKind regards,\nCustomer Experience Team`,
                attachments: [{ filename: 'welcome-letter.pdf', content: pdf, contentType: 'application/pdf' }]
            });
            if (!info?.accepted?.length || info.rejected?.length) {
                throw new Error('Welcome letter email was not accepted by the mail server');
            }
            res.set('Cache-Control', 'no-store');
            return res.status(200).json({ code: 200, message: 'Welcome letter generated and sent successfully', recipient });
        } catch (error) {
            console.error('Error generating welcome letter:', error.code || error.name);
            return res.status(500).json({ message: 'An error occurred while generating or sending welcome letter' });
        }
    });
    return router;
}

export default createWelcomeLetterRouter();
