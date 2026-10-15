import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecaptureClient } from '../utility/getDataRecaptureStatus.js';
import { createDataRecaptureHandler } from '../routes/dataRecaptureStatus.js';

function response() {
    return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, set(key, value) { this.headers[key] = value; return this; }, json(body) { this.body = body; return this; } };
}

test('resolves mobile number before calling authenticated POST with the resolved PIN', async () => {
    const order = [];
    const client = createRecaptureClient({
        getToken: async () => { order.push('authenticate'); return 'test-token'; },
        fetchImpl: async (url, options) => {
            order.push('check');
            assert.match(url, /partnerservice\/rsa-recapture-check$/);
            assert.equal(options.method, 'POST');
            assert.equal(options.headers.Authorization, 'Bearer test-token');
            assert.deepEqual(JSON.parse(options.body), { pin: 'PEN000000000001' });
            return new Response(JSON.stringify({ status: false }));
        }
    });
    const handler = createDataRecaptureHandler({ resolvePin: async input => {
        order.push('resolve'); assert.equal(input, '2348000000000'); return 'PEN000000000001';
    }, checkRecapture: client });
    const res = response();
    await handler({ body: { mobileNumOrPin: '2348000000000' } }, res);
    assert.deepEqual(order, ['resolve', 'authenticate', 'check']);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { dataRecaptureStatus: { status: false } });
    assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('partner unauthorized response refreshes once, then succeeds', async () => {
    let tokenCalls = 0;
    const invalidated = [];
    const client = createRecaptureClient({
        getToken: async () => `token-${++tokenCalls}`,
        invalidateToken: token => invalidated.push(token),
        fetchImpl: async (_url, options) => options.headers.Authorization === 'Bearer token-1'
            ? new Response('', { status: 401 }) : new Response('false')
    });
    assert.equal(await client('PEN000000000001'), false);
    assert.deepEqual(invalidated, ['token-1']);
    assert.equal(tokenCalls, 2);
});

test('repeated unauthorized responses stop after two attempts', async () => {
    let calls = 0;
    const client = createRecaptureClient({ getToken: async () => 'token', invalidateToken: () => {}, fetchImpl: async () => { calls++; return new Response('', { status: 401 }); } });
    await assert.rejects(client('PEN000000000001'));
    assert.equal(calls, 2);
});

test('invalid input and missing customers do not call the partner', async () => {
    const handler = createDataRecaptureHandler({ resolvePin: async () => null, checkRecapture: async () => assert.fail('Must not call partner') });
    for (const input of [undefined, '', {}, 123]) {
        const res = response();
        await handler({ body: { mobileNumOrPin: input } }, res);
        assert.equal(res.statusCode, 400);
    }
    const res = response();
    await handler({ body: { mobileNumOrPin: 'PEN000000000001' } }, res);
    assert.equal(res.statusCode, 404);
});

test('upstream errors, malformed JSON, and timeouts return controlled failures', async () => {
    for (const [fetchImpl, status] of [
        [async () => new Response('private upstream message', { status: 500 }), 502],
        [async () => new Response('not JSON'), 502],
        [async () => { throw new DOMException('private timeout details', 'TimeoutError'); }, 504]
    ]) {
        const handler = createDataRecaptureHandler({ resolvePin: async () => 'PEN000000000001', checkRecapture: createRecaptureClient({ getToken: async () => 'token', fetchImpl }) });
        const res = response();
        await handler({ body: { mobileNumOrPin: 'PEN000000000001' } }, res);
        assert.equal(res.statusCode, status);
        assert.doesNotMatch(JSON.stringify(res.body), /private/);
    }
});
