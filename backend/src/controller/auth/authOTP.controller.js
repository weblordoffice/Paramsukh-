import jwt from 'jsonwebtoken';
import { User } from "../../models/user.models.js";
import { sendOTP, verifyOTP } from "../../services/otpService.js";
import { generateTokens } from "../../lib/generateTokens.js";
import { sendWelcomeEmail } from "../../services/emailService.js";
import { registerOrValidateDevice } from "../../lib/deviceSessionManager.js";

// Helper function to extract and verify the JWT token from headers
const getLoggedInUser = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id) {
        return await User.findById(decoded.id);
      }
    }
  } catch (err) {
    // Silent fail if token is invalid or expired
  }
  return null;
};

/**
 * Send OTP for signup or signin
 * POST /api/auth/send-otp
 * Body: { phone }
 */
export const sendOTPController = async (req, res) => {
  try {
    const { phone, purpose } = req.body;

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

    const loggedInUser = await getLoggedInUser(req);

    if (loggedInUser) {
      // Authenticated linking flow: user is trying to link a phone number
      if (loggedInUser.phone === formattedPhone) {
        return res.status(400).json({
          success: false,
          message: "This phone number is already linked to your account."
        });
      }
    } else {
      // Standard anonymous flow
      // For signin: user must already exist before we send an OTP
      if (purpose === 'signin' && isNewUser) {
        return res.status(404).json({
          success: false,
          isNewUser: true,
          message: "Account not found. Please sign up first."
        });
      }

      // For signup: user must NOT already exist
      if (purpose === 'signup' && !isNewUser) {
        return res.status(409).json({
          success: false,
          isNewUser: false,
          message: "Account already exists. Please sign in instead."
        });
      }
    }

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
    const { phone, otp, name, email, referralCode } = req.body;

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

    const loggedInUser = await getLoggedInUser(req);
    let user;
    let isNewUser = false;

    if (loggedInUser) {
      // Linking / Merging flow
      const existingPhoneUser = await User.findOne({ phone: formattedPhone });

      if (existingPhoneUser) {
        // MERGE: logged-in user is linking a phone that already belongs to another account.
        // Use a MongoDB session for atomicity to prevent race conditions.
        const session = await User.startSession();
        try {
          session.startTransaction();

          existingPhoneUser.clerkId = loggedInUser.clerkId || existingPhoneUser.clerkId;
          existingPhoneUser.authProvider = loggedInUser.authProvider || existingPhoneUser.authProvider;
          if (loggedInUser.email) {
            existingPhoneUser.email = loggedInUser.email.toLowerCase().trim();
          }
          if (loggedInUser.photoURL && !existingPhoneUser.photoURL) {
            existingPhoneUser.photoURL = loggedInUser.photoURL;
          }
          await existingPhoneUser.save({ session });

          // Delete the temporary Google/Clerk user to avoid duplicates
          await User.findByIdAndDelete(loggedInUser._id, { session });

          await session.commitTransaction();
          user = existingPhoneUser;
          console.log(`🔀 Merged temp user ${loggedInUser._id} into existing phone user ${user._id}`);
        } catch (mergeError) {
          await session.abortTransaction();
          throw mergeError;
        } finally {
          session.endSession();
        }
      } else {
        // LINK: No user exists with this phone number yet. Simply assign it to the logged in user.
        loggedInUser.phone = formattedPhone;
        await loggedInUser.save();
        
        user = loggedInUser;
        console.log(`🔗 Linked phone number ${formattedPhone} to Google user ${user._id}`);
      }
      
      await user.updateLastLogin();
    } else {
      // Standard anonymous OTP verification (signup/signin)
      user = await User.findOne({ phone: formattedPhone });
      
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

        const { generateUniqueReferralCode } = await import('../../lib/referralHelper.js');
        const refCode = await generateUniqueReferralCode();

        user = new User({
          phone: formattedPhone,
          displayName: name.trim(),
          email: email.toLowerCase().trim(),
          authProvider: 'phone',
          subscriptionPlan: 'free',
          subscriptionStatus: 'inactive',
          trialEndsAt: null,
          loginCount: 1,
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

        if (process.env.NODE_ENV === 'development') {
          console.log("✅ New user created:", formattedPhone);
        }
      } else {
        await user.updateLastLogin();
        if (process.env.NODE_ENV === 'development') {
          console.log("✅ User signed in:", formattedPhone);
        }
      }
    }

    const deviceGuard = await registerOrValidateDevice(user._id, req, 'phone');
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

    // Trigger badge unlocking evaluation on login (e.g. checks login count milestones)
    try {
      const { unlockBadgesForUser } = await import('../../services/badgeUnlockingService.js');
      await unlockBadgesForUser(user._id);
    } catch (badgeError) {
      console.error('❌ Failed to update achievements on login:', badgeError);
    }

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

