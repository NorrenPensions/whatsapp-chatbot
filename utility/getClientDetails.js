import { connectToDatabase, sql } from '../config/database.js';
import getPin from './getPin.js';

/**
 * Fetches client/customer details from the EMPLOYEES table.
 * Specifically retrieves FIRSTNAME, SURNAME, OTHERNAMES, EMAIL, and EMPLOYER_NAME.
 * Accepts either an RSA PIN or a mobile number (resolves the PIN if a mobile number is provided).
 *
 * @param {string} pinOrMobile - RSA PIN or Nigerian mobile number
 * @returns {Promise<object|null>} Client details or null if not found
 */
async function getClientDetails(pinOrMobile) {
    if (!pinOrMobile) {
        return null;
    }

    let pin = pinOrMobile;

    // If a mobile number is provided, resolve the PIN first
    if (typeof pinOrMobile === 'string' && pinOrMobile.startsWith('234')) {
        pin = await getPin(pinOrMobile);
        if (!pin) {
            return null;
        }
    }

    const pool = await connectToDatabase('PFA');

    const result = await pool.request()
        .input('pin', sql.VarChar(20), pin)
        .query(`
            SELECT 
                PIN,
                FIRSTNAME,
                SURNAME,
                OTHERNAMES,
                EMAIL,
                EMPLOYER_NAME
            FROM EMPLOYEES
            WHERE PIN = @pin
        `);

    const employee = result.recordset[0];
    if (!employee) {
        return null;
    }

    const firstName = employee.FIRSTNAME?.trim() || '';
    const surname = employee.SURNAME?.trim() || '';
    const otherNames = employee.OTHERNAMES?.trim() || '';
    const email = employee.EMAIL?.trim() || '';
    const employerName = employee.EMPLOYER_NAME?.trim() || '';
    const fullName = [firstName, otherNames, surname].filter(Boolean).join(' ');

    return {
        pin: employee.PIN || pin,
        firstName,
        surname,
        otherNames,
        fullName,
        email,
        employerName,
        FIRSTNAME: firstName,
        SURNAME: surname,
        OTHERNAMES: otherNames,
        EMAIL: email,
        EMPLOYER_NAME: employerName
    };
}

export { getClientDetails, getClientDetails as getCustomerDetails };
export default getClientDetails;
