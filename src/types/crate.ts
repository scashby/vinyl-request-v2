// src/types/crate.ts
export interface Crate {
  id: number;
  name: string;
  icon: string;
  color: string;
  is_smart: boolean;
  smart_rules: SmartRules | null;
  match_rules: 'all' | 'any';
  live_update: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  album_count?: number; // Calculated on frontend
}

export interface SmartRules {
  rules: SmartRule[];
}

export interface SmartRule {
  field: CrateFieldType;
  operator: CrateOperatorType;
  value: string | number | boolean;
}

// All database fields that can be used in smart crate rules
export type CrateFieldType = 
  // Text fields - Basic
  | 'artist' | 'title' | 'format' | 'country' | 'location' 
  | 'owner' | 'notes' | 'barcode' | 'cat_no'
  // Text fields - Packaging & Condition
  | 'packaging' | 'package_sleeve_condition' | 'media_condition'
  // Text fields - Vinyl Details
  | 'vinyl_weight' | 'rpm' | 'sound' | 'spars_code' | 'studio'
  // Text fields - Personal
  | 'purchase_store' | 'box_set'
  // Text fields - Classical
  | 'composer' | 'conductor' | 'chorus' | 'composition' | 'orchestra'
  // Number fields
  | 'year_int' | 'my_rating' | 'play_count' | 'discs' | 'sides' | 'index_number'
  | 'purchase_price' | 'current_value'
  // Date fields
  | 'date_added' | 'purchase_date' | 'last_played_date' 
  | 'original_release_date' | 'recording_date' | 'last_cleaned_date'
  // Boolean fields
  | 'for_sale' | 'is_live' | 'is_1001'
  // Array fields (special handling)
  | 'custom_tags' | 'discogs_genres' | 'spotify_genres' | 'labels' | 'signed_by'
  | 'songwriters' | 'producers' | 'engineers' | 'musicians'
  // Derived fields
  | 'decade';

export type CrateOperatorType = 
  // Text operators
  | 'contains' | 'is' | 'is_not' | 'does_not_contain'
  // Number operators
  | 'greater_than' | 'less_than' | 'greater_than_or_equal_to' | 'less_than_or_equal_to'
  // Date operators
  | 'before' | 'after'
  // Array operators
  | 'includes' | 'excludes';