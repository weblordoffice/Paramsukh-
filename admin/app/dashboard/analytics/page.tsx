'use client';
           
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import {                                                                                     
  Users, 
  BookOpen, 
  Calendar,
  DollarSign,
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight,
  ArrowDownRight,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  BookMarked,
  BookOpenCheck,
  Ticket,
  IndianRupee,
  RefreshCcw,
  ShoppingCart,
  ChevronRight
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

type CardType = 'users' | 'courses' | 'revenue' | 'events';

interface DetailStat {
  label: string;
  value: string;
  icon: typeof Users;
  color: string;
  sublabel?: string;
}

interface DetailStatGroup {
  title: string;
  icon: typeof Users;
  color: string;
  stats: DetailStat[];
}

interface DetailModalProps {
  card: CardType | null;
  data: AnalyticsData;
  onClose: () => void;
}

function DetailModal({ card, data, onClose }: DetailModalProps) {
  if (!card) return null;

  const content: Record<CardType, DetailStatGroup> = {
    users: {
      title: 'User Health Details',
      icon: Users,
      color: 'blue',
      stats: [
        { label: 'Total Users', value: data.users.total.toLocaleString('en-IN'), icon: Users, color: '#3B82F6' },
        { label: 'Active Users', value: data.users.active.toLocaleString('en-IN'), icon: UserCheck, color: '#10B981', sublabel: 'Last 30 days' },
        { label: 'Inactive Users', value: data.users.inactive.toLocaleString('en-IN'), icon: UserX, color: '#EF4444', sublabel: '30+ days inactive' },
        { label: 'Active Rate', value: `${data.users.activePercentage}%`, icon: TrendingUp, color: data.users.activePercentage > 50 ? '#10B981' : '#EF4444' },
      ]
    },
    courses: {
      title: 'Course Engagement Details',
      icon: BookOpen,
      color: 'orange',
      stats: [
        { label: 'Total Enrollments', value: data.courses.totalEnrollments.toLocaleString('en-IN'), icon: BookMarked, color: '#F1842D' },
        { label: 'Completed', value: data.courses.completedEnrollments.toLocaleString('en-IN'), icon: BookOpenCheck, color: '#10B981' },
        { label: 'In Progress', value: (data.courses.totalEnrollments - data.courses.completedEnrollments).toLocaleString('en-IN'), icon: Clock, color: '#F59E0B' },
        { label: 'Drop-out Rate', value: `${data.courses.dropOutRate}%`, icon: AlertCircle, color: data.courses.dropOutRate < 30 ? '#10B981' : '#EF4444' },
      ]
    },
    revenue: {
      title: 'Revenue & Loyalty Details',
      icon: DollarSign,
      color: 'green',
      stats: [
        { label: 'Total Revenue', value: data.revenue.totalRevenue !== undefined ? `₹${data.revenue.totalRevenue.toLocaleString('en-IN')}` : 'N/A', icon: IndianRupee, color: '#10B981' },
        { label: 'Renewal Rate', value: `${data.revenue.renewalRate}%`, icon: RefreshCcw, color: data.revenue.renewalRate > 20 ? '#10B981' : '#EF4444' },
        { label: 'Total Orders', value: data.revenue.totalOrders.toLocaleString('en-IN'), icon: ShoppingCart, color: '#3B82F6' },
        { label: 'Avg Order Value', value: data.revenue.totalOrders > 0 && data.revenue.totalRevenue !== undefined ? `₹${Math.round(data.revenue.totalRevenue / data.revenue.totalOrders).toLocaleString('en-IN')}` : 'N/A', icon: DollarSign, color: '#8B5CF6' },
      ]
    },
    events: {
      title: 'Event Success Details',
      icon: Calendar,
      color: 'purple',
      stats: [
        { label: 'Total Events', value: data.events.totalEvents.toLocaleString('en-IN'), icon: Calendar, color: '#8B5CF6' },
        { label: 'Total Registrations', value: data.events.totalRegistrations.toLocaleString('en-IN'), icon: Ticket, color: '#3B82F6' },
        { label: 'Avg per Event', value: data.events.avgRegistrationsPerEvent.toLocaleString('en-IN'), icon: TrendingUp, color: '#10B981' },
        { label: 'Fill Rate', value: data.events.totalEvents > 0 ? `${Math.round((data.events.totalRegistrations / (data.events.totalEvents * 50)) * 100)}%` : 'N/A', icon: CheckCircle2, color: '#10B981' },
      ]
    }
  };

  const info = content[card];
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
        <div className={`flex items-center justify-between p-6 border-b border-gray-100`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${colorMap[info.color]}`}>
              <info.icon className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{info.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
          <div className="grid grid-cols-2 gap-4">
            {info.stats.map((stat, i) => (
              <div 
                key={i}
                className="bg-gray-50 rounded-xl p-4 border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                {stat.sublabel && (
                  <div className="text-xs text-gray-400 mt-1">{stat.sublabel}</div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Quick Tip</h4>
            <p className="text-sm text-gray-500 leading-relaxed">
              {card === 'users' && 'Encourage inactive users to return with targeted email campaigns and push notifications highlighting new content.'}
              {card === 'courses' && 'Identify courses with high drop-out rates and add engagement checkpoints, quizzes, or certificates to boost completion.'}
              {card === 'revenue' && 'Focus on retaining existing customers. A 5% increase in retention can increase profitability by 25-95%.'}
              {card === 'events' && 'Events with low registration can be promoted via community posts and targeted emails to users interested in that category.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

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
      type: 'users' as CardType,
      title: 'User Health',
      label: 'Active vs Inactive',
      value: `${data.users.activePercentage}%`,
      subValue: `${data.users.active.toLocaleString('en-IN')} / ${data.users.total.toLocaleString('en-IN')} active users`,
      icon: Users,
      color: 'blue',
      status: data.users.activePercentage > 50 ? 'up' : 'down',
      desc: 'Active users logged in within 30 days.',
      link: '/dashboard/users'
    },
    {
      type: 'courses' as CardType,
      title: 'Course Engagement',
      label: 'Drop-out Rate',
      value: `${data.courses.dropOutRate}%`,
      subValue: `${data.courses.completedEnrollments.toLocaleString('en-IN')} completions`,
      icon: BookOpen,
      color: 'orange',
      status: data.courses.dropOutRate < 30 ? 'up' : 'down',
      desc: 'Percentage of users who started but haven\'t finished.',
      link: '/dashboard/courses'
    },
    {
      type: 'revenue' as CardType,
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
      type: 'events' as CardType,
      title: 'Event Success',
      label: 'Avg Registrations',
      value: `${data.events.avgRegistrationsPerEvent}/event`,
      subValue: `${data.events.totalRegistrations.toLocaleString('en-IN')} total signups`,
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
    <>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Platform Analytics</h1>
          <p className="text-gray-500">Real-time health indicators and performance metrics. Click any card to view detailed breakdown.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card, i) => (
            <div
              key={i}
              onClick={() => setSelectedCard(card.type)}
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
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  Details <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
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

      <DetailModal card={selectedCard} data={data} onClose={() => setSelectedCard(null)} />
    </>
  );
}
