'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Heart, Download, IndianRupee } from 'lucide-react';

interface Donation {
    _id: string;
    userName: string;
    phone?: string;
    amount: number;
    paymentMethod: string;
    status: string;
    message?: string;
    isAnonymous: boolean;
    createdAt: string;
}

export default function DonationsPage() {
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState(0);

    const fetchDonations = async (pageNum = 1) => {
        setLoading(true);
        try {
            const params: any = { page: pageNum, limit: 20 };
            if (filterStatus !== 'all') params.status = filterStatus;
            if (searchTerm) params.search = searchTerm;

            const response = await apiClient.get('/api/donations/all', { params });
            setDonations(response.data?.data?.donations || []);
            setTotalPages(response.data?.data?.pagination?.pages || 1);
            setTotalAmount(response.data?.data?.totalAmount || 0);
        } catch (error: any) {
            if (error.response?.status >= 500) toast.error('Server error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDonations(); }, [filterStatus]);
    useEffect(() => {
        const timer = setTimeout(() => { setPage(1); fetchDonations(1); }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => { fetchDonations(page); }, [page]);

    const exportCSV = () => {
        const headers = ['Name', 'Phone', 'Amount', 'Payment Method', 'Status', 'Message', 'Anonymous', 'Date'];
        const rows = donations.map(d => [
            d.isAnonymous ? 'Anonymous' : d.userName,
            d.phone || 'N/A',
            d.amount,
            d.paymentMethod,
            d.status,
            (d.message || '').replace(/"/g, '""'),
            d.isAnonymous ? 'Yes' : 'No',
            new Date(d.createdAt).toLocaleString()
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'donations.csv'; a.click();
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Donations</h1>
                    <p className="text-gray-500 mt-1">Track and manage all donations</p>
                </div>
                <button onClick={exportCSV} disabled={donations.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3"><div className="p-2 bg-purple-50 rounded-lg"><Heart className="w-5 h-5 text-purple-600" /></div></div>
                    <p className="text-2xl font-bold text-gray-900 mt-3">{donations.length}</p>
                    <p className="text-sm text-gray-500">Total Donations</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-lg"><IndianRupee className="w-5 h-5 text-green-600" /></div></div>
                    <p className="text-2xl font-bold text-gray-900 mt-3">₹{totalAmount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Total Amount</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="Search by name, phone or message..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="initiated">Initiated</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : donations.length === 0 ? (
                    <div className="text-center py-20 text-gray-500">No donations found</div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Donor</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Amount</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Method</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Message</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {donations.map(d => (
                                <tr key={d._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4"><span className="font-medium text-gray-900">{d.isAnonymous ? 'Anonymous' : d.userName}</span></td>
                                    <td className="px-6 py-4 font-semibold text-green-600">₹{d.amount}</td>
                                    <td className="px-6 py-4 text-gray-600 capitalize">{d.paymentMethod}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${d.status === 'completed' ? 'bg-green-100 text-green-800' : d.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{d.status}</span></td>
                                    <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">{d.message || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 rounded-lg border disabled:opacity-50">Prev</button>
                    <span className="px-4 py-2 text-gray-600">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 rounded-lg border disabled:opacity-50">Next</button>
                </div>
            )}
        </div>
    );
}
