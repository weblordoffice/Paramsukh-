'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Activity,
    BookOpen,
    Calendar,
    CheckCircle2,
    Circle,
    Flag,
    Award,
    HeartPulse,
    MessageSquare,
    TrendingUp,
    Clock,
    AlertTriangle,
    Users,
    RefreshCw,
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';

type TabKey = 'overview' | 'learning' | 'wellness' | 'community' | 'achievements' | 'activity';
type RangeDays = 7 | 30 | 90 | 180 | 365;

interface Analytics {
    rangeDays: number;
    profile: {
        displayName?: string | null;
        email?: string | null;
        phone?: string | null;
        photoURL?: string | null;
        subscriptionPlan?: string | null;
        subscriptionStatus?: string | null;
        isActive?: boolean;
        memberSince?: string | null;
        lastLoginAt?: string | null;
        loginCount: number;
        completeness: { percent: number; missing: string[] };
    };
    overview: {
        currentStreak: number;
        activeDays: number;
        rangeDays: number;
        lastActivityAt?: string | null;
    };
    learning: {
        totalEnrollments: number;
        completedCourses: number;
        inProgressCourses: number;
        averageProgress: number;
        certificates: number;
    };
    events: { registrations: number; attended: number };
    goals: {
        total: number;
        active: number;
        completed: number;
        paused: number;
        averageProgress: number;
        activeGoals: Array<{
            _id: string;
            title: string;
            category: string;
            currentValue: number;
            targetValue: number;
            unit?: string;
            targetDate?: string | null;
            progressPercent: number;
        }>;
    };
    community: { points: number; posts: number; comments: number };
    wellness: null | {
        stressLevel: number;
        sleepQuality: number;
        energyLevel: number;
        moodRating: number;
        physicalActivityLevel?: string;
        wellnessScore: number;
        updatedAt?: string | null;
    };
    courses: Array<{
        courseId: string;
        title: string;
        category?: string | null;
        progress: number;
        isCompleted: boolean;
        enrolledAt?: string | null;
        completedAt?: string | null;
        lastAccessedAt?: string | null;
    }>;
    trend: Array<{
        date: string;
        learning: number;
        community: number;
        events: number;
        achievements: number;
        total: number;
    }>;
    risk: {
        riskStatus: 'active' | 'at_risk' | 'inactive';
        flags: string[];
        lastActivityAt?: string | null;
        inactiveDays?: number | null;
        stalledCourses: Array<{ courseId: string; title: string; progress: number; lastAccessedAt?: string | null }>;
        notStartedCourses: Array<{ courseId: string; title: string; enrolledAt?: string | null }>;
        overdueGoals: Array<{ _id: string; title: string; targetDate?: string | null; progressPercent: number }>;
    };
    achievements: Array<{
        id: string;
        title: string;
        description: string;
        requirement: string;
        icon: string;
        color: string;
        category: string;
        unlocked: boolean;
        unlockedAt?: string | null;
        progress: { current: number; target: number; percent: number; unit: string };
    }>;
    achievementStats: { unlocked: number; total: number } | null;
}

interface ActivityItem {
    type: string;
    title: string;
    description: string;
    date: string;
    metadata?: Record<string, any>;
}

const FLAG_LABELS: Record<string, string> = {
    account_inactive: 'Account disabled',
    inactive_30d: 'Inactive for 30+ days',
    inactive_14d: 'Inactive for 14+ days',
    stalled_courses: 'Stalled courses',
    not_started_courses: 'Enrolled but not started',
    overdue_goals: 'Overdue goals',
    no_goals: 'No wellness goals set',
    no_enrollments: 'No course enrollments',
};

const ACTIVITY_ICONS: Record<string, any> = {
    account_created: Users,
    login: Clock,
    course_enrolled: BookOpen,
    course_progress: TrendingUp,
    course_completed: CheckCircle2,
    event_registered: Calendar,
    event_attended: Calendar,
    certificate_issued: Award,
    goal_created: Flag,
    goal_progress: Flag,
    goal_completed: CheckCircle2,
    community_points: MessageSquare,
    community_post: MessageSquare,
    community_comment: MessageSquare,
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const riskStyle = (status?: string) => {
    if (status === 'inactive') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'at_risk') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-green-50 text-green-700 border-green-200';
};

const riskLabel = (status?: string) => {
    if (status === 'inactive') return 'Inactive';
    if (status === 'at_risk') return 'At risk';
    return 'Active';
};

export default function UserTrackingPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const userId = params?.id;
    const [range, setRange] = useState<RangeDays>(30);
    const [activityRange, setActivityRange] = useState<RangeDays>(90);
    const [tab, setTab] = useState<TabKey>('overview');
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadAnalytics = useCallback(async (isRefresh = false) => {
        if (!userId) return;
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const response = await apiClient.get(`/api/user/${userId}/analytics/admin`, {
                params: { range },
            });
            setAnalytics(response.data);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load user analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [range, userId]);

    const loadActivity = useCallback(async () => {
        if (!userId) return;
        setActivityLoading(true);
        try {
            const response = await apiClient.get(`/api/user/${userId}/activity`, {
                params: { range: activityRange },
            });
            setActivities(response.data.activities || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load activity timeline');
        } finally {
            setActivityLoading(false);
        }
    }, [activityRange, userId]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    useEffect(() => {
        loadActivity();
    }, [loadActivity]);

    const chartData = useMemo(() => {
        return (analytics?.trend || []).map((point) => ({
            ...point,
            label: point.date.slice(5),
        }));
    }, [analytics]);

    const tabs: Array<{ key: TabKey; label: string }> = [
        { key: 'overview', label: 'Overview' },
        { key: 'learning', label: 'Learning' },
        { key: 'wellness', label: 'Wellness & Goals' },
        { key: 'community', label: 'Community' },
        { key: 'achievements', label: 'Achievements' },
        { key: 'activity', label: 'Activity' },
    ];

    if (loading && !analytics) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                <AlertTriangle className="w-14 h-14 mx-auto mb-4 text-amber-500" />
                <p>Unable to load this user&apos;s tracking data.</p>
                <button
                    onClick={() => router.push('/dashboard/users')}
                    className="mt-4 px-4 py-2 bg-primary text-white rounded-lg font-medium"
                >
                    Back to Users
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <button
                        onClick={() => router.push('/dashboard/users')}
                        className="p-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        title="Back to users"
                    >
                        <ArrowLeft className="w-5 h-5 text-secondary" />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center text-lg font-bold text-primary">
                            {analytics.profile.photoURL ? (
                                <img src={analytics.profile.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (analytics.profile.displayName || 'U').charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-secondary">{analytics.profile.displayName || 'User'}</h1>
                            <p className="text-sm text-accent">
                                {analytics.profile.email || analytics.profile.phone || 'No contact info'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary uppercase">
                                    {analytics.profile.subscriptionPlan || 'free'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${analytics.profile.isActive === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                    {analytics.profile.isActive === false ? 'Inactive account' : 'Active account'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${riskStyle(analytics.risk.riskStatus)}`}>
                                    {riskLabel(analytics.risk.riskStatus)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={range}
                        onChange={(event) => setRange(Number(event.target.value) as RangeDays)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 180 days</option>
                        <option value={365}>Last 365 days</option>
                    </select>
                    <button
                        onClick={() => {
                            loadAnalytics(true);
                            loadActivity();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
                {tabs.map((item) => (
                    <button
                        key={item.key}
                        onClick={() => setTab(item.key)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === item.key ? 'bg-primary text-white' : 'text-accent hover:bg-gray-100'}`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Last activity</p>
                            <p className="text-lg font-bold text-secondary mt-1">{formatDateTime(analytics.risk.lastActivityAt)}</p>
                            <p className="text-xs text-accent mt-1">
                                {analytics.risk.inactiveDays != null ? `${analytics.risk.inactiveDays} days ago` : 'No activity'}
                            </p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Activity streak</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.overview.currentStreak} days</p>
                            <p className="text-xs text-accent mt-1">{analytics.overview.activeDays} active days in range</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Courses</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.learning.completedCourses}/{analytics.learning.totalEnrollments}</p>
                            <p className="text-xs text-accent mt-1">{analytics.learning.averageProgress}% average progress</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Profile completeness</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.profile.completeness.percent}%</p>
                            <p className="text-xs text-accent mt-1">{analytics.profile.completeness.missing.length} fields missing</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                        <div className="xl:col-span-2 bg-white rounded-xl p-5 shadow-md">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-secondary">Activity Trend</h2>
                                <span className="text-xs text-accent">Last {range} days</span>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="learning" stackId="activity" fill="#3B82F6" name="Learning" />
                                        <Bar dataKey="community" stackId="activity" fill="#EC4899" name="Community" />
                                        <Bar dataKey="events" stackId="activity" fill="#10B981" name="Events" />
                                        <Bar dataKey="achievements" stackId="activity" fill="#F59E0B" name="Milestones" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <h2 className="text-lg font-bold text-secondary mb-4">Risk Flags</h2>
                            {analytics.risk.flags.length === 0 ? (
                                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">No risk flags. User is engaged.</p>
                            ) : (
                                <div className="space-y-2">
                                    {analytics.risk.flags.map((flag) => (
                                        <div key={flag} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            {FLAG_LABELS[flag] || flag}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {analytics.risk.stalledCourses.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-xs font-bold text-accent uppercase mb-2">Stalled Courses</p>
                                    {analytics.risk.stalledCourses.slice(0, 5).map((course) => (
                                        <div key={course.courseId} className="text-sm text-secondary py-1">
                                            {course.title} · {course.progress}%
                                        </div>
                                    ))}
                                </div>
                            )}

                            {analytics.risk.overdueGoals.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-xs font-bold text-accent uppercase mb-2">Overdue Goals</p>
                                    {analytics.risk.overdueGoals.slice(0, 5).map((goal) => (
                                        <div key={goal._id} className="text-sm text-secondary py-1">
                                            {goal.title} · due {formatDate(goal.targetDate)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Events</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.events.registrations}</p>
                            <p className="text-xs text-accent mt-1">{analytics.events.attended} attended</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Wellness goals</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.goals.active} active</p>
                            <p className="text-xs text-accent mt-1">{analytics.goals.completed} completed</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Community points</p>
                            <p className="text-2xl font-bold text-secondary mt-1">{analytics.community.points}</p>
                            <p className="text-xs text-accent mt-1">{analytics.community.posts} posts · {analytics.community.comments} comments</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-md">
                            <p className="text-xs font-semibold text-accent uppercase">Badges</p>
                            <p className="text-2xl font-bold text-secondary mt-1">
                                {analytics.achievementStats?.unlocked || 0}/{analytics.achievementStats?.total || 0}
                            </p>
                            <p className="text-xs text-accent mt-1">{analytics.learning.certificates} certificates</p>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'learning' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Enrolled" value={analytics.learning.totalEnrollments} icon={BookOpen} />
                        <StatCard label="Completed" value={analytics.learning.completedCourses} icon={CheckCircle2} />
                        <StatCard label="In progress" value={analytics.learning.inProgressCourses} icon={Clock} />
                        <StatCard label="Certificates" value={analytics.learning.certificates} icon={Award} />
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-md">
                        <h2 className="text-lg font-bold text-secondary mb-4">Course Progress</h2>
                        {analytics.courses.length === 0 ? (
                            <p className="text-sm text-accent py-8 text-center">No course enrollments.</p>
                        ) : (
                            <div className="space-y-4">
                                {analytics.courses.map((course) => (
                                    <div key={course.courseId} className="border border-gray-100 rounded-lg p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-secondary">{course.title}</p>
                                                <p className="text-xs text-accent mt-1">
                                                    {course.category || 'General'} · Enrolled {formatDate(course.enrolledAt)}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${course.isCompleted ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                                {course.isCompleted ? 'Completed' : `${course.progress}%`}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
                                            <div
                                                className={`h-full rounded-full ${course.isCompleted ? 'bg-green-500' : 'bg-primary'}`}
                                                style={{ width: `${Math.min(100, course.progress)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-accent mt-2">
                                            Last activity: {formatDateTime(course.lastAccessedAt)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'wellness' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <div className="bg-white rounded-xl p-5 shadow-md">
                        <div className="flex items-center gap-2 mb-4">
                            <HeartPulse className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-secondary">Wellness Snapshot</h2>
                        </div>
                        {!analytics.wellness ? (
                            <p className="text-sm text-accent py-8 text-center">Assessment not completed.</p>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-xs font-semibold text-accent uppercase">Overall score</p>
                                        <p className="text-3xl font-extrabold text-primary">{analytics.wellness.wellnessScore}/100</p>
                                    </div>
                                    <p className="text-xs text-accent">Updated {formatDate(analytics.wellness.updatedAt)}</p>
                                </div>
                                {[
                                    { label: 'Stress', value: analytics.wellness.stressLevel, color: '#EF4444' },
                                    { label: 'Sleep', value: analytics.wellness.sleepQuality, color: '#6366F1' },
                                    { label: 'Energy', value: analytics.wellness.energyLevel, color: '#10B981' },
                                    { label: 'Mood', value: analytics.wellness.moodRating, color: '#F59E0B' },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-3 mb-3">
                                        <span className="w-16 text-xs font-semibold text-accent">{item.label}</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${item.value * 10}%`, backgroundColor: item.color }} />
                                        </div>
                                        <span className="w-8 text-right text-xs font-bold text-secondary">{item.value}/10</span>
                                    </div>
                                ))}
                                <p className="text-xs text-accent mt-3">
                                    Physical activity: {analytics.wellness.physicalActivityLevel || 'Not set'}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-md">
                        <div className="flex items-center gap-2 mb-4">
                            <Flag className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-secondary">Wellness Goals</h2>
                        </div>
                        <p className="text-sm text-accent mb-4">
                            {analytics.goals.active} active · {analytics.goals.completed} completed · {analytics.goals.paused} paused
                        </p>
                        {analytics.goals.activeGoals.length === 0 ? (
                            <p className="text-sm text-accent py-6 text-center">No active goals.</p>
                        ) : (
                            <div className="space-y-3">
                                {analytics.goals.activeGoals.map((goal) => (
                                    <div key={goal._id} className="border border-gray-100 rounded-lg p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-secondary">{goal.title}</p>
                                            <span className="text-xs font-bold text-primary">{goal.progressPercent}%</span>
                                        </div>
                                        <p className="text-xs text-accent mt-1">
                                            {goal.currentValue}/{goal.targetValue} {goal.unit || ''}
                                            {goal.targetDate ? ` · Due ${formatDate(goal.targetDate)}` : ''}
                                        </p>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                                            <div className="h-full bg-primary rounded-full" style={{ width: `${goal.progressPercent}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'community' && (
                <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Points" value={analytics.community.points} icon={TrendingUp} />
                        <StatCard label="Posts" value={analytics.community.posts} icon={MessageSquare} />
                        <StatCard label="Comments" value={analytics.community.comments} icon={MessageSquare} />
                    </div>
                    <div className="bg-white rounded-xl p-5 shadow-md">
                        <h2 className="text-lg font-bold text-secondary mb-3">Community Summary</h2>
                        <p className="text-sm text-accent">
                            This user has earned {analytics.community.points} community points from {analytics.community.posts} posts and {analytics.community.comments} comments.
                        </p>
                    </div>
                </div>
            )}

            {tab === 'achievements' && (
                <div className="space-y-5">
                    <div className="bg-white rounded-xl p-5 shadow-md">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-secondary">Achievements</h2>
                            <span className="text-sm font-semibold text-primary">
                                {analytics.achievementStats?.unlocked || 0}/{analytics.achievementStats?.total || 0} unlocked
                            </span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {analytics.achievements.map((badge) => (
                            <div
                                key={badge.id}
                                className={`bg-white rounded-xl p-5 shadow-md border ${badge.unlocked ? 'border-primary/30' : 'border-gray-100 opacity-70'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: `${badge.color}18` }}>
                                        <Award className="w-5 h-5" style={{ color: badge.color }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-secondary">{badge.title}</p>
                                        <p className="text-xs text-accent mt-1">{badge.description}</p>
                                    </div>
                                </div>
                                <div className="mt-4">
                                    <div className="flex items-center justify-between text-xs text-accent mb-1">
                                        <span>{badge.unlocked ? 'Unlocked' : badge.requirement}</span>
                                        <span>{badge.progress.current}/{badge.progress.target}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${badge.progress.percent}%`, backgroundColor: badge.color }} />
                                    </div>
                                    {badge.unlocked && (
                                        <p className="text-xs text-green-700 mt-2">Unlocked {formatDate(badge.unlockedAt)}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === 'activity' && (
                <div className="space-y-4">
                    <div className="bg-white rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-secondary">Activity Timeline</h2>
                            <p className="text-xs text-accent">Last {activityRange} days · {activities.length} events</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={activityRange}
                                onChange={(event) => setActivityRange(Number(event.target.value) as RangeDays)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value={30}>Last 30 days</option>
                                <option value={90}>Last 90 days</option>
                                <option value={365}>Last 365 days</option>
                            </select>
                            <button
                                onClick={loadActivity}
                                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                title="Refresh timeline"
                            >
                                <RefreshCw className={`w-4 h-4 text-accent ${activityLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-5 shadow-md">
                        {activityLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : activities.length === 0 ? (
                            <p className="text-sm text-accent py-10 text-center">No activity in this period.</p>
                        ) : (
                            <div className="space-y-0">
                                {activities.map((activity, index) => {
                                    const Icon = ACTIVITY_ICONS[activity.type] || Activity;
                                    return (
                                        <div key={`${activity.date}-${index}`} className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Icon className="w-4 h-4 text-primary" />
                                                </div>
                                                {index < activities.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
                                            </div>
                                            <div className="pb-5 min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-secondary">{activity.title}</p>
                                                    <p className="text-xs text-accent">{formatDateTime(activity.date)}</p>
                                                </div>
                                                <p className="text-sm text-accent mt-1">{activity.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
    return (
        <div className="bg-white rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold text-accent uppercase">{label}</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{value}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
            </div>
        </div>
    );
}
