export async function GET(req: Request, { params }: { params: { uploadId: string } }) {
  return Response.json(
    { error: 'Not yet implemented' },
    { status: 501 }
  )
}
