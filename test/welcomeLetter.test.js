import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

process.env.API_BASIC_AUTH_CREDENTIALS ||= JSON.stringify([{ username: 'test', password: 'a'.repeat(32) }]);
const { createWelcomeLetterRouter } = await import('../routes/welcomeLetter.js');
const { photoDataUrl, getWelcomeColumns } = await import('../utility/welcomeLetterData.js');
const { default: render, formatLetterDate } = await import('../utility/renderWelcomeLetter.js');

async function request(body, dependencies = {}) {
    const app = express();
    app.use(express.json());
    app.use(createWelcomeLetterRouter({ authenticate: (_req, _res, next) => next(), resolvePin: async () => 'PEN000000000001', fetchData: async () => ({ pin: 'PEN000000000001', email: 'registered@example.com' }), generate: async () => Buffer.from('%PDF-test'), sendMail: async () => ({ accepted: ['registered@example.com'], rejected: [] }), ...dependencies }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
        return await fetch(`http://127.0.0.1:${server.address().port}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } finally { server.close(); }
}

test('invalid identifiers are rejected before database access', async () => {
    for (const input of [undefined, 123, {}, "PEN'; DROP TABLE EMPLOYEES--", '']) {
        assert.equal((await request({ mobileNumOrPin: input }, { resolvePin: () => { throw new Error('Must not query'); } })).status, 400);
    }
});
test('PDF is emailed only to the registered email and returns confirmation', async () => {
    let mail;
    const response = await request({ mobileNumOrPin: 'PEN000000000001', email: 'override@example.com' }, {
        sendMail: async options => { mail = options; return { accepted: [options.to], rejected: [] }; }
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).recipient, 'registered@example.com');
    assert.equal(mail.to, 'registered@example.com');
    assert.equal(mail.attachments[0].content.toString(), '%PDF-test');
    assert.equal(mail.attachments[0].contentType, 'application/pdf');
});
test('missing or invalid registered email prevents PDF generation and sending', async () => {
    for (const [email, status] of [[undefined, 404], ['', 404], ['invalid', 422], ['a@example.com,b@example.com', 422]]) {
        const response = await request({ mobileNumOrPin: 'PEN000000000001' }, {
            fetchData: async () => ({ email }),
            generate: async () => { assert.fail('Must not generate'); },
            sendMail: async () => { assert.fail('Must not send'); }
        });
        assert.equal(response.status, status);
    }
});
test('SMTP failure or rejection never reports success', async () => {
    for (const sendMail of [async () => { throw new Error('SMTP credentials'); }, async () => ({ accepted: [], rejected: ['registered@example.com'] })]) {
        const response = await request({ mobileNumOrPin: 'PEN000000000001' }, { sendMail });
        assert.equal(response.status, 500);
        assert.doesNotMatch(await response.text(), /SMTP credentials/);
    }
});
test('missing customers and database failures have controlled responses', async () => {
    assert.equal((await request({ mobileNumOrPin: '2348000000000' }, { resolvePin: async () => null })).status, 404);
    assert.equal((await request({ mobileNumOrPin: 'PEN000000000001' }, { fetchData: async () => null })).status, 404);
    const response = await request({ mobileNumOrPin: 'PEN000000000001' }, { generate: async () => { throw new Error('sensitive database details'); } });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /sensitive/);
});
test('photo formats, missing photos and invalid formats', () => {
    assert.equal(photoDataUrl(null), '');
    assert.match(photoDataUrl(Buffer.from('89504e470d0a1a0a', 'hex')), /^data:image\/png;base64,/);
    assert.match(photoDataUrl(Buffer.from('ffd8ff', 'hex')), /^data:image\/jpeg;base64,/);
    assert.throws(() => photoDataUrl(Buffer.from('<script>')));
});
test('template escapes customer content and calendar dates remain stable', () => {
    assert.equal(formatLetterDate('1993-06-18'), '18 Jun 1993');
    assert.throws(() => formatLetterDate('invalid'));
    const html = render({ firstName: '<script>alert(1)</script>', address: 'Line 1\nLine 2' });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Line 1/);
    assert.doesNotMatch(html, /class="photo"/);
});
test('SQL column mapping rejects injected identifiers', () => {
    const previous = process.env.WELCOME_LETTER_COLUMNS;
    try {
        process.env.WELCOME_LETTER_COLUMNS = JSON.stringify({ imageKey: 'PIN]; DROP TABLE X' });
        assert.throws(getWelcomeColumns);
    } finally {
        if (previous === undefined) delete process.env.WELCOME_LETTER_COLUMNS;
        else process.env.WELCOME_LETTER_COLUMNS = previous;
    }
});

test('employee details come from PFA and only the photo comes from PFAIMAGES', async () => {
    const { default: fetchData } = await import('../utility/welcomeLetterData.js');
    const calls = [];
    const employee = { pin: 'PEN000000000001', firstName: 'Database Customer', employerCode: 'RC123', registrationDate: '2026-10-12', imageLookupKey: 'PEN000000000001' };
    const connect = async database => ({ request: () => {
        const inputs = [];
        return {
            input(...args) { inputs.push(args); return this; },
            async query(query) {
                calls.push({ database, query, inputs });
                return { recordset: database === 'PFA' ? [employee] : [{ PICTURE_IMAGE: Buffer.from('ffd8ff', 'hex') }] };
            }
        };
    } });
    const result = await fetchData(employee.pin, connect);
    assert.equal(result.firstName, employee.firstName);
    assert.equal(result.employerCode, 'RC123');
    assert.equal(calls[0].database, 'PFA');
    assert.match(calls[0].query, /EMAIL AS email/);
    assert.match(calls[0].query, /EMPLOYER_RCNO AS employerCode/);
    assert.match(calls[0].query, /DATE_CREATED AS registrationDate/);
    assert.doesNotMatch(calls[0].query, /ADDRESS|FORM_REF_NO|REGISTRATION_DATE|MOBILE_PHONE/);
    assert.equal(calls[1].database, 'PFAIMAGES');
    assert.match(calls[1].query, /SELECT PICTURE_IMAGE FROM PFAIMAGES.dbo.EMPLOYEE_IMAGES/);
    assert.equal(calls[1].inputs[0][1], employee.pin);
    assert.match(result.photoUrl, /^data:image\/jpeg;base64,/);
});
