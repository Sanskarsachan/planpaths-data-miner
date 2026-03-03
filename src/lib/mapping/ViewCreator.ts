import { createClient } from '@/lib/supabase/server'

// Creates a named SQL view for a school:
//   CREATE VIEW view_lincoln_high_miami_fl AS
//   SELECT * FROM vw_school_courses WHERE school_slug = 'lincoln-high-miami-fl'
// This gives the "school has its own table" UX in the Supabase dashboard.
export async function ensureSchoolView(schoolSlug: string): Promise<void> {
  const supabase = createClient()
  const viewName = `view_${schoolSlug.replace(/-/g, '_')}`

  const { error } = await supabase.rpc('create_school_view', {
    p_view_name: viewName,
    p_school_slug: schoolSlug,
  })

  if (error) {
    // View already exists is acceptable
    if (!error.message.includes('already exists')) {
      console.error('ViewCreator error:', error.message)
    }
  }
}
