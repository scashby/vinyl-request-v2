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
  | 'owner' | 'personal_notes' | 'release_notes' | 'barcode' | 'catalog_number' | 'label' | 'status'
  // Text fields - Condition
  | 'sleeve_condition' | 'media_condition'
  // Number fields
  | 'year_int' | 'play_count'
  | 'purchase_price' | 'current_value'
  // Date fields
  | 'date_added' | 'purchase_date' | 'last_played_at'
  // Array fields (special handling)
  | 'tags'
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
