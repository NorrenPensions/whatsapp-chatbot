import getPin from '../utility/getPin.js';
import getDataRecaptureStatus from '../utility/getDataRecaptureStatus.js';

export function createDataRecaptureHandler({ resolvePin = getPin, checkRecapture = getDataRecaptureStatus } = {}) {
    return async (req, res) => {
        const input = req.body?.mobileNumOrPin;
        if (typeof input !== 'string' || !input.trim()) {
            return res.status(400).json({ message: 'mobileNumOrPin is required and must be a string' });
        }
        try {
            const pin = await resolvePin(input.trim());
            console.log('Recap Pin: ', pin);
            if (!pin) return res.status(404).json({ message: 'Customer not found for the provided mobile number or RSA PIN' });
            const dataRecaptureStatus = await checkRecapture(pin);
            res.set('Cache-Control', 'no-store');
            return res.json({ dataRecaptureStatus });
        } catch (error) {
            const timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
            return res.status(timeout ? 504 : 502).json({
                message: timeout
                    ? 'The data recapture status request timed out'
                    : 'Unable to retrieve data recapture status'
            });
        }
    };
}

export default createDataRecaptureHandler();
