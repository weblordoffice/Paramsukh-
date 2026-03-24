'use client';

import {
    Users,
    BookOpen,
    Calendar,
    ShoppingCart,
    Package,
    MessageSquare,
    Bell,
    ClipboardList,
    Home,
    Crown,
    X,
    Mic,
    Settings
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

interface MenuItem {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    /** Only super_admin sees this item */
    superAdminOnly?: boolean;
    /** For role 'admin': need this permission to see the item (ignored for super_admin) */
    permission?: string;
}

const menuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', href: '/dashboard' },
    { icon: Users, label: 'Users', href: '/dashboard/users', permission: 'manage_users' },
    { icon: Crown, label: 'Memberships', href: '/dashboard/memberships', permission: 'manage_users' },
    { icon: Crown, label: 'Plans', href: '/dashboard/plans', permission: 'manage_users' },
    { icon: BookOpen, label: 'Courses', href: '/dashboard/courses', permission: 'manage_courses' },
    { icon: Mic, label: 'Podcasts', href: '/dashboard/podcasts', permission: 'manage_content' },
    { icon: Calendar, label: 'Events', href: '/dashboard/events', permission: 'manage_events' },
    { icon: ShoppingCart, label: 'Products', href: '/dashboard/products', permission: 'manage_shop' },
    { icon: Package, label: 'Orders', href: '/dashboard/orders', permission: 'manage_orders' },
    { icon: ClipboardList, label: 'Bookings', href: '/dashboard/bookings', permission: 'manage_content' },
    { icon: MessageSquare, label: 'Community', href: '/dashboard/community', permission: 'manage_community' },
    { icon: MessageSquare, label: 'Counseling', href: '/dashboard/counseling', permission: 'manage_content' },
    { icon: Bell, label: 'Notifications', href: '/dashboard/notifications', permission: 'manage_content' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings', superAdminOnly: true },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const user = useAuthStore((s) => s.user);
    const hasPermission = useAuthStore((s) => s.hasPermission);
    const isSuperAdmin = user?.role === 'super_admin';

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-secondary text-white flex flex-col 
                transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Close Button (Mobile Only) */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/50 hover:text-white md:hidden"
                >
                    <X className="w-6 h-6" />
                </button>
                {/* Logo */}
                <div className="p-6 border-b border-secondary-light flex flex-col items-center">
                    <div className="relative w-full h-24 mb-2">
                        <Image
                            src="/paramsukh.png"
                            alt="ParamSukh Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                    <p className="text-sm text-accent-light">Admin Panel</p>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-3">
                        {menuItems.map((item) => {
                            if (item.superAdminOnly && !isSuperAdmin) return null;
                            if (item.permission && !isSuperAdmin && !hasPermission(item.permission)) return null;
                            const Icon = item.icon;
                            const isActive = pathname === item.href;

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                            ? 'bg-primary text-white shadow-lg'
                                            : 'text-accent-light hover:bg-secondary-light hover:text-white'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-secondary-light">
                    <p className="text-xs text-accent-light text-center">
                        © 2026 ParamSukh
                    </p>
                </div>
            </aside>
        </>
    );
}
