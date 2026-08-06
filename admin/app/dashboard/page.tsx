'use client';

import { useEffect, useState } from 'react';
import {
    Users,
    BookOpen,
    Calendar,
    ShoppingCart,
    TrendingUp,
    Package,
    ArrowRight,
    Plus,
    Activity,
    Clock
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Stats {
    users: number;
    courses: number;
    events: number;
    products: number;
    orders: number;
    bookings: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<Stats>({
        users: 0,
        courses: 0,
        events: 0,
        products: 0,
        orders: 0,
        bookings: 0,
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        fetchStats();
        return () => clearInterval(timer);
    }, []);

    const fetchStats = async () => {
        try {
            const [usersRes, coursesRes, eventsRes, productsRes, ordersRes, bookingsRes] = await Promise.allSettled([
                apiClient.get('/api/user/all').catch(() => ({ data: { users: [] } })),
                apiClient.get('/api/courses/all').catch(() => ({ data: { courses: [] } })),
                apiClient.get('/api/events/all').catch(() => ({ data: { events: [] } })),
                apiClient.get('/api/products').catch(() => ({ data: { products: [] } })),
                apiClient.get('/api/orders/all').catch(() => ({ data: { data: { orders: [] } } })),
                apiClient.get('/api/counseling/all').catch(() => ({ data: { data: { bookings: [] } } })),
            ]);

            setStats({
                users: usersRes.status === 'fulfilled' ? (usersRes.value.data.users?.length || 0) : 0,
                courses: coursesRes.status === 'fulfilled' ? (coursesRes.value.data.courses?.length || 0) : 0,
                events: eventsRes.status === 'fulfilled' ? (eventsRes.value.data.events?.length || 0) : 0,
                products: productsRes.status === 'fulfilled' ? (productsRes.value.data.products?.length || 0) : 0,
                orders: ordersRes.status === 'fulfilled' ? (ordersRes.value.data.data?.orders?.length || 0) : 0,
                bookings: bookingsRes.status === 'fulfilled' ? (bookingsRes.value.data.data?.bookings?.length || 0) : 0,
            });
        } catch (error) {
            toast.error('Failed to fetch statistics');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const statCards = [
        {
            title: 'Total Users',
            count: stats.users,
            icon: Users,
            color: 'from-orange-500 to-orange-600',
            bg: 'bg-orange-50',
            text: 'text-orange-600'
        },
        {
            title: 'Active Courses',
            count: stats.courses,
            icon: BookOpen,
            color: 'from-blue-500 to-blue-600',
            bg: 'bg-blue-50',
            text: 'text-blue-600'
        },
        {
            title: 'Upcoming Events',
            count: stats.events,
            icon: Calendar,
            color: 'from-purple-500 to-purple-600',
            bg: 'bg-purple-50',
            text: 'text-purple-600'
        },
        {
            title: 'Total Orders',
            count: stats.orders,
            icon: Package,
            color: 'from-green-500 to-green-600',
            bg: 'bg-green-50',
            text: 'text-green-600'
        },
    ];

    const quickActions = [
        {
            title: 'Add New User',
            desc: 'Register a new member manually',
            icon: Users,
            path: '/dashboard/users',
            color: 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
        },
        {
            title: 'Create Course',
            desc: 'Launch a new learning module',
            icon: BookOpen,
            path: '/dashboard/courses',
            color: 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
        },
        {
            title: 'Schedule Event',
            desc: 'Host a webinar or workshop',
            icon: Calendar,
            path: '/dashboard/events',
            color: 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'
        },
        {
            title: 'Add Product',
            desc: 'Update your inventory',
            icon: ShoppingCart,
            path: '/dashboard/products',
            color: 'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white'
        },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-500 font-medium">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        {getGreeting()}, Admin 👋
                    </h1>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition shadow-sm">
                        <Activity className="w-5 h-5" />
                    </button>
                    <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium shadow-lg shadow-black/20 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        <span>New Report</span>
                    </button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, idx) => (
                    <div
                        key={idx}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group cursor-default"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg} ${stat.text} transition-colors`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-gray-500 text-sm font-medium">{stat.title}</h3>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.count}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Visual Overview / Hero Card */}
                <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/30 transition-all duration-700" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

                    <div className="relative z-10">
                        <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-medium border border-white/20">
                            System Status: Healthy
                        </span>
                        <h2 className="text-3xl font-bold mt-6 mb-4">
                            Your Platform is <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200">Growing Fast!</span>
                        </h2>
                        <p className="text-gray-300 max-w-md mb-8 leading-relaxed">
                            You have {stats.bookings} new bookings and {stats.orders} pending orders to review today. Keep up the great work!
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => router.push('/dashboard/bookings')}
                                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition shadow-lg shadow-orange-500/30 flex items-center gap-2"
                            >
                                View Bookings <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => router.push('/dashboard/users')}
                                className="px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 text-white rounded-xl font-medium transition"
                            >
                                Manage Users
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Actions Panel */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-orange-500" />
                        Quick Actions
                    </h3>
                    <div className="flex flex-col gap-4 flex-1">
                        {quickActions.map((action, idx) => (
                            <Link
                                key={idx}
                                href={action.path}
                                className="group p-4 rounded-2xl border border-gray-100 hover:border-orange-100 hover:shadow-md transition-all duration-200 flex items-start gap-4 bg-gray-50/50 hover:bg-white"
                            >
                                <div className={`p-3 rounded-xl ${action.color} transition-colors duration-200 shrink-0`}>
                                    <action.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-gray-900 font-semibold group-hover:text-orange-600 transition-colors">
                                        {action.title}
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                        {action.desc}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
