import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PlanPaths Data Miner",
  description: "Extract and map school course catalogs",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground m-0">
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t bg-gray-50 py-4 mt-8">
            <div className="container mx-auto px-4 text-center text-sm text-gray-600">
              <p>v1.0.0 · Next.js 15 + Supabase</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
