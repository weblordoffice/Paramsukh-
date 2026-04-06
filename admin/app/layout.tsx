import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

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
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <SessionProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <AuthInitializer />
                        {children}
                        <Toaster position="top-right" />
                        <SonnerToaster position="bottom-right" />
                    </ThemeProvider>
                </SessionProvider>
            </body>
        </html>
    );
}

