import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createFundPricesRouter } from '../routes/fundPrices.js';

const sampleFunds = [
    {
        fundCode: 'FUND2',
        fundName: 'NORRENBERGER RSA FUND II',
        fundPrice: 7.1971,
        valuationDate: 1791932400000
    },
    {
        fundCode: 'FUND1',
        fundName: 'RSA FUND I',
        fundPrice: 3.2219,
        valuationDate: 1791932400000
    }
];

test('GET / returns complete list of fund prices', async () => {
    const router = createFundPricesRouter({
        postImpl: async () => ({ status: 200, data: sampleFunds }),
        getUrl: () => 'http://test-url/fundprice-list'
    });

    const app = express();
    app.use(express.json());
    app.use('/fund-prices', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.get(`http://127.0.0.1:${port}/fund-prices`);
        assert.equal(res.status, 200);
        assert.equal(res.data.length, 2);
        assert.equal(res.data[0].fundCode, 'FUND2');
    } finally {
        server.close();
    }
});

test('GET /:fundCode filters fund by code case-insensitively', async () => {
    const router = createFundPricesRouter({
        postImpl: async () => ({ status: 200, data: sampleFunds })
    });

    const app = express();
    app.use(express.json());
    app.use('/fund-prices', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.get(`http://127.0.0.1:${port}/fund-prices/fund1`);
        assert.equal(res.status, 200);
        assert.equal(res.data.fundCode, 'FUND1');
        assert.equal(res.data.fundPrice, 3.2219);
    } finally {
        server.close();
    }
});

test('POST / with fundCode in body filters fund', async () => {
    const router = createFundPricesRouter({
        postImpl: async () => ({ status: 200, data: sampleFunds })
    });

    const app = express();
    app.use(express.json());
    app.use('/fund-prices', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.post(`http://127.0.0.1:${port}/fund-prices`, { fundCode: 'FUND2' });
        assert.equal(res.status, 200);
        assert.equal(res.data.fundCode, 'FUND2');
    } finally {
        server.close();
    }
});

test('returns 404 if requested fundCode is not found', async () => {
    const router = createFundPricesRouter({
        postImpl: async () => ({ status: 200, data: sampleFunds })
    });

    const app = express();
    app.use(express.json());
    app.use('/fund-prices', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        await assert.rejects(
            axios.get(`http://127.0.0.1:${port}/fund-prices/NON_EXISTENT`),
            err => err.response && err.response.status === 404
        );
    } finally {
        server.close();
    }
});
