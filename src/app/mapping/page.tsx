import { MappingViewer } from '@/components/MappingViewer'

export const metadata = {
  title: 'Mapping | planpaths-data-miner',
}

export default function MappingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-12">
      <div className="container mx-auto px-4">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Course Mapping</h1>
          <p className="text-xl text-gray-600">
            Match extracted courses to your state's master database using 27 matching strategies
          </p>
        </header>

        <MappingViewer />
      </div>
    </main>
  )
}
