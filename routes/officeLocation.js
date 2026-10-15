import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';

const router = Router();

router.post('/state', async (req, res) => {
    const { state } = req.body;

    if (!state) {
        return res.status(400).json({ message: 'Please provide a state' });
    }

    try {
        const pool = await connectToDatabase('PFA');
        const result = await pool.request()
            .input('state', sql.VarChar(50), state)
            .query(`
                SELECT state, officeName, city, address, personnel, phone
                FROM PFA.dbo.ServiceCentres WHERE State = @state
            `);

        const location = result.recordset.map(row => {
            return {
                state: row.state,
                officeName: row.officeName,
                city: row.city,
                address: row.address,
                personnel: row.personnel,
                phone: row.phone
            };
        });

        res.json(location);
    } catch (error) {
        console.error('Error fetching office location: ', error);
        res.status(500).json({ message: 'An error occurred while fetching office location' });
    }
});

export default router;
