import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner'


const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Color Parser",
    description: "Parse clipboard colors into full-height color bands, or pick precise colors from photos. Convert to HEX, RGB, HSL, OKLCH, and more, right on your device.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
                <Toaster
                    position="top-center"
                    richColors
                    closeButton
                />
                {children}
            </body>
        </html>
    );
}
