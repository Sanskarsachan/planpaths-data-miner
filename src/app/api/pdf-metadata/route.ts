export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const fileEntry = formData.get('file')

    if (!(fileEntry instanceof Blob)) {
      return Response.json({ error: 'Missing file' }, { status: 400 })
    }

    const pdfParse = (await import('pdf-parse')).default
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer())
    const pdfData = await pdfParse(fileBuffer)

    const numPages = Number(pdfData.numpages || 1)

    return Response.json({
      numPages: Number.isFinite(numPages) && numPages > 0 ? numPages : 1,
      info: pdfData.info || null,
      metadata: pdfData.metadata || null,
    })
  } catch (error: any) {
    console.error('[pdf-metadata] parse error:', error?.message || error)
    return Response.json({ error: 'Failed to parse PDF', numPages: 1 }, { status: 500 })
  }
}
