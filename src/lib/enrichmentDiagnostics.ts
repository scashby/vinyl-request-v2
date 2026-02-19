import type {
  FieldDiagnosticRow,
  OutcomeCode,
  PatternRecommendation,
  PatternRootCause,
  SourceDiagnostic,
} from 'types/enrichmentDiagnostics';

const isMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => isMeaningfulValue(item));
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const toCompactReason = (reason?: string): string => {
  if (!reason) return '';
  return reason.replace(/\s+/g, ' ').trim();
};

export const parseHttpStatusFromReason = (reason?: string): number | null => {
  const compact = toCompactReason(reason);
  if (!compact) return null;
  const candidates = [
    compact.match(/\((\d{3})\)/),
    compact.match(/\bstatus[:=\s]+(\d{3})\b/i),
    compact.match(/\bhttp[:=\s]+(\d{3})\b/i),
    compact.match(/\bapi\s+(\d{3})\b/i),
  ];
  for (const match of candidates) {
    const parsed = Number(match?.[1] ?? NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const classifyErrorOutcome = (
  status: number | null,
  reason?: string,
  fallback: OutcomeCode = 'source_error_http_other'
): OutcomeCode => {
  const compact = toCompactReason(reason).toLowerCase();
  if (status === 401 || status === 403) return 'source_error_auth';
  if (status === 429 || compact.includes('retry-after') || compact.includes('rate limit')) {
    return 'source_error_rate_limit';
  }
  if (compact.includes('timed out') || compact.includes('timeout')) return 'source_error_timeout';
  if (compact.includes('non-json') || compact.includes('invalid json') || compact.includes('parse')) {
    return 'source_error_parse';
  }
  if (typeof status === 'number' && status >= 400) return 'source_error_http_other';
  return fallback;
};

const classifyNoDataOutcome = (status: number | null, reason?: string): OutcomeCode => {
  const compact = toCompactReason(reason).toLowerCase();
  if (
    compact.includes('service unavailable') ||
    compact.includes('oauth cookie missing') ||
    compact.includes('missing discogs oauth')
  ) {
    return 'source_unavailable';
  }
  if (compact.includes('not found') || compact.includes('no match') || compact.includes('artist not found')) {
    return 'not_found';
  }
  if (status === 401 || status === 403) return 'source_error_auth';
  if (status === 429 || compact.includes('retry-after') || compact.includes('rate limit')) {
    return 'source_error_rate_limit';
  }
  if (compact.includes('timed out') || compact.includes('timeout')) return 'source_error_timeout';
  if (compact.includes('non-json') || compact.includes('invalid json')) return 'source_error_parse';
  if (typeof status === 'number' && status >= 400) return 'source_error_http_other';
  return 'not_found';
};

export const classifyOutcomeCode = (
  args: {
    diag: SourceDiagnostic | undefined;
    attempted: boolean;
    returnedKeys: string[];
    candidateKeys: string[];
    sourcePayload?: Record<string, unknown>;
    reason?: string;
  }
): { outcomeCode: OutcomeCode; httpStatus: number | null; hasCandidateValue: boolean; hitKeys: string[] } => {
  const { diag, attempted, returnedKeys, candidateKeys, sourcePayload, reason } = args;
  const hitKeys = candidateKeys.filter((key) => returnedKeys.includes(key));
  const hasCandidateValue = hitKeys.some((key) => isMeaningfulValue(sourcePayload?.[key]));
  const status = parseHttpStatusFromReason(reason ?? diag?.reason);

  if (!attempted || !diag) {
    return { outcomeCode: 'source_not_called', httpStatus: null, hasCandidateValue: false, hitKeys: [] };
  }

  if (diag.status === 'returned') {
    if (hitKeys.length > 0 && hasCandidateValue) {
      return { outcomeCode: 'returned_target_field', httpStatus: status, hasCandidateValue, hitKeys };
    }
    return { outcomeCode: 'returned_other_fields', httpStatus: status, hasCandidateValue: false, hitKeys: [] };
  }

  if (diag.status === 'error') {
    return {
      outcomeCode: classifyErrorOutcome(status, reason ?? diag.reason),
      httpStatus: status,
      hasCandidateValue: false,
      hitKeys: [],
    };
  }

  return {
    outcomeCode: classifyNoDataOutcome(status, reason ?? diag.reason),
    httpStatus: status,
    hasCandidateValue: false,
    hitKeys: [],
  };
};

export const buildFieldDiagnosticsForAlbum = (args: {
  runId: string;
  albumId: number;
  selectedFields: string[];
  activeFieldConfig: Record<string, Set<string>>;
  candidates: Record<string, unknown>;
  sourceDiagnostics?: Record<string, SourceDiagnostic>;
  attemptedSources?: string[];
  sourceFieldCoverage?: Record<string, string[]>;
  candidateKeysForField: (field: string) => string[];
  toDiagnosticsSourceKey: (source: string) => string;
}): FieldDiagnosticRow[] => {
  const {
    runId,
    albumId,
    selectedFields,
    activeFieldConfig,
    candidates,
    sourceDiagnostics,
    attemptedSources,
    sourceFieldCoverage,
    candidateKeysForField,
    toDiagnosticsSourceKey,
  } = args;

  const rows: FieldDiagnosticRow[] = [];
  selectedFields.forEach((field) => {
    const allowedSources = Array.from(activeFieldConfig[field] ?? []);
    const candidateKeys = candidateKeysForField(field);
    allowedSources.forEach((source) => {
      const diagSource = toDiagnosticsSourceKey(source);
      const diag = sourceDiagnostics?.[diagSource];
      const attempted = attemptedSources?.includes(diagSource) ?? false;
      const returnedKeys = sourceFieldCoverage?.[diagSource] ?? [];
      const sourcePayload = (candidates[diagSource] ?? candidates[source]) as Record<string, unknown> | undefined;
      const classified = classifyOutcomeCode({
        diag,
        attempted,
        returnedKeys,
        candidateKeys,
        sourcePayload,
      });

      rows.push({
        run_id: runId,
        album_id: albumId,
        field_name: field,
        source_name: source,
        outcome_code: classified.outcomeCode,
        http_status: classified.httpStatus,
        reason: toCompactReason(diag?.reason) || null,
        returned_keys: returnedKeys,
        has_candidate_value: classified.hasCandidateValue,
      });
    });
  });
  return rows;
};

export const recommendPatternAction = (
  dominantOutcome: OutcomeCode,
  opts?: { hasCandidateValue?: boolean; returnedTargetButNoApply?: boolean }
): PatternRecommendation => {
  if (dominantOutcome === 'source_error_auth') {
    return {
      rootCause: 'systemic_auth_or_access_issue',
      actionCode: 'check_auth_flow',
      actionText: 'Check oauth/token headers/cookie/session flow.',
    };
  }
  if (dominantOutcome === 'source_error_rate_limit') {
    return {
      rootCause: 'systemic_auth_or_access_issue',
      actionCode: 'check_rate_limits',
      actionText: 'Review throttling, retry-after handling, and source queue timing.',
    };
  }
  if (dominantOutcome === 'source_error_parse') {
    return {
      rootCause: 'systemic_request_or_parsing_issue',
      actionCode: 'check_request_and_parser',
      actionText: 'Inspect response content type/body and parsing fallback logic.',
    };
  }
  if (dominantOutcome === 'source_error_timeout' || dominantOutcome === 'source_error_http_other') {
    return {
      rootCause: 'systemic_request_or_parsing_issue',
      actionCode: 'check_request_and_parser',
      actionText: 'Inspect request shape, endpoint behavior, and timeout handling.',
    };
  }
  if (dominantOutcome === 'returned_other_fields') {
    return {
      rootCause: 'systemic_mapping_or_apply_gap',
      actionCode: 'check_field_mapping',
      actionText: 'Source returned data but not the target field; check field mapping/candidate keys.',
    };
  }
  if (dominantOutcome === 'returned_target_field' && opts?.returnedTargetButNoApply) {
    return {
      rootCause: 'systemic_mapping_or_apply_gap',
      actionCode: 'check_apply_write_path',
      actionText: 'Target field is returned but not persisted; check apply/mapping write path.',
    };
  }
  if (dominantOutcome === 'not_found') {
    return {
      rootCause: 'likely_source_lacks_field',
      actionCode: 'remove_or_reroute_source_field',
      actionText: 'Likely missing at this source; remove or reroute this field-source pairing.',
    };
  }
  return {
    rootCause: 'mixed_expected_variability',
    actionCode: 'observe_no_action',
    actionText: 'Mixed outcomes are expected; no immediate action.',
  };
};

export const getDominantOutcome = (counts: Partial<Record<OutcomeCode, number>>): {
  outcome: OutcomeCode;
  count: number;
} => {
  const entries = Object.entries(counts) as Array<[OutcomeCode, number]>;
  if (entries.length === 0) return { outcome: 'source_not_called', count: 0 };
  const [outcome, count] = entries.reduce((best, current) => (current[1] > best[1] ? current : best));
  return { outcome, count };
};

export const rootCauseFromOutcome = (outcome: OutcomeCode): PatternRootCause =>
  recommendPatternAction(outcome).rootCause;
