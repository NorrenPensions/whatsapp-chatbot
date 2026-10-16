import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import formatPhoneNumber from '../utility/formatPhoneNum.js';
import capitalizeWords from '../utility/capitalizeWords.js';
import getPin from '../utility/getPin.js';
import transporter from '../utility/transporter.js';

const router = Router();
router.use(requireVendorBasicAuth);


router.post('/send-otp', async (req, res) => {
    const { mobileNumOrPin } = req.body;

    const pin = await getPin(mobileNumOrPin);

    const min = 200000
    const max = 900000
    const otp = Math.floor(Math.random() * (max - min) + min);

    try {
        const pool = await connectToDatabase('PFA');
        const poolB = await connectToDatabase('BenefitTracker_v2');

        const clientDetailRes = await pool.request()
            .input('pin', sql.VarChar(30), pin)
            .query(`
                SELECT PIN, EMAIL, TITLE, SURNAME, FIRSTNAME, OTHERNAMES, MOBILE_PHONE FROM PFA.dbo.EMPLOYEES
                WHERE PIN = @pin OR MOBILE_PHONE = @pin`);

        const clientDetail = clientDetailRes.recordset[0];

        if (!clientDetail) return res.json({ message: 'Invalid user or incorrect RSA pin.' });

        const rsaPin = clientDetail.PIN;
        const findClientRes = await poolB.request()
            .input('pin', rsaPin)
            .query(`
                SELECT * FROM BenefitTracker_v2.dbo.Clients
                    WHERE rsa_pin = @pin`)

        const clientFound = findClientRes.rowsAffected[0] > 0;
        const today = new Date();

        if (clientFound) {
            const existingClient = findClientRes.recordset[0];
            if (existingClient && existingClient.otp && existingClient.otp_createdAt) {
                const secondsPassed = (today - new Date(existingClient.otp_createdAt)) / 1000;
                if (secondsPassed < 60) {
                    return res.json({ message: 'An OTP was recently generated. Please wait 60 seconds before requesting another.', status: 429 });
                }
            }
        }

        if (!clientFound) {
            const clientCreationRes = await poolB.request()
                .input('rsa_pin', rsaPin)
                .input('surname', clientDetail.SURNAME)
                .input('firstname', clientDetail.FIRSTNAME)
                .input('othernames', clientDetail.OTHERNAMES)
                .input('email', clientDetail.EMAIL)
                .input('mobile_phone', clientDetail.MOBILE_PHONE)
                .input('otp', otp)
                .input('otp_createdAt', today)
                .input('createdAt', today)
                .query(`
                    INSERT INTO BenefitTracker_v2.dbo.Clients (rsa_pin, surname, firstname, othernames, email, mobile_phone, otp, otp_createdAt, createdAt)
                    VALUES (@rsa_pin, @surname, @firstname, @othernames, @email, @mobile_phone, @otp, @otp_createdAt, @createdAt)
            `);
            // Check the insert result
            if (clientCreationRes.rowsAffected[0] <= 0) {
                return res.status(500).json({ message: 'Failed to create client record.' });
            }
        }

        if (clientFound) {
            const clientOtpUpdateRes = await poolB.request()
                .input('rsa_pin', rsaPin)
                .input('otp', otp)
                .input('otp_createdAt', today)
                .query(`
                    UPDATE BenefitTracker_v2.dbo.Clients
                    SET otp = @otp,
                        otp_createdAt = @otp_createdAt
                    WHERE rsa_pin = @rsa_pin`);

            if (clientOtpUpdateRes.rowsAffected[0] <= 0) {
                return res.status(500).json({ message: 'Failed to update client record.' });
            }
        }

        const email = typeof clientDetail.EMAIL === 'string' ? clientDetail.EMAIL.trim() : '';
        const isEmailValid = Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

        // 1. If the user has a valid email, send OTP via email and do NOT send SMS
        if (isEmailValid) {
            try {
                const { TITLE, SURNAME, FIRSTNAME } = clientDetail;
                const clientName = `${TITLE || ''} ${FIRSTNAME || ''} ${SURNAME || ''}`.trim();
                const name = capitalizeWords(clientName) || 'Customer';

                const option = {
                    from: '"Norrenberger Pensions" <noreply-npl@norrenpensions.com>',
                    to: email,
                    subject: 'Account Verification',
                    html: `
                        <b>Dear ${name},</b>
                        <p>Use this one-time-pin(OTP) <strong style="padding:3px; margin-right:3px; font-size:1.2em; background:blue; color: white">${otp}</strong> for verification on the NPL Benefit Tracker platform.</p>
                        <p>If you did not initiate this OTP generation, please immediately contact Norrenberger Pension customer service on 07002200300.</p>
                        <p>Thank You.</p>
                        <p>Norrenberger Pensions Ltd</p>
                    `
                };

                await new Promise((resolve, reject) => {
                    transporter.sendMail(option, (err, info) => {
                        if (err) return reject(err);
                        resolve(info);
                    });
                });

                return res.json({ message: 'OTP successfully sent to your email.', channel: 'email', status: 200 });
            } catch (mailErr) {
                console.error('Email delivery failed, attempting fallback to SMS:', mailErr);
            }
        }

        // 2. If the user does not have an email or the email is invalid (or failed), send an SMS
        const { MOBILE_PHONE: phone } = clientDetail;
        const phoneNum = phone ? formatPhoneNumber(phone) : null;

        if (!phoneNum) {
            const message = isEmailValid
                ? 'Failed to send OTP email, and no valid mobile phone number was found on your record for SMS fallback.'
                : 'We do not have a valid email or mobile phone number on your record. Kindly complete an update form with Norrenberger Pensions.';
            return res.status(400).json({ message, status: 400 });
        }

        const channel = 'BNTR';
        const senderID = 'NorrenPens';
        const msg = `Your One Time Password (OTP) for Norrenberger Benefit Tracker verification is :${otp}`;

        await pool.request()
            .input('pin', sql.VarChar(20), rsaPin)
            .input('phone', sql.VarChar(15), phoneNum)
            .input('msg', sql.VarChar(250), msg)
            .input('channel', sql.VarChar(20), channel)
            .input('senderID', sql.VarChar(20), senderID)
            .query(`
                INSERT INTO SMS_SERVER.SmartSMSNotification.dbo.tbl_SMS2MEMBER 
                ( senderID, RSAPIN, PhoneNo, Message, ChannelCode )
                VALUES ( @senderID, @pin, @phone, @msg, @channel )
            `);

        return res.json({ message: 'OTP successfully sent via SMS.', channel: 'sms', status: 200 });

    } catch (error) {
        console.log('Server error: ', error);
        return res.status(500).json({ message: 'An error occurred while processing OTP request.' });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { mobileNumOrPin, otp } = req.body;

    const pin = await getPin(mobileNumOrPin);

    const pool = await connectToDatabase('PFA');
    const poolB = await connectToDatabase('BenefitTracker_v2');

    const savedOtpRes = await poolB.request()
        .input('pin', pin)
        .query(`
            SELECT otp AS savedOtp, rsa_pin AS rsaPin, otp_createdAt FROM BenefitTracker_v2.dbo.Clients
                WHERE rsa_pin = @pin OR mobile_phone = @pin`)

    if (!savedOtpRes.recordset || savedOtpRes.recordset.length === 0) {
        return res.status(400).json({ message: "Invalid OTP or request not found.", status: 400 });
    }

    const { savedOtp, rsaPin, otp_createdAt } = savedOtpRes.recordset[0];

    if (savedOtp && otp && String(otp).trim() === String(savedOtp).trim()) {
        const otpExpiryMinutes = 10;
        const now = new Date();
        const otpTime = new Date(otp_createdAt);
        const diffMins = (now - otpTime) / (1000 * 60);

        if (!otp_createdAt || diffMins > otpExpiryMinutes) {
            await poolB.request()
                .input('pin', rsaPin)
                .query(`
                    UPDATE BenefitTracker_v2.dbo.Clients
                        SET otp = NULL, otp_createdAt = NULL
                        WHERE rsa_pin = @pin`);
            return res.status(400).json({ message: "OTP has expired. Please request a new one.", status: 400 });
        }

        await poolB.request()
            .input('pin', rsaPin)
            .query(`
                UPDATE BenefitTracker_v2.dbo.Clients
                    SET otp = NULL, otp_createdAt = NULL
                    WHERE rsa_pin = @pin`);

        const result = await pool.request()
            .input('pin', sql.VarChar(30), rsaPin)
            .query(`
                SELECT 
                    PIN AS rsaPin,
                    EMAIL AS email,
                    SURNAME AS surname,
                    FIRSTNAME AS firstname,
                    OTHERNAMES AS othername,
                    MOBILE_PHONE AS phone
                    FROM PFA.dbo.EMPLOYEES
                    WHERE PIN = @pin;
                    `);

        if (result.rowsAffected[0] > 0) {
            const { rsaPin, email, surname, firstname, othername, phone } = result.recordset[0];
            return res.json({
                details: {
                    rsaPin,
                    email,
                    surname,
                    firstname,
                    othername,
                    phone
                }, message: "Correct OTP submitted.", status: 200
            });
        }

        return res.status(404).json({ message: "Employee record not found.", status: 404 });

    } else {
        return res.status(400).json({ message: "Incorrect OTP", status: 400 });
    }

});

export default router;