import { NextResponse } from 'next/server';
import { supabaseAdmin } from 'src/lib/supabaseAdmin';
import { hasSaleSmartRule, isSaleFolderName, SALE_SMART_RULES } from 'src/lib/saleUtils';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const { data: crates, error } = await supabaseAdmin
      .from('crates')
      .select('id, name, icon, color, is_smart, smart_rules, sort_order');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const existingByRule = (crates ?? []).find((crate) => hasSaleSmartRule(crate.smart_rules));
    if (existingByRule?.id) {
      return NextResponse.json({ ok: true, id: existingByRule.id });
    }

    const existingByName = (crates ?? []).find((crate) => isSaleFolderName(crate.name));
    if (existingByName?.id) {
      const { error: updateError } = await supabaseAdmin
        .from('crates')
        .update({
          is_smart: true,
          smart_rules: SALE_SMART_RULES,
          match_rules: 'all',
          live_update: true,
          icon: existingByName.icon || '💰',
          color: existingByName.color || '#d97706',
        })
        .eq('id', existingByName.id);

      if (updateError) {
        return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, id: existingByName.id });
    }

    const maxSortOrder = (crates ?? []).reduce((max, crate) => {
      const value = typeof crate.sort_order === 'number' ? crate.sort_order : 0;
      return Math.max(max, value);
    }, -1);

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('crates')
      .insert({
        name: 'Sale',
        icon: '💰',
        color: '#d97706',
        is_smart: true,
        smart_rules: SALE_SMART_RULES,
        match_rules: 'all',
        live_update: true,
        sort_order: maxSortOrder + 1,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      return NextResponse.json({ ok: false, error: insertError?.message || 'Failed to create sale crate' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
