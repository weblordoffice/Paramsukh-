'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Package, Truck, CheckCircle, XCircle, ShoppingBag, MapPin, User, FileText, ChevronRight, X } from 'lucide-react';
import Image from 'next/image';

interface Order {
    _id: string;
    orderNumber: string;
    user: { displayName: string; email: string; phone: string };
    items: any[];
    totalAmount: number;
    status: string;
    createdAt: string;
    deliveryAddress: {
        fullName: string;
        addressLine1: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
    };
    payment: {
        method: string;
        status: string;
    };
}

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await apiClient.get('/api/orders/all');
            setOrders(response.data.data?.orders || response.data.orders || response.data || []);
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching orders:', error);
            }
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (status: string) => {
        if (!selectedOrder) return;
        setIsStatusUpdating(true);
        try {
            await apiClient.patch(`/api/orders/${selectedOrder._id}/status`, { status });
            toast.success(`Order status updated to ${status}`);
            setSelectedOrder(prev => prev ? { ...prev, status } : null);
            fetchOrders(); // Refresh table
        } catch (error: any) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        } finally {
            setIsStatusUpdating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return 'bg-green-100 text-green-800';
            case 'shipped': return 'bg-blue-100 text-blue-800';
            case 'processing': return 'bg-yellow-100 text-yellow-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredOrders = orders.filter(order =>
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.user?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Orders Management</h1>
                    <p className="text-accent mt-1">Track and manage all orders</p>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Order #</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Customer</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Items</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Amount</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase">Date</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-accent uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-accent">No orders found</td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order._id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-4 font-medium text-secondary">{order.orderNumber || order._id.slice(-8)}</td>
                                        <td className="px-6 py-4 text-accent">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{order.user?.displayName || 'Unknown'}</span>
                                                <span className="text-xs text-gray-500">{order.user?.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-accent">{order.items?.length || 0} items</td>
                                        <td className="px-6 py-4 font-semibold text-secondary">₹{order.totalAmount || 0}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-accent text-sm">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="text-primary hover:text-primary-dark font-medium text-sm flex items-center justify-end"
                                            >
                                                View
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-xl font-bold text-secondary">
                                    Order #{selectedOrder.orderNumber || selectedOrder._id.slice(-8)}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Placed on {new Date(selectedOrder.createdAt).toLocaleString(undefined, { hour12: true })}
                                </p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Left Column: Order Items */}
                            <div className="md:col-span-2 space-y-6">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                                        <ShoppingBag className="w-4 h-4 mr-2" />
                                        Order Items
                                    </h3>
                                    <div className="space-y-4">
                                        {selectedOrder.items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-start space-x-4 bg-white p-3 rounded-lg border">
                                                <div className="relative w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                                                    {item.productImage ? (
                                                        <Image src={item.productImage} alt={item.productName} fill className="object-cover" />
                                                    ) : (
                                                        <Package className="w-8 h-8 m-auto text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-medium text-gray-900 line-clamp-1">{item.productName}</h4>
                                                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                                                    <p className="text-sm font-semibold text-gray-900 mt-1">₹{item.price}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t flex justify-between items-center font-bold text-lg">
                                        <span>Total Amount</span>
                                        <span>₹{selectedOrder.totalAmount || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Customer & Actions */}
                            <div className="space-y-6">
                                {/* Status Update */}
                                <div className="bg-white border rounded-xl p-4 shadow-sm">
                                    <h3 className="font-semibold text-gray-900 mb-3">Update Status</h3>
                                    <div className="space-y-2">
                                        {['pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusUpdate(status)}
                                                disabled={isStatusUpdating || selectedOrder.status === status}
                                                className={`w-full py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors flex items-center justify-between
                                                    ${selectedOrder.status === status
                                                        ? 'bg-primary text-white'
                                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                {status}
                                                {selectedOrder.status === status && <CheckCircle className="w-4 h-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Customer Details */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                                            <User className="w-4 h-4 mr-2" />
                                            Customer
                                        </h3>
                                        <p className="text-sm font-medium">{selectedOrder.user?.displayName || 'Guest'}</p>
                                        <p className="text-xs text-gray-500">{selectedOrder.user?.email}</p>
                                        <p className="text-xs text-gray-500">{selectedOrder.user?.phone}</p>
                                    </div>
                                    <div className="pt-4 border-t">
                                        <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                                            <MapPin className="w-4 h-4 mr-2" />
                                            Delivery Address
                                        </h3>
                                        <p className="text-xs text-gray-600 leading-relaxed">
                                            {selectedOrder.deliveryAddress?.fullName}<br />
                                            {selectedOrder.deliveryAddress?.addressLine1}<br />
                                            {selectedOrder.deliveryAddress?.city}, {selectedOrder.deliveryAddress?.state} - {selectedOrder.deliveryAddress?.pincode}<br />
                                            Phone: {selectedOrder.deliveryAddress?.phone}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
