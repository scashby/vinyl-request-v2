'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from 'src/lib/supabaseClient';

type SoldItem = {
  id: number;
  status: string | null;
  location: string | null;
  purchase_price: number | null;
  current_value: number | null;
  date_added: string | null;
  release?: {
    id: number;
    media_type: string | null;
    release_year: number | null;
    master?: {
      title: string | null;
      artist?: { name: string | null } | null;
      cover_image_url: string | null;
    } | null;
  } | null;
};

const toSingle = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

export default function SaleItemsPage() {
  const [items, setItems] = useState<SoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadSoldItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('inventory')
        .select(
          `
          id,
          status,
          location,
          purchase_price,
          current_value,
          date_added,
          release:releases (
            id,
            media_type,
            release_year,
            master:masters (
              title,
              cover_image_url,
              artist:artists ( name )
            )
          )
        `
        )
        .eq('status', 'sold')
        .order('date_added', { ascending: false });

      if (fetchError) throw fetchError;

      const normalized = (data ?? []).map((row) => ({
        ...row,
        release: toSingle(row.release),
      })) as SoldItem[];

      setItems(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sold items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSoldItems();
  }, [loadSoldItems]);

  const restoreToActive = async (inventoryId: number) => {
    setSavingId(inventoryId);
    try {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ status: 'active' })
        .eq('id', inventoryId);
      if (updateError) throw updateError;
      setItems((prev) => prev.filter((item) => item.id !== inventoryId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 text-gray-800">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sold Items (V3)</h1>
          <p className="text-sm text-gray-600">Inventory items marked as sold.</p>
        </div>
        <button
          onClick={loadSoldItems}
          className="px-4 py-2 rounded bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300"
        >
          Refresh
        </button>
      </div>

      {loading && <div className="text-sm text-gray-600">Loading sold items…</div>}
      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {!loading && items.length === 0 && (
        <div className="text-sm text-gray-600">No sold items found.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Artist</th>
                <th className="py-2 pr-4">Year</th>
                <th className="py-2 pr-4">Format</th>
                <th className="py-2 pr-4">Location</th>
                <th className="py-2 pr-4">Purchase</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const release = item.release;
                const master = release?.master;
                const artist = master?.artist?.name ?? '';
                return (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-3 pr-4 font-semibold">{master?.title ?? 'Untitled'}</td>
                    <td className="py-3 pr-4">{artist}</td>
                    <td className="py-3 pr-4">{release?.release_year ?? '—'}</td>
                    <td className="py-3 pr-4">{release?.media_type ?? '—'}</td>
                    <td className="py-3 pr-4">{item.location ?? '—'}</td>
                    <td className="py-3 pr-4">{item.purchase_price ?? '—'}</td>
                    <td className="py-3 pr-4">{item.current_value ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => restoreToActive(item.id)}
                        disabled={savingId === item.id}
                        className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingId === item.id ? 'Updating…' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
