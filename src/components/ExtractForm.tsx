'use client'

import React, { useState, useCallback } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
]

interface ExtractionResult {
  upload_id: string
  school_slug: string
  status: 'processing' | 'complete' | 'failed'
  courses_found?: number
  dupes_removed?: number
  processing_ms?: number
  error_message?: string
}

export function ExtractForm() {
  const [schoolName, setSchoolName] = useState('')
  const [state, setState] = useState('Florida')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusChecking, setStatusChecking] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('File must be smaller than 50MB')
        return
      }
      if (!selectedFile.type.includes('pdf')) {
        setError('File must be a PDF')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const pollStatus = useCallback(async (uploadId: string) => {
    setStatusChecking(true)
    let isComplete = false
    let attempts = 0
    const maxAttempts = 60 // 2 minutes max

    while (!isComplete && attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/extract/${uploadId}`)
        const data = await response.json()

        setResult(data)

        if (data.status === 'complete' || data.status === 'failed') {
          isComplete = true
        } else {
          // Wait 2 seconds before next poll
          await new Promise(resolve => setTimeout(resolve, 2000))
          attempts++
        }
      } catch (err) {
        console.error('Error polling status:', err)
        await new Promise(resolve => setTimeout(resolve, 2000))
        attempts++
      }
    }

    setStatusChecking(false)
    setLoading(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (!schoolName.trim()) {
      setError('School name is required')
      return
    }

    if (!file) {
      setError('PDF file is required')
      return
    }

    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('school_name', schoolName)
      formData.append('state', state)
      formData.append('file', file)

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setResult({ ...data, status: 'processing' })

      // Start polling
      await pollStatus(data.upload_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">Extract Courses from PDF</h2>

        {!result ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* School Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                School Name *
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="e.g., Orlando High School"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* State Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State *
              </label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              >
                {US_STATES.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Catalog PDF *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="sr-only"
                  id="pdf-upload"
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition ${
                    loading ? 'bg-gray-50' : 'hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {file ? (
                        <>
                          <span className="font-medium">{file.name}</span>
                          <br />
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </>
                      ) : (
                        <>
                          Click to select or drag and drop
                          <br />
                          <span className="text-gray-500">PDF up to 50MB</span>
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !schoolName.trim() || !file}
              className={`w-full px-6 py-3 font-medium rounded-lg transition flex items-center justify-center gap-2 ${
                loading || !schoolName.trim() || !file
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {statusChecking ? 'Extracting...' : 'Uploading...'}
                </>
              ) : (
                'Extract Courses'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Result Status */}
            <div
              className={`flex items-center gap-3 p-4 rounded-lg ${
                result.status === 'complete'
                  ? 'bg-green-50 border border-green-200'
                  : result.status === 'failed'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-blue-50 border border-blue-200'
              }`}
            >
              {result.status === 'processing' ? (
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
              ) : result.status === 'complete' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    result.status === 'complete'
                      ? 'text-green-800'
                      : result.status === 'failed'
                        ? 'text-red-800'
                        : 'text-blue-800'
                  }`}
                >
                  {result.status === 'processing'
                    ? 'Extraction in progress...'
                    : result.status === 'complete'
                      ? 'Extraction completed successfully'
                      : 'Extraction failed'}
                </p>
                {result.status === 'processing' && (
                  <p className="text-sm text-blue-600 mt-1">
                    Upload ID: {result.upload_id}
                  </p>
                )}
              </div>
            </div>

            {/* Results */}
            {result.status === 'complete' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Courses Found</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {result.courses_found}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Duplicates Removed</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {result.dupes_removed}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Processing Time</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(result.processing_ms! / 1000).toFixed(1)}s
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">School Slug</p>
                  <p className="text-lg font-mono text-gray-900">
                    {result.school_slug}
                  </p>
                </div>
              </div>
            )}

            {result.status === 'failed' && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-800">Error Details</p>
                <p className="text-sm text-red-700 mt-1">{result.error_message}</p>
              </div>
            )}

            {/* Next Action */}
            {result.status === 'complete' && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900 mb-3">
                  <span className="font-medium">Next step:</span> Go to the Mapping
                  page to run the 27-pass course matching engine.
                </p>
                <a
                  href="/mapping"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  View Mapping Results →
                </a>
              </div>
            )}

            {/* Reset Button */}
            <button
              onClick={() => {
                setResult(null)
                setSchoolName('')
                setFile(null)
                setError(null)
              }}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Extract Another PDF
            </button>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <span className="font-medium">How it works:</span> Upload a school course catalog
          PDF. The system will automatically extract course codes, names, and categories using
          AI, then store them in the database for mapping to your state's master database.
        </p>
      </div>
    </div>
  )
}
