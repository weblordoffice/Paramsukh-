import { User } from '../../models/user.models.js';
import { generateTokens } from '../../lib/generateTokens.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { registerOrValidateDevice } from '../../lib/deviceSessionManager.js';
import { getDeviceDetails } from '../../lib/deviceHelper.js';
import { sendWelcomeEmail } from '../../services/emailService.js';

function getClerkJwksUrl() {
    if (process.env.CLERK_JWKS_URL) {
        return process.env.CLERK_JWKS_URL;
    }
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || '';
    if (publishableKey) {
        const parts = publishableKey.split('_');
        if (parts.length >= 3) {
            const encoded = parts.slice(2).join('_');
            try {
                const decoded = Buffer.from(encoded, 'base64').toString('utf8');
                const fapi = decoded.replace(/\$$/, '');
                if (fapi) {
                    return `https://${fapi}/.well-known/jwks.json`;
                }
            } catch (_) { /* fall through */ }
        }
    }
    return 'https://api.clerk.com/v1/jwks';
}

let cachedJwks = null;
let jwksLastFetched = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000;

async function getClerkJwks() {
    if (cachedJwks && Date.now() - jwksLastFetched < JWKS_CACHE_TTL) {
        return cachedJwks;
    }
    try {
        const jwksUrl = getClerkJwksUrl();
        const { default: axios } = await import('axios');
        const headers = {};
        if (process.env.CLERK_SECRET_KEY) {
            headers.Authorization = `Bearer ${process.env.CLERK_SECRET_KEY}`;
        }
        const response = await axios.get(jwksUrl, { timeout: 5000, headers });
        cachedJwks = response.data;
        jwksLastFetched = Date.now();
        console.log(` Clerk JWKS fetched successfully from ${jwksUrl}`);
        return cachedJwks;
    } catch (error) {
        console.error('Failed to fetch Clerk JWKS:', error.message);
        return null;
    }
}

function jwkToPem(jwk) {
    const keyObject = crypto.createPublicKey({
        key: {
            kty: jwk.kty || 'RSA',
            n: jwk.n,
            e: jwk.e,
        },
        format: 'jwk',
    });
    return keyObject.export({ type: 'spki', format: 'pem' });
}

async function verifyClerkToken(clerkToken) {
    if (!clerkToken) return null;

    try {
        const jwks = await getClerkJwks();
        if (!jwks || !jwks.keys) {
            console.warn('Clerk JWKS unavailable');
            return null;
        }

        const decodedHeader = JSON.parse(Buffer.from(clerkToken.split('.')[0], 'base64').toString('utf8'));

        const matchingKey = jwks.keys.find((k) => k.kid === decodedHeader.kid);
        if (!matchingKey) {
            console.warn('No matching Clerk JWK found for kid:', decodedHeader.kid);
            return null;
        }

        const publicKeyPem = jwkToPem(matchingKey);

        const decoded = jwt.verify(clerkToken, publicKeyPem, {
            algorithms: [matchingKey.alg || 'RS256'],
        });

        return decoded.sub || decoded.user_id || null;
    } catch (error) {
        console.error('Clerk token verification failed:', error.message);
        return null;
    }
}

/**
 * Sync Clerk user details with backend database.
 * Accepts either a Clerk-issued JWT in Authorization header (preferred),
 * or a clerkId in the body (fallback for backward compatibility).
 * POST /api/auth/clerk-sync
 */
