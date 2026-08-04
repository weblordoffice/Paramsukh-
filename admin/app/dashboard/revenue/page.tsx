'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api/client';
import {
  DollarSign, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight,
  ShoppingCart, CreditCard, RefreshCcw, Search, Download, Filter, X, ChevronLeft, ChevronRight,
  Eye, Calendar, Banknote, Users, BarChart3, PieChart
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, Legend, ComposedChart, Line
} from 'recharts';
import toast from 'react-hot-toast';

const SOURCE_COLORS: Record<string, string> = {
  membership: '#8B5CF6',
  order: '#3B82F6',
  event: '#10B981',
  counseling: '#F59E0B',
  podcast: '#EF4444',
  donation: '#EC4899',
  admin_grant: '#6B7280',
};

const SOURCE_LABELS: Record<string, string> = {
  membership: 'Membership',
  order: 'Marketplace',
  event: 'Events',
  counseling: 'Counseling',
  podcast: 'Podcasts',
  donation: 'Donations',
  admin_grant: 'Admin Grants',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-yellow-100 text-yellow-800',
};

interface RevenueData {
  overview: {
    totalRevenue: number;
    totalRefundAmount: number;
    totalFailedTransactions: number;
    totalTransactions: number;
    successCount: number;
    revenueToday: number;
    revenueThisMonth: number;
    revenueThisYear: number;
    transactionsToday: number;
    transactionsThisMonth: number;
    averageOrderValue: number;
    netRevenue: number;
  };
  sourceBreakdown: { source: string; revenue: number; transactions: number; percentage: number }[];
  charts: {
    daily: { _id: string; total: number; count: number }[];
    monthly: { _id: string; total: number; count: number }[];
  };
}

interface TransactionItem {
  _id: string;
  userId: string;
  userName: string;
  source: string;
  sourceId: string;
  amount: number;
  status: string;
  provider: string;
  providerRef: string;
  metadata: Record<string, string>;
  refundAmount: number;
  createdAt: string;
}

