import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/lib/auth";
import ThemeProvider from "@/lib/theme";
import { ConfigProvider } from "@/lib/config";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema de Gestión de Talleres",
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
          <AuthProvider>
            <ThemeProvider>
              <main className="flex-grow">
                {children}
              </main>
              <Footer />
            </ThemeProvider>
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
