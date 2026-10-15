import axios from 'axios';

const DEFAULT_BASE_URL = 'http://ffpro.norrenpensions.com:8080/pensionserver-web/rest';

export function partnerServiceUrl(endpoint) {
    const base = (process.env.PARTNER_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    return `${base}/partnerservice/${endpoint}`;
}

export function createTokenProvider({ postImpl = (...args) => axios.post(...args), now = Date.now } = {}) {
    let cachedToken;
    let refreshAt = 0;
    let pending;

    async function fetchNewToken() {
        const username = process.env.PARTNER_API_USERNAME;
        const password = process.env.PARTNER_API_PASSWORD;
        if (!username || !password) throw new Error('Partner API credentials are not configured');
        const response = await postImpl(partnerServiceUrl('auth/login'), null, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            timeout: 30_000,
            maxRedirects: 0
        });
        if (response.status < 200 || response.status >= 300) throw new Error('Partner API authentication failed');
        const data = response.data;
        const rawToken = data?.access_token || data?.token || response.headers?.authorization;
        const token = typeof rawToken === 'string' ? rawToken.trim().replace(/^Bearer\s+/i, '') : '';
        if (!token || /\s/.test(token)) throw new Error('Partner API did not return a valid access token');
        const expiresIn = Number(data?.expires_in ?? 900);
        if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error('Partner API returned an invalid token expiry');
        cachedToken = token;
        const lifetime = expiresIn * 1000;
        refreshAt = now() + lifetime - Math.min(60_000, lifetime * 0.1);
        return token;
    }

    return {
        async getAccessToken() {
            if (cachedToken && now() < refreshAt) return cachedToken;
            if (!pending) {
                pending = fetchNewToken()
                    .then(token => {
                        console.log('External API authentication succeeded');
                        return token;
                    })
                    .catch(error => {
                        console.log('External API authentication failed');
                        const timeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
                        const failure = new Error('External API authentication failed');
                        if (timeout) failure.name = 'TimeoutError';
                        throw failure;
                    })
                    .finally(() => { pending = undefined; });
            }
            return pending;
        },
        invalidateAccessToken(token) {
            if (!token || token === cachedToken) { cachedToken = undefined; refreshAt = 0; }
        }
    };
}

const provider = createTokenProvider();
export const getAccessToken = provider.getAccessToken;
export const invalidateAccessToken = provider.invalidateAccessToken;