const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN')}`;
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions'>('overview');

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPagination, setTxPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [txPage, setTxPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);
      if (sourceFilter) params.set('source', sourceFilter);
      const res = await apiClient.get(`/api/admin/revenue/dashboard?${params}`);
      if (res.data.success) setData(res.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, sourceFilter]);

  const fetchTransactions = useCallback(async (page = 1) => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (sourceFilter) params.set('source', sourceFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);
      const res = await apiClient.get(`/api/admin/revenue/transactions?${params}`);
      if (res.data.success) {
        setTransactions(res.data.data);
        setTxPagination(res.data.pagination);
        setTxPage(page);
      }
    } catch (e) { console.error(e); }
    finally { setTxLoading(false); }
  }, [search, sourceFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);
  useEffect(() => { if (activeTab === 'transactions') fetchTransactions(1); }, [activeTab]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (sourceFilter) params.set('source', sourceFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('startDate', dateFrom);
      if (dateTo) params.set('endDate', dateTo);
      const res = await apiClient.get(`/api/admin/revenue/transactions/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `revenue-${new Date().toISOString().split('T')[0]}.csv`;
      a.click(); window.URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (e) { toast.error('Export failed'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load revenue data.</div>;

  const { overview, charts } = data;

  const statCards = [
    { title: 'Total Revenue', value: formatCurrency(overview.netRevenue), icon: DollarSign, color: 'from-violet-500 to-purple-600', trend: null },
    { title: 'Revenue This Month', value: formatCurrency(overview.revenueThisMonth), icon: TrendingUp, color: 'from-blue-500 to-cyan-600', trend: null },
    { title: 'Revenue Today', value: formatCurrency(overview.revenueToday), icon: Activity, color: 'from-emerald-500 to-teal-600', sub: `${overview.transactionsToday} transactions` },
    { title: 'Avg Order Value', value: formatCurrency(overview.averageOrderValue), icon: Banknote, color: 'from-amber-500 to-orange-600', trend: null },
    { title: 'Total Transactions', value: overview.totalTransactions.toLocaleString(), icon: ShoppingCart, color: 'from-rose-500 to-pink-600', sub: `${overview.successCount} successful` },
    { title: 'Refunded', value: formatCurrency(overview.totalRefundAmount), icon: RefreshCcw, color: 'from-gray-500 to-slate-600', sub: `${overview.totalFailedTransactions} failed` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Revenue Analytics</h1>
          <p className="text-sm text-accent mt-1">Track every rupee flowing through the platform</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-primary text-white shadow-md' : 'bg-white text-secondary border border-gray-200 hover:bg-gray-50'}`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />Overview
          </button>
          <button
            onClick={() => { setActiveTab('transactions'); fetchTransactions(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'transactions' ? 'bg-primary text-white shadow-md' : 'bg-white text-secondary border border-gray-200 hover:bg-gray-50'}`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />Transactions
          </button>
        </div>
      </div>

      {/* Date Range & Filter */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <span className="text-sm text-accent">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => { setDateFrom(''); setDateTo(''); setSourceFilter(''); }} className="px-3 py-2 text-sm text-accent hover:bg-gray-100 rounded-lg">
          <X className="w-4 h-4 inline mr-1" />Reset
        </button>
        <button onClick={handleExport} className="ml-auto px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md`}>
                    <card.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-secondary mt-4">{card.value}</p>
                <p className="text-sm text-accent">{card.title}</p>
                {card.sub && <p className="text-xs text-accent-light mt-1">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-secondary">Revenue Trend</h3>
                  <p className="text-sm text-accent">Daily revenue for this year</p>
                </div>
                <select className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg" defaultValue="daily">
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={charts.daily}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} interval={Math.ceil(charts.daily.length / 8)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} labelFormatter={(l) => `Date: ${l}`} />
                  <Area type="monotone" dataKey="total" stroke="#8B5CF6" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Source Breakdown */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-secondary mb-4">Revenue by Source</h3>
              <div className="space-y-3">
                {data.sourceBreakdown.map((s) => (
                  <div key={s.source} className="group">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-secondary">{SOURCE_LABELS[s.source] || s.source}</span>
                      <span className="text-accent">{s.percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${s.percentage}%`, backgroundColor: SOURCE_COLORS[s.source] || '#6B7280' }}
                      />
                    </div>
                    <p className="text-xs text-accent mt-1">{formatCurrency(s.revenue)} • {s.transactions} txns</p>
                  </div>
                ))}
              </div>
              {data.sourceBreakdown.length === 0 && (
                <p className="text-sm text-accent text-center py-8">No revenue data for selected period</p>
              )}
            </div>
          </div>
        </>
      ) : (
        /* Transactions Tab */
        <div className="bg-white rounded-xl border border-gray-100">
          {/* Search + Filters */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
              <input
                placeholder="Search user, payment ID, product..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === 'Enter' && fetchTransactions(1)}
              />
            </div>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <button onClick={() => fetchTransactions(1)} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark">
              <Search className="w-4 h-4 inline mr-2" />Search
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-secondary">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary">Source</th>
                  <th className="text-left px-4 py-3 font-semibold text-secondary">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-secondary">Amount</th>
                  <th className="text-center px-4 py-3 font-semibold text-secondary">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-secondary">Action</th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-accent">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  </td></tr>
                ) : transactions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-accent">No transactions found</td></tr>
                ) : transactions.map((tx) => (
                  <tr key={tx._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-accent whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-secondary">{tx.userName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: (SOURCE_COLORS[tx.source] || '#6B7280') + '20', color: SOURCE_COLORS[tx.source] || '#6B7280' }}>
                        {SOURCE_LABELS[tx.source] || tx.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-accent max-w-[200px] truncate">
                      {tx.metadata?.planName || tx.metadata?.courseName || tx.metadata?.productName || tx.metadata?.eventName || tx.source}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      <span className={tx.status === 'refunded' ? 'text-yellow-600 line-through' : 'text-secondary'}>
                        {formatCurrency(tx.status === 'refunded' ? tx.refundAmount : tx.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-600'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setSelectedTx(tx)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Eye className="w-4 h-4 text-accent" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {txPagination.pages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-accent">
                Showing {((txPage - 1) * txPagination.limit) + 1}-{Math.min(txPage * txPagination.limit, txPagination.total)} of {txPagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchTransactions(txPage - 1)} disabled={txPage <= 1}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
                {Array.from({ length: Math.min(txPagination.pages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(txPage - 2, txPagination.pages - 4));
                  const page = start + i;
                  if (page > txPagination.pages) return null;
                  return (
                    <button key={page} onClick={() => fetchTransactions(page)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${page === txPage ? 'bg-primary text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                      {page}
                    </button>
                  );
                })}
                <button onClick={() => fetchTransactions(txPage + 1)} disabled={txPage >= txPagination.pages}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTx(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-secondary">Transaction Details</h3>
              <button onClick={() => setSelectedTx(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-accent">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedTx.status]}`}>{selectedTx.status}</span></div>
              <div className="flex justify-between"><span className="text-accent">Date</span><span className="font-medium">{formatDate(selectedTx.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-accent">Source</span><span className="font-medium">{SOURCE_LABELS[selectedTx.source] || selectedTx.source}</span></div>
              <div className="flex justify-between"><span className="text-accent">Amount</span><span className="font-mono font-bold text-secondary">{formatCurrency(selectedTx.amount)}</span></div>
              {selectedTx.refundAmount > 0 && <div className="flex justify-between"><span className="text-accent">Refunded</span><span className="font-mono font-bold text-yellow-600">{formatCurrency(selectedTx.refundAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-accent">User</span><span className="font-medium">{selectedTx.userName || '-'}</span></div>
              <div className="flex justify-between"><span className="text-accent">Provider</span><span className="font-medium">{selectedTx.provider}</span></div>
              <div className="flex justify-between"><span className="text-accent">Provider Ref</span><span className="font-mono text-xs">{selectedTx.providerRef || '-'}</span></div>
              <div className="flex justify-between"><span className="text-accent">Transaction ID</span><span className="font-mono text-xs">{selectedTx._id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
