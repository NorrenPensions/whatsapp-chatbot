import { getAccessToken, invalidateAccessToken, partnerServiceUrl } from '../routes/authToken.js';

export function createRecaptureClient({ fetchImpl = (...args) => fetch(...args), getToken = getAccessToken, invalidateToken = invalidateAccessToken } = {}) {
    return async function getDataRecaptureStatus(pin) {
        let token = await getToken();
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await fetchImpl(partnerServiceUrl('rsa-recapture-check'), {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ pin }),
                signal: AbortSignal.timeout(30_000),
                redirect: 'error'
            });
            if (response.status === 401 && attempt === 0) {
                await response.body?.cancel();
                invalidateToken(token);
                token = await getToken();
                continue;
            }
            if (!response.ok) throw new Error('Partner recapture check failed');
            return await response.json();
        }
    };
}

export default createRecaptureClient();
