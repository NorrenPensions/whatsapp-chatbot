import { connectToDatabase, sql } from '../config/database.js';

// Set WELCOME_LETTER_COLUMNS to a JSON mapping when database column names differ.
export function getWelcomeColumns() {
    const columns = {
        imageKey: 'PIN', employeeKey: 'PIN',
        ...JSON.parse(process.env.WELCOME_LETTER_COLUMNS || '{}')
    };
    for (const value of Object.values(columns)) {
        if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
            throw new Error('Invalid welcome letter database column configuration');
        }
    }
    return columns;
}

export function photoDataUrl(value) {
    if (value == null || (Buffer.isBuffer(value) && !value.length)) return '';
    if (!Buffer.isBuffer(value)) throw new Error('PICTURE_IMAGE must contain binary image data');
    let mime;
    if (value.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) mime = 'image/png';
    else if (value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff) mime = 'image/jpeg';
    else if (/^GIF8[79]a$/.test(value.subarray(0, 6).toString('ascii'))) mime = 'image/gif';
    else if (value.subarray(0, 4).toString() === 'RIFF' && value.subarray(8, 12).toString() === 'WEBP') mime = 'image/webp';
    else throw new Error('Unsupported customer photo format');
    return `data:${mime};base64,${value.toString('base64')}`;
}

export default async function getWelcomeLetterData(pin, connect = connectToDatabase) {
    const c = getWelcomeColumns();
    const pool = await connect('PFA');
    const result = await pool.request().input('pin', sql.VarChar(20), pin).query(`
        SELECT FIRSTNAME AS firstName, SURNAME AS surname, OTHERNAMES AS otherNames,
            PIN AS pin, EMAIL AS email, EMPLOYER_NAME AS employerName, EMPLOYER_RCNO AS employerCode,
            DATE_CREATED AS registrationDate, DATE_OF_BIRTH AS dateOfBirth,
            [${c.employeeKey}] AS imageLookupKey
        FROM PFA.dbo.EMPLOYEES WHERE PIN = @pin
    `);
    const employee = result.recordset[0];
    if (!employee) return null;
    if (employee.imageLookupKey == null) throw new Error('Customer image lookup key is missing');
    const images = await connect('PFAIMAGES');
    const photoResult = await images.request().input('customerKey', employee.imageLookupKey).query(`
        SELECT PICTURE_IMAGE FROM PFAIMAGES.dbo.EMPLOYEE_IMAGES WHERE [${c.imageKey}] = @customerKey
    `);
    if (photoResult.recordset.length > 1) throw new Error('Multiple customer image records found; a selection rule is required');
    return { ...employee, pin, photoUrl: photoDataUrl(photoResult.recordset[0]?.PICTURE_IMAGE) };
}
