import Assessment from '../../models/assessment.models.js';
import { User } from '../../models/user.models.js';
import { Course } from '../../models/course.models.js';
import { AppConfig } from '../../models/appConfig.models.js';
import { generateBatchRecommendationExplanations } from '../../services/chatProxy.service.js';
import { deriveCategoriesAndIssues, scoreCourse } from '../../services/recommendationScoring.service.js';
import { Enrollment } from '../../models/enrollment.models.js';
import { getUserEntitlementContext } from '../../services/entitlement.service.js';

const LOCAL_FALLBACK_MAPPING = {
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

// @desc    Submit or update user assessment
// @route   POST /api/assessment/submit
// @access  Private
export const submitAssessment = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      birthDate,
      occupation,
      countryCode,
      countryName,
      stateCode,
      stateName,
      location,
      stressLevel,
      sleepQuality,
      energyLevel,
      moodRating,
      physicalActivityLevel,
      physicalIssue,
      physicalIssueDetails,
      specialDiseaseIssue,
      specialDiseaseDetails,
      relationshipIssue,
      relationshipIssueDetails,
      financialIssue,
      financialIssueDetails,
      mentalHealthIssue,
      mentalHealthIssueDetails,
      spiritualGrowth,
      spiritualGrowthDetails
    } = req.body;

    const normalizedCountryCode = String(countryCode || '').trim().toUpperCase();
    const normalizedCountryName = String(countryName || '').trim();
    const normalizedStateCode = String(stateCode || '').trim().toUpperCase();
    const normalizedStateName = String(stateName || '').trim();
    const normalizedLocation = String(location || '').trim();
    const derivedLocation =
      normalizedStateName && normalizedCountryName
        ? `${normalizedStateName}, ${normalizedCountryName}`
        : '';
    const finalLocation = normalizedLocation || derivedLocation;

    // Validate required fields
    if (!birthDate || !occupation || !finalLocation) {
      return res.status(400).json({
        success: false,
        message: 'Birth date, occupation, and location are required'
      });
    }

    // Check required boolean fields
    if (
      physicalIssue === undefined ||
      specialDiseaseIssue === undefined ||
      relationshipIssue === undefined ||
      financialIssue === undefined ||
      mentalHealthIssue === undefined ||
      spiritualGrowth === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: 'All assessment questions must be answered'
      });
    }

    // Check if assessment already exists
    let assessment = await Assessment.findOne({ user: userId });

    if (assessment) {
      // Update existing assessment
      assessment.birthDate = birthDate;
      assessment.occupation = occupation;
      assessment.countryCode = normalizedCountryCode;
      assessment.countryName = normalizedCountryName;
      assessment.stateCode = normalizedStateCode;
      assessment.stateName = normalizedStateName;
      assessment.location = finalLocation;
      assessment.stressLevel = stressLevel || 5;
      assessment.sleepQuality = sleepQuality || 5;
      assessment.energyLevel = energyLevel || 5;
      assessment.moodRating = moodRating || 5;
      assessment.physicalActivityLevel = physicalActivityLevel || 'moderate';
      assessment.physicalIssue = physicalIssue;
      assessment.physicalIssueDetails = physicalIssueDetails || '';
      assessment.specialDiseaseIssue = specialDiseaseIssue;
      assessment.specialDiseaseDetails = specialDiseaseDetails || '';
      assessment.relationshipIssue = relationshipIssue;
      assessment.relationshipIssueDetails = relationshipIssueDetails || '';
      assessment.financialIssue = financialIssue;
      assessment.financialIssueDetails = financialIssueDetails || '';
      assessment.mentalHealthIssue = mentalHealthIssue;
      assessment.mentalHealthIssueDetails = mentalHealthIssueDetails || '';
      assessment.spiritualGrowth = spiritualGrowth;
      assessment.spiritualGrowthDetails = spiritualGrowthDetails || '';

      await assessment.save();

      return res.status(200).json({
        success: true,
        message: 'Assessment updated successfully',
        data: {
          assessment
        }
      });
    }

    // Create new assessment
    assessment = new Assessment({
      user: userId,
      birthDate,
      occupation,
      countryCode: normalizedCountryCode,
      countryName: normalizedCountryName,
      stateCode: normalizedStateCode,
      stateName: normalizedStateName,
      location: finalLocation,
      stressLevel: stressLevel || 5,
      sleepQuality: sleepQuality || 5,
      energyLevel: energyLevel || 5,
      moodRating: moodRating || 5,
      physicalActivityLevel: physicalActivityLevel || 'moderate',
      physicalIssue,
      physicalIssueDetails: physicalIssueDetails || '',
      specialDiseaseIssue,
      specialDiseaseDetails: specialDiseaseDetails || '',
      relationshipIssue,
      relationshipIssueDetails: relationshipIssueDetails || '',
      financialIssue,
      financialIssueDetails: financialIssueDetails || '',
      mentalHealthIssue,
      mentalHealthIssueDetails: mentalHealthIssueDetails || '',
      spiritualGrowth,
      spiritualGrowthDetails: spiritualGrowthDetails || ''
    });

    await assessment.save();

    // Update user's assessment completion status
    await User.findByIdAndUpdate(userId, {
      assessmentCompleted: true,
      assessmentCompletedAt: Date.now()
    });

    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully',
      data: {
        assessment
      }
    });
  } catch (error) {
    console.error('Submit Assessment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit assessment',
      error: error.message
    });
  }
};

