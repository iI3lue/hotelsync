import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Panel de administración de HotelSync",
  description: "Panel de administración de HotelSync",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido
        </a>
        <ThemeProvider>
          <div className="flex">
            <aside className="w-64 bg-gray-800 text-white min-h-screen p-4 dark:bg-gray-950">
              <div className="flex items-center justify-between mb-8 gap-2">
                <h1 className="text-xl font-bold">Panel HotelSync</h1>
                <ThemeToggle />
              </div>
              <nav aria-label="Principal" className="space-y-2">
                <a
                  href="/"
                  className="block px-3 py-2 rounded transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:hover:bg-gray-800"
                >
                  Panel principal
                </a>
                <a
                  href="/hotels"
                  className="block px-3 py-2 rounded transition-colors hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:hover:bg-gray-800"
                >
                  Hoteles
                </a>
              </nav>
            </aside>
            <main id="contenido" className="flex-1 min-w-0 p-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
