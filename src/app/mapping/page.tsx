'use client'

export default function MappingPage() {
  return (
    <div className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">SQL Mapping Engine</h1>
        <p className="text-gray-600">27-pass matching algorithm with zero AI cost</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Select School</h2>
        <p className="text-sm text-gray-600 mb-4">Choose a school to run mapping passes</p>
        <button className="btn-primary">
          Select School
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Pass Reference</h2>
        <p className="text-sm text-gray-600 mb-4">Florida mapping engine includes 27 SQL passes:</p>
        <div className="space-y-1 text-sm">
          <p><span className="font-mono bg-gray-100 px-2 py-1 rounded">Pass 1: exact-course-code</span> (1.00 confidence, ~53% of courses)</p>
          <p><span className="font-mono bg-gray-100 px-2 py-1 rounded">Pass 15: exact-honors-position-roman-match</span> (0.93 confidence, handles "Biology II Honors" ↔ "Biology Honors 2")</p>
          <p><span className="font-mono bg-gray-100 px-2 py-1 rounded">Pass 25: synonym-table-match</span> (0.90 confidence, curated aliases)</p>
          <p><span className="font-mono bg-gray-100 px-2 py-1 rounded">Pass 27: unmatched</span> (0.00 confidence, review_status = 'needs_review')</p>
        </div>
      </div>
    </div>
  )
}
