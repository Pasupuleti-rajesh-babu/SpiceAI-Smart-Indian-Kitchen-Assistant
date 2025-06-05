
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import BottomNavigationBar from '@/components/layout/BottomNavigationBar';
import { ThemeHandler } from '@/components/layout/ThemeHandler';

export const metadata: Metadata = {
  title: 'SpiceAI: Smart Indian Kitchen Assistant',
  description: 'Your AI-powered guide to Indian cooking, pantry management, and meal planning.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeHandler>
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow pb-20 md:pb-24">
              {children}
            </main>
            <BottomNavigationBar />
          </div>
          <Toaster />
        </ThemeHandler>
      </body>
    </html>
  );
}
