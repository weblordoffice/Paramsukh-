'use client';
          
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import {                                                                                     
  Users, 
  TrendingUp,               
  TrendingDown, 
  BookOpen, 
  Calendar, 
  DollarSign, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  ArrowRight
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsData {
  users: {
    total: number;
    active: number;
    inactive: number;
    activePercentage: number;
  };
  courses: {
    totalEnrollments: number;
    completedEnrollments: number;
    dropOutRate: number;
  };
  revenue: {
    totalRevenue?: number;
    renewalRate: number;
    totalOrders: number;
  };
  events: {
    totalEvents: number;
    totalRegistrations: number;
    avgRegistrationsPerEvent: number;
  };  
  charts: {
    userGrowth: { _id: string; count: number }[];
    revenueTrend: { _id: string; total: number }[];
  }
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await apiClient.get('/api/admin/analytics/basic');
        if (response.data.success) {
          setData(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load analytics data.</div>;

  const cards = [
    {
      title: 'User Health',
      label: 'Active vs Inactive',
      value: `${data.users.activePercentage}%`,
      subValue: `${data.users.active} / ${data.users.total} active users`,
      icon: Users,
      color: 'blue',
      status: data.users.activePercentage > 50 ? 'up' : 'down',
      desc: 'Active users logged in within 30 days.',
      link: '/dashboard/users'
    },
    {
      title: 'Course Engagement',
      label: 'Drop-out Rate',
      value: `${data.courses.dropOutRate}%`,
      subValue: `${data.courses.completedEnrollments} completions`,
      icon: BookOpen,
      color: 'orange',
      status: data.courses.dropOutRate < 30 ? 'up' : 'down',
      desc: 'Percentage of users who started but haven\'t finished.',
      link: '/dashboard/courses'
    },
    {
      title: 'Revenue Loyalty',
      label: 'Renewal Rate',
      value: `${data.revenue.renewalRate}%`,
      subValue: data.revenue.totalRevenue !== undefined ? `₹${data.revenue.totalRevenue.toLocaleString('en-IN')} total revenue` : `${data.revenue.totalOrders} unique customers`,
      icon: DollarSign,
      color: 'green',
      status: data.revenue.renewalRate > 20 ? 'up' : 'down',
      desc: 'Overall financial performance & renewal analytics.',
      link: '/dashboard/revenue'
    },
    {
      title: 'Event Success',
      label: 'Avg Registrations',
      value: `${data.events.avgRegistrationsPerEvent}/event`,
      subValue: `${data.events.totalRegistrations} total signups`,
      icon: Calendar,
      color: 'purple',
      status: data.events.avgRegistrationsPerEvent > 5 ? 'up' : 'down',
      desc: 'Average registrations confirmed per event.',
      link: '/dashboard/events'
    }
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Platform Analytics</h1>
        <p className="text-gray-500">Real-time health indicators and performance metrics. Click any card to view detailed management pages.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div
            key={i}
            onClick={() => router.push(card.link)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${colorMap[card.color]} group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <div className={`flex items-center text-sm font-medium ${card.status === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {card.status === 'up' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
                  {card.status === 'up' ? 'Healthy' : 'Needs attention'}
                </div>
              </div>
              
              <h3 className="text-gray-500 text-sm font-medium mb-1">{card.title}</h3>
              <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-sm text-gray-600 mb-4 font-medium">{card.subValue}</div>
            </div>
            
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400 italic leading-relaxed">{card.desc}</p>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 ml-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder for future detailed charts */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                    <LineChartIcon className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-gray-800">User Growth Trend</h3>
                </div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Last 90 Days</span>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.userGrowth}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                            dataKey="_id" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#9CA3AF'}}
                            minTickGap={30}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#9CA3AF'}}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="count" 
                            name="New Users"
                            stroke="#3B82F6" 
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                    <BarChartIcon className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-gray-800">Revenue Performance</h3>
                </div>
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Last 90 Days</span>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.revenueTrend}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis 
                            dataKey="_id" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#9CA3AF'}}
                            minTickGap={30}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#9CA3AF'}}
                            tickFormatter={(value) => `₹${value}`}
                        />
                        <Tooltip 
                            formatter={(value: any) => [`₹${value}`, 'Revenue']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="total" 
                            name="Revenue" 
                            stroke="#10B981" 
                            fillOpacity={1} 
                            fill="url(#colorTotal)" 
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
}
