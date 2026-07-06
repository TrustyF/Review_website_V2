export interface TmdbMovieResponse {
  id: number
  title: string
  overview: string | null
  release_date: string | null
  runtime: number | 0
  budget: number | 0
  revenue: number | 0
  tagline: string | null
  imdb_id: string | null
  original_language: string | null
  vote_average: number | null
  origin_country: string[]
  genres: { id: number; name: string }[]
  production_companies: {
    id: number
    name: string
    logo_path: string | null
    origin_country: string
  }[]
  credits?: {
    cast: {
      id: number
      name: string
      character: string
      order: number
    }[]
    crew: {
      id: number
      name: string
      job: string
      department: string
    }[]
  }
}
