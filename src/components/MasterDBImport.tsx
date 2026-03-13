'use client'

import React, { useState } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface ImportResult {
  staged_count: number
  import_result: {
    total_inserted: number
    categories: number
    six_digit_codes: number
    seven_digit_codes: number
    trigger_fired: boolean
    honors_normalized: boolean
  }
}

export function MasterDBImport() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.type.includes('csv') && !selectedFile.name.endsWith('.csv')) {
        setError('File must be a CSV file')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!file) {
      setError('CSV file is required')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/master-db/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Import failed')
      }

      const data = await response.json()
      setResult(data)
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csv = `course_code,name,category
6101010,English I,English Language Arts
6101020,AP English Language and Composition,English Language Arts
132310,Physics I,Science
132330,AP Chemistry,Science
201005,Algebra I,Mathematics
201035,AP Calculus AB,Mathematics
2100010,World History,Social Studies
2100020,AP US Government and Politics,Social Studies
5100005,Visual Arts I,Fine Arts
5200010,Music Theory I,Fine Arts`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'master_courses_template.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Import Master Database</h2>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CSV Format Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 font-medium mb-2">CSV Format Required:</p>
              <pre className="text-xs text-blue-800 bg-white p-3 rounded border border-blue-200 overflow-auto">
{`course_code,name,category
6101010,English I,English Language Arts
6101020,AP English Language and Composition,English Language Arts
132310,Physics I,Science`}
              </pre>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course CSV File *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="sr-only"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition ${
                    loading ? 'bg-gray-50' : 'hover:border-green-500 hover:bg-green-50'
                  }`}
                >
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {file ? (
                        <>
                          <span className="font-medium">{file.name}</span>
                          <br />
                          ({(file.size / 1024).toFixed(1)} KB)
                        </>
                      ) : (
                        <>
                          Click to select or drag and drop
                          <br />
                          <span className="text-gray-500">CSV file</span>
                        </>
                      )}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !file}
                className={`flex-1 px-6 py-3 font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                  loading || !file
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import CSV'
                )}
              </button>

              <button
                type="button"
                onClick={downloadTemplate}
                className="px-6 py-3 font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                Template
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Success */}
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Import Completed Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  Master courses are now ready for mapping
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Courses Imported</p>
                <p className="text-3xl font-bold text-gray-900">
                  {result.import_result.total_inserted}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Categories</p>
                <p className="text-3xl font-bold text-gray-900">
                  {result.import_result.categories}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">6-Digit Codes</p>
                <p className="text-3xl font-bold text-gray-900">
                  {result.import_result.six_digit_codes}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">7-Digit Codes</p>
                <p className="text-3xl font-bold text-gray-900">
                  {result.import_result.seven_digit_codes}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900 mb-2">
                <span className="font-medium">Database Triggers:</span>
              </p>
              <ul className="text-sm text-blue-900 space-y-1 ml-4">
                <li>Normalization triggers activated</li>
                <li>Honors designations normalized</li>
                <li>All courses indexed for mapping</li>
              </ul>
            </div>

            {/* Next Action */}
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-900 mb-3">
                <span className="font-medium">Next step:</span> Go to the Extraction page to
                upload school catalogs, then run the mapping engine.
              </p>
              <a
                href="/extract"
                className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                Extract Courses →
              </a>
            </div>

            {/* Import Again */}
            <button
              onClick={() => {
                setResult(null)
                setFile(null)
                setError(null)
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900">
          <span className="font-medium">What is the Master Database?</span> The official list
          of all courses offered by your state's education system. Extracted course catalogs
          will be matched against this database to create a comprehensive mapping.
        </p>
      </div>
    </div>
  )
}
