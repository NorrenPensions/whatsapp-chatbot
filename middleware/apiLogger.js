import { connectToDatabase } from '../config/database.js';

/**
 * Sensitive fields whose values should be masked in the request summary.
 * Add any field name that might contain PII (PINs, phone numbers, emails, etc.)
 */
const SENSITIVE_FIELDS = new Set([
    'rsaPin', 'rsa_pin', 'pin',
    'mobileNumOrPin', 'phoneNumber', 'phone', 'mobile',
    'email', 'otp', 'password', 'token',
]);

/**
 * Mask a value, keeping the first 3 and last 3 characters visible.
 * Short values are fully replaced with asterisks.
 */
function maskValue(value) {
    const str = String(value);
    if (str.length <= 6) return '***';
    return `${str.slice(0, 3)}${'*'.repeat(str.length - 6)}${str.slice(-3)}`;
}

/**
 * Build a redacted summary of the request body.
 * Sensitive fields are masked; the output is truncated to 500 chars.
 */
function buildRequestSummary(body) {
    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
        return null;
    }

    const redacted = {};
    for (const [key, value] of Object.entries(body)) {
        if (SENSITIVE_FIELDS.has(key)) {
            redacted[key] = maskValue(value);
        } else {
            redacted[key] = value;
        }
    }

    const json = JSON.stringify(redacted);
    return json.length > 500 ? json.slice(0, 497) + '...' : json;
}

/**
 * Extract the vendor username from the Basic Auth header.
 * Returns null if no valid Basic Auth is present.
 */
function extractVendorUsername(authHeader) {
    if (!authHeader) return null;
    const match = /^Basic\s+(.+)$/i.exec(authHeader);
    if (!match) return null;

    try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
        const separator = decoded.indexOf(':');
        return separator > 0 ? decoded.slice(0, separator) : null;
    } catch {
        return null;
    }
}

/**
 * Asynchronously insert a log entry into PFA.dbo.ChatbotApiLog.
 * Failures are silently logged to console — logging should never
 * break the actual API response.
 */
async function insertLog(logEntry) {
    try {
        const pool = await connectToDatabase('PFA');
        await pool.request()
            .input('endpoint', logEntry.endpoint)
            .input('method', logEntry.method)
            .input('status_code', logEntry.statusCode)
            .input('response_time_ms', logEntry.responseTimeMs)
            .input('client_ip', logEntry.clientIp)
            .input('vendor_username', logEntry.vendorUsername)
            .input('user_agent', logEntry.userAgent)
            .input('request_summary', logEntry.requestSummary)
            .input('error_message', logEntry.errorMessage)
            .query(`
                INSERT INTO PFA.dbo.ChatbotApiLog 
                    (endpoint, method, status_code, response_time_ms, client_ip, vendor_username, user_agent, request_summary, error_message)
                VALUES 
                    (@endpoint, @method, @status_code, @response_time_ms, @client_ip, @vendor_username, @user_agent, @request_summary, @error_message)
            `);
    } catch (err) {
        console.error('[ChatbotApiLog] Failed to insert log entry:', err.message);
    }
}

/**
 * Express middleware that logs API request/response metrics.
 * 
 * Usage: app.use(apiLogger);
 * 
 * This must be mounted BEFORE your routes so it can capture
 * the response via the 'finish' event.
 */
export default function apiLogger(req, res, next) {
    // Skip health check endpoints to avoid noise
    if (req.path === '/health' || req.path === '/health/') {
        return next();
    }

    const startTime = process.hrtime.bigint();

    // Capture response data once the response is sent
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const responseTimeMs = Number((endTime - startTime) / 1_000_000n);

        const logEntry = {
            endpoint: req.originalUrl || req.url,
            method: req.method,
            statusCode: res.statusCode,
            responseTimeMs,
            clientIp: req.ip || req.socket?.remoteAddress || null,
            vendorUsername: extractVendorUsername(req.get('authorization')),
            userAgent: (req.get('user-agent') || '').slice(0, 500) || null,
            requestSummary: buildRequestSummary(req.body),
            errorMessage: res.statusCode >= 400 ? (res.statusMessage || null) : null,
        };

        // Fire and forget — don't await
        insertLog(logEntry);
    });

    next();
}
