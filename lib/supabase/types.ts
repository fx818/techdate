export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type InterestVector = Record<string, number>

export type XpAction = 'like' | 'comment' | 'reply' | 'post' | 'profile_complete' | 'login_streak'

export type Gender = 'male' | 'female' | 'non_binary'

export type Preference = 'male' | 'female' | 'everyone'

export type SwipeDirection = 'left' | 'right'

export type PostSource = 'hackernews' | 'devto' | 'xcom' | 'user'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          phone: string | null
          name: string
          bio: string | null
          city: string
          gender: Gender
          preference: Preference
          photo_url: string | null
          genres: string[]
          xp: number
          dating_unlocked: boolean
          interest_vector: InterestVector
          is_premium: boolean
          last_active: string
          created_at: string
          last_login_date: string | null
          streak_count: number
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'xp' | 'dating_unlocked' | 'is_premium' | 'last_login_date' | 'streak_count'>
        Update: Partial<Database['public']['Tables']['users']['Row']>
      }
      posts: {
        Row: {
          id: string
          author_id: string | null
          is_gideon: boolean
          title: string
          content: string | null
          url: string | null
          genre: string
          source: PostSource
          likes_count: number
          comments_count: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'created_at' | 'likes_count' | 'comments_count'>
        Update: Partial<Database['public']['Tables']['posts']['Row']>
      }
      comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          parent_id: string | null
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Row']>
      }
      likes: {
        Row: { id: string; user_id: string; post_id: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['likes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      xp_events: {
        Row: { id: string; user_id: string; action: XpAction; xp_awarded: number; created_at: string }
        Insert: Omit<Database['public']['Tables']['xp_events']['Row'], 'id' | 'created_at'>
        Update: never
      }
      swipes: {
        Row: { id: string; swiper_id: string; swiped_id: string; direction: SwipeDirection; created_at: string }
        Insert: Omit<Database['public']['Tables']['swipes']['Row'], 'id' | 'created_at'>
        Update: never
      }
      matches: {
        Row: { id: string; user1_id: string; user2_id: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at'>
        Update: never
      }
      messages: {
        Row: { id: string; match_id: string; sender_id: string; content: string; created_at: string }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
