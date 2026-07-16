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

export const DEFAULT_RECOMMENDATION_MAPPING = {
  physicalIssue: {
    category: 'physical',
    secondaryCategories: [],
    priorityTags: ['movement', 'body', 'exercise', 'yoga'],
    template: 'To support your physical health goals, this course introduces safe movement sequences and wellness routines tailored to help you feel active.'
  },
  specialDiseaseIssue: {
    category: 'physical',
    secondaryCategories: [],
    priorityTags: ['healing', 'therapy', 'restorative', 'gentle'],
    template: 'Specifically targeted for physical recovery and biological wellness, this program provides gentle therapy and restorative instructions.'
  },
  mentalHealthIssue: {
    category: 'mental',
    secondaryCategories: ['spiritual'],
    priorityTags: ['meditation', 'stress-relief', 'mindfulness', 'calm'],
    template: 'Designed to help ease mental strain, this mindfulness course teaches stress management tools perfect for a busy modern lifestyle.'
  },
  relationshipIssue: {
    category: 'relationship',
    secondaryCategories: ['mental'],
    priorityTags: ['communication', 'connection', 'empathy', 'love'],
    template: 'Providing guidance on personal growth, this program helps cultivate mindfulness and communication skills for stronger relationships.'
  },
  financialIssue: {
    category: 'financial',
    secondaryCategories: ['mental'],
    priorityTags: ['abundance', 'mindset', 'prosperity', 'goals'],
    template: 'A holistic wellness curriculum focusing on financial mindfulness, reducing anxiety around goals, and building abundance habits.'
  },
  spiritualGrowth: {
    category: 'spiritual',
    secondaryCategories: ['mental'],
    priorityTags: ['meditation', 'consciousness', 'yoga', 'wisdom'],
    template: 'To aid your spiritual path, this course guides you through core meditation and foundational yoga theory for deeper self-discovery.'
  }
};

/**
 * Retrieve the recommendation mappings configuration (Public/Private)
 * GET /api/config/recommendation-mappings
 */
export const getRecommendationMappings = async (req, res) => {
  try {
    const config = await AppConfig.findOne({ key: 'recommendation_mappings' });
    const mappings = config ? config.value : DEFAULT_RECOMMENDATION_MAPPING;

    return res.status(200).json({
      success: true,
      mappings,
    });
  } catch (error) {
    console.error('❌ Error retrieving recommendation mappings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve recommendation mappings',
      error: error.message,
    });
  }
};

/**
 * Update the recommendation mappings configuration (Admin only)
 * POST /api/config/recommendation-mappings
 */
export const setRecommendationMappings = async (req, res) => {
  try {
    const { mappings } = req.body;

    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'A valid mappings object is required',
      });
    }

    const updatedConfig = await AppConfig.findOneAndUpdate(
      { key: 'recommendation_mappings' },
      {
        key: 'recommendation_mappings',
        value: mappings,
        description: 'Mappings between wellness assessment issues and course categories/fallback explanation templates',
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Recommendation mappings updated successfully',
      data: updatedConfig,
    });
  } catch (error) {
    console.error('❌ Error updating recommendation mappings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update recommendation mappings',
      error: error.message,
    });
  }
};
