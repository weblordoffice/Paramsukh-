import Assessment from '../../models/assessment.models.js';
import { User } from '../../models/user.models.js';

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

// @desc    Get personalized recommendations (Deprecated)
// @route   GET /api/assessment/recommendations
// @access  Private
export const getRecommendations = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        recommendations: [],
        message: "Recommendations system has been disabled."
      }
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
