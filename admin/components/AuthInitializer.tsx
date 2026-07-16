'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthInitializer() {
    const { token, isAuthenticated } = useAuthStore();
    const prevAuth = useRef(isAuthenticated);

    useEffect(() => {
        if (!isAuthenticated && prevAuth.current) {
            window.location.href = '/';
        }
        prevAuth.current = isAuthenticated;
    }, [isAuthenticated]);

    return null;
}
