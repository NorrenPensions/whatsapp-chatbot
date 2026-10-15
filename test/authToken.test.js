import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenProvider } from '../routes/authToken.js';

process.env.PARTNER_API_USERNAME = 'test-user';
process.env.PARTNER_API_PASSWORD = 'test-password';

test('authenticates with Basic auth, shares concurrent refresh, caches and expires token', async () => {
    let timestamp = 0;
    let calls = 0;
    const provider = createTokenProvider({ now: () => timestamp, postImpl: async (url, body, options) => {
        calls++;
        assert.match(url, /partnerservice\/auth\/login$/);
        assert.equal(body, null);
        assert.equal(options.timeout, 30_000);
        assert.equal(options.headers.Authorization, `Basic ${Buffer.from('test-user:test-password').toString('base64')}`);
        return { status: 200, data: { access_token: `token-${calls}`, expires_in: 120 } };
    } });
    assert.deepEqual(await Promise.all([provider.getAccessToken(), provider.getAccessToken()]), ['token-1', 'token-1']);
    assert.equal(calls, 1);
    assert.equal(await provider.getAccessToken(), 'token-1');
    timestamp = 120_000;
    assert.equal(await provider.getAccessToken(), 'token-2');
    provider.invalidateAccessToken('token-1');
    assert.equal(await provider.getAccessToken(), 'token-2');
    provider.invalidateAccessToken('token-2');
    assert.equal(await provider.getAccessToken(), 'token-3');
});

test('supports Authorization header and strips the Bearer prefix', async () => {
    const provider = createTokenProvider({ postImpl: async () => ({ status: 200, headers: { authorization: 'Bearer header-token' } }) });
    assert.equal(await provider.getAccessToken(), 'header-token');
});

test('failed authentication and invalid tokens are not cached', async () => {
    for (const response of [() => ({ status: 401, data: 'private details' }), () => ({ status: 200, data: {} }), () => ({ status: 200, data: { token: 'bad token' } }), () => ({ status: 200, data: { token: 'ok', expires_in: 0 } })]) {
        let calls = 0;
        const provider = createTokenProvider({ postImpl: async () => { calls++; return response(); } });
        await assert.rejects(provider.getAccessToken());
        await assert.rejects(provider.getAccessToken());
        assert.equal(calls, 2);
    }
});


test('Axios failures do not expose request credentials and preserve timeouts', async () => {
    const provider = createTokenProvider({ postImpl: async () => {
        const error = new Error('sensitive request details');
        error.code = 'ECONNABORTED';
        error.config = { headers: { Authorization: 'secret' } };
        throw error;
    } });
    await assert.rejects(provider.getAccessToken(), error => {
        assert.equal(error.name, 'TimeoutError');
        assert.equal(error.message, 'External API authentication failed');
        assert.equal(error.config, undefined);
        return true;
    });
});
