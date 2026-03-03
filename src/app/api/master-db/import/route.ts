import { createClient } from '@/lib/supabase/server'
import { IncomingForm } from 'formidable'
import * as fs from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: Request) {
  try {
    const form = new IncomingForm()
    const [, files] = await form.parse(req as any)

    const csvFile = Array.isArray(files.file) ? files.file[0] : files.file?.[0]
    if (!csvFile) {
      return Response.json(
        { error: 'No CSV file provided' },
        { status: 400 }
      )
    }

    // Read CSV file
    const buffer = await fs.promises.readFile(csvFile.filepath)
    const csv = buffer.toString('utf-8')
    const lines = csv.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return Response.json(
        { error: 'CSV file must contain header and at least one row' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Parse CSV (expected: course_code,name,category)
    const courses: Array<{
      course_code: string
      name: string
      category: string
    }> = []

    for (let i = 1; i < lines.length; i++) {
      const [code, name, category] = lines[i].split(',').map(x => x.trim())
      if (code && name && category) {
        courses.push({ course_code: code, name, category })
      }
    }

    // Insert into staging
    const { error: stageError } = await supabase
      .from('fl_master_staging')
      .insert(courses)
      .select('*')

    if (stageError) {
      return Response.json(
        { error: stageError.message },
        { status: 500 }
      )
    }

    // Call import function
    const { data: result, error: importError } = await supabase
      .rpc('import_florida_master_db')

    if (importError) {
      return Response.json(
        { error: importError.message },
        { status: 500 }
      )
    }

    return Response.json(
      {
        staged_count: courses.length,
        import_result: result,
      },
      { status: 201 }
    )
  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
