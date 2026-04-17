import { User } from '../../models/user.models.js';
import jwt from 'jsonwebtoken';
import { reconcileUserSubscriptionPlanIntegrity } from '../../services/membershipPlan.service.js';

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

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Find user
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

    const reconciliation = await reconcileUserSubscriptionPlanIntegrity(user, { save: true });
    if (reconciliation?.reconciled) {
      console.warn(`⚠️ Reconciled orphan plan for user ${user._id}: ${reconciliation.previousPlan} -> free`);
    }

    // Update login count
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastLoginAt = new Date();
    await user.save();

    // Generate new access token
    const token = jwt.sign(
      { id: user._id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Optionally generate new refresh token
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`✅ Token refreshed for user: ${user.displayName}`);

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
    console.error('❌ Token refresh error:', error);
    
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
    // If using database-stored refresh tokens, invalidate them here
    // For now, just clear the cookie
    res.clearCookie('token');
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
