import { ExtractForm } from '@/components/ExtractForm'

export const metadata = {
  title: 'Extract Courses | planpaths-data-miner',
}

export default function ExtractPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="container mx-auto px-4">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Course Extraction</h1>
          <p className="text-xl text-gray-600">
            Upload a PDF course catalog to extract course codes and details
          </p>
        </header>

        <ExtractForm />
      </div>
    </main>
  )
}
