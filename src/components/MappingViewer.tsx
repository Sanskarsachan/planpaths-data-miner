'use client'

import React, { useState, useEffect } from 'react'
import { Search, Loader2, AlertCircle } from 'lucide-react'

interface MappingResult {
  mapping_logic: string
  count: number
}

interface SchoolData {
  id: string
  name: string
  slug: string
  state_code: string
}

export function MappingViewer() {
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string>('')
  const [stateCode, setStateCode] = useState<string>('FL')
  const [results, setResults] = useState<MappingResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load schools on mount
  useEffect(() => {
    const loadSchools = async () => {
      try {
        const response = await fetch('/api/schools')
        const data = await response.json()
        setSchools(data)
        if (data.length > 0) {
          setSelectedSchool(data[0].slug)
          setStateCode(data[0].state_code)
        }
      } catch (err) {
        console.error('Error loading schools:', err)
      }
    }
    loadSchools()
  }, [])

  const handleRunMapping = async (reset: boolean = false) => {
    if (!selectedSchool || !stateCode) {
      setError('Please select a school')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_slug: selectedSchool,
          state_code: stateCode,
          reset,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Mapping failed')
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const selectedSchoolData = schools.find(s => s.slug === selectedSchool)
  const totalMatches = results?.reduce((sum, r) => sum + r.count, 0) || 0

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Course Mapping Engine</h2>

        {/* School Selection */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select School
            </label>
            <select
              value={selectedSchool}
              onChange={e => {
                const school = schools.find(s => s.slug === e.target.value)
                setSelectedSchool(e.target.value)
                if (school) setStateCode(school.state_code)
              }}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- No schools extracted yet --</option>
              {schools.map(school => (
                <option key={school.slug} value={school.slug}>
                  {school.name} ({school.state_code})
                </option>
              ))}
            </select>
          </div>

          {/* State Code Display */}
          {selectedSchoolData && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">School:</span> {selectedSchoolData.name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">State:</span> {selectedSchoolData.state_code}
              </p>
            </div>
          )}

          {/* Info */}
          {schools.length === 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                No schools found. Extract a course catalog from the Extraction page first.
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => handleRunMapping(false)}
            disabled={loading || !selectedSchool}
            className={`flex-1 px-6 py-3 font-medium rounded-lg transition flex items-center justify-center gap-2 ${
              loading || !selectedSchool
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Running Mapping...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Run Mapping
              </>
            )}
          </button>

          {results && (
            <button
              onClick={() => handleRunMapping(true)}
              disabled={loading}
              className="px-6 py-3 font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              Reset & Re-map
            </button>
          )}
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">Total Matches</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{totalMatches}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-900 font-medium">Passes Used</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {results.length}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-900 font-medium">Unmatched</p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {results[results.length - 1]?.count || 0}
                </p>
              </div>
            </div>

            {/* Mapping Passes */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Matching Passes</h3>
              <div className="space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {result.mapping_logic}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            result.count > 0
                              ? index === results.length - 1
                                ? 'bg-red-500'
                                : 'bg-green-500'
                              : 'bg-gray-300'
                          }`}
                          style={{
                            width: `${Math.max(
                              (result.count / Math.max(...results.map(r => r.count), 1)) *
                                100,
                              result.count > 0 ? 5 : 0
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-right w-16 text-sm font-semibold text-gray-900">
                        {result.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Step */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <span className="font-medium">Next:</span> Review and refine mappings, or
                export results. Check the extracted_courses and mapping_results tables in
                Supabase for detailed data.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!results && !loading && schools.length > 0 && (
          <div className="text-center py-12 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No mapping results yet</p>
            <p className="text-sm">Click "Run Mapping" to start the 27-pass matching engine</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-medium">How it works:</span> The 27-pass mapping engine uses
          increasingly flexible matching strategies to link extracted courses to your state's
          master database. Early passes use exact matches, later passes use fuzzy matching.
        </p>
      </div>
    </div>
  )
}
