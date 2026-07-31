import { User } from '../../models/user.models.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { reconcileUserSubscriptionPlanIntegrity } from '../../services/membershipPlan.service.js';
import { getDeviceDetails } from '../../lib/deviceHelper.js';
import { DeviceSession } from '../../models/deviceSession.models.js';
import { generateTokens } from '../../lib/generateTokens.js';

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh-token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const user = await User.findById(decoded.id).select('-__v');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    if (decoded.family !== undefined && (!user.tokenFamily || decoded.family !== user.tokenFamily)) {
      user.tokenFamily = null;
      user.tokenVersion += 1;
      await DeviceSession.updateMany(
        { user: user._id, isRevoked: false },
        { isRevoked: true }
      );
      await user.save();
      console.warn(`REPLAY DETECTED for user ${user._id} — all sessions revoked`);
      return res.status(401).json({
        success: false,
        code: 'TOKEN_REPLAY',
        message: 'Token replay detected. All sessions have been revoked.'
      });
    }

    const reconciliation = await reconcileUserSubscriptionPlanIntegrity(user, { save: true });
    if (reconciliation?.reconciled) {
      console.warn(`Reconciled orphan plan for user ${user._id}: ${reconciliation.previousPlan} -> free`);
    }

    const newFamily = crypto.randomUUID();
    user.tokenFamily = newFamily;
    user.tokenVersion += 1;
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLoginAt = new Date();
    await user.save();

    const { deviceId } = getDeviceDetails(req);
    const token = generateTokens(user._id, deviceId, user.tokenVersion, res);
    const newRefreshToken = jwt.sign(
      { id: user._id, family: newFamily },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`Token refreshed for user: ${user.displayName}`);

    return res.status(200).json({
      success: true,
      token,
      refreshToken: newRefreshToken,
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        photoURL: user.photoURL,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Logout user (invalidate refresh token if using database)
 * POST /api/auth/logout
 */
export const logout = async (req, res) => {
  try {
    if (req.deviceSession) {
      req.deviceSession.isRevoked = true;
      await req.deviceSession.save();
    }
    req.user.tokenFamily = null;
    req.user.tokenVersion += 1;
    await req.user.save();
    res.clearCookie('token');
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    return res.json({
      success: true,
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email || null,
        phone: user.phone || null,
        photoURL: user.photoURL,
        authProvider: user.authProvider,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount,
        assessmentCompleted: user.assessmentCompleted || false,
        assessmentCompletedAt: user.assessmentCompletedAt || null,
        onboardingCompleted: user.onboardingCompleted || false
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
