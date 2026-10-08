import type { FileType } from '@/lib/api/types'

export type Sample = { file: string; title: string; type: FileType; description: string }

/** Copies of backend/sample_data (except the deliberately broken file), served from /samples. */
export const SAMPLES: readonly Sample[] = [
  {
    file: 'mine_site_survey.kml',
    title: 'Mine site survey',
    type: 'KML',
    description:
      'Polygons with a hole and a self-intersection, lines, a point, a drone flight path and an unsupported 3D model.',
  },
  {
    file: 'parcels_utm43n.zip',
    title: 'Land parcels',
    type: 'SHAPEFILE',
    description: 'Two layers, parcels and access roads, already projected in UTM zone 43N.',
  },
  {
    file: 'web_mercator_square.zip',
    title: 'Web Mercator trap',
    type: 'SHAPEFILE',
    description: 'A 1,000 × 1,000 “metre” square in Web Mercator that covers 944,917 m² on the ground.',
  },
]

/** Fetches a bundled sample as a File, so it goes through exactly the same upload flow as a user's file. */
export async function loadSample(sample: Sample): Promise<File> {
  const response = await fetch(`/samples/${sample.file}`)
  if (!response.ok) throw new Error(`Sample ${sample.file} is missing (HTTP ${response.status}).`)
  return new File([await response.blob()], sample.file)
}
