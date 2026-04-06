'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  TrendingUp,
  Award,
  Users,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface EnrollmentStats {
  totalEnrollments: number;
  completedEnrollments: number;
  inProgressEnrollments: number;
  notStarted: number;
  averageProgress: number;
  coursesWithEnrollments: number;
  usersWithEnrollments: number;
}

interface CourseEnrollment {
  courseId: string;
  title: string;
  thumbnailUrl?: string;
  category?: string;
  totalVideos: number;
  totalPdfs: number;
  enrollmentCount: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  averageProgress: number;
}

export default function EnrollmentsPage() {
  const [stats, setStats] = useState<EnrollmentStats | null>(null);
  const [courses, setCourses] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [statsRes, coursesRes] = await Promise.allSettled([
        apiClient.get('/api/enrollments/stats'),
        apiClient.get('/api/enrollments/stats/courses')
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data.stats);
      }
      if (coursesRes.status === 'fulfilled') {
        setCourses(coursesRes.value.data.courses || []);
      }
    } catch (error) {
      console.error('Error fetching enrollment stats:', error);
      toast.error('Failed to fetch enrollment statistics');
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(
    new Set(courses.map((c) => c.category).filter(Boolean))
  ) as string[];

  const filteredCourses = filterCategory === 'all'
    ? courses
    : courses.filter((c) => c.category === filterCategory);

  const getCompletionRate = (enrollmentCount: number, completedCount: number) => {
    if (enrollmentCount === 0) return 0;
    return Math.round((completedCount / enrollmentCount) * 100);
  };

  const statCards = [
    {
      title: 'Total Enrollments',
      value: stats?.totalEnrollments || 0,
      icon: BookOpen,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      description: 'All time enrollments'
    },
    {
      title: 'Completed Courses',
      value: stats?.completedEnrollments || 0,
      icon: Award,
      color: 'from-green-500 to-green-600',
      bg: 'bg-green-50',
      text: 'text-green-600',
      description: 'Courses fully completed'
    },
    {
      title: 'In Progress',
      value: stats?.inProgressEnrollments || 0,
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      description: 'Currently learning'
    },
    {
      title: 'Average Progress',
      value: `${stats?.averageProgress || 0}%`,
      icon: BarChart3,
      color: 'from-purple-500 to-purple-600',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      description: 'Across all enrollments'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enrollments Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Track course enrollments and completion rates
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-3 rounded-lg ${stat.bg} ${stat.text}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-gray-500 text-sm font-medium">{stat.title}</h3>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-2">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter by Category:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Courses
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilterCategory(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                  filterCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Course Enrollments Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Course Enrollments
          </h2>
          <p className="text-sm text-gray-500">
            Enrollment breakdown by course
          </p>
        </div>
        
        {filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No enrollments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or wait for users to enroll.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Course
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Enrolled
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    In Progress
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Not Started
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Completion Rate
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Avg Progress
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCourses.map((course) => (
                  <tr key={course.courseId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {course.thumbnailUrl && (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden">
                            <Image
                              src={course.thumbnailUrl}
                              alt={course.title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {course.title}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {course.category} • {course.totalVideos} videos
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {course.enrollmentCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {course.completedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {course.inProgressCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {course.notStartedCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getCompletionRate(course.enrollmentCount, course.completedCount) >= 50 ? (
                          <ArrowUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {getCompletionRate(course.enrollmentCount, course.completedCount)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${course.averageProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">
                        {course.averageProgress}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
