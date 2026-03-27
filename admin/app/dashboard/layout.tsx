'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useAuthStore } from '@/lib/store/authStore';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { data: session, status } = useSession();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const token = useAuthStore((state) => state.token);
    const exchangeGoogleToken = useAuthStore((state) => state.exchangeGoogleToken);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [hasExchanged, setHasExchanged] = useState(false);
    const idToken = (session as { id_token?: string } | null)?.id_token;
    const accessToken = (session as { access_token?: string } | null)?.access_token;
    const hasOAuthToken = Boolean(idToken || accessToken);

    const exchanging =
        status === 'authenticated' &&
        !!session &&
        !token &&
        hasOAuthToken &&
        !hasExchanged;

    useEffect(() => {
        if (!exchanging) return;
        exchangeGoogleToken({ idToken, accessToken })
            .then((result) => {
                setHasExchanged(true);
                if (!result.ok) {
                    const msg = result.message || 'not_admin';
                    console.error('[Admin Auth] Token exchange failed:', msg);
                    signOut({ callbackUrl: `/?error=${encodeURIComponent(msg)}` });
                    router.replace(`/?error=${encodeURIComponent(msg)}`);
                }
            })
            .catch(() => {
                setHasExchanged(true);
            });
    }, [accessToken, exchanging, exchangeGoogleToken, idToken, router]);

    useEffect(() => {
        if (!exchanging && !isAuthenticated && status !== 'loading') {
            router.push('/');
        }
    }, [isAuthenticated, status, exchanging, router]);

    if (status === 'loading' || exchanging || (!isAuthenticated && status === 'authenticated')) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-600">{exchanging ? 'Verifying admin access...' : 'Loading...'}</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onSidebarToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
