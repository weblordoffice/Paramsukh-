import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Runtime environment checks — prefer runtime handling but always
// export top-level `GET` and `POST` so Next's module parser is happy.
const requiredEnv = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NEXTAUTH_SECRET'];
const missing = requiredEnv.filter((k) => !process.env[k]);

const makeErrorResponse = (message: string) => {
    return async (_req: Request) => {
        return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    };
};

let handler: (req: Request) => Promise<Response>;

if (missing.length > 0) {
    const message = `Missing env: ${missing.join(', ')}`;
    handler = makeErrorResponse(message);
} else {
    const authOptions = {
        providers: [
            GoogleProvider({
                clientId: process.env.GOOGLE_CLIENT_ID!,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
                authorization: {
                    params: {
                        scope: 'openid email profile',
                        response_type: 'code',
                        prompt: 'consent',
                    },
                },
            }),
        ],
        callbacks: {
            async jwt({ token, account }: { token: any; account: any }) {
                if (account?.id_token) {
                    token.id_token = account.id_token;
                }
                if (account?.access_token) {
                    token.access_token = account.access_token;
                }
                return token;
            },
            async session({ session, token }: { session: any; token: any }) {
                if (session.user) {
                    (session as any).id_token = token.id_token;
                    (session as any).access_token = token.access_token;
                }
                return session;
            },
        },
        pages: {
            signIn: '/',
        },
        session: { strategy: 'jwt' as const },
        secret: process.env.NEXTAUTH_SECRET,
    };

    // NextAuth returns a handler function compatible with app-route Request/Response
    handler = NextAuth(authOptions as any) as unknown as (req: Request) => Promise<Response>;
}

export const GET = handler as any;
export const POST = handler as any;
