import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

import AuthInitializer from "@/components/AuthInitializer";
import SessionProvider from "@/components/SessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "ParamSukh Admin Panel",
    description: "Admin panel for ParamSukh platform",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <SessionProvider>
                    <AuthInitializer />
                    {children}
                    <Toaster position="top-right" />
                </SessionProvider>
            </body>
        </html>
    );
}
