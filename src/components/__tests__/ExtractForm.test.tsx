import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExtractForm } from '@/components/ExtractForm'

// Mock fetch globally
global.fetch = jest.fn()

describe('ExtractForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the form with all required fields', () => {
    render(<ExtractForm />)

    expect(screen.getByText('Extract Courses from PDF')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Orlando High School/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Florida')).toBeInTheDocument()
    expect(screen.getByLabelText(/Course Catalog PDF/i)).toBeInTheDocument()
  })

  it('disables submit button when form is empty', () => {
    render(<ExtractForm />)

    const submitButton = screen.getByRole('button', { name: /Extract Courses/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit button when form is filled', () => {
    render(<ExtractForm />)

    const schoolInput = screen.getByPlaceholderText(/Orlando High School/i)
    const fileInput = screen.getByLabelText(/Course Catalog PDF/i) as HTMLInputElement

    fireEvent.change(schoolInput, { target: { value: 'Test High School' } })

    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const submitButton = screen.getByRole('button', { name: /Extract Courses/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('rejects non-PDF files', () => {
    render(<ExtractForm />)

    const fileInput = screen.getByLabelText(/Course Catalog PDF/i) as HTMLInputElement
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(screen.getByText(/File must be a PDF/i)).toBeInTheDocument()
  })

  it('rejects files larger than 50MB', () => {
    render(<ExtractForm />)

    const fileInput = screen.getByLabelText(/Course Catalog PDF/i) as HTMLInputElement

    // Create a mock file larger than 50MB
    const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.pdf', {
      type: 'application/pdf',
    })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByText(/File must be smaller than 50MB/i)).toBeInTheDocument()
  })

  it('submits form with correct data', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        upload_id: 'test-uuid',
        school_slug: 'test-school',
      }),
    })

    render(<ExtractForm />)

    const schoolInput = screen.getByPlaceholderText(/Orlando High School/i)
    const fileInput = screen.getByLabelText(/Course Catalog PDF/i) as HTMLInputElement
    const submitButton = screen.getByRole('button', { name: /Extract Courses/i })

    fireEvent.change(schoolInput, { target: { value: 'Test High School' } })

    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/extract',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      )
    })
  })

  it('displays error message on submission failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Upload failed: invalid PDF',
      }),
    })

    render(<ExtractForm />)

    const schoolInput = screen.getByPlaceholderText(/Orlando High School/i)
    const fileInput = screen.getByLabelText(/Course Catalog PDF/i) as HTMLInputElement
    const submitButton = screen.getByRole('button', { name: /Extract Courses/i })

    fireEvent.change(schoolInput, { target: { value: 'Test High School' } })

    const file = new File(['test pdf content'], 'test.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument()
    })
  })
})
