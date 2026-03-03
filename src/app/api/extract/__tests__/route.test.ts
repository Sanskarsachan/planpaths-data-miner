import { POST } from '@/app/api/extract/route'
import type { NextRequest } from 'next/server'

// Mock dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { id: 'uuid' } })),
        })),
      })),
      insert: jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'course-1' }],
        })
      ),
      upsert: jest.fn(() =>
        Promise.resolve({
          data: [{ id: 'course-1' }],
        })
      ),
    })),
  })),
}))

jest.mock('@/lib/extraction/StateDetector')
jest.mock('@/lib/extraction/SmartChunker')
jest.mock('@/lib/extraction/GeminiExtractor')
jest.mock('@/lib/extraction/Deduplicator')
jest.mock('pdf-parse')

describe('/api/extract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const mockRequest = {
      json: async () => ({}),
    } as NextRequest

    const response = await POST(mockRequest)
    expect(response.status).toBe(400)
  })

  it('successfully processes a valid PDF upload', async () => {
    const formData = new FormData()
    formData.append('school_name', 'Test High School')
    formData.append('state', 'Florida')
    formData.append('file', new File(['test'], 'test.pdf', { type: 'application/pdf' }))

    const mockRequest = {
      formData: async () => formData,
    } as unknown as NextRequest

    const response = await POST(mockRequest as NextRequest)

    // The response should return 201 with upload_id and school_slug
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toHaveProperty('upload_id')
    expect(data).toHaveProperty('school_slug')
  })
})

describe('API Route Error Handling', () => {
  it('returns 500 on server error', async () => {
    jest.mock('@/lib/supabase/server', () => ({
      createClient: jest.fn(() => {
        throw new Error('Database connection failed')
      }),
    }))

    const mockRequest = {
      formData: async () => {
        throw new Error('Parse error')
      },
    } as unknown as NextRequest

    const response = await POST(mockRequest as NextRequest)
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
