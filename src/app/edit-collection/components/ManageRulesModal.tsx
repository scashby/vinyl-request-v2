// src/app/edit-collection/components/ManageRulesModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface ManageRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define the RuleType explicitly so we can use it for casting
type RuleType = 'alias' | 'sort_exception' | 'ignore';

interface ArtistRule {
  id: number;
  search_pattern: string;
  replacement: string | null;
  rule_type: RuleType;
  created_at: string;
}

export function ManageRulesModal({ isOpen, onClose }: ManageRulesModalProps) {
  const [rules, setRules] = useState<ArtistRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPattern, setNewPattern] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newType, setNewType] = useState<RuleType>('sort_exception');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) loadRules();
  }, [isOpen]);

  const loadRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('artist_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRules(data as ArtistRule[]);
    }
    setLoading(false);
  };

  const handleAddRule = async () => {
    if (!newPattern.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('artist_rules').insert({
      search_pattern: newPattern.trim(),
      replacement: newReplacement.trim() || null,
      rule_type: newType
    });

    if (!error) {
      setNewPattern('');
      setNewReplacement('');
      await loadRules();
    }
    setSaving(false);
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Delete this rule?')) return;
    const { error } = await supabase.from('artist_rules').delete().eq('id', id);
    if (!error) {
      setRules(rules.filter(r => r.id !== id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[30005]" onClick={onClose}>
      <div className="bg-white rounded-lg w-[600px] h-[600px] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Artist Normalization Rules</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Add New Rule */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-3">Add New Rule</div>
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 px-3 py-2 border rounded text-sm"
              placeholder="Pattern (e.g. 'The The')"
              value={newPattern}
              onChange={e => setNewPattern(e.target.value)}
            />
            <select
              className="px-3 py-2 border rounded text-sm bg-white"
              value={newType}
              onChange={e => setNewType(e.target.value as RuleType)}
            >
              <option value="sort_exception">Sort Exception</option>
              <option value="alias">Alias (Rename)</option>
              <option value="ignore">Ignore</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border rounded text-sm"
              placeholder="Replacement (Optional)"
              value={newReplacement}
              onChange={e => setNewReplacement(e.target.value)}
              disabled={newType === 'ignore'}
            />
            <button
              onClick={handleAddRule}
              disabled={saving || !newPattern}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Rule'}
            </button>
          </div>
        </div>

        {/* Rules List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No rules defined yet.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 border-b border-gray-200">
                  <th className="pb-2 pl-2">Type</th>
                  <th className="pb-2">Pattern</th>
                  <th className="pb-2">Replacement</th>
                  <th className="pb-2 text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="py-3 pl-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        rule.rule_type === 'alias' ? 'bg-purple-100 text-purple-700' :
                        rule.rule_type === 'sort_exception' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {rule.rule_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-sm font-medium text-gray-900">{rule.search_pattern}</td>
                    <td className="py-3 text-sm text-gray-500">{rule.replacement || '—'}</td>
                    <td className="py-3 text-right pr-2">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}