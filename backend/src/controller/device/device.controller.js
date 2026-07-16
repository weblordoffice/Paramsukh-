import { DeviceSession } from '../../models/deviceSession.models.js';
import { getDeviceDetails } from '../../lib/deviceHelper.js';

/**
 * Handle heartbeat to update lastSeen timestamp for current device session
 */
export const heartbeat = async (req, res) => {
  try {
    const { deviceId } = getDeviceDetails(req);
    const session = await DeviceSession.findOne({
      user: req.user._id,
      deviceId,
      isRevoked: false
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Active device session not found.'
      });
    }

    session.lastSeen = new Date();
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Heartbeat logged successfully.'
    });
  } catch (error) {
    console.error('❌ Heartbeat error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error logging heartbeat.',
      error: error.message
    });
  }
};

/**
 * Retrieves all active non-revoked device sessions for the authenticated user
 */
export const getActiveDevices = async (req, res) => {
  try {
    const { deviceId: currentDeviceId } = getDeviceDetails(req);
    const sessions = await DeviceSession.find({
      user: req.user._id,
      isRevoked: false
    }).sort({ lastSeen: -1 });

    const devices = sessions.map(s => ({
      deviceId: s.deviceId,
      deviceName: s.deviceName,
      browser: s.browser,
      os: s.os,
      authProvider: s.authProvider,
      lastSeen: s.lastSeen,
      createdAt: s.createdAt,
      isCurrentDevice: s.deviceId === currentDeviceId
    }));

    return res.status(200).json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('❌ Get active devices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching active devices.',
      error: error.message
    });
  }
};

/**
 * Revoke specific device session by deviceId parameter
 */
export const revokeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    const session = await DeviceSession.findOne({
      user: req.user._id,
      deviceId,
      isRevoked: false
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Device session not found or already revoked.'
      });
    }

    session.isRevoked = true;
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Device session successfully revoked.'
    });
  } catch (error) {
    console.error('❌ Revoke device error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error revoking device session.',
      error: error.message
    });
  }
};

/**
 * Terminate all other sessions except the current request session
 */
export const logoutOthers = async (req, res) => {
  try {
    const { deviceId: currentDeviceId } = getDeviceDetails(req);

    const result = await DeviceSession.updateMany(
      {
        user: req.user._id,
        deviceId: { $ne: currentDeviceId },
        isRevoked: false
      },
      {
        $set: { isRevoked: true }
      }
    );

    return res.status(200).json({
      success: true,
      message: `Successfully logged out other devices. Revoked ${result.modifiedCount} session(s).`
    });
  } catch (error) {
    console.error('❌ Logout other devices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error terminating other device sessions.',
      error: error.message
    });
  }
};
