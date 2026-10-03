export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      card_keys: {
        Row: {
          game_id: string
          idx: number
          kind: string
        }
        Insert: {
          game_id: string
          idx: number
          kind: string
        }
        Update: {
          game_id?: string
          idx?: number
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_keys_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          game_id: string
          idx: number
          revealed: boolean
          revealed_by: string | null
          revealed_kind: string | null
          word: string
        }
        Insert: {
          game_id: string
          idx: number
          revealed?: boolean
          revealed_by?: string | null
          revealed_kind?: string | null
          word: string
        }
        Update: {
          game_id?: string
          idx?: number
          revealed?: boolean
          revealed_by?: string | null
          revealed_kind?: string | null
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      clues: {
        Row: {
          count: number
          created_at: string
          game_id: string
          id: string
          spymaster_id: string
          team: string
          word: string
        }
        Insert: {
          count: number
          created_at?: string
          game_id: string
          id?: string
          spymaster_id: string
          team: string
          word: string
        }
        Update: {
          count?: number
          created_at?: string
          game_id?: string
          id?: string
          spymaster_id?: string
          team?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "clues_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          game_id: string
          joined_at: string
          role: string
          team: string
          user_id: string
        }
        Insert: {
          game_id: string
          joined_at?: string
          role?: string
          team?: string
          user_id: string
        }
        Update: {
          game_id?: string
          joined_at?: string
          role?: string
          team?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          clue_count: number | null
          clue_word: string | null
          code: string
          created_at: string
          current_team: string | null
          guesses_left: number | null
          host_id: string
          id: string
          phase: string | null
          starting_team: string | null
          status: string
          updated_at: string
          win_reason: string | null
          winner: string | null
        }
        Insert: {
          clue_count?: number | null
          clue_word?: string | null
          code: string
          created_at?: string
          current_team?: string | null
          guesses_left?: number | null
          host_id: string
          id?: string
          phase?: string | null
          starting_team?: string | null
          status?: string
          updated_at?: string
          win_reason?: string | null
          winner?: string | null
        }
        Update: {
          clue_count?: number | null
          clue_word?: string | null
          code?: string
          created_at?: string
          current_team?: string | null
          guesses_left?: number | null
          host_id?: string
          id?: string
          phase?: string | null
          starting_team?: string | null
          status?: string
          updated_at?: string
          win_reason?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          op_assassin: number
          op_bystander: number
          op_correct: number
          op_games: number
          op_wins: number
          op_wrong: number
          sm_assassin: number
          sm_cards_cleared: number
          sm_clues: number
          sm_games: number
          sm_wins: number
          user_id: string
        }
        Insert: {
          op_assassin?: number
          op_bystander?: number
          op_correct?: number
          op_games?: number
          op_wins?: number
          op_wrong?: number
          sm_assassin?: number
          sm_cards_cleared?: number
          sm_clues?: number
          sm_games?: number
          sm_wins?: number
          user_id: string
        }
        Update: {
          op_assassin?: number
          op_bystander?: number
          op_correct?: number
          op_games?: number
          op_wins?: number
          op_wrong?: number
          sm_assassin?: number
          sm_cards_cleared?: number
          sm_clues?: number
          sm_games?: number
          sm_wins?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_key: { Args: { _game: string; _uid: string }; Returns: boolean }
      choose_seat: {
        Args: { _game: string; _role: string; _team: string }
        Returns: undefined
      }
      create_game: { Args: never; Returns: string }
      end_turn: { Args: { _game: string }; Returns: undefined }
      finish_game: {
        Args: { _game: string; _reason: string; _winner: string }
        Returns: undefined
      }
      give_clue: {
        Args: { _count: number; _game: string; _word: string }
        Returns: undefined
      }
      join_game: { Args: { _code: string }; Returns: string }
      leave_game: { Args: { _game: string }; Returns: undefined }
      make_guess: { Args: { _game: string; _idx: number }; Returns: string }
      start_game: { Args: { _game: string }; Returns: undefined }
      switch_turn: { Args: { _game: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
