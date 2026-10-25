'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Eye, Video, FolderOpen, Users, Award, TrendingUp, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import CourseModal from '@/components/CourseModal';
import { useAuthStore } from '@/lib/store/authStore';

interface Course {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    bannerUrl: string;
    color: string;
    duration: string;
    category?: string;
    tags: string[];
    status: string;
    includedInPlans?: string[];
    videos?: any[];
    totalVideos?: number;
    totalPdfs?: number;
    enrollmentCount?: number;
    completionCount?: number;
    averageRating?: number;
    reviewCount?: number;
    createdAt: string;
}

interface MembershipPlan {
    _id: string;
    slug: string;
    name: string;
    color?: string;
}

interface EnrollmentStats {
    courseId: string;
    enrollmentCount: number;
    completedCount: number;
}

export default function CoursesPage() {
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [modalKey, setModalKey] = useState(0);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [planLookup, setPlanLookup] = useState<Record<string, { name: string; color: string }>>({});
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filterStatus, setFilterStatus] = useState('');
    const [error, setError] = useState<string | null>(null);
    const user = useAuthStore((state) => state.user);
    const hasPermission = useAuthStore((state) => state.hasPermission);

    useEffect(() => {
        if (user && !hasPermission('manage_courses')) {
            toast.error('You do not have permission to manage courses');
            router.replace('/dashboard');
        }
    }, [user, hasPermission, router]);

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchCourses();
    }, [page, filterStatus, searchTerm]);

    const fetchCourses = async () => {
        try {
            setError(null);
            const response = await apiClient.get('/api/courses/all', {
                params: {
                    page,
                    limit: 20,
                    ...(filterStatus ? { status: filterStatus } : {}),
                    ...(searchTerm ? { search: searchTerm } : {}),
                },
            });
            const coursesData = response.data.courses || [];
            setPages(response.data.pagination?.pages || 1);
            setTotal(response.data.pagination?.total ?? coursesData.length);
            setCourses(coursesData);
        } catch (error: any) {
            console.error('Error fetching courses:', error);
            setError(error.response?.data?.message || 'Failed to load courses');
            setCourses([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const response = await apiClient.get('/api/membership-plans');
            if (response.data?.data) {
                const plans: MembershipPlan[] = Array.isArray(response.data.data)
                    ? response.data.data
                    : response.data.data.plans || [];
                const lookup: Record<string, { name: string; color: string }> = {};
                plans.forEach((plan) => {
                    const slug = (plan.slug || '').trim().toLowerCase();
                    if (slug) {
                        lookup[slug] = { name: plan.name || slug, color: plan.color || '#64748B' };
                    }
                });
                setPlanLookup(lookup);
            }
        } catch {
            // non-critical
        }
    };

    const handleCreate = () => {
        setSelectedCourse(null);
        setModalKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const handleEdit = (course: Course) => {
        setSelectedCourse(course);
        setModalKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const handleDelete = async (courseId: string) => {
        if (!confirm('Delete this course? Courses with learner history must be archived instead.')) return;

        setDeleting(courseId);
        try {
            await apiClient.delete(`/api/courses/delete/${courseId}`);
            toast.success('Course deleted successfully!');
            fetchCourses();
        } catch (error: any) {
            if (error.response?.status === 409 && error.response?.data?.archiveRequired) {
                if (confirm('This course has learner history. Archive it instead?')) {
                    try {
                        await apiClient.put(`/api/courses/update/${courseId}`, { status: 'archived' });
                        toast.success('Course archived');
                        fetchCourses();
                        return;
                    } catch (archiveError: any) {
                        toast.error(archiveError.response?.data?.message || 'Failed to archive course');
                        return;
                    }
                }
            }
            toast.error(error.response?.data?.message || 'Failed to delete course');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const filteredCourses = courses;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Courses Management</h1>
                    <p className="text-gray-900 mt-1">Manage all courses and content</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Course</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl p-4 shadow-md flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-900" />
                    <input
                        type="text"
                        placeholder="Search courses by title or description..."
                        value={searchTerm}
                        onChange={(e) => { setPage(1); setSearchTerm(e.target.value); }}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 placeholder:text-gray-500"
                        aria-label="Search courses"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => { setPage(1); setFilterStatus(e.target.value); }}
                    className="px-4 py-3 border border-gray-300 rounded-lg text-gray-900"
                    aria-label="Filter by status"
                >
                    <option value="">All statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                </select>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-red-700 font-medium">{error}</p>
                    <button onClick={() => fetchCourses()} className="mt-3 px-4 py-2 rounded-lg bg-red-600 text-white">
                        Retry
                    </button>
                </div>
            ) : (
            <></>
            )}

            {/* Courses Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-900">
                        No courses found
                    </div>
                ) : (
                    filteredCourses.map((course) => (
                        <div
                            key={course._id}
                            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 card-hover"
                        >
                            {/* Course Image */}
                            <div className="relative h-48 bg-gray-200">
                                {course.thumbnailUrl ? (
                                    <Image
                                        src={course.thumbnailUrl}
                                        alt={course.title}
                                        fill
                                        unoptimized
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-primary to-primary-dark">
                                        <Video className="w-16 h-16 text-white opacity-50" />
                                    </div>
                                )}
                                {/* Status Badge */}
                                <div className="absolute top-3 right-3">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${course.status === 'published' ? 'bg-green-100 text-green-800' :
                                            course.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'
                                        }`}>
                                        {course.status}
                                    </span>
                                </div>
                            </div>

                            {/* Course Info */}
                            <div className="p-6 space-y-4">
                                <div>
                                    {course.category && (
                                        <span className="inline-block px-2.5 py-0.5 mb-2 bg-blue-50 text-blue-700 text-xs font-semibold uppercase tracking-wider rounded">
                                            {course.category}
                                        </span>
                                    )}
                                    {course.includedInPlans && course.includedInPlans.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                            <span className="text-xs text-gray-500 font-medium mr-0.5">Plans:</span>
                                            {course.includedInPlans.map((planSlug) => {
                                                const plan = planLookup[planSlug.toLowerCase()];
                                                return (
                                                    <span
                                                        key={planSlug}
                                                        className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full"
                                                        style={{
                                                            backgroundColor: plan ? `${plan.color}20` : '#F3F4F6',
                                                            color: plan?.color || '#6B7280',
                                                        }}
                                                    >
                                                        {plan?.name || planSlug}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {(!course.includedInPlans || course.includedInPlans.length === 0) && (
                                        <span className="inline-block px-2.5 py-0.5 mb-2 bg-green-50 text-green-700 text-xs font-semibold uppercase tracking-wider rounded">
                                            Free
                                        </span>
                                    )}
                                    <h3 className="text-xl font-bold text-secondary mb-2 line-clamp-1">
                                        {course.title}
                                    </h3>
                                    <p className="text-gray-900 text-sm line-clamp-2">
                                        {course.description}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex flex-wrap gap-2">
                                        {course.tags?.slice(0, 3).map((tag, index) => (
                                            <span key={index} className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-xs">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-medium text-secondary">
                                            {course.duration || '—'}
                                        </span>
                                        <span className="text-gray-900">
                                            {course.totalVideos || course.videos?.length || 0} videos
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-right">
                                        <div className="flex items-center gap-1">
                                            <Users className="w-4 h-4 text-green-600" />
                                            <span className="font-medium text-green-600">
                                                {course.enrollmentCount || 0}
                                            </span>
                                        </div>
                                        <span className="text-gray-900 text-xs">enrolled</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => router.push(`/dashboard/courses/${course._id}`)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                        title="Manage course content"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                        Manage
                                    </button>
                                    <button
                                        onClick={() => handleEdit(course)}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                        title="Edit course"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(course._id)}
                                        disabled={deleting === course._id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                        title="Delete course"
                                    >
                                        {deleting === course._id ? (
                                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{total} course(s)</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-700">Page {page} of {pages}</span>
                    <button
                        onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                        disabled={page >= pages}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {/* Course Modal */}
            <CourseModal
                key={modalKey}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                course={selectedCourse}
                onSuccess={fetchCourses}
            />
        </div>
    );
}
