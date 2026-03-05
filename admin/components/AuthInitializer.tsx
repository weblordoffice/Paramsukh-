'use client';

import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/lib/store/authStore';

export default function AuthInitializer() {
    const { token, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated && token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
    }, [isAuthenticated, token]);

    return null;
}
