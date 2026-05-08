import jwt from 'jsonwebtoken';
import { User } from "../../models/user.models.js";
import { sendOTP, verifyOTP } from "../../services/otpService.js";
import { generateTokens } from "../../lib/generateTokens.js";
import { sendWelcomeEmail } from "../../services/emailService.js";

/**
 * Send OTP for signup or signin
 * POST /api/auth/send-otp
 * Body: { phone }
 */
export const sendOTPController = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^(\+91)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({
        success: false,
        message: "Valid Indian phone number required (10 digits starting with 6-9)"
      });
    }

    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const formattedPhone = `+91${cleanPhone}`;

    const existingUser = await User.findOne({ phone: formattedPhone });
    const isNewUser = !existingUser;

    const result = await sendOTP(cleanPhone);

    return res.json({
      success: true,
      message: result.message,
      isNewUser
    });
  } catch (error) {
    console.error("❌ Send OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate OTP"
    });
  }
};

/**
 * Verify OTP and authenticate
 * POST /api/auth/verify-otp
 * Body: { phone, otp, name?, email? }
 */
export const verifyOTPController = async (req, res) => {
  try {
    const { phone, otp, name, email } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP are required"
      });
    }

    const cleanPhone = phone.replace(/^\+91/, '').replace(/\D/g, '');
    const formattedPhone = `+91${cleanPhone}`;

    const verification = await verifyOTP(cleanPhone, otp);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    let user = await User.findOne({ phone: formattedPhone });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;

      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Name is required for new users (minimum 2 characters)"
        });
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Valid email is required for new users"
        });
      }

      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email already registered with another account"
        });
      }

      user = new User({
        phone: formattedPhone,
        displayName: name.trim(),
        email: email.toLowerCase().trim(),
        authProvider: 'phone',
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
        trialEndsAt: null,
        loginCount: 1,
        lastLoginAt: new Date()
      });

      await user.save();
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ New user created:", formattedPhone);
      }
    } else {
      await user.updateLastLogin();
      if (process.env.NODE_ENV === 'development') {
        console.log("✅ User signed in:", formattedPhone);
      }
    }

    const token = generateTokens(user._id, res);
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Send welcome email if new user
    if (isNewUser && user.email) {
      try {
        sendWelcomeEmail(user).catch(err => console.error('Failed to send welcome email:', err));
      } catch (e) {
        console.error('Email error:', e);
      }
    }

    return res.json({
      success: true,
      message: isNewUser ? "Account created successfully" : "Signed in successfully",
      isNewUser,
      token,
      refreshToken,
      user: {
        _id: user._id,
        phone: user.phone,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        authProvider: user.authProvider,
        assessmentCompleted: user.assessmentCompleted || false,
        assessmentCompletedAt: user.assessmentCompletedAt || null
      }
    });

  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify OTP"
    });
  }
};

