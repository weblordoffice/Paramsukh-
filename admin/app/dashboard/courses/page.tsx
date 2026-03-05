'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Eye, Video, FolderOpen, Users, Award, TrendingUp, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import CourseModal from '@/components/CourseModal';

interface Course {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    bannerUrl: string;
    color: string;
    icon: string;
    duration: number;
    category?: string;
    tags: string[];
    status: string;
    videos?: any[];
    totalVideos?: number;
    totalPdfs?: number;
    enrollmentCount?: number;
    completionCount?: number;
    averageRating?: number;
    reviewCount?: number;
    createdAt: string;
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
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const response = await apiClient.get('/api/courses/all');
            // Fetch enrollment stats to populate enrollment counts
            const statsResponse = await apiClient.get('/api/enrollments/stats/courses').catch(() => null);
            const coursesData = response.data.courses || [];
            
            // Merge enrollment stats into course data
            if (statsResponse?.data?.courses) {
                const enrollmentStatsMap = new Map<string, EnrollmentStats>(
                    statsResponse.data.courses.map((stat: EnrollmentStats) => [stat.courseId, stat])
                );
                const coursesWithStats = coursesData.map((course: Course) => {
                    const stats = enrollmentStatsMap.get(course._id);
                    return {
                        ...course,
                        enrollmentCount: stats?.enrollmentCount || 0,
                        completionCount: stats?.completedCount || 0
                    };
                });
                setCourses(coursesWithStats);
            } else {
                setCourses(coursesData);
            }
        } catch (error: any) {
            // Only show error for server errors, not for empty data
            if (error.response?.status !== 404) {
                console.error('Error fetching courses:', error);
                // Only show toast for actual server errors (500s)
                if (error.response?.status >= 500) {
                    toast.error('Server error. Please try again later.');
                }
            }
            setCourses([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedCourse(null);
        setIsModalOpen(true);
    };

    const handleEdit = (course: Course) => {
        setSelectedCourse(course);
        setIsModalOpen(true);
    };

    const handleDelete = async (courseId: string) => {
        if (!confirm('Are you sure you want to delete this course?')) return;

        setDeleting(courseId);
        try {
            await apiClient.delete(`/api/courses/delete/${courseId}`);
            toast.success('Course deleted successfully!');
            fetchCourses();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete course');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const filteredCourses = courses.filter(course =>
        course.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

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
            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-900" />
                    <input
                        type="text"
                        placeholder="Search courses by title or tags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 placeholder:text-gray-500"
                    />
                </div>
            </div>

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
                                            {course.duration} min
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

            {/* Course Modal */}
            <CourseModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                course={selectedCourse}
                onSuccess={fetchCourses}
            />
        </div>
    );
}
