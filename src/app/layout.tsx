import type { Metadata } from "next"
import { readFileSync } from "fs"
import { DM_Mono, DM_Sans } from "next/font/google"
import { join } from "path"
import packageJson from "../../package.json"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "PlanPaths Data Miner",
  description: "Extract and map school course catalogs",
}

function readInstalledVersion(packagePath: string, fallback: string | undefined) {
  try {
    const packageContents = readFileSync(packagePath, "utf8")
    const parsedPackage = JSON.parse(packageContents) as { version?: string }
    return parsedPackage.version ?? fallback ?? "unknown"
  } catch {
    return fallback?.replace(/^[^\d]*/, "") ?? "unknown"
  }
}

const appVersion = packageJson.version
const nextVersion = readInstalledVersion(
  join(process.cwd(), "node_modules", "next", "package.json"),
  packageJson.dependencies.next,
)
const supabaseVersion = readInstalledVersion(
  join(process.cwd(), "node_modules", "@supabase", "supabase-js", "package.json"),
  packageJson.dependencies["@supabase/supabase-js"],
)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${dmMono.variable} bg-background text-foreground m-0`}>
        <div className="min-h-screen flex flex-col">
          <main className="flex-1">
            {children}
          </main>
          <footer className="mt-8 border-t border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] py-5">
            <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:text-left">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/38">
                Runtime Versions
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-end">
                <span className="rounded-full border border-violet-400/18 bg-violet-400/10 px-3 py-1 font-medium text-violet-200">
                  v{appVersion}
                </span>
                <span className="text-white/28">•</span>
                <span className="rounded-full border border-cyan-400/18 bg-cyan-400/10 px-3 py-1 font-medium text-cyan-200">
                  Next.js {nextVersion}
                </span>
                <span className="text-white/28">•</span>
                <span className="rounded-full border border-emerald-400/18 bg-emerald-400/10 px-3 py-1 font-medium text-emerald-200">
                  Supabase {supabaseVersion}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
