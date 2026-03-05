import { User } from "../../models/user.models.js";

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = (req, res) => {
  try {
    res.clearCookie('token');
    return res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        displayName: user.displayName ?? '',
        email: user.email ?? null,
        phone: user.phone ?? null,
        photoURL: user.photoURL ?? null,
        authProvider: user.authProvider ?? 'phone',
        subscriptionPlan: user.subscriptionPlan ?? 'free',
        subscriptionStatus: user.subscriptionStatus ?? 'trial',
        trialEndsAt: user.trialEndsAt ?? null,
        lastLoginAt: user.lastLoginAt ?? null,
        loginCount: user.loginCount ?? 0,
        assessmentCompleted: user.assessmentCompleted ?? false
      }
    });
  } catch (error) {
    console.error('getCurrentUser error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const refreshToken = (req, res) => {
  res.json({ success: false, message: 'Not implemented' });
};
