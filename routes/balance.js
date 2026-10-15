import { Router } from 'express';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import getPin from '../utility/getPin.js';
import getBalance from '../utility/getBalance.js';
import getGrowth from '../utility/getGrowth.js';

const router = Router();

router.use(requireVendorBasicAuth);

router.post('/my-bal', async (req, res) => {
    const { mobileNumOrPin } = req.body;

    const pin = await getPin(mobileNumOrPin);

    if (!pin) {
        const userInput = mobileNumOrPin?.startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }

    try {
        const balance = await getBalance(pin);

        res.json(balance);

    } catch (error) {
        console.error('Error fetching balances: ', error);
        res.status(500).json({ message: 'An error occurred while fetching balances' });
    }
});

const handleGrowth = async (req, res) => {
    const { mobileNumOrPin } = req.body;

    const pin = await getPin(mobileNumOrPin);

    if (!pin) {
        const userInput = mobileNumOrPin?.startsWith('234') ? 'mobile number' : 'RSA PIN';
        res.status(404).json({ message: `The provided ${userInput} does not exist.` });
        return;
    }

    try {
        const growth = await getGrowth(pin);

        res.json(growth);

    } catch (error) {
        console.error('Error fetching growth: ', error);
        res.status(500).json({ message: 'An error occurred while fetching growth' });
    }
};

router.post('/my-growth', handleGrowth);
router.post('/growth', handleGrowth);

export default router;