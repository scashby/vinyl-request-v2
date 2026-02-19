export type OutcomeCode =
  | 'returned_target_field'
  | 'returned_other_fields'
  | 'not_found'
  | 'source_error_auth'
  | 'source_error_rate_limit'
  | 'source_error_timeout'
  | 'source_error_http_other'
  | 'source_error_parse'
  | 'source_not_called'
  | 'source_unavailable';

export type PatternRootCause =
  | 'systemic_auth_or_access_issue'
  | 'systemic_request_or_parsing_issue'
  | 'systemic_mapping_or_apply_gap'
  | 'likely_source_lacks_field'
  | 'mixed_expected_variability';

export type PatternActionCode =
  | 'check_auth_flow'
  | 'check_rate_limits'
  | 'check_request_and_parser'
  | 'check_field_mapping'
  | 'check_apply_write_path'
  | 'remove_or_reroute_source_field'
  | 'observe_no_action';

export type SourceDiagnosticStatus = 'returned' | 'no_data' | 'error';

export type SourceDiagnostic = {
  status: SourceDiagnosticStatus;
  reason?: string;
};

export type FieldDiagnosticRow = {
  run_id: string;
  album_id: number;
  field_name: string;
  source_name: string;
  outcome_code: OutcomeCode;
  http_status: number | null;
  reason: string | null;
  returned_keys: string[];
  has_candidate_value: boolean;
  created_at?: string;
};

export type PatternRecommendation = {
  rootCause: PatternRootCause;
  actionCode: PatternActionCode;
  actionText: string;
};

export type PatternRow = {
  runId: string | null;
  field: string;
  source: string;
  sampleSize: number;
  dominantOutcome: OutcomeCode;
  dominantCount: number;
  dominantPct: number;
  counts: Partial<Record<OutcomeCode, number>>;
  recommendedActionCode: PatternActionCode;
  recommendedActionText: string;
  rootCause: PatternRootCause;
  patternFlag: boolean;
};
