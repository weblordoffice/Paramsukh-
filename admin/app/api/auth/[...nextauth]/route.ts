import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
