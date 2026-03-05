import { Suspense } from 'react';
import LoginClient from './LoginClient';

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-secondary-light to-accent p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="h-6 w-40 bg-gray-200 rounded mb-3 mx-auto" />
          <div className="h-4 w-56 bg-gray-200 rounded mb-8 mx-auto" />
          <div className="h-12 w-full bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
