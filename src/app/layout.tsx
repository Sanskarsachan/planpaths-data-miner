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
      <body className="bg-background text-foreground">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="container mx-auto px-4 py-4">
              <h1 className="text-2xl font-bold">PlanPaths Data Miner</h1>
              <p className="text-sm text-gray-600">Extract school course catalogs → Supabase → Master DB Mapping</p>
            </div>
          </header>
          <main className="flex-1 container mx-auto px-4 py-8">
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
