/**
 * QuotaExhaustedModal Component
 * Modal shown when user tries to extract but quota is exhausted
 */

'use client'

import { AlertTriangle } from 'lucide-react'

interface QuotaExhaustedModalProps {
  isOpen: boolean
  resetAt: Date | null
  onClose: () => void
  onContactSupport?: () => void
}

export function QuotaExhaustedModal({
  isOpen,
  resetAt,
  onClose,
  onContactSupport,
}: QuotaExhaustedModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-full">
            <AlertTriangle className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Daily Quota Exhausted</h2>
            <p className="text-sm text-gray-600">You've used all 20 API requests for today</p>
          </div>
        </div>

        {/* Reset Info */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-4">
          <p className="text-sm text-blue-900">
            <strong>Your quota will reset:</strong>
          </p>
          <p className="text-sm text-blue-800 mt-1">
            {resetAt
              ? resetAt.toLocaleString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Unknown time'}
          </p>
        </div>

        {/* Options */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-900 mb-2">What can you do?</p>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span>•</span>
              <span>Wait until midnight UTC for your daily quota to reset</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Contact support to add more API keys to your pool</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>Schedule your extractions to use the quota more efficiently</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 font-medium"
          >
            Close
          </button>
          {onContactSupport && (
            <button
              onClick={onContactSupport}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              Contact Support
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
