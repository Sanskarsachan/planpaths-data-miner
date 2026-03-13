import { Circle } from 'lucide-react'

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card">
        <h2 className="text-xl font-bold mb-4">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded bg-blue-50">
            <p className="text-gray-600 text-sm">Extraction Pipeline</p>
            <p className="text-2xl font-bold">Upload PDFs</p>
            <a href="/extract" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
              Start extracting →
            </a>
          </div>
          <div className="p-4 border rounded bg-green-50">
            <p className="text-gray-600 text-sm">Mapping Engine</p>
            <p className="text-2xl font-bold">27-Pass SQL</p>
            <a href="/mapping" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
              View mappings →
            </a>
          </div>
          <div className="p-4 border rounded bg-purple-50">
            <p className="text-gray-600 text-sm">Master Database</p>
            <p className="text-2xl font-bold">Import CSVs</p>
            <a href="/master-db" className="mt-2 inline-block text-blue-600 hover:underline text-sm">
              Import courses →
            </a>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold mb-4">Overview</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>PlanPaths Data Miner</strong> is a production-ready system for extracting and mapping school course catalogs.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Extract courses from PDF catalogs using Gemini 2.5 Flash</li>
            <li>Intelligent chunking by subject area for clean context</li>
            <li>27-pass SQL mapping engine (FL complete, TX/CA extensible)</li>
            <li>Zero AI cost for mapping — SQL joins on pre-normalized columns</li>
            <li>Supabase PostgreSQL 15 with trigger-based normalization</li>
          </ul>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold mb-4">States Supported</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border rounded p-3">
            <p className="font-semibold inline-flex items-center gap-2">
              <Circle className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
              Florida (FL)
            </p>
            <p className="text-gray-600 text-xs mt-1">Complete 27-pass engine · 6/7-digit codes · M/J honors</p>
          </div>
          <div className="border rounded p-3 opacity-60">
            <p className="font-semibold inline-flex items-center gap-2">
              <Circle className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
              Texas (TX)
            </p>
            <p className="text-gray-600 text-xs mt-1">Extensible pattern · TEA codes · Coming soon</p>
          </div>
          <div className="border rounded p-3 opacity-60">
            <p className="font-semibold inline-flex items-center gap-2">
              <Circle className="h-3.5 w-3.5 fill-green-500 text-green-500" />
              California (CA)
            </p>
            <p className="text-gray-600 text-xs mt-1">A-G approval · CTE pathways · Coming soon</p>
          </div>
        </div>
      </section>
    </div>
  )
}
