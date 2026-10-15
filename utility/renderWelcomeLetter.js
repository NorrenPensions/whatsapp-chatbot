import fs from 'node:fs';
import handlebars from 'handlebars';

const root = new URL('../adhoc_statement_template/', import.meta.url);
const asset = name => `data:image/png;base64,${fs.readFileSync(new URL(`public/img/${name}`, root)).toString('base64')}`;

export function formatLetterDate(value) {
    if (!value) return '';
    // SQL calendar dates must retain their day irrespective of the host timezone.
    const date = value instanceof Date
        ? new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
        : new Date(String(value).slice(0, 10));
    if (Number.isNaN(date.getTime())) throw new Error('Invalid welcome letter date');
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function renderWelcomeLetter(data) {
    const template = handlebars.compile(fs.readFileSync(new URL('templates/welcome-letter.hbs', root), 'utf8'));
    const clean = value => String(value ?? '').trim();
    return template({
        ...data,
        fullName: [data.firstName, data.otherNames, data.surname].map(clean).filter(Boolean).join(' '),
        firstName: clean(data.firstName) || 'Customer',
        addressLines: clean(data.address).split(/\r?\n/).filter(Boolean),
        registrationDate: formatLetterDate(data.registrationDate),
        dateOfBirth: formatLetterDate(data.dateOfBirth),
        letterDate: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date()),
        logoUrl: asset('norren-logo.png'), signatureUrl: asset('bilk_sign.png'),
        css: fs.readFileSync(new URL('public/css/welcome-letter.css', root), 'utf8')
    });
}
