"use client";

import { useState, useEffect } from "react";
import { BookOpen, TrendingUp, Award, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

interface Enrollment {
  _id: string;
  courseId: {
    _id: string;
    title: string;
    thumbnail?: string;
    category?: string;
  };
  progress: number;
  enrolledAt: string;
  isCompleted: boolean;
  completedAt?: string;
  lastAccessedAt?: string;
  completedVideos: string[];
  completedPdfs: string[];
}

interface EnrollmentsTabProps {
  userId: string;
}

export default function EnrollmentsTab({ userId }: EnrollmentsTabProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEnrollments: 0,
    completed: 0,
    inProgress: 0,
    averageProgress: 0
  });

  useEffect(() => {
    fetchEnrollments();
  }, [userId]);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/user/${userId}/enrollments`);
      if (response.data.success) {
        const enrollmentsData = response.data.enrollments || [];
        setEnrollments(enrollmentsData);
        calculateStats(enrollmentsData);
      }
    } catch (error: any) {
      console.error("Error fetching enrollments:", error);
      toast.error(error.response?.data?.message || "Failed to fetch enrollments");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (enrollmentsData: Enrollment[]) => {
    const completed = enrollmentsData.filter(e => e.isCompleted).length;
    const inProgress = enrollmentsData.filter(e => !e.isCompleted && e.progress > 0).length;
    const averageProgress = enrollmentsData.length > 0
      ? Math.round(enrollmentsData.reduce((sum, e) => sum + e.progress, 0) / enrollmentsData.length)
      : 0;

    setStats({
      totalEnrollments: enrollmentsData.length,
      completed,
      inProgress,
      averageProgress
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total Enrollments</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalEnrollments}</p>
            </div>
            <BookOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-2xl font-bold text-green-900">{stats.completed}</p>
            </div>
            <Award className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">In Progress</p>
              <p className="text-2xl font-bold text-orange-900">{stats.inProgress}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600">Avg. Progress</p>
              <p className="text-2xl font-bold text-purple-900">{stats.averageProgress}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Enrollments List */}
      {enrollments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No enrollments yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            This user hasn&apos;t enrolled in any courses.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {enrollments.map((enrollment) => (
            <div
              key={enrollment._id}
              className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  {enrollment.courseId.thumbnail && (
                    <img
                      src={enrollment.courseId.thumbnail}
                      alt={enrollment.courseId.title}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {enrollment.courseId.title}
                        </h3>
                        {enrollment.courseId.category && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {enrollment.courseId.category}
                          </span>
                        )}
                      </div>
                      {enrollment.isCompleted && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          Completed
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Progress</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {enrollment.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            enrollment.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${enrollment.progress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Enrolled</p>
                        <p className="font-medium text-gray-900">
                          {new Date(enrollment.enrolledAt).toLocaleDateString()}
                        </p>
                      </div>
                      {enrollment.lastAccessedAt && (
                        <div>
                          <p className="text-gray-600">Last Accessed</p>
                          <p className="font-medium text-gray-900">
                            {new Date(enrollment.lastAccessedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {enrollment.completedAt && (
                        <div>
                          <p className="text-gray-600">Completed On</p>
                          <p className="font-medium text-gray-900">
                            {new Date(enrollment.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex gap-4 text-sm text-gray-600">
                      <span>Videos: {enrollment.completedVideos.length}</span>
                      <span>PDFs: {enrollment.completedPdfs.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
