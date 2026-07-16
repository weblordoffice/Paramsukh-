import Assessment from '../../models/assessment.models.js';
import { User } from '../../models/user.models.js';
import { Course } from '../../models/course.models.js';
import { AppConfig } from '../../models/appConfig.models.js';
import { generateRecommendationExplanation } from '../../services/chatProxy.service.js';

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
      age,
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
    if (!age || !occupation || !finalLocation) {
      return res.status(400).json({
        success: false,
        message: 'Age, occupation, and location are required'
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
      assessment.age = age;
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
      age,
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

// @desc    Get personalized recommendations
// @route   GET /api/assessment/recommendations
// @access  Private
export const getRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    const assessment = await Assessment.findOne({ user: userId });

    if (!assessment) {
      return res.status(200).json({
        success: true,
        recommendations: [],
        message: 'Assessment not completed yet.'
      });
    }

    const config = await AppConfig.findOne({ key: 'recommendation_mappings' });
    const mappings = config ? config.value : LOCAL_FALLBACK_MAPPING;

    const uniqueCategories = new Set();
    const priorityTagSet = new Set();
    const issues = [];
    const checkKeys = [
      'physicalIssue',
      'specialDiseaseIssue',
      'mentalHealthIssue',
      'relationshipIssue',
      'financialIssue',
      'spiritualGrowth'
    ];

    for (const key of checkKeys) {
      if (assessment[key] === true) {
        const map = mappings[key] || LOCAL_FALLBACK_MAPPING[key];
        if (map) {
          uniqueCategories.add(map.category);
          (map.secondaryCategories || []).forEach((c) => uniqueCategories.add(c));
          (map.priorityTags || []).forEach((t) => priorityTagSet.add(t.toLowerCase()));
          issues.push({
            key,
            category: map.category,
            details: assessment[key + 'Details'] || '',
            template: map.template,
            priorityTags: (map.priorityTags || []).map((t) => t.toLowerCase())
          });
        }
      }
    }

    // Contextual category boosting based on wellness scales
    const { stressLevel = 5, sleepQuality = 5, energyLevel = 5, moodRating = 5, physicalActivityLevel = 'moderate' } = assessment;

    if (stressLevel >= 7) {
      uniqueCategories.add('mental');
      uniqueCategories.add('spiritual');
    }
    if (sleepQuality <= 4) {
      uniqueCategories.add('spiritual');
      uniqueCategories.add('mental');
    }
    if (energyLevel <= 4) {
      uniqueCategories.add('physical');
    }
    if (moodRating <= 4) {
      uniqueCategories.add('mental');
      uniqueCategories.add('spiritual');
    }

    const categoryArray = [...uniqueCategories];
    let courses = [];

    if (categoryArray.length === 0) {
      courses = await Course.find({ category: 'general', status: 'published' }).lean();
    } else {
      courses = await Course.find({ category: { $in: categoryArray }, status: 'published' }).lean();
    }

    // Score and rank courses based on profile match
    const scoredCourses = courses.map((course) => {
      let score = 0;

      const courseTags = (course.tags || []).map((t) => t.toLowerCase());

      const primaryIssueForCategory = issues.find((i) => i.category === course.category);
      if (primaryIssueForCategory) {
        score += 10; // Direct category match

        // Tag matching
        const matchingTags = primaryIssueForCategory.priorityTags.filter((pt) =>
          courseTags.some((ct) => ct.includes(pt) || pt.includes(ct))
        );
        score += matchingTags.length * 4;
      } else if (categoryArray.includes(course.category)) {
        score += 6; // Secondary category match
      }

      // Contextual boosts
      if (stressLevel >= 7 && courseTags.some((t) => ['meditation', 'calm', 'relax', 'stress', 'mindfulness', 'breath'].some((k) => t.includes(k)))) {
        score += 5;
      }
      if (sleepQuality <= 4 && courseTags.some((t) => ['sleep', 'relax', 'calm', 'rest', 'yoga nidra'].some((k) => t.includes(k)))) {
        score += 5;
      }
      if (energyLevel <= 4 && courseTags.some((t) => ['energy', 'vitality', 'prana', 'breath'].some((k) => t.includes(k)))) {
        score += 4;
      }
      if (moodRating <= 4 && courseTags.some((t) => ['mood', 'joy', 'happiness', 'gratitude', 'positive'].some((k) => t.includes(k)))) {
        score += 4;
      }

      // Activity level matching
      const beginnerIndicators = ['beginner', 'gentle', 'intro', 'foundation', 'basic'];
      const advancedIndicators = ['advanced', 'intensive', 'challenging', 'power'];
      if (physicalActivityLevel === 'sedentary' || physicalActivityLevel === 'light') {
        if (courseTags.some((t) => beginnerIndicators.some((k) => t.includes(k)))) {
          score += 4;
        }
      } else if (physicalActivityLevel === 'active' || physicalActivityLevel === 'very_active') {
        if (courseTags.some((t) => advancedIndicators.some((k) => t.includes(k)))) {
          score += 3;
        }
      }

      // Age group awareness
      const age = assessment.age || 30;
      if (age > 50 && courseTags.some((t) => ['gentle', 'senior', 'restorative', 'chair'].some((k) => t.includes(k)))) {
        score += 3;
      }

      return { ...course, _score: score };
    });

    scoredCourses.sort((a, b) => b._score - a._score);

    const recommendations = [];
    for (const course of scoredCourses) {
      const relevantIssue = issues.find((i) => i.category === course.category) || issues[0];
      let explanation = '';

      if (relevantIssue) {
        try {
          const payload = {
            course_title: course.title,
            course_description: course.description || course.shortDescription || '',
            issue_type: relevantIssue.key,
            issue_details: relevantIssue.details || 'None provided',
            user_age: assessment.age,
            user_occupation: assessment.occupation,
            user_location: assessment.location || ''
          };
          const aiRes = await generateRecommendationExplanation(payload);
          if (aiRes && aiRes.explanation) {
            explanation = aiRes.explanation;
          }
        } catch (err) {
          console.warn(`AI explanation failed for course ${course.title}, using fallback template:`, err.message);
        }

        if (!explanation) {
          explanation = relevantIssue.template || 'This course matches your profile assessment goals.';
          explanation = explanation
            .replace(/\${occupation}/g, assessment.occupation || 'professional')
            .replace(/\${age}/g, String(assessment.age || 'adult'));
        }
      } else {
        explanation = 'This course aligns with wellness principles and holistic health.';
      }

      recommendations.push({
        ...course,
        whyThisFits: explanation
      });
    }

    return res.status(200).json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Get Recommendations Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recommendations',
      error: error.message
    });
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
