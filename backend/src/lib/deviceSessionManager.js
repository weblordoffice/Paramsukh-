import { DeviceSession, DeviceRegistrationLog } from '../models/deviceSession.models.js';
import { getDeviceDetails } from './deviceHelper.js';

/**
 * Handles device session validation, limits, swap requests, and log registrations.
 * @returns {Promise<{success: boolean, deviceLimitExceeded?: boolean, cooldown?: boolean, cooldownRemaining?: number, activeDevices?: Array, session?: object, message?: string}>}
 */
export const registerOrValidateDevice = async (userId, req, authProvider, clerkSessionId = null) => {
  const { deviceId, deviceName, os, browser } = getDeviceDetails(req);

  // 1. Check if this device is already registered and active for the user
  let session = await DeviceSession.findOne({ user: userId, deviceId, isRevoked: false });

  if (session) {
    session.deviceName = deviceName;
    session.os = os;
    session.browser = browser;
    session.lastSeen = new Date();
    if (clerkSessionId) session.clerkSessionId = clerkSessionId;
    await session.save();
    return { success: true, session };
  }

  // 2. It is a new device. Check switch limits (max 3 registrations in rolling 24 hours)
  const window24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const registrationLogs = await DeviceRegistrationLog.find({
    user: userId,
    registeredAt: { $gte: window24h }
  }).sort({ registeredAt: 1 });

  if (registrationLogs.length >= 3) {
    const oldestLog = registrationLogs[0];
    const msElapsed = Date.now() - oldestLog.registeredAt.getTime();
    const cooldownRemainingMs = (24 * 60 * 60 * 1000) - msElapsed;
    const cooldownRemainingMinutes = Math.ceil(cooldownRemainingMs / (60 * 1000));

    return {
      success: false,
      cooldown: true,
      cooldownRemaining: cooldownRemainingMinutes,
      message: `New device registration limit exceeded (max 3 per 24 hours). Please wait ${cooldownRemainingMinutes} minute(s) before trying again.`
    };
  }

  // 3. Count currently active (non-revoked) sessions for the user
  const activeSessions = await DeviceSession.find({ user: userId, isRevoked: false });

  if (activeSessions.length >= 2) {
    // Check if the client requested to revoke a specific device to free up a slot
    const revokeDeviceId = req.headers['x-revoke-device-id'] || req.body?.revokeDeviceId;
    if (revokeDeviceId) {
      const revokedSession = await DeviceSession.findOne({
        user: userId,
        deviceId: revokeDeviceId,
        isRevoked: false
      });

      if (revokedSession) {
        revokedSession.isRevoked = true;
        await revokedSession.save();
        console.log(`🔒 Revoked device session ${revokeDeviceId} for user ${userId} to clear slot.`);
      } else {
        return {
          success: false,
          message: 'Target device to revoke was not found or is already inactive.'
        };
      }
    } else {
      // Return limit exceeded payload with the current active devices list
      return {
        success: false,
        deviceLimitExceeded: true,
        activeDevices: activeSessions.map(s => ({
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          os: s.os,
          browser: s.browser,
          lastSeen: s.lastSeen
        })),
        message: 'Active device limit exceeded (maximum 2 active devices allowed).'
      };
    }
  }

  // 4. Register the new device session and log the action
  const newSession = new DeviceSession({
    user: userId,
    deviceId,
    clerkSessionId,
    authProvider,
    deviceName,
    os,
    browser,
    lastSeen: new Date()
  });
  await newSession.save();

  const newLog = new DeviceRegistrationLog({
    user: userId,
    deviceId
  });
  await newLog.save();

  console.log(`📱 Registered new device session: ${deviceName} (${os}/${browser}) for user ${userId}`);

  return { success: true, session: newSession };
};
