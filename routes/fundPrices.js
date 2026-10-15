import { Router } from 'express';
import axios from 'axios';

export const DEFAULT_FUND_PRICES_URL =
    'http://ffpro.norrenberger.com:8080/pensionserver-web/rest/partnerservice/fundprice-list';

export function getFundPricesUrl() {
    return process.env.FUND_PRICES_API_URL || DEFAULT_FUND_PRICES_URL;
}

export function createFundPricesRouter({
    postImpl = (...args) => axios.post(...args),
    getUrl = getFundPricesUrl
} = {}) {
    const router = Router();

    async function fetchFundPrices() {
        const response = await postImpl(getUrl(), null, {
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 15_000
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Partner fund prices API returned HTTP status ${response.status}`);
        }

        return response.data;
    }

    async function handleFundPrices(req, res) {
        const fundCode = req.params.fundCode || req.query.fundCode || req.body?.fundCode;

        try {
            const data = await fetchFundPrices();

            if (!Array.isArray(data)) {
                return res.status(502).json({
                    message: 'Unexpected response format from partner fund prices service'
                });
            }

            if (fundCode) {
                const targetCode = String(fundCode).trim().toUpperCase();
                const matched = data.find(
                    item => item && item.fundCode && String(item.fundCode).trim().toUpperCase() === targetCode
                );

                if (!matched) {
                    return res.status(404).json({
                        message: `Fund with code '${fundCode}' not found.`
                    });
                }

                return res.json(matched);
            }

            return res.json(data);
        } catch (error) {
            console.error('Error fetching fund prices:', error?.message || error);
            return res.status(500).json({
                message: 'An error occurred while fetching fund prices'
            });
        }
    }

    router.get('/', handleFundPrices);
    router.post('/', handleFundPrices);
    router.get('/:fundCode', handleFundPrices);

    return router;
}

const defaultRouter = createFundPricesRouter();
export default defaultRouter;
