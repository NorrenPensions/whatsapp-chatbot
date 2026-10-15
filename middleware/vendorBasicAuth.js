import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const rateLimitState = new Map();

function parseCredentials() {
    const configuredCredentials = process.env.API_BASIC_AUTH_CREDENTIALS;
    if (!configuredCredentials) {
        throw new Error('API_BASIC_AUTH_CREDENTIALS must be configured');
    }

    let credentials;
    try {
        credentials = JSON.parse(configuredCredentials);
    } catch {
        throw new Error('API_BASIC_AUTH_CREDENTIALS must contain a valid JSON array');
    }

    if (!Array.isArray(credentials) || credentials.length === 0) {
        throw new Error('API_BASIC_AUTH_CREDENTIALS must contain at least one credential');
    }

    const usernames = new Set();
    return credentials.map(credential => {
        if (
            !credential ||
            typeof credential.username !== 'string' ||
            credential.username.length === 0 ||
            credential.username.includes(':') ||
            typeof credential.password !== 'string' ||
            credential.password.length < 32 ||
            usernames.has(credential.username)
        ) {
            throw new Error(
                'Each API Basic Auth credential needs a unique username and a password of at least 32 characters'
            );
        }

        usernames.add(credential.username);
        return {
            usernameHash: hash(credential.username),
            passwordHash: hash(credential.password)
        };
    });
}

function parseAllowedIps() {
    const configuredIps = process.env.CLIENT_DETAILS_ALLOWED_IPS;
    if (!configuredIps) {
        return null;
    }

    const ips = configuredIps.split(',').map(ip => ip.trim());
    if (ips.some(ip => !ip || !isIP(ip))) {
        throw new Error('CLIENT_DETAILS_ALLOWED_IPS must be a comma-separated list of IP addresses');
    }

    return new Set(ips);
}

function hash(value) {
    return createHash('sha256').update(value, 'utf8').digest();
}

function parseBasicAuth(header) {
    const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header || '');
    if (!match) {
        return null;
    }

    const encodedCredentials = match[1];
    const bytes = Buffer.from(encodedCredentials, 'base64');
    if (bytes.toString('base64') !== encodedCredentials) {
        return null;
    }

    let decoded;
    try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return null;
    }

    const separator = decoded.indexOf(':');
    if (separator <= 0) {
        return null;
    }

    return [decoded.slice(0, separator), decoded.slice(separator + 1)];
}

const credentials = parseCredentials();
const allowedIps = parseAllowedIps();

const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, window] of rateLimitState) {
        if (now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
            rateLimitState.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS);
cleanupTimer.unref();

export default function requireVendorBasicAuth(req, res, next) {
    // if (!req.secure) {
    //     return res.status(403).json({ message: 'HTTPS is required' });
    // }

    const clientIp = req.ip || req.socket.remoteAddress;
    if (allowedIps && !allowedIps.has(clientIp)) {
        return res.status(403).json({ message: 'Forbidden' });
    }

    const now = Date.now();
    let window = rateLimitState.get(clientIp);
    if (!window || now - window.startedAt >= RATE_LIMIT_WINDOW_MS) {
        window = { startedAt: now, requestCount: 0 };
        rateLimitState.set(clientIp, window);
    }

    if (window.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.max(
            1,
            Math.ceil((RATE_LIMIT_WINDOW_MS - (now - window.startedAt)) / 1000)
        );
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ message: 'Too many requests' });
    }
    window.requestCount += 1;

    const suppliedCredentials = parseBasicAuth(req.get('authorization'));
    let authenticated = false;
    if (suppliedCredentials) {
        const [username, password] = suppliedCredentials;
        const usernameHash = hash(username);
        const passwordHash = hash(password);

        for (const credential of credentials) {
            const usernameMatches = timingSafeEqual(usernameHash, credential.usernameHash);
            const passwordMatches = timingSafeEqual(passwordHash, credential.passwordHash);
            authenticated = (usernameMatches && passwordMatches) || authenticated;
        }
    }

    if (!authenticated) {
        res.set('WWW-Authenticate', 'Basic realm="client-details", charset="UTF-8"');
        return res.status(401).json({ message: 'Authentication required' });
    }

    return next();
}
