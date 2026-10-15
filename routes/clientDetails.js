import axios from 'axios';
import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import getPin from '../utility/getPin.js';
import getBalance from '../utility/getBalance.js';
import getClientDetails from '../utility/getClientDetails.js';
import numberToWords from '../utility/numberToWords.js';
import dataRecaptureStatusHandler from './dataRecaptureStatus.js';
import { getAccessToken, invalidateAccessToken, partnerServiceUrl } from './authToken.js';

const router = Router();

router.use(requireVendorBasicAuth);

router.post('/my-pin', async (req, res) => {
    const { mobileNumOrPin } = req.body;
    const pin = await getPin(mobileNumOrPin);

    console.log('Pin: ', pin);
    console.log('Mobile num or PIN: ', mobileNumOrPin);

    if (!pin) {
        const userInput = mobileNumOrPin.startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }

    res.json({ pin });
});

router.post('/my-email', async (req, res) => {
    const { mobileNumOrPin } = req.body;
    if (!mobileNumOrPin) {
        return res.status(400).json({ message: 'mobileNumOrPin is required' });
    }
    const pin = await getPin(mobileNumOrPin);

    if (!pin) {
        const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }
    const pool = await connectToDatabase('PFA');

    console.log('Pin: ', pin);
    console.log('Mobile num or PIN: ', mobileNumOrPin);

    try {
        const result = await pool.request()
            .input('pin', sql.VarChar(20), pin)
            .query(`
            SELECT EMAIL
            FROM EMPLOYEES
            WHERE PIN = @pin
          `);

        const employee = result.recordset[0];
        if (!employee) {
            return res.status(404).json({ message: 'Employee record not found.' });
        }
        const email = employee.EMAIL?.trim();
        if (!email) {
            return res.status(404).json({ message: 'No email address found for this account.' });
        }
        return res.json({ email });
    } catch (error) {
        console.error('Error fetching balances: ', error);
    }

});


router.put('/update-email', async (req, res) => {
    const { mobileNumOrPin, newEmail } = req.body;
    if (!mobileNumOrPin || !newEmail) {
        return res.status(400).json({ message: 'mobileNumOrPin and newEmail are required' });
    }
    const pin = await getPin(mobileNumOrPin);

    if (!pin) {
        const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }
    const pool = await connectToDatabase('PFA');

    console.log('Pin: ', pin);
    console.log('Mobile num or PIN: ', mobileNumOrPin);

    try {
        const result = await pool.request()
            .input('pin', sql.VarChar(20), pin)
            .input('email', sql.VarChar(100), newEmail)
            .query(`
            UPDATE EMPLOYEES SET EMAIL = @email WHERE PIN = @pin;
          `);

        res.json({ message: 'Email updated successfully' });
    } catch (error) {
        console.error('Error updating email: ', error);
        res.status(500).json({ message: 'An error occurred while updating email' });
    }

});

router.put('/update-phone', async (req, res) => {
    const { mobileNumOrPin, newMobileNum } = req.body;
    if (!mobileNumOrPin || !newMobileNum) {
        return res.status(400).json({ message: 'mobileNumOrPin and newMobileNum are required' });
    }
    const pin = await getPin(mobileNumOrPin);

    if (!pin) {
        const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }
    const pool = await connectToDatabase('PFA');

    console.log('Pin: ', pin);
    console.log('Mobile num or PIN: ', mobileNumOrPin);

    try {
        const result = await pool.request()
            .input('pin', sql.VarChar(20), pin)
            .input('mobileNum', sql.VarChar(20), newMobileNum)
            .query(`
            UPDATE EMPLOYEES SET MOBILE_PHONE = @mobileNum WHERE PIN = @pin;
          `);

        res.json({ message: 'Mobile number updated successfully' });
    } catch (error) {
        console.error('Error updating mobile number: ', error);
        res.status(500).json({ message: 'An error occurred while updating mobile number' });
    }

});

//router.post('/data-recapture-status', dataRecaptureStatusHandler);

router.post('/data-recapture-status', async (req, res) => {
    const { mobileNumOrPin } = req.body;
    if (!mobileNumOrPin) {
        return res.status(400).json({ message: 'mobileNumOrPin is required' });
    }
    const pin = await getPin(mobileNumOrPin);
    if (!pin) {
        const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
        return res.status(404).json({ message: `The provided ${userInput} does not exist.` });
    }

    try {
        let token = await getAccessToken();
        let response;
        try {
            response = await axios.post(
                partnerServiceUrl('rsa-recapture-check'),
                { pin },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    timeout: 30000
                }
            );
        } catch (err) {
            if (err.response?.status === 401) {
                invalidateAccessToken(token);
                token = await getAccessToken();
                response = await axios.post(
                    partnerServiceUrl('rsa-recapture-check'),
                    { pin },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            Accept: 'application/json'
                        },
                        timeout: 30000
                    }
                );
            } else {
                throw err;
            }
        }

        const dataRecaptureStatus = response.data;
        console.log('Recapture status response:', dataRecaptureStatus);
        res.set('Cache-Control', 'no-store');
        return res.json({ recaptured: dataRecaptureStatus ? true : false });
    } catch (error) {
        console.error('Error fetching data recapture status:', error);
        const timeout = error.code === 'ECONNABORTED' || error.name === 'TimeoutError';
        return res.status(timeout ? 504 : 502).json({
            message: timeout
                ? 'The data recapture status request timed out'
                : 'Unable to retrieve data recapture status'
        });
    }
});

router.post('/embassy-letter-details', async (req, res) => {
    const { mobileNumOrPin } = req.body;
    if (!mobileNumOrPin) {
        return res.status(400).json({ message: 'mobileNumOrPin is required' });
    }

    const pin = await getPin(mobileNumOrPin);
    if (!pin) {
        const userInput = String(mobileNumOrPin).startsWith('234') ? 'mobile number' : 'RSA PIN';
        return res.status(404).json({ message: `The provided ${userInput} does not exist.` });
    }

    try {
        const clientDetails = await getClientDetails(pin);
        if (!clientDetails) {
            return res.status(404).json({ message: 'Client details not found for this account.' });
        }

        const balance = await getBalance(pin);
        const numericBal = Number(balance) || 0;
        const formattedBalance = numericBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const balanceInWords = numberToWords(numericBal);

        return res.json({
            ...clientDetails,
            balance: numericBal,
            formattedBalance,
            balanceInWords
        });
    } catch (error) {
        console.error('Error fetching embassy letter details: ', error);
        return res.status(500).json({ message: 'An error occurred while fetching embassy letter details' });
    }
});

export default router;