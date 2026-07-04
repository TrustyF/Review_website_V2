export type TMDBCompany = {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

type TMDBCompanyMapped = {
  externalId: number
  name: string
  logoPath: string | null
  originCountry: string
}

export type TMDBMovieResponse = {
  budget?: number | null
  revenue?: number | null
  tagline?: string | null
  imdb_id?: string | null
  origin_country?: string[]
  production_companies?: TMDBCompany[]
}

export type TMDBMovie = {
  budget: number | null
  revenue: number | null
  tagline: string | null
  imdb_id: string | null
  origin_country: string
  production_companies: TMDBCompanyMapped[]
}
