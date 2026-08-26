import { User } from "../models/user.models.js";
import jwt from 'jsonwebtoken';
import { reconcileUserSubscriptionPlanIntegrity } from '../services/membershipPlan.service.js';
import { DeviceSession } from '../models/deviceSession.models.js';
import { getDeviceDetails } from '../lib/deviceHelper.js';


export const protectedRoutes = async(req, res, next) => {
    try {
        // Check for token in Authorization header (Bearer token) or cookies
        let token = '';
        
        // Check Authorization header first (for Postman/API clients)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7); // Remove 'Bearer ' prefix
        } else {
            // Fall back to cookie (for browser clients)
            token = req.cookies.token || '';
        }
        
        if(!token){
            return res.status(401).json({
                success: false,
                message: "No token provided. Please include token in Authorization header (Bearer token) or login to set cookie."
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if(!decoded || !decoded.id){
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        
        const user = await User.findById(decoded.id);
        if(!user){
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        if (decoded.v !== undefined && user.tokenVersion !== undefined && decoded.v < user.tokenVersion) {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_STALE',
                message: 'Session invalidated. Please log in again.'
            });
        }

        // If plan records were deleted manually, downgrade stale plan slugs to free.
        const reconciliation = await reconcileUserSubscriptionPlanIntegrity(user, { save: true });
        if (reconciliation?.reconciled) {
            console.warn(`Reconciled orphan plan for user ${user._id}: ${reconciliation.previousPlan} -> free`);
        }

        // Validate active device session
        let { deviceId } = getDeviceDetails(req);

        // If client didn't pass explicit x-device-id header (e.g. mobile EventSource SSE), fallback to decoded.deviceId
        if (!req.headers['x-device-id'] && decoded.deviceId) {
            deviceId = decoded.deviceId;
        }

        if (decoded.deviceId && deviceId && decoded.deviceId !== deviceId) {
            const matchingTokenSession = await DeviceSession.findOne({
                user: user._id,
                deviceId: decoded.deviceId,
                isRevoked: false
            });
            if (matchingTokenSession) {
                deviceId = decoded.deviceId;
            } else {
                return res.status(401).json({
                    success: false,
                    code: 'TOKEN_DEVICE_MISMATCH',
                    message: 'Token bound to a different device.'
                });
            }
        }

        let session = await DeviceSession.findOne({
            user: user._id,
            deviceId,
            isRevoked: false
        });

        if (!session && decoded.deviceId) {
            session = await DeviceSession.findOne({
                user: user._id,
                deviceId: decoded.deviceId,
                isRevoked: false
            });
        }

        if (!session) {
            session = await DeviceSession.findOne({
                user: user._id,
                isRevoked: false
            }).sort({ lastSeen: -1 });
        }

        if (!session) {
            return res.status(401).json({
                success: false,
                code: 'SESSION_REVOKED',
                message: 'Session has been revoked or is invalid. Please log in again.'
            });
        }

        // Update lastSeen with 1-minute write throttling to optimize DB load
        if (Date.now() - session.lastSeen.getTime() > 60 * 1000) {
            session.lastSeen = new Date();
            await session.save();
        }
        
        req.user = user;
        req.deviceSession = session;
        next();
    } catch(error) {
        console.error("❌ Error in protected route middleware:", error);
        
        // Handle JWT specific errors
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: "Invalid token"
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: "Token expired. Please login again."
            });
        }
        
        return res.status(401).json({
            success: false,
            message: "Unauthorized access",
            error: error.message
        });
    }
}
