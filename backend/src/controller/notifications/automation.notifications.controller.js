import {
  sendDailyMotivationQuotes,
  MOTIVATION_QUOTE_COUNT,
} from '../../services/notificationAutomation.service.js';

/**
 * Admin: trigger the daily motivation quote immediately.
 * POST /api/notifications/automation/daily-quote
 */
export const triggerDailyMotivationQuotes = async (req, res) => {
  try {
    const result = await sendDailyMotivationQuotes();
    return res.status(200).json({
      success: true,
      message: result.sent > 0
        ? `Daily motivation sent to ${result.sent} users`
        : 'All users already received today\'s motivation',
      data: result,
    });
  } catch (error) {
    console.error('Trigger Daily Motivation Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send daily motivation quotes',
      error: error.message,
    });
  }
};

/**
 * Admin: automation status.
 * GET /api/notifications/automation/status
 */
export const getNotificationAutomationStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      dailyQuoteCron: process.env.DAILY_QUOTE_CRON || '0 8 * * *',
      dailyQuoteTimezone: process.env.DAILY_QUOTE_TIMEZONE || 'Asia/Kolkata',
      motivationQuoteCount: MOTIVATION_QUOTE_COUNT,
    },
  });
};
