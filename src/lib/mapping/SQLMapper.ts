import { createClient } from '@/lib/supabase/server'
import type { MappingPassSummary, StateCode } from '@/types/database'

const MAPPING_FUNCTION: Record<StateCode, string> = {
  FL: 'run_florida_mapping',
  TX: 'run_texas_mapping',
  CA: 'run_california_mapping',
}

export async function runMapping(
  schoolSlug: string,
  stateCode: StateCode,
  reset = false
): Promise<MappingPassSummary[]> {
  const supabase = createClient()

  const fn = reset ? 'reset_and_remap_school' : MAPPING_FUNCTION[stateCode]
  if (!fn) throw new Error(`No mapping function for state: ${stateCode}`)

  const { data, error } = await supabase
    .rpc(fn, { p_school_slug: schoolSlug })

  if (error) throw new Error(`Mapping RPC failed: ${error.message}`)
  return (data as MappingPassSummary[]) ?? []
}
