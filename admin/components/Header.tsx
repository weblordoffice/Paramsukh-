'use client';

import { useAuthStore } from '@/lib/store/authStore';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Menu, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface HeaderProps {
    onSidebarToggle?: () => void;
}

export default function Header({ onSidebarToggle }: HeaderProps) {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    const handleLogout = () => {
        logout();
        signOut({ callbackUrl: '/' });
        toast.success('Logged out successfully');
        router.push('/');
    };

    return (
        <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Menu Button for Mobile */}
                    <button
                        onClick={onSidebarToggle}
                        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-secondary">Admin Dashboard</h2>
                        <p className="text-xs md:text-sm text-accent hidden md:block">Manage your platform</p>
                    </div>
                </div>

                <div className="flex items-center space-x-2 md:space-x-4">
                    <div className="hidden md:flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-lg">
                        <User className="w-5 h-5 text-accent" />
                        <span className="text-sm font-medium text-secondary">{user?.email ?? user?.name ?? 'Admin'}</span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 px-3 py-2 md:px-4 md:py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium hidden md:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
