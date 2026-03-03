'use client'

export default function MasterDBPage() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Master Database Import</h1>
        <p className="text-gray-600">Import state course catalogs as the mapping reference</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Import CSV</h2>
        <p className="text-sm text-gray-600 mb-4">Upload master course CSV files to populate master_courses table</p>
        <div className="border-2 border-dashed rounded-lg p-8 text-center bg-gray-50">
          <p className="text-gray-600 mb-2">Drag and drop your CSV here</p>
          <p className="text-xs text-gray-500">Supports Florida (.csv)</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">CSV Format</h2>
        <p className="text-sm text-gray-600 mb-3">Required columns (from Florida state catalog):</p>
        <div className="text-xs bg-gray-50 p-3 rounded font-mono space-y-1">
          <div>Sr No, Category, Sub-Category, Course code, Course Abbreviated Name,</div>
          <div>Course Name, Level/Length, Course Length, Level, Graduation Requirement,</div>
          <div>Credit, Subject Tag, Source Filename, Grade Level, Certification</div>
        </div>
      </div>
    </div>
  )
}
