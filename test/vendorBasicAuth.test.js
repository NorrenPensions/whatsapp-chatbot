import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';

process.env.API_BASIC_AUTH_CREDENTIALS = JSON.stringify([
    { username: 'vendor-one', password: 'a'.repeat(40) },
    { username: 'vendor-two', password: 'b'.repeat(40) }
]);
process.env.CLIENT_DETAILS_ALLOWED_IPS = '127.0.0.1';

const { default: requireVendorBasicAuth } = await import('../middleware/vendorBasicAuth.js');
const app = express();
app.set('trust proxy', 'loopback');
app.get('/client-details', requireVendorBasicAuth, (_req, res) => {
    res.json({ authorized: true });
});

let server;
let baseUrl;

before(async () => {
    await new Promise(resolve => {
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${server.address().port}`;
            resolve();
        });
    });
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
    });
});

test('rejects requests that are not HTTPS', async () => {
    const response = await fetch(`${baseUrl}/client-details`);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { message: 'HTTPS is required' });
});

test('rejects missing or invalid Basic credentials', async () => {
    const missingCredentialsResponse = await fetch(`${baseUrl}/client-details`, {
        headers: { 'x-forwarded-proto': 'https' }
    });

    assert.equal(missingCredentialsResponse.status, 401);
    assert.equal(
        missingCredentialsResponse.headers.get('www-authenticate'),
        'Basic realm="client-details", charset="UTF-8"'
    );

    const invalidCredentials = Buffer.from(`vendor-one:${'x'.repeat(40)}`).toString('base64');
    const invalidCredentialsResponse = await fetch(`${baseUrl}/client-details`, {
        headers: {
            authorization: `Basic ${invalidCredentials}`,
            'x-forwarded-proto': 'https'
        }
    });

    assert.equal(invalidCredentialsResponse.status, 401);
});

test('accepts any currently configured vendor credential', async () => {
    const encodedCredentials = Buffer.from(`vendor-two:${'b'.repeat(40)}`).toString('base64');
    const response = await fetch(`${baseUrl}/client-details`, {
        headers: {
            authorization: `Basic ${encodedCredentials}`,
            'x-forwarded-proto': 'https'
        }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authorized: true });
});

test('rejects client IPs outside the allowlist', async () => {
    const response = await fetch(`${baseUrl}/client-details`, {
        headers: {
            'x-forwarded-for': '192.0.2.10',
            'x-forwarded-proto': 'https'
        }
    });

    assert.equal(response.status, 403);
});

test('rate limits requests by source IP', async () => {
    const headers = { 'x-forwarded-proto': 'https' };
    for (let request = 0; request < 57; request += 1) {
        const response = await fetch(`${baseUrl}/client-details`, { headers });
        assert.equal(response.status, 401);
    }

    const response = await fetch(`${baseUrl}/client-details`, { headers });
    assert.equal(response.status, 429);
    assert.ok(Number(response.headers.get('retry-after')) > 0);
});
