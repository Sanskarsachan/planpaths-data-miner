import Link from 'next/link'
import { Header } from '@/components/Header'
import {
  ArrowRight,
  BookMarked,
  BrainCircuit,
  Circle,
  Database,
  FileSearch,
  Files,
  FolderKanban,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

const commandCards = [
  {
    title: 'Extraction Pipeline',
    value: 'PDF Ingestion',
    description: 'Upload catalogs, split intelligently, and extract clean structured courses with Gemini.',
    href: '/extract',
    icon: FileSearch,
    accent: 'from-violet-500/30 via-violet-400/10 to-cyan-400/5',
  },
  {
    title: 'Mapping Engine',
    value: '27-Pass Match',
    description: 'Run deterministic SQL mapping across normalized school, synonym, and master course data.',
    href: '/mapping',
    icon: Workflow,
    accent: 'from-cyan-500/25 via-sky-400/10 to-violet-400/5',
  },
  {
    title: 'Master Database',
    value: 'State Imports',
    description: 'Load course master datasets, maintain reference tables, and keep mapping outcomes consistent.',
    href: '/master-db',
    icon: Database,
    accent: 'from-amber-500/25 via-orange-300/10 to-violet-400/5',
  },
  {
    title: 'Mining Console',
    value: 'QA + Audit',
    description: 'Inspect schools, review unmatched courses, and trace extraction quality across uploads.',
    href: '/mine',
    icon: Radar,
    accent: 'from-emerald-500/25 via-teal-400/10 to-cyan-400/5',
  },
]

const pipelineSteps = [
  {
    step: '01',
    title: 'Collect',
    detail: 'Bring in district or school PDFs and preserve raw upload metadata for every run.',
  },
  {
    step: '02',
    title: 'Structure',
    detail: 'Chunk by subject area, deduplicate entries, and normalize courses before persistence.',
  },
  {
    step: '03',
    title: 'Map',
    detail: 'Resolve extracted courses against state master references with a deterministic SQL engine.',
  },
  {
    step: '04',
    title: 'Audit',
    detail: 'Review confidence bands, unmatched rows, and school-level completeness before export.',
  },
]

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(96,58,200,0.3),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_#0d0b14_0%,_#090711_100%)] text-white">
      <Header />

      <main className="surface-grid relative mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(167,139,250,0.24),_transparent_55%)]" />

        <section className="grid items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="card panel-glow animate-fade-up relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(167,139,250,0.18),_transparent_34%),linear-gradient(140deg,_rgba(255,255,255,0.04),_transparent_58%)]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-violet-200/85">
                  <Sparkles className="h-3.5 w-3.5" />
                  Data Collection Command Center
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                    Collect, structure, and map school course catalogs with a modern ops-grade pipeline.
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-white/62 sm:text-lg">
                    PlanPaths Data Miner is built for high-signal ingestion work: extract courses from PDFs, normalize them into Supabase, and run deterministic mapping against state master databases with clear audit trails.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">Engine</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">27-pass</div>
                    <div className="mt-1 text-sm text-white/50">Deterministic SQL mapping</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">Storage</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Supabase</div>
                    <div className="mt-1 text-sm text-white/50">Normalized extraction records</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/40">AI Layer</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em]">Gemini 2.5</div>
                    <div className="mt-1 text-sm text-white/50">Chunk-aware PDF extraction</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/extract" className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  Start Extraction
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/mine" className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  Open Mining Console
                  <Radar className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <aside className="card panel-glow animate-fade-up-delay relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent_35%)]" />
            <div className="relative flex h-full flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.26em] text-white/38">System Readout</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Pipeline Snapshot</h2>
                </div>
                <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  Operational
                </div>
              </div>

              <div className="animate-float relative overflow-hidden rounded-[28px] border border-white/8 bg-[#0f0d1a] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_42%)]" />
                <div className="animate-scan absolute inset-x-4 h-20 bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent blur-md" />

                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/58">Core Focus</div>
                    <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">Catalog ingestion + auditability</div>
                  </div>
                  <BrainCircuit className="h-5 w-5 text-violet-300" />
                </div>

                <div className="relative mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Coverage</div>
                    <div className="mt-2 text-3xl font-semibold tracking-[-0.04em]">FL</div>
                    <div className="mt-1 text-xs text-white/50">Production-ready mapping rules</div>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Review</div>
                    <div className="mt-2 text-3xl font-semibold tracking-[-0.04em]">QA</div>
                    <div className="mt-1 text-xs text-white/50">Confidence, unmatched, drilldown</div>
                  </div>
                </div>

                <div className="relative mt-5 space-y-3 rounded-2xl border border-white/8 bg-black/20 p-4">
                  {[
                    ['Ingestion', 'Chunking + dedupe + extraction'],
                    ['Persistence', 'Uploads + extractions_v2 + hashes'],
                    ['Mapping', 'Master courses + synonyms + review'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 border-b border-white/6 pb-3 last:border-b-0 last:pb-0">
                      <span className="font-mono text-xs uppercase tracking-[0.22em] text-white/40">{label}</span>
                      <span className="text-right text-sm text-white/68">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {commandCards.map(({ title, value, description, href, icon: Icon, accent }) => (
            <Link
              key={title}
              href={href}
              className="group card panel-glow relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-white/20"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-100 transition duration-300 group-hover:opacity-80`} />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50" />
              <div className="relative flex h-full flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white shadow-lg shadow-black/20">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/35 transition duration-300 group-hover:translate-x-1 group-hover:text-white/70" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/45">{title}</div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">{value}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/60">{description}</p>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="card panel-glow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/40">Pipeline</div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">Built for repeatable data collection</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-300" />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {pipelineSteps.map((item) => (
                <div key={item.step} className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition duration-300 hover:border-violet-300/30 hover:bg-white/[0.05]">
                  <div className="font-mono text-xs uppercase tracking-[0.28em] text-violet-200/75">Step {item.step}</div>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/58">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="card panel-glow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/40">Core Modules</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Professional tooling surface</h2>
                </div>
                <FolderKanban className="h-5 w-5 text-violet-300" />
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ['Extract', 'PDF upload workflows with chunk-aware AI extraction'],
                  ['Mine', 'School drilldown, mapping inspection, and confidence review'],
                  ['Master DB', 'Controlled imports for state-wide reference catalogs'],
                  ['Ask', 'Natural-language analysis interface for your course data'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.8)]" />
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="mt-1 text-sm leading-6 text-white/58">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card panel-glow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/40">State Coverage</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Rollout status</h2>
                </div>
                <Files className="h-5 w-5 text-cyan-300" />
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
                  <p className="inline-flex items-center gap-2 font-semibold text-white">
                    <Circle className="h-3.5 w-3.5 fill-blue-400 text-blue-400" />
                    Florida (FL)
                  </p>
                  <p className="mt-2 text-white/62">Complete 27-pass engine, 6/7-digit code support, M/J honors handling, production mapping logic.</p>
                </div>
                <div className="rounded-2xl border border-amber-400/14 bg-white/[0.03] p-4 opacity-75">
                  <p className="inline-flex items-center gap-2 font-semibold text-white">
                    <Circle className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    Texas (TX)
                  </p>
                  <p className="mt-2 text-white/54">Extensible pattern for TEA codes and future state-specific mapping rules.</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/14 bg-white/[0.03] p-4 opacity-75">
                  <p className="inline-flex items-center gap-2 font-semibold text-white">
                    <Circle className="h-3.5 w-3.5 fill-emerald-400 text-emerald-400" />
                    California (CA)
                  </p>
                  <p className="mt-2 text-white/54">Prepared for A-G and pathway mapping once the reference dataset is imported.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card panel-glow relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_rgba(96,58,200,0.18),_transparent_32%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-white/46">
                <BookMarked className="h-3.5 w-3.5 text-violet-300" />
                Ready For Ingestion Ops
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                Use the extraction queue as your front door, then audit every downstream mapping decision.
              </h2>
              <p className="mt-4 text-base leading-8 text-white/60">
                The product is strongest when it behaves like infrastructure: clear inputs, structured outputs, and observable quality at every stage of the data collection lifecycle.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/extract" className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                Launch Extract
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/mapping" className="btn-secondary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                Review Mapping
                <Workflow className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
