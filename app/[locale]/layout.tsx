import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { cn } from "@/lib/utils";
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { NextAuthProvider } from '@/components/providers/session-provider';
import { Toaster } from "sonner";
import "../globals.css";

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata = {
  title: "Medcare System",
  description: "Medical management system",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body className="bg-slate-100 text-slate-800 h-screen w-full flex overflow-hidden">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <NextAuthProvider>
            <AuthInitializer>
              {children}
            </AuthInitializer>
            <Toaster richColors position="top-right" />
          </NextAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
