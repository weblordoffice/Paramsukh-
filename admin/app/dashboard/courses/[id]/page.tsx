'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Video, FileText, Calendar, HelpCircle } from 'lucide-react';
import VideosTab from './VideosTab';
import PDFsTab from './PDFsTab';
import LiveSessionsTab from './LiveSessionsTab';
import AssignmentsTab from './AssignmentsTab';

interface Course {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    bannerUrl: string;
    color: string;
    icon: string;
    duration: number;
    tags: string[];
    status: string;
    videos?: any[];
    pdfs?: any[];
    liveSessions?: any[];
    assignments?: any[];
}

type TabType = 'videos' | 'pdfs' | 'sessions' | 'assignments';

export default function CourseDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = params.id as string;
    
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('videos');

    useEffect(() => {
        if (courseId) {
            fetchCourseDetails();
        }
    }, [courseId]);

    const fetchCourseDetails = async () => {
        try {
            const response = await apiClient.get(`/api/courses/${courseId}`);
            setCourse(response.data.course);
        } catch (error) {
            toast.error('Failed to fetch course details');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const refreshCourse = () => {
        fetchCourseDetails();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!course) {
        return (
            <div className="p-6">
                <div className="text-center">
                    <p className="text-gray-600">Course not found</p>
                    <button
                        onClick={() => router.push('/dashboard/courses')}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        Back to Courses
                    </button>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'videos' as TabType, label: 'Videos', icon: Video, count: course.videos?.length || 0 },
        { id: 'pdfs' as TabType, label: 'PDFs', icon: FileText, count: course.pdfs?.length || 0 },
        { id: 'sessions' as TabType, label: 'Live Sessions', icon: Calendar, count: course.liveSessions?.length || 0 },
        { id: 'assignments' as TabType, label: 'Assignments', icon: HelpCircle, count: course.assignments?.length || 0 },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.push('/dashboard/courses')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Courses
                </button>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        {course.thumbnailUrl && (
                            <img
                                src={course.thumbnailUrl}
                                alt={course.title}
                                className="w-24 h-24 rounded-lg object-cover"
                            />
                        )}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{course.title}</h1>
                            <p className="text-gray-600 mb-3">{course.description}</p>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                                    {course.status}
                                </span>
                                <span className="text-gray-500">
                                    {course.duration} mins
                                </span>
                                <span className="text-gray-500">
                                    {course.tags?.join(', ')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="border-b border-gray-200">
                    <div className="flex gap-8 px-6">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{tab.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        activeTab === tab.id
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'videos' && (
                        <VideosTab courseId={courseId} videos={course.videos || []} onUpdate={refreshCourse} />
                    )}
                    {activeTab === 'pdfs' && (
                        <PDFsTab courseId={courseId} pdfs={course.pdfs || []} onUpdate={refreshCourse} />
                    )}
                    {activeTab === 'sessions' && (
                        <LiveSessionsTab courseId={courseId} sessions={course.liveSessions || []} onUpdate={refreshCourse} />
                    )}
                    {activeTab === 'assignments' && (
                        <AssignmentsTab courseId={courseId} assignments={course.assignments || []} onUpdate={refreshCourse} />
                    )}
                </div>
            </div>
        </div>
    );
}
