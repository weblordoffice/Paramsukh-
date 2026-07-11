import { AppConfig } from '../../models/appConfig.models.js';

// Default welcome video link (YouTube or direct mp4 fallback)
const DEFAULT_WELCOME_VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/**
 * Retrieve the welcome video URL (Public)
 * GET /api/config/welcome-video
 */
export const getWelcomeVideo = async (req, res) => {
  try {
    const config = await AppConfig.findOne({ key: 'welcome_video' });
    const url = config ? config.value : DEFAULT_WELCOME_VIDEO;

    return res.status(200).json({
      success: true,
      videoUrl: url,
    });
  } catch (error) {
    console.error('❌ Error retrieving welcome video URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve welcome video URL',
      error: error.message,
    });
  }
};

/**
 * Update the welcome video URL (Admin only)
 * POST /api/config/welcome-video
 */
export const setWelcomeVideo = async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A valid video URL is required',
      });
    }

    const updatedConfig = await AppConfig.findOneAndUpdate(
      { key: 'welcome_video' },
      {
        key: 'welcome_video',
        value: videoUrl.trim(),
        description: 'Dynamic welcome intro video URL used on the mobile app home screen hero widget',
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Welcome video URL updated successfully',
      data: updatedConfig,
    });
  } catch (error) {
    console.error('❌ Error setting welcome video URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update welcome video URL',
      error: error.message,
    });
  }
};
