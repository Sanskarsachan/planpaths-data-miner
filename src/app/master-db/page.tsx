import { MasterDBImport } from '@/components/MasterDBImport'

export const metadata = {
  title: 'Master Database | planpaths-data-miner',
}

export default function MasterDBPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12">
      <div className="container mx-auto px-4">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Master Database Import</h1>
          <p className="text-xl text-gray-600">
            Upload your state's official course database for mapping
          </p>
        </header>

        <MasterDBImport />
      </div>
    </main>
  )
}
