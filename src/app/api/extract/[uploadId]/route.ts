export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  await params
  return Response.json(
    { error: 'Not yet implemented' },
    { status: 501 }
  )
}
