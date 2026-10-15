import { connectToDatabase } from '../config/database.js';
import getPin from './getPin.js';

/**
 * Fetches the total growth for a customer from the database.
 * Accepts either an RSA PIN or a mobile number (resolves the PIN if a mobile number is provided).
 *
 * @param {string} pinOrMobile - RSA PIN or mobile number
 * @returns {Promise<number|undefined>} Total growth
 */
async function getGrowth(pinOrMobile) {
    if (!pinOrMobile) {
        return undefined;
    }

    let pin = pinOrMobile;

    // If a mobile number is provided, resolve the PIN first
    if (typeof pinOrMobile === 'string' && pinOrMobile.startsWith('234')) {
        pin = await getPin(pinOrMobile);
        if (!pin) {
            return undefined;
        }
    }

    const pool = await connectToDatabase('PFA');

    const growthRes = await pool.request()
        .input('pin', pin)
        .query(`
            SELECT totGrowth
            FROM PFA.dbo.Cvi_udfMemberStmtHeader(@pin, GETDATE())
        `);

    return growthRes.recordset[0]?.totGrowth;
}

export default getGrowth;
