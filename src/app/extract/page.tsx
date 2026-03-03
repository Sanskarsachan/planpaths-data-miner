'use client'

export default function ExtractPage() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">PDF Extraction</h1>
        <p className="text-gray-600">Upload school course catalogs for intelligent extraction</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Upload Catalog PDF</h2>
        <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50">
          <p className="text-gray-600 mb-2">Drag and drop your PDF here, or click to select</p>
          <p className="text-xs text-gray-500">Supports PDFs up to 50MB</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Upload a school catalog PDF</li>
          <li>System detects state (FL/TX/CA) from content and filename</li>
          <li>SmartChunker splits PDF by subject area headers</li>
          <li>Gemini 2.5 Flash extracts courses (max 5 concurrent calls)</li>
          <li>Deduplication checks for cross-upload duplicates</li>
          <li>All courses stored in extracted_courses table</li>
        </ol>
      </div>
    </div>
  )
}
