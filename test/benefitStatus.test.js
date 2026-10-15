process.env.API_BASIC_AUTH_CREDENTIALS = JSON.stringify([
    { username: 'test-user', password: 'a'.repeat(40) }
]);

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';

const { createBenefitStatusRouter, stages } = await import('../routes/benefitStatus.js');



test('POST / returns benefit application status with mapped stage label', async () => {
    const mockPool = {
        request: () => ({
            input: () => ({
                query: async () => ({
                    recordset: [
                        {
                            status: 'Approved by Finance',
                            status_id: 16,
                            benefit_type: 'EnBloc - Private',
                            applicant_name: 'Gaddafi Balarabe',
                            application_date: '2025-05-21T09:35:33.353Z'
                        }
                    ]
                })
            })
        })
    };

    const router = createBenefitStatusRouter({
        authenticate: null,
        resolvePin: async pin => pin,
        getDbPool: async () => mockPool
    });

    const app = express();
    app.use(express.json());
    app.use('/benefit-status', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.post(`http://127.0.0.1:${port}/benefit-status`, {
            mobileNumOrPin: 'PEN100771157719'
        });

        assert.equal(res.status, 200);
        assert.equal(res.data.status, 200);
        assert.equal(res.data.data.statusId, 16);
        assert.equal(
            res.data.data.status,
            'Approved for payment - payment instruction sent to Custodian'
        );
        assert.equal(
            res.data.message,
            'Approved for payment - payment instruction sent to Custodian'
        );
        assert.equal(res.data.data.applicantName, 'Gaddafi Balarabe');
        assert.equal(res.data.data.benefitType, 'EnBloc - Private');
    } finally {
        server.close();
    }
});

test('POST / resolves mobile number to PIN before querying', async () => {
    let queriedPin = null;
    const mockPool = {
        request: () => ({
            input: (name, type, val) => {
                if (name === 'pin') queriedPin = val;
                return {
                    query: async () => ({
                        recordset: [
                            {
                                status: 'Received',
                                status_id: 2,
                                benefit_type: '25% Payment',
                                applicant_name: 'John Doe',
                                application_date: '2026-01-10T10:00:00.000Z'
                            }
                        ]
                    })
                };
            }
        })
    };

    const router = createBenefitStatusRouter({
        authenticate: null,
        resolvePin: async input => (input === '2348012345678' ? 'PEN000000000001' : null),
        getDbPool: async () => mockPool
    });

    const app = express();
    app.use(express.json());
    app.use('/benefit-status', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.post(`http://127.0.0.1:${port}/benefit-status`, {
            mobileNumOrPin: '2348012345678'
        });

        assert.equal(res.status, 200);
        assert.equal(queriedPin, 'PEN000000000001');
        assert.equal(res.data.data.statusId, 2);
        assert.equal(res.data.data.status, 'Application received');
    } finally {
        server.close();
    }
});

test('POST / returns 404 when no application is found', async () => {
    const mockPool = {
        request: () => ({
            input: () => ({
                query: async () => ({ recordset: [] })
            })
        })
    };

    const router = createBenefitStatusRouter({
        authenticate: null,
        resolvePin: async pin => pin,
        getDbPool: async () => mockPool
    });

    const app = express();
    app.use(express.json());
    app.use('/benefit-status', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.post(`http://127.0.0.1:${port}/benefit-status`, {
            mobileNumOrPin: 'PEN999999999999'
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.status, 404);
        assert.equal(res.data.data, null);
        assert.equal(res.data.message, 'No request found for that pin');
    } finally {
        server.close();
    }
});

test('POST / returns not found message when PIN or mobile cannot be resolved', async () => {
    const router = createBenefitStatusRouter({
        authenticate: null,
        resolvePin: async () => null,
        getDbPool: async () => ({})
    });

    const app = express();
    app.use(express.json());
    app.use('/benefit-status', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        const res = await axios.post(`http://127.0.0.1:${port}/benefit-status`, {
            mobileNumOrPin: '2340000000000'
        });
        assert.equal(res.status, 200);
        assert.equal(res.data.status, 404);
        assert.equal(res.data.data, null);
        assert.equal(res.data.message, 'No request found for that pin');
    } finally {
        server.close();
    }
});

test('POST / returns 400 when identifier is missing', async () => {
    const router = createBenefitStatusRouter({
        authenticate: null,
        resolvePin: async pin => pin,
        getDbPool: async () => ({})
    });

    const app = express();
    app.use(express.json());
    app.use('/benefit-status', router);

    const server = app.listen(0);
    const port = server.address().port;

    try {
        const { default: axios } = await import('axios');
        await assert.rejects(
            axios.post(`http://127.0.0.1:${port}/benefit-status`, {}),
            err => err.response && err.response.status === 400
        );
    } finally {
        server.close();
    }
});
