import mongoose from 'mongoose';

const coursePlanSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
        index: true
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MembershipPlan',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Ensure a course is not added twice to the same plan
coursePlanSchema.index({ courseId: 1, planId: 1 }, { unique: true });

export const CoursePlan = mongoose.model('CoursePlan', coursePlanSchema);