// @desc    Get user's assessment
// @route   GET /api/assessment
// @access  Private
export const getAssessment = async (req, res) => {
  try {
    const userId = req.user._id;

    const assessment = await Assessment.findOne({ user: userId });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found. Please complete your assessment first.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        assessment
      }
    });
  } catch (error) {
    console.error('Get Assessment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
      error: error.message
    });
  }
};

// @desc    Get personalized recommendations (cached 30 min)
// @route   GET /api/assessment/recommendations
// @access  Private
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    const assessment = await Assessment.findOne({ user: userId });
    if (!assessment) {
      return res.status(200).json({ success: true, recommendations: [], message: 'Assessment not completed yet.' });
    }

    const THIRTY_MIN = 30 * 60 * 1000;
    if (req.user._cachedRecs && req.user._cachedRecsAt && (Date.now() - req.user._cachedRecsAt) < THIRTY_MIN) {
      return res.status(200).json({ success: true, recommendations: req.user._cachedRecs, cached: true });
    }

    const [config, enrolledCourses, userDoc] = await Promise.all([
      AppConfig.findOne({ key: 'recommendation_mappings' }),
      Enrollment.find({ userId }).select('courseId').lean(),
      User.findById(userId).select('tags').lean(),
    ]);
    const mappings = (config && config.value) ? config.value : LOCAL_FALLBACK_MAPPING;
    const enrolledCourseIds = new Set(enrolledCourses.map(e => String(e.courseId)));

    const { categories, issues } = deriveCategoriesAndIssues(assessment, mappings);
    if (categories.length === 0) categories.push('general');

    let courses = await Course.find({ category: { $in: categories }, status: 'published' }).lean();
    courses = courses.filter(c => !enrolledCourseIds.has(String(c._id)));

    const userTags = (userDoc && userDoc.tags) ? userDoc.tags.map(t => t.toLowerCase()) : [];
    const scored = courses.map(c => ({
      ...c, _score: scoreCourse(c, { categories, issues, assessment, userTags }),
    })).sort((a, b) => b._score - a._score);

    const top10 = scored.slice(0, 10);

    const batchPayload = {
      courses: top10.map(c => ({
        course_id: String(c._id),
        course_title: c.title,
        course_description: c.description || '',
        issue_type: (issues.find(i => i.category === c.category) || issues[0] || {}).key || 'general',
        issue_details: (issues.find(i => i.category === c.category) || {}).details || '',
      })),
      user_age: assessment.birthDate ? Math.floor((Date.now() - new Date(assessment.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 30,
      user_occupation: assessment.occupation || 'professional',
      user_location: assessment.location || '',
    };

    let explanations = {};
    try {
      const batchRes = await generateBatchRecommendationExplanations(batchPayload);
      explanations = batchRes.explanations || {};
    } catch (err) {
      console.warn('Batch AI explanations failed, using templates:', err.message);
    }

    const recommendations = top10.map(c => {
      const aiExplanation = explanations[String(c._id)];
      const relevantIssue = issues.find(i => i.category === c.category) || issues[0];
      let explanation = aiExplanation || '';
      if (!explanation && relevantIssue) {
        explanation = (relevantIssue.template || 'This course matches your profile assessment goals.')
          .replace(/\${occupation}/g, assessment.occupation || 'professional')
          .replace(/\${age}/g, String(assessment.birthDate ? Math.floor((Date.now() - new Date(assessment.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'adult'));
      }
      if (!explanation) explanation = 'This course aligns with your wellness profile.';

      const { _score, ...course } = c;
      return { ...course, whyThisFits: explanation, recommendationScore: _score };
    });

    try {
      await User.findByIdAndUpdate(userId, {
        _cachedRecs: recommendations,
        _cachedRecsAt: new Date(),
      });
    } catch (_) {}

    return res.status(200).json({ success: true, recommendations });
  } catch (error) {
    console.error('Get Recommendations Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve recommendations', error: error.message });
  }
};

// @desc    Delete user's assessment
// @route   DELETE /api/assessment
// @access  Private
export const deleteAssessment = async (req, res) => {
  try {
    const userId = req.user._id;

    const assessment = await Assessment.findOneAndDelete({ user: userId });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Update user's assessment status
    await User.findByIdAndUpdate(userId, {
      assessmentCompleted: false,
      assessmentCompletedAt: null
    });

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully'
    });
  } catch (error) {
    console.error('Delete Assessment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assessment',
      error: error.message
    });
  }
};

// @desc    Get assessment by user ID (Admin)
// @route   GET /api/assessment/admin/user/:userId
// @access  Private (Admin)
export const getAssessmentByUserIdAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    const assessment = await Assessment.findOne({ user: userId });

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found for this user'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        assessment
      }
    });
  } catch (error) {
    console.error('Get Admin Assessment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assessment',
      error: error.message
    });
  }
};

// @desc    Check if user has completed assessment
// @route   GET /api/assessment/status
// @access  Private
export const checkAssessmentStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const assessment = await Assessment.findOne({ user: userId });

    res.status(200).json({
      success: true,
      data: {
        completed: !!assessment,
        completedAt: assessment ? assessment.completedAt : null
      }
    });
  } catch (error) {
    console.error('Check Assessment Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check assessment status',
      error: error.message
    });
  }
};
