import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/lib/auth";
import ThemeProvider from "@/lib/theme";
import { ConfigProvider } from "@/lib/config";
import { NotificationProvider } from "@/lib/notification";
import { LanguageProvider } from "@/lib/i18n";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MechHub - Sistema de Gestión de Talleres",
  description: "Optimiza el flujo de trabajo de tu taller mecánico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.className} min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <ConfigProvider>
          <NotificationProvider>
            <AuthProvider>
              <LanguageProvider>
                <ThemeProvider>
                  <main className="flex-grow">
                    {children}
                  </main>
                  <Footer />
                </ThemeProvider>
              </LanguageProvider>
            </AuthProvider>
          </NotificationProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
