'use client';

import { X, ClipboardList, MapPin, Briefcase, Calendar } from 'lucide-react';

interface AssessmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    assessment: any;
    userName: string;
}

export default function AssessmentModal({ isOpen, onClose, assessment, userName }: AssessmentModalProps) {
    if (!isOpen) return null;

    const sections = [
        {
            title: 'Physical Health',
            issueKey: 'physicalIssue',
            detailsKey: 'physicalIssueDetails',
            color: 'bg-red-50 text-red-700 border-red-200'
        },
        {
            title: 'Disease & Conditions',
            issueKey: 'specialDiseaseIssue',
            detailsKey: 'specialDiseaseDetails',
            color: 'bg-orange-50 text-orange-700 border-orange-200'
        },
        {
            title: 'Relationship Wellness',
            issueKey: 'relationshipIssue',
            detailsKey: 'relationshipIssueDetails',
            color: 'bg-pink-50 text-pink-700 border-pink-200'
        },
        {
            title: 'Financial Wellness',
            issueKey: 'financialIssue',
            detailsKey: 'financialIssueDetails',
            color: 'bg-green-50 text-green-700 border-green-200'
        },
        {
            title: 'Mental Health',
            issueKey: 'mentalHealthIssue',
            detailsKey: 'mentalHealthIssueDetails',
            color: 'bg-blue-50 text-blue-700 border-blue-200'
        },
        {
            title: 'Spiritual Growth',
            issueKey: 'spiritualGrowth',
            detailsKey: 'spiritualGrowthDetails',
            color: 'bg-purple-50 text-purple-700 border-purple-200'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">
                                Assessment Results
                            </h2>
                            <p className="text-sm text-gray-500">
                                for {userName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {!assessment ? (
                        <div className="text-center py-12 text-gray-500">
                            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>No assessment data available for this user.</p>
                        </div>
                    ) : (
                        <>
                            {/* Personal Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Age</p>
                                        <p className="font-semibold text-gray-900">{assessment.age} years</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-green-600">
                                        <Briefcase className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Occupation</p>
                                        <p className="font-semibold text-gray-900 line-clamp-1" title={assessment.occupation}>{assessment.occupation}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm text-red-600">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Location</p>
                                        <p className="font-semibold text-gray-900 line-clamp-1" title={assessment.location}>{assessment.location}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 gap-4">
                                {sections.map((section) => {
                                    const hasIssue = assessment[section.issueKey];
                                    const details = assessment[section.detailsKey];

                                    return (
                                        <div key={section.title} className={`p-4 rounded-xl border ${hasIssue ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold text-gray-800">{section.title}</h3>
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${hasIssue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {hasIssue ? 'Issue Reported' : 'No Issue'}
                                                </span>
                                            </div>
                                            {details ? (
                                                <p className="text-sm text-gray-700 bg-white/50 p-3 rounded-lg border border-gray-200/50">
                                                    &ldquo;{details}&rdquo;
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-500 italic">No additional details provided.</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition shadow-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
