'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
    Plus,
    Trash2,
    Save,
    ClipboardList,
    ChevronDown,
    ChevronUp,
    Eye,
    X,
    GripVertical,
    ShieldCheck,
} from 'lucide-react';

type QuestionType = 'mcq' | 'short_answer' | 'descriptive';
type GradingMode = 'exact' | 'contains' | 'manual';

interface AssessmentOption {
    key: string;
    text: string;
}

interface AssessmentQuestion {
    _id?: string;
    prompt: string;
    type: QuestionType;
    points: number;
    order: number;
    gradingMode: GradingMode;
    isEnabled: boolean;
    explanation: string;
    options: AssessmentOption[];
    correctOptionKey: string | null;
    acceptedAnswers: string[];
}

interface Assessment {
    _id?: string;
    title: string;
    instructions: string;
    questions: AssessmentQuestion[];
    passingRule: { type: 'correct_count' | 'percentage'; value: number };
    maxAttempts: number;
    retakeCooldownHours: number;
    timeLimitMinutes: number;
    shuffleQuestions: boolean;
    isEnabled: boolean;
    vivaRequired: boolean;
}

interface AttemptSummary {
    _id: string;
    attemptNumber: number;
    status: string;
    startedAt?: string;
    submittedAt?: string;
    correctCount?: number;
    totalQuestions?: number;
    score?: number;
    maxScore?: number;
    percentage?: number;
    passed?: boolean | null;
    user?: { displayName?: string; email?: string; phone?: string };
}

interface AttemptAnswer {
    questionId: string;
    questionType: string;
    answer: any;
    awardedPoints: number;
    isCorrect: boolean | null;
    gradingStatus: string;
    feedback?: string;
}

interface AttemptDetail extends AttemptSummary {
    answers?: AttemptAnswer[];
    assessment?: any;
}

interface AssessmentTabProps {
    courseId: string;
}

const emptyQuestion = (order: number): AssessmentQuestion => ({
    prompt: '',
    type: 'mcq',
    points: 1,
    order,
    gradingMode: 'exact',
    isEnabled: true,
    explanation: '',
    options: [
        { key: 'a', text: '' },
        { key: 'b', text: '' },
    ],
    correctOptionKey: 'a',
    acceptedAnswers: [],
});

const defaultAssessment = (): Assessment => ({
    title: 'Course Assessment',
    instructions: '',
    questions: [],
    passingRule: { type: 'correct_count', value: 5 },
    maxAttempts: 3,
    retakeCooldownHours: 0,
    timeLimitMinutes: 0,
    shuffleQuestions: false,
    isEnabled: false,
    vivaRequired: true,
});

const statusStyles: Record<string, string> = {
    in_progress: 'bg-amber-100 text-amber-700',
    pending_manual: 'bg-blue-100 text-blue-700',
    graded: 'bg-green-100 text-green-700',
    expired: 'bg-gray-100 text-gray-600',
};

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const formatAnswer = (answer: any) => {
    if (answer === null || answer === undefined || answer === '') return '—';
    if (typeof answer === 'string') return answer;
    return JSON.stringify(answer);
};

