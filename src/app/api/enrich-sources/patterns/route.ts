import { NextResponse } from 'next/server';
import { getAuthHeader, supabaseServer } from 'src/lib/supabaseServer';
import {
  getDominantOutcome,
  recommendPatternAction,
} from 'lib/enrichmentDiagnostics';
import type {
  OutcomeCode,
  PatternActionCode,
  PatternRootCause,
} from 'types/enrichmentDiagnostics';

export const dynamic = 'force-dynamic';

const DEFAULT_MIN_ALBUMS = 50;
const DEFAULT_THRESHOLD_PCT = 80;
const MAX_ROWS = 200000;

type PatternResponseRow = {
  runId: string | null;
  field: string;
  source: string;
  sampleSize: number;
  dominantOutcome: OutcomeCode;
  dominantCount: number;
  dominantPct: number;
  counts: Partial<Record<OutcomeCode, number>>;
  rootCause: PatternRootCause;
  recommendedActionCode: PatternActionCode;
  recommendedActionText: string;
  patternFlag: boolean;
};

type DiagnosticReadRow = {
  run_id: string;
  album_id: number;
  field_name: string;
  source_name: string;
  outcome_code: OutcomeCode;
  has_candidate_value: boolean;
};

const parseIntParam = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asIso = (value: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
};

const keyForGroup = (field: string, source: string) => `${field}::${source}`;

export async function GET(request: Request) {
  const supabase = supabaseServer(getAuthHeader(request)) as any;

  try {
    const { searchParams } = new URL(request.url);
    const requestedRunId = searchParams.get('runId');
    const startDate = asIso(searchParams.get('startDate'));
    const endDate = asIso(searchParams.get('endDate'));
    const minAlbums = parseIntParam(searchParams.get('minAlbums'), DEFAULT_MIN_ALBUMS);
    const thresholdPct = parseIntParam(searchParams.get('thresholdPct'), DEFAULT_THRESHOLD_PCT);

    let effectiveRunId = requestedRunId;
    if (!effectiveRunId) {
      const latestResult = await supabase
        .from('enrichment_field_diagnostics')
        .select('run_id, created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (latestResult.error) {
        throw new Error(latestResult.error.message);
      }
      const latest = latestResult.data?.[0] as { run_id?: string } | undefined;
      effectiveRunId = latest?.run_id ?? null;
    }

    const fetchPage = async (from: number, to: number) => {
      let query = supabase
        .from('enrichment_field_diagnostics')
        .select('run_id, album_id, field_name, source_name, outcome_code, has_candidate_value, created_at')
        .order('created_at', { ascending: true });

      if (effectiveRunId) {
        query = query.eq('run_id', effectiveRunId);
      } else {
        if (startDate) {
          query = query.gte('created_at', startDate);
        }
        if (endDate) {
          query = query.lte('created_at', endDate);
        }
      }

      return query.range(from, to);
    };

    const rows: DiagnosticReadRow[] = [];
    const pageSize = 1000;
    let cursor = 0;
    while (cursor < MAX_ROWS) {
      const { data, error } = await fetchPage(cursor, cursor + pageSize - 1);
      if (error) throw new Error(error.message);
      const batch = (data ?? []) as DiagnosticReadRow[];
      if (batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < pageSize) break;
      cursor += pageSize;
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        runId: effectiveRunId,
        thresholds: { minAlbums, thresholdPct },
        patterns: [],
      });
    }

    type Bucket = {
      runId: string | null;
      field: string;
      source: string;
      sampleSize: number;
      hasCandidateValueCount: number;
      counts: Partial<Record<OutcomeCode, number>>;
    };
    const buckets = new Map<string, Bucket>();

    rows.forEach((row) => {
      const key = keyForGroup(row.field_name, row.source_name);
      if (!buckets.has(key)) {
        buckets.set(key, {
          runId: row.run_id ?? null,
          field: row.field_name,
          source: row.source_name,
          sampleSize: 0,
          hasCandidateValueCount: 0,
          counts: {},
        });
      }
      const bucket = buckets.get(key)!;
      bucket.sampleSize += 1;
      bucket.counts[row.outcome_code] = (bucket.counts[row.outcome_code] ?? 0) + 1;
      if (row.has_candidate_value) bucket.hasCandidateValueCount += 1;
    });

    const patterns: PatternResponseRow[] = [];
    buckets.forEach((bucket) => {
      const dominant = getDominantOutcome(bucket.counts);
      const dominantPct = bucket.sampleSize > 0 ? (dominant.count / bucket.sampleSize) * 100 : 0;
      const patternFlag = bucket.sampleSize >= minAlbums && dominantPct >= thresholdPct;
      const recommendation = recommendPatternAction(dominant.outcome, {
        hasCandidateValue: bucket.hasCandidateValueCount > 0,
      });

      patterns.push({
        runId: bucket.runId,
        field: bucket.field,
        source: bucket.source,
        sampleSize: bucket.sampleSize,
        dominantOutcome: dominant.outcome,
        dominantCount: dominant.count,
        dominantPct,
        counts: bucket.counts,
        rootCause: recommendation.rootCause,
        recommendedActionCode: recommendation.actionCode,
        recommendedActionText: recommendation.actionText,
        patternFlag,
      });
    });

    // If every source for a field is systematically "not_found", treat this as source-coverage gap.
    const flaggedByField = new Map<string, PatternResponseRow[]>();
    patterns
      .filter((row) => row.patternFlag)
      .forEach((row) => {
        if (!flaggedByField.has(row.field)) flaggedByField.set(row.field, []);
        flaggedByField.get(row.field)?.push(row);
      });

    flaggedByField.forEach((fieldRows) => {
      if (fieldRows.length === 0) return;
      const allNotFound = fieldRows.every((row) => row.dominantOutcome === 'not_found');
      if (!allNotFound) return;
      fieldRows.forEach((row) => {
        row.rootCause = 'likely_source_lacks_field';
        row.recommendedActionCode = 'remove_or_reroute_source_field';
        row.recommendedActionText = 'Field is consistently not found across selected sources; remove or reroute this field-source pairing.';
      });
    });

    patterns.sort((a, b) => {
      if (a.patternFlag !== b.patternFlag) return a.patternFlag ? -1 : 1;
      if (b.dominantPct !== a.dominantPct) return b.dominantPct - a.dominantPct;
      return b.sampleSize - a.sampleSize;
    });

    return NextResponse.json({
      success: true,
      runId: effectiveRunId,
      thresholds: { minAlbums, thresholdPct },
      patterns,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