export const clerkSyncController = async (req, res) => {
    try {
        let clerkId = null;
        let clerkSessionId = null;

        // Primary: Verify Clerk-issued JWT from Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const clerkToken = authHeader.substring(7);
            // Skip verification if it's our own backend JWT (contains 'id' claim pattern)
            try {
                const parts = clerkToken.split('.');
                if (parts.length === 3) {
                    const rawPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (rawPayload.id && !rawPayload.sid) {
                        // This is our own JWT, not a Clerk token. Don't try to verify as Clerk.
                    } else {
                        const verifiedClerkId = await verifyClerkToken(clerkToken);
                        if (verifiedClerkId) {
                            clerkId = verifiedClerkId;
                            clerkSessionId = rawPayload.sid || null;
                        }
                    }
                }
            } catch (_) { /* ignore parse errors */ }
        }

        // Must have a verified Clerk JWT — no fallback to unverified body clerkId
        if (!clerkId) {
            return res.status(401).json({
                success: false,
                message: 'Clerk authentication required. Provide a valid Clerk-issued JWT in the Authorization header.'
            });
        }

        const { email, displayName, photoURL, referralCode } = req.body || {};

        console.log('[clerkSync] START — clerkId:', clerkId, 'email:', email);

        let user = await User.findOne({ clerkId });
        console.log('[clerkSync] Branch 1 (findByClerkId):', user ? `FOUND user ${user._id} phone=${user.phone}` : 'NOT FOUND');

        if (!user && email) {
            user = await User.findOne({ email: email.toLowerCase().trim() });
            console.log('[clerkSync] Branch 2 (findByEmail):', user ? `FOUND user ${user._id} phone=${user.phone} — LINKING` : 'NOT FOUND');
            if (user) {
                user.clerkId = clerkId;
                user.authProvider = 'clerk';
                if (!user.displayName && displayName) user.displayName = displayName.trim();
                if (!user.photoURL && photoURL) user.photoURL = photoURL;
                await user.save();
                console.log(`🔗 Linked existing email account ${email} to Clerk ID ${clerkId}`);
            }
        }

        if (!user) {
            console.log('[clerkSync] Branch 3 (CREATE) — no existing user found, creating new one');
            const { generateUniqueReferralCode } = await import('../../lib/referralHelper.js');
            const refCode = await generateUniqueReferralCode();

            user = new User({
                clerkId,
                displayName: (displayName && displayName.trim()) || 'Gurukul Member',
                email: email ? email.toLowerCase().trim() : undefined,
                photoURL: photoURL || null,
                authProvider: 'clerk',
                subscriptionPlan: 'free',
                subscriptionStatus: 'inactive',
                loginCount: 0,
                lastLoginAt: new Date(),
                referralCode: refCode
            });

            let referralHandled = false;
            if (referralCode) {
                try {
                    const { validateReferral } = await import('../../services/referral.service.js');
                    const validation = await validateReferral({
                        referralCode,
                        newUserId: user._id,
                        ip: req.ip
                    });

                    if (!validation.valid) {
                        console.warn(`Referral validation failed for Clerk user ${user._id}: ${validation.reason}`);
                    } else {
                        user.referredBy = validation.referrer._id;
                        await user.save();
                        referralHandled = true;

                        try {
                            const { Referral } = await import('../../models/referral.models.js');
                            await Referral.create({
                                referrer: validation.referrer._id,
                                referredUser: user._id,
                                referralCode: referralCode,
                                metadata: { ip: req.ip, userAgent: req.headers['user-agent'] || '', channel: 'app' }
                            });

                            const { fireTrigger } = await import('../../services/referral.service.js');
                            fireTrigger('user.signup', { referrerId: validation.referrer._id, referredUserId: user._id });
                        } catch (refError) {
                            user.referredBy = null;
                            await user.save();
                            console.error('Failed to log referral connection, reverted:', refError.message);
                        }
                    }
                } catch (validationError) {
                    console.error('Referral validation error:', validationError.message);
                }
            }

            if (!referralHandled) {
                await user.save();
            }
            console.log(`Created new Clerk-authenticated user with Clerk ID ${clerkId}`);
            sendWelcomeEmail(user);
        }

        user.loginCount = (user.loginCount || 0) + 1;
        user.lastLoginAt = new Date();

        const tokenFamily = crypto.randomUUID();
        user.tokenFamily = tokenFamily;
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        await user.save();

        const deviceGuard = await registerOrValidateDevice(user._id, req, 'clerk', clerkSessionId);
        if (!deviceGuard.success) {
            return res.status(deviceGuard.cooldown ? 403 : (deviceGuard.deviceLimitExceeded ? 403 : 400)).json({
                success: false,
                deviceLimitExceeded: deviceGuard.deviceLimitExceeded || false,
                cooldown: deviceGuard.cooldown || false,
                cooldownRemaining: deviceGuard.cooldownRemaining || 0,
                activeDevices: deviceGuard.activeDevices || [],
                message: deviceGuard.message
            });
        }

        const { deviceId } = getDeviceDetails(req);
        const token = generateTokens(user._id, deviceId, user.tokenVersion, res);
        const refreshToken = jwt.sign(
            { id: user._id, family: tokenFamily },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(user._id);
        } catch (badgeError) {
            console.error('❌ Failed to update achievements on login:', badgeError);
        }

        console.log('[clerkSync] RESPONSE — user._id:', user._id, 'phone:', user.phone, 'email:', user.email, 'onboardingCompleted:', user.onboardingCompleted, 'needsPhoneVerification:', !user.phone);

        return res.status(200).json({
            success: true,
            message: 'User synced successfully',
            token,
            refreshToken,
            user: {
                _id: user._id,
                phone: user.phone || null,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                subscriptionPlan: user.subscriptionPlan,
                subscriptionStatus: user.subscriptionStatus,
                authProvider: user.authProvider,
                assessmentCompleted: user.assessmentCompleted || false,
                assessmentCompletedAt: user.assessmentCompletedAt || null,
                onboardingCompleted: user.onboardingCompleted || false
            },
            needsPhoneVerification: !user.phone
        });
    } catch (error) {
        console.error('❌ Clerk sync error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to sync Clerk user details',
            error: error.message
        });
    }
};
