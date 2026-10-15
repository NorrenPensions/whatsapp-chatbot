import { connectToDatabase, sql } from '../config/database.js';
import getMobilePhoneVariants from '../utility/mobileNumVariants.js';

async function getPin(mobileNumOrPin) {

  const pool = await connectToDatabase('PFA');

  if (mobileNumOrPin.startsWith('234')) {
    const variants = getMobilePhoneVariants(mobileNumOrPin);
    console.log('MobileNumber: ', variants);

    try {
      const result = await pool.request()
        .input('mobile1', sql.VarChar(20), variants[0])
        .input('mobile2', sql.VarChar(20), variants[1])
        .input('mobile3', sql.VarChar(20), variants[2])
        .input('mobile4', sql.VarChar(20), variants[3])
        .query(`
        SELECT PIN
        FROM EMPLOYEES
        WHERE MOBILE_PHONE IN (
          @mobile1,
          @mobile2,
          @mobile3,
          @mobile4 
        )
      `);

      const pin = result.recordset[0].PIN;

      return pin;
    } catch (error) {
      console.error('Error fetching balances: ', error);
    }
  }

  try {
    const result = await pool.request()
      .input('pin', sql.VarChar(20), mobileNumOrPin)
      .query(`
        SELECT PIN
        FROM EMPLOYEES
        WHERE PIN = @pin
      `);

    const pin = result.recordset[0].PIN;

    return pin;
  } catch (error) {
    console.error('Error fetching balances: ', error);
  }


}

export default getPin;

