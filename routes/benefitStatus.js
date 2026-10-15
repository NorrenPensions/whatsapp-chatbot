import { Router } from 'express';
import { connectToDatabase, sql } from '../config/database.js';
import requireVendorBasicAuth from '../middleware/vendorBasicAuth.js';
import getPin from '../utility/getPin.js';

export const stages = [
    { id: 2, label: 'Application received' },
    { id: 4, label: 'Under Initial Review' },
    { id: 8, label: 'Under internal review' },
    { id: 14, label: 'Final stage of processing - awaiting approval for payment' },
    { id: 16, label: 'Approved for payment - payment instruction sent to Custodian' },
    { id: 18, label: 'Process completed' }
];

export function createBenefitStatusRouter({
    authenticate = requireVendorBasicAuth,
    resolvePin = getPin,
    getDbPool = () => connectToDatabase('BenefitTracker_v2')
} = {}) {
    const router = Router();

    if (authenticate) {
        router.use(authenticate);
    }

    const handleBenefitStatus = async (req, res) => {
        const identifier =
            req.body?.mobileNumOrPin ||
            req.body?.rsaPin ||
            req.body?.pin ||
            req.params?.pinOrMobile ||
            req.query?.mobileNumOrPin ||
            req.query?.rsaPin ||
            req.query?.pin;

        if (!identifier) {
            return res.status(400).json({
                data: null,
                message: 'Please provide mobileNumOrPin or rsaPin',
                status: 400
            });
        }

        const rsaPin = await resolvePin(identifier);

        if (!rsaPin) {
            return res.json({
                data: null,
                message: 'No request found for that pin',
                status: 404
            });
        }

        try {
            const pool = await getDbPool();
            const result = await pool.request()
                .input('pin', sql.VarChar(30), rsaPin)
                .query(`
                    SELECT TOP 1 status, status_id, benefit_type, applicant_name, application_date 
                    FROM BenefitTracker_v2.dbo.Applications
                    WHERE applicant_rsa_pin = @pin
                    ORDER BY application_date DESC
                `);

            if (result.recordset && result.recordset.length > 0) {
                const { status, status_id, benefit_type, applicant_name, application_date } = result.recordset[0];

                const matchedStage = stages.find(s => Number(s.id) === Number(status_id));
                const statusMessage = matchedStage ? matchedStage.label : (status || 'Application in progress');

                return res.json({
                    data: {
                        statusId: status_id,
                        status: statusMessage,
                        rawStatus: status,
                        benefitType: benefit_type,
                        applicantName: applicant_name,
                        appDate: application_date
                    },
                    message: statusMessage,
                    status: 200
                });
            }

            return res.json({
                data: null,
                message: 'No request found for that pin',
                status: 404
            });
        } catch (error) {
            console.error('Error fetching benefit status:', error);
            return res.status(500).json({
                data: null,
                message: 'An error occurred while fetching benefit status.',
                status: 500
            });
        }
    };

    router.post('/', handleBenefitStatus);
    router.post('/status', handleBenefitStatus);
    router.get('/', handleBenefitStatus);
    router.get('/:pinOrMobile', handleBenefitStatus);

    return router;
}

const defaultRouter = createBenefitStatusRouter();
export default defaultRouter;