export default function AssessmentTab({ courseId }: AssessmentTabProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [assessment, setAssessment] = useState<Assessment>(defaultAssessment);
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

    const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
    const [attemptsLoading, setAttemptsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [selectedAttempt, setSelectedAttempt] = useState<AttemptDetail | null>(null);
    const [attemptLoading, setAttemptLoading] = useState(false);
    const [manualGrades, setManualGrades] = useState<Record<string, string>>({});
    const [grading, setGrading] = useState(false);

    const fetchAssessment = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/admin/courses/${courseId}/assessment`);
            const data = response.data?.assessment;
            if (data) {
                setAssessment({
                    ...defaultAssessment(),
                    ...data,
                    questions: (data.questions || []).map((question: any, index: number) => ({
                        ...emptyQuestion(index),
                        ...question,
                        points: Number(question.points ?? 1),
                        order: Number(question.order ?? index),
                        options: Array.isArray(question.options) && question.options.length
                            ? question.options
                            : [{ key: 'a', text: '' }, { key: 'b', text: '' }],
                        acceptedAnswers: question.acceptedAnswers || [],
                        correctOptionKey: question.correctOptionKey || null,
                    })),
                });
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load course assessment');
        } finally {
            setLoading(false);
        }
    }, [courseId]);

    const fetchAttempts = useCallback(async () => {
        try {
            setAttemptsLoading(true);
            const response = await apiClient.get(`/api/admin/courses/${courseId}/assessment/attempts`, {
                params: { page, limit: 20, status: statusFilter || undefined },
            });
            setAttempts(response.data?.attempts || []);
            setPagination({
                total: response.data?.pagination?.total || 0,
                pages: response.data?.pagination?.pages || 1,
            });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load assessment attempts');
        } finally {
            setAttemptsLoading(false);
        }
    }, [courseId, page, statusFilter]);

    useEffect(() => {
        fetchAssessment();
    }, [fetchAssessment]);

    useEffect(() => {
        fetchAttempts();
    }, [fetchAttempts]);

    const activeQuestions = useMemo(
        () => assessment.questions.filter((question) => question.isEnabled !== false).length,
        [assessment.questions]
    );

    const updateQuestion = (index: number, patch: Partial<AssessmentQuestion>) => {
        setAssessment((prev) => ({
            ...prev,
            questions: prev.questions.map((question, i) => (i === index ? { ...question, ...patch } : question)),
        }));
    };

    const addQuestion = () => {
        setAssessment((prev) => ({
            ...prev,
            questions: [...prev.questions, emptyQuestion(prev.questions.length)],
        }));
        setExpandedQuestion(assessment.questions.length);
    };

    const removeQuestion = (index: number) => {
        setAssessment((prev) => ({
            ...prev,
            questions: prev.questions
                .filter((_, i) => i !== index)
                .map((question, i) => ({ ...question, order: i })),
        }));
        setExpandedQuestion(null);
    };

    const moveQuestion = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= assessment.questions.length) return;
        setAssessment((prev) => {
            const questions = [...prev.questions];
            [questions[index], questions[target]] = [questions[target], questions[index]];
            return { ...prev, questions: questions.map((question, i) => ({ ...question, order: i })) };
        });
        setExpandedQuestion(target);
    };

    const handleSave = async () => {
        if (!assessment.questions.length) {
            toast.error('Add at least one question before saving');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...assessment,
                passingRule: {
                    type: assessment.passingRule.type,
                    value: Number(assessment.passingRule.value),
                },
                maxAttempts: Number(assessment.maxAttempts),
                retakeCooldownHours: Number(assessment.retakeCooldownHours),
                timeLimitMinutes: Number(assessment.timeLimitMinutes),
                questions: assessment.questions.map((question, index) => ({
                    ...(question._id ? { _id: question._id } : {}),
                    prompt: question.prompt,
                    type: question.type,
                    points: Number(question.points),
                    order: index,
                    gradingMode: question.gradingMode,
                    isEnabled: question.isEnabled !== false,
                    explanation: question.explanation,
                    options: question.type === 'mcq' ? question.options : [],
                    correctOptionKey: question.type === 'mcq' ? question.correctOptionKey : null,
                    acceptedAnswers: question.type === 'short_answer' ? question.acceptedAnswers : [],
                })),
            };
            await apiClient.put(`/api/admin/courses/${courseId}/assessment`, payload);
            toast.success('Course assessment saved');
            fetchAssessment();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save course assessment');
        } finally {
            setSaving(false);
        }
    };

    const openAttempt = async (attemptId: string) => {
        setAttemptLoading(true);
        setSelectedAttempt(null);
        try {
            const response = await apiClient.get(`/api/admin/assessment-attempts/${attemptId}`);
            const attempt = response.data?.attempt;
            setSelectedAttempt(attempt);
            const grades: Record<string, string> = {};
            (attempt?.answers || []).forEach((answer: AttemptAnswer) => {
                if (answer.gradingStatus === 'manual_pending') {
                    grades[String(answer.questionId)] = '';
                }
            });
            setManualGrades(grades);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load attempt');
        } finally {
            setAttemptLoading(false);
        }
    };

    const submitGrades = async () => {
        if (!selectedAttempt) return;
        const grades = Object.entries(manualGrades).map(([questionId, value]) => ({
            questionId,
            rawValue: value,
            awardedPoints: Number(value),
        }));
        if (grades.some((grade) => String(grade.rawValue ?? '').trim() === '' || !Number.isFinite(grade.awardedPoints) || grade.awardedPoints < 0)) {
            toast.error('Enter valid points for every pending answer');
            return;
        }
        setGrading(true);
        try {
            await apiClient.patch(`/api/admin/assessment-attempts/${selectedAttempt._id}/grade`, { grades });
            toast.success('Attempt graded');
            setSelectedAttempt(null);
            fetchAttempts();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to grade attempt');
        } finally {
            setGrading(false);
        }
    };

    const getQuestionForAnswer = (answer: AttemptAnswer) =>
        (selectedAttempt?.assessment?.questions || []).find(
            (question: any) => String(question._id) === String(answer.questionId)
        );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Certification Assessment</h3>
                    <p className="text-sm text-gray-500">
                        {activeQuestions} active question{activeQuestions === 1 ? '' : 's'} ·{' '}
                        Passing: {assessment.passingRule.type === 'percentage'
                            ? `${assessment.passingRule.value}%`
                            : `${assessment.passingRule.value} correct`}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Assessment'}
                </button>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Title</span>
                        <input
                            value={assessment.title}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, title: event.target.value }))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Instructions</span>
                        <input
                            value={assessment.instructions}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, instructions: event.target.value }))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                            placeholder="Shown to learners before they start"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Passing rule</span>
                        <div className="flex gap-2">
                            <select
                                value={assessment.passingRule.type}
                                onChange={(event) => setAssessment((prev) => ({
                                    ...prev,
                                    passingRule: {
                                        ...prev.passingRule,
                                        type: event.target.value as 'correct_count' | 'percentage',
                                    },
                                }))}
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                            >
                                <option value="correct_count">Correct answers</option>
                                <option value="percentage">Percentage</option>
                            </select>
                            <input
                                type="number"
                                min={0}
                                max={assessment.passingRule.type === 'percentage' ? 100 : undefined}
                                value={assessment.passingRule.value}
                                onChange={(event) => setAssessment((prev) => ({
                                    ...prev,
                                    passingRule: { ...prev.passingRule, value: Number(event.target.value) },
                                }))}
                                className="w-28 rounded-lg border px-3 py-2 text-sm"
                            />
                        </div>
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Max attempts</span>
                        <input
                            type="number"
                            min={1}
                            value={assessment.maxAttempts}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, maxAttempts: Number(event.target.value) }))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Retake cooldown (hours)</span>
                        <input
                            type="number"
                            min={0}
                            value={assessment.retakeCooldownHours}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, retakeCooldownHours: Number(event.target.value) }))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-medium text-gray-700">Time limit (minutes, 0 = none)</span>
                        <input
                            type="number"
                            min={0}
                            value={assessment.timeLimitMinutes}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, timeLimitMinutes: Number(event.target.value) }))}
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={assessment.isEnabled}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, isEnabled: event.target.checked }))}
                        />
                        Assessment enabled
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={assessment.vivaRequired}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, vivaRequired: event.target.checked }))}
                        />
                        Viva required for assessment certificate
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={assessment.shuffleQuestions}
                            onChange={(event) => setAssessment((prev) => ({ ...prev, shuffleQuestions: event.target.checked }))}
                        />
                        Shuffle questions
                    </label>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-900">Questions</h4>
                    <button
                        onClick={addQuestion}
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                        <Plus size={16} /> Add Question
                    </button>
                </div>

                {assessment.questions.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
                        <ClipboardList className="mx-auto mb-2 text-gray-400" size={40} />
                        <p className="text-gray-500">No questions yet. Add your first question to build the assessment.</p>
                    </div>
                ) : (
                    assessment.questions.map((question, index) => {
                        const isOpen = expandedQuestion === index;
                        return (
                            <div key={question._id || index} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                                <div className="flex flex-wrap items-center gap-3 p-4">
                                    <button
                                        onClick={() => setExpandedQuestion(isOpen ? null : index)}
                                        className="text-gray-400 hover:text-gray-700"
                                        aria-label="Toggle question"
                                    >
                                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                                Q{index + 1}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                question.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {question.isEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {question.type === 'mcq' ? 'MCQ' : question.type === 'short_answer' ? 'Short answer' : 'Descriptive'}
                                                {' · '}{question.points} pt{question.points === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">
                                            {question.prompt || 'Untitled question'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => moveQuestion(index, -1)}
                                            disabled={index === 0}
                                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                                            aria-label="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => moveQuestion(index, 1)}
                                            disabled={index === assessment.questions.length - 1}
                                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                                            aria-label="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => removeQuestion(index)}
                                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                            aria-label="Delete question"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="space-y-4 border-t bg-gray-50 p-4">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-medium text-gray-700">Question prompt</span>
                                            <textarea
                                                value={question.prompt}
                                                onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                                                rows={2}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                                placeholder="What should the learner answer?"
                                            />
                                        </label>

                                        <div className="grid gap-4 md:grid-cols-3">
                                            <label className="block">
                                                <span className="mb-1 block text-sm font-medium text-gray-700">Type</span>
                                                <select
                                                    value={question.type}
                                                    onChange={(event) => updateQuestion(index, {
                                                        type: event.target.value as QuestionType,
                                                        gradingMode: event.target.value === 'descriptive' ? 'manual' : question.gradingMode,
                                                    })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                >
                                                    <option value="mcq">Multiple choice</option>
                                                    <option value="short_answer">Short answer</option>
                                                    <option value="descriptive">Descriptive</option>
                                                </select>
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-sm font-medium text-gray-700">Points</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="0.5"
                                                    value={question.points}
                                                    onChange={(event) => updateQuestion(index, { points: Number(event.target.value) })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-sm font-medium text-gray-700">Grading</span>
                                                <select
                                                    value={question.gradingMode}
                                                    onChange={(event) => updateQuestion(index, { gradingMode: event.target.value as GradingMode })}
                                                    disabled={question.type === 'descriptive'}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                                                >
                                                    <option value="exact">Exact match</option>
                                                    <option value="contains">Contains answer</option>
                                                    <option value="manual">Manual grading</option>
                                                </select>
                                            </label>
                                        </div>

                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                            <input
                                                type="checkbox"
                                                checked={question.isEnabled}
                                                onChange={(event) => updateQuestion(index, { isEnabled: event.target.checked })}
                                            />
                                            Include this question in the assessment
                                        </label>

                                        {question.type === 'mcq' && (
                                            <div className="space-y-3">
                                                <span className="block text-sm font-medium text-gray-700">Options</span>
                                                {question.options.map((option, optionIndex) => (
                                                    <div key={optionIndex} className="flex items-center gap-2">
                                                        <input
                                                            type="radio"
                                                            name={`correct-${index}`}
                                                            checked={(question.correctOptionKey || '').toLowerCase() === option.key.toLowerCase()}
                                                            onChange={() => updateQuestion(index, { correctOptionKey: option.key })}
                                                            aria-label={`Mark option ${option.key} correct`}
                                                        />
                                                        <span className="w-6 text-xs font-semibold uppercase text-gray-500">{option.key}</span>
                                                        <input
                                                            value={option.text}
                                                            onChange={(event) => {
                                                                const options = question.options.map((item, i) =>
                                                                    i === optionIndex ? { ...item, text: event.target.value } : item
                                                                );
                                                                updateQuestion(index, { options });
                                                            }}
                                                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                                                            placeholder={`Option ${option.key}`}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (question.options.length <= 2) {
                                                                    toast.error('At least two options are required');
                                                                    return;
                                                                }
                                                                const options = question.options.filter((_, i) => i !== optionIndex);
                                                                updateQuestion(index, {
                                                                    options,
                                                                    correctOptionKey: options.some((item) => item.key === question.correctOptionKey)
                                                                        ? question.correctOptionKey
                                                                        : options[0]?.key || null,
                                                                });
                                                            }}
                                                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                            aria-label="Remove option"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => {
                                                        const key = String.fromCharCode(97 + question.options.length);
                                                        updateQuestion(index, { options: [...question.options, { key, text: '' }] });
                                                    }}
                                                    className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                                >
                                                    <Plus size={14} /> Add option
                                                </button>
                                            </div>
                                        )}

                                        {question.type === 'short_answer' && (
                                            <div className="space-y-2">
                                                <span className="block text-sm font-medium text-gray-700">
                                                    Accepted answers (comma separated)
                                                </span>
                                                <input
                                                    value={question.acceptedAnswers.join(', ')}
                                                    onChange={(event) => updateQuestion(index, {
                                                        acceptedAnswers: event.target.value
                                                            .split(',')
                                                            .map((value) => value.trim())
                                                            .filter(Boolean),
                                                    })}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                    placeholder="e.g. ahimsa, non-violence"
                                                />
                                            </div>
                                        )}

                                        <label className="block">
                                            <span className="mb-1 block text-sm font-medium text-gray-700">
                                                Explanation (optional, not shown before submission)
                                            </span>
                                            <textarea
                                                value={question.explanation}
                                                onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
                                                rows={2}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="rounded-xl border bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                    <div>
                        <h4 className="text-base font-semibold text-gray-900">Learner Attempts</h4>
                        <p className="text-sm text-gray-500">{pagination.total} attempt{pagination.total === 1 ? '' : 's'}</p>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border px-3 py-2 text-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="in_progress">In progress</option>
                        <option value="pending_manual">Pending manual</option>
                        <option value="graded">Graded</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>

                {attemptsLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                ) : attempts.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-500">No attempts submitted yet.</div>
                ) : (
                    <div className="divide-y">
                        {attempts.map((attempt) => (
                            <div key={attempt._id} className="flex flex-wrap items-center gap-3 p-4">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-gray-900">
                                            {attempt.user?.displayName || 'Learner'}
                                        </span>
                                        <span className="text-xs text-gray-500">Attempt #{attempt.attemptNumber}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            statusStyles[attempt.status] || 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {attempt.status.replace('_', ' ')}
                                        </span>
                                        {attempt.passed === true && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                <ShieldCheck size={12} /> Passed
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {attempt.user?.email || attempt.user?.phone || 'No contact'} ·{' '}
                                        {attempt.percentage ?? 0}% · {attempt.correctCount ?? 0}/{attempt.totalQuestions ?? 0} correct ·{' '}
                                        {formatDate(attempt.submittedAt)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => openAttempt(attempt._id)}
                                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    <Eye size={16} /> Review
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                        <button
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                            className="rounded border px-3 py-1.5 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-gray-500">Page {page} of {pagination.pages}</span>
                        <button
                            onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
                            disabled={page >= pagination.pages}
                            className="rounded border px-3 py-1.5 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {(selectedAttempt || attemptLoading) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Attempt Review</h3>
                            <button onClick={() => setSelectedAttempt(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>

                        {attemptLoading || !selectedAttempt ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-2 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-3">
                                    <div>
                                        <p className="text-gray-500">Learner</p>
                                        <p className="font-medium text-gray-900">{selectedAttempt.user?.displayName || 'Learner'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Score</p>
                                        <p className="font-medium text-gray-900">
                                            {selectedAttempt.score ?? 0}/{selectedAttempt.maxScore ?? 0} ({selectedAttempt.percentage ?? 0}%)
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Status</p>
                                        <p className="font-medium capitalize text-gray-900">{selectedAttempt.status.replace('_', ' ')}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {(selectedAttempt.answers || []).map((answer, index) => {
                                        const question = getQuestionForAnswer(answer);
                                        return (
                                            <div key={`${answer.questionId}-${index}`} className="rounded-lg border p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-gray-900">
                                                            Q{index + 1}. {question?.prompt || 'Question'}
                                                        </p>
                                                        <p className="mt-1 text-sm text-gray-700">
                                                            Answer: <span className="font-medium">{formatAnswer(answer.answer)}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                        answer.gradingStatus === 'manual_pending'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : answer.isCorrect
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {answer.awardedPoints ?? 0}/{question?.points ?? 0}
                                                    </span>
                                                </div>

                                                {answer.gradingStatus === 'manual_pending' && (
                                                    <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-blue-50 p-3">
                                                        <label className="block">
                                                            <span className="mb-1 block text-xs font-medium text-gray-700">
                                                                Awarded points
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={Number(question?.points || 0)}
                                                                step="0.5"
                                                                value={manualGrades[String(answer.questionId)] ?? ''}
                                                                onChange={(event) => setManualGrades((prev) => ({
                                                                    ...prev,
                                                                    [String(answer.questionId)]: event.target.value,
                                                                }))}
                                                                className="w-32 rounded-lg border px-3 py-2 text-sm"
                                                            />
                                                        </label>
                                                        <span className="pb-2 text-xs text-gray-500">
                                                            Max {question?.points ?? 0} points
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {selectedAttempt.status === 'pending_manual' && (
                                    <div className="flex justify-end gap-3 border-t pt-4">
                                        <button
                                            onClick={() => setSelectedAttempt(null)}
                                            className="rounded-lg border px-4 py-2 text-sm font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={submitGrades}
                                            disabled={grading}
                                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                                        >
                                            {grading ? 'Submitting...' : 'Submit Grades'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
