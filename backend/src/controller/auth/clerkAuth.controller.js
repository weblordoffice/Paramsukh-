import { User } from '../../models/user.models.js';
import { generateTokens } from '../../lib/generateTokens.js';
import jwt from 'jsonwebtoken';
import { registerOrValidateDevice } from '../../lib/deviceSessionManager.js';

const CLERK_JWKS_URL = 'https://api.clerk.com/v1/jwks';

let cachedJwks = null;
let jwksLastFetched = 0;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getClerkJwks() {
    if (cachedJwks && Date.now() - jwksLastFetched < JWKS_CACHE_TTL) {
        return cachedJwks;
    }
    try {
        const { default: axios } = await import('axios');
        const response = await axios.get(CLERK_JWKS_URL, { timeout: 5000 });
        cachedJwks = response.data;
        jwksLastFetched = Date.now();
        return cachedJwks;
    } catch (error) {
        console.error('Failed to fetch Clerk JWKS:', error.message);
        return null;
    }
}

function pemToBytes(pem) {
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    return Buffer.from(b64, 'base64');
}

async function verifyClerkToken(clerkToken) {
    if (!clerkToken) return null;

    try {
        const jwks = await getClerkJwks();
        if (!jwks || !jwks.keys) {
            console.warn('Clerk JWKS unavailable, falling back to direct clerkId');
            return null;
        }

        const decodedHeader = JSON.parse(Buffer.from(clerkToken.split('.')[0], 'base64').toString('utf8'));

        const matchingKey = jwks.keys.find((k) => k.kid === decodedHeader.kid);
        if (!matchingKey) {
            console.warn('No matching Clerk JWK found for kid:', decodedHeader.kid);
            return null;
        }

        const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${matchingKey.n}\n-----END PUBLIC KEY-----`;

        const decoded = jwt.verify(clerkToken, publicKeyPem, {
            algorithms: [matchingKey.alg || 'RS256'],
            issuer: 'https://clerk.paramsukh.com', // will match any clerk issuer
            // Use dynamic issuer: Clerk tokens have iss like https://clerk.YOUR_DOMAIN
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

        let user = await User.findOne({ clerkId });

        if (!user && email) {
            user = await User.findOne({ email: email.toLowerCase().trim() });
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

            if (referralCode) {
                const referrer = await User.findOne({ referralCode: referralCode.trim() });
                if (referrer) {
                    user.referredBy = referrer._id;
                }
            }

            await user.save();
            console.log(`✨ Created new Clerk-authenticated user with Clerk ID ${clerkId}`);

            if (user.referredBy) {
                try {
                    const { Referral } = await import('../../models/referral.models.js');
                    await Referral.create({
                        referrer: user.referredBy,
                        referredUser: user._id,
                        status: 'joined'
                    });
                } catch (refError) {
                    console.error('❌ Failed to log referral connection:', refError);
                }
            }
        }

        user.loginCount = (user.loginCount || 0) + 1;
        user.lastLoginAt = new Date();
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

        const token = generateTokens(user._id, res);
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        try {
            const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
            await unlockBadgesForUser(user._id);
        } catch (badgeError) {
            console.error('❌ Failed to update achievements on login:', badgeError);
        }

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
                assessmentCompletedAt: user.assessmentCompletedAt || null
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
