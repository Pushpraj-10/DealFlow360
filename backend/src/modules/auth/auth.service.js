import crypto from 'crypto';

const HASH_ALGORITHM = 'sha512';
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 64;
const TOKEN_ALGORITHM = 'sha256';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 8;

const base64UrlEncode = (value) => {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const base64UrlDecode = (value) => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return Buffer.from(padded, 'base64').toString('utf8');
};

const getSessionSecret = () => {
    const secret = process.env.ACCESS_TOKEN_SECRET || process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error('ACCESS_TOKEN_SECRET or SESSION_SECRET must be configured');
    }

    return secret;
};

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');

    return `pbkdf2_${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
};

const verifyPassword = (password, storedHash) => {
    const [scheme, iterations, salt, expectedHash] = storedHash.split('$');

    if (scheme !== `pbkdf2_${HASH_ALGORITHM}` || !iterations || !salt || !expectedHash) {
        return false;
    }

    const actualHash = crypto
    .pbkdf2Sync(password, salt, Number(iterations), HASH_KEY_LENGTH, HASH_ALGORITHM)
    .toString('hex');

    return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
};

const signSessionToken = (user) => {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresIn = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || DEFAULT_TOKEN_TTL_SECONDS);
    const header = {alg: 'HS256', typ: 'JWT'};
    const payload = {
        sub: user._id.toString(),
        email: user.email,
        role: user.role,
        customerId: user.customerId ? user.customerId.toString() : null,
        iat: issuedAt,
        exp: issuedAt + expiresIn
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
    .createHmac(TOKEN_ALGORITHM, getSessionSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

    return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
};

const verifySessionToken = (token) => {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
        return null;
    }

    const expectedSignature = base64UrlEncode(
        crypto
        .createHmac(TOKEN_ALGORITHM, getSessionSecret())
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest()
    );

    const actualSignatureBuffer = Buffer.from(encodedSignature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
        actualSignatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(actualSignatureBuffer, expectedSignatureBuffer)
    ) {
        return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (!payload.exp || payload.exp < now) {
        return null;
    }

    return payload;
};

export {
    hashPassword,
    verifyPassword,
    signSessionToken,
    verifySessionToken
};
