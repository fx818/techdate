export interface DatingProfile {
  id: string
  name: string
  photo_url: string | null
  city: string
  genres: string[]
  xp: number
  bio: string | null
}
