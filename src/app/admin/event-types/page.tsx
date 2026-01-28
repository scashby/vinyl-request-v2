"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "lib/supabaseClient";
import { Container } from "components/ui/Container";
import { Button } from "components/ui/Button";
import {
  defaultEventTypeConfig,
  type EventSubtypeConfig,
  type EventTypeConfig,
  type EventTypeConfigState,
} from "src/lib/eventTypeConfig";

const SETTINGS_KEY = "event_type_config";

const createEmptySubtype = (): EventSubtypeConfig => ({
  id: "",
  label: "",
  defaults: {
    time: "",
    has_queue: false,
    queue_types: [],
    is_recurring: false,
    recurrence_pattern: "weekly",
    recurrence_interval: 1,
  },
});

const createEmptyType = (): EventTypeConfig => ({
  id: "",
  label: "",
  description: "",
  subtypes: [],
});

export default function Page() {
  const [config, setConfig] = useState<EventTypeConfigState>(defaultEventTypeConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const loadConfig = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", SETTINGS_KEY)
          .single();

        if (error) {
          if (error.code !== "PGRST116") {
            throw error;
          }
          setConfig(defaultEventTypeConfig);
          return;
        }

        if (data?.value) {
          const parsed = JSON.parse(data.value);
          setConfig(parsed);
        } else {
          setConfig(defaultEventTypeConfig);
        }
      } catch (err) {
        console.error("Error loading event type config:", err);
        setStatus("Error loading settings. Using defaults.");
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setStatus("");
    try {
      const { error } = await supabase.from("admin_settings").upsert({
        key: SETTINGS_KEY,
        value: JSON.stringify(config),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setStatus("✅ Event types saved.");
      setTimeout(() => setStatus(""), 4000);
    } catch (err) {
      console.error("Error saving event type config:", err);
      setStatus("❌ Failed to save event types.");
    } finally {
      setSaving(false);
    }
  };

  const addType = () => {
    setConfig((prev) => ({
      types: [...prev.types, createEmptyType()],
    }));
  };

  const updateType = (index: number, updates: Partial<EventTypeConfig>) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) =>
        idx === index ? { ...type, ...updates } : type
      ),
    }));
  };

  const removeType = (index: number) => {
    setConfig((prev) => ({
      types: prev.types.filter((_, idx) => idx !== index),
    }));
  };

  const addSubtype = (typeIndex: number) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) =>
        idx === typeIndex
          ? { ...type, subtypes: [...(type.subtypes || []), createEmptySubtype()] }
          : type
      ),
    }));
  };

  const updateSubtype = (
    typeIndex: number,
    subtypeIndex: number,
    updates: Partial<EventSubtypeConfig>
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const subtypes = (type.subtypes || []).map((subtype, sIdx) =>
          sIdx === subtypeIndex ? { ...subtype, ...updates } : subtype
        );
        return { ...type, subtypes };
      }),
    }));
  };

  const updateSubtypeDefaults = (
    typeIndex: number,
    subtypeIndex: number,
    updates: Partial<EventSubtypeConfig["defaults"]>
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const subtypes = (type.subtypes || []).map((subtype, sIdx) => {
          if (sIdx !== subtypeIndex) return subtype;
          return {
            ...subtype,
            defaults: {
              ...subtype.defaults,
              ...updates,
            },
          };
        });
        return { ...type, subtypes };
      }),
    }));
  };

  const removeSubtype = (typeIndex: number, subtypeIndex: number) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        return {
          ...type,
          subtypes: (type.subtypes || []).filter((_, sIdx) => sIdx !== subtypeIndex),
        };
      }),
    }));
  };

  const flattenedIds = useMemo(() => {
    const ids = new Set<string>();
    config.types.forEach((type) => {
      if (type.id) ids.add(type.id);
      type.subtypes?.forEach((subtype) => {
        if (subtype.id) ids.add(`${type.id}:${subtype.id}`);
      });
    });
    return ids;
  }, [config.types]);

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manage Event Types</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure event categories, brewery subtypes, and default values applied to the editor.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={addType}>
            Add Event Type
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div>Loading settings…</div>
      ) : (
        <div className="space-y-6">
          {config.types.map((type, typeIndex) => (
            <div key={`${type.id}-${typeIndex}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div className="flex-1 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Type ID</label>
                    <input
                      value={type.id}
                      onChange={(e) => updateType(typeIndex, { id: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="brewery"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Label</label>
                    <input
                      value={type.label}
                      onChange={(e) => updateType(typeIndex, { label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Brewery Event"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500">Description</label>
                    <input
                      value={type.description || ""}
                      onChange={(e) => updateType(typeIndex, { description: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Short helper text for admins."
                    />
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => removeType(typeIndex)}>
                  Remove Type
                </Button>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Subtypes & defaults</h4>
                  <Button size="sm" variant="secondary" onClick={() => addSubtype(typeIndex)}>
                    Add Subtype
                  </Button>
                </div>
                {(type.subtypes || []).length === 0 ? (
                  <div className="text-sm text-gray-500">No subtypes yet.</div>
                ) : (
                  <div className="space-y-4">
                    {(type.subtypes || []).map((subtype, subtypeIndex) => (
                      <div key={`${subtype.id}-${subtypeIndex}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                          <div className="flex-1 grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Subtype ID</label>
                              <input
                                value={subtype.id}
                                onChange={(e) => updateSubtype(typeIndex, subtypeIndex, { id: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                placeholder="vinyl-sundays"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-500">Label</label>
                              <input
                                value={subtype.label}
                                onChange={(e) => updateSubtype(typeIndex, subtypeIndex, { label: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                                placeholder="Vinyl Sundays"
                              />
                            </div>
                          </div>
                          <Button variant="danger" size="sm" onClick={() => removeSubtype(typeIndex, subtypeIndex)}>
                            Remove
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-500">Default time</label>
                            <input
                              value={subtype.defaults?.time || ""}
                              onChange={(e) =>
                                updateSubtypeDefaults(typeIndex, subtypeIndex, { time: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                              placeholder="12:00 PM - 6:00 PM"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-6 md:mt-0">
                            <input
                              type="checkbox"
                              checked={subtype.defaults?.has_queue || false}
                              onChange={(e) =>
                                updateSubtypeDefaults(typeIndex, subtypeIndex, { has_queue: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-gray-700">Enable queue</span>
                          </div>
                          <div className="flex items-center gap-2 mt-6 md:mt-0">
                            <input
                              type="checkbox"
                              checked={subtype.defaults?.is_recurring || false}
                              onChange={(e) =>
                                updateSubtypeDefaults(typeIndex, subtypeIndex, { is_recurring: e.target.checked })
                              }
                              className="h-4 w-4"
                            />
                            <span className="text-sm text-gray-700">Recurring by default</span>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500">Recurrence pattern</label>
                            <select
                              value={subtype.defaults?.recurrence_pattern || "weekly"}
                              onChange={(e) =>
                                updateSubtypeDefaults(typeIndex, subtypeIndex, { recurrence_pattern: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500">Recurrence interval</label>
                            <input
                              type="number"
                              min="1"
                              value={subtype.defaults?.recurrence_interval ?? 1}
                              onChange={(e) =>
                                updateSubtypeDefaults(typeIndex, subtypeIndex, {
                                  recurrence_interval: parseInt(e.target.value) || 1,
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500">Queue types</label>
                            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                              {["side", "track", "album"].map((queueType) => {
                                const current = subtype.defaults?.queue_types || [];
                                const checked = current.includes(queueType);
                                return (
                                  <label key={queueType} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...current, queueType]
                                          : current.filter((item) => item !== queueType);
                                        updateSubtypeDefaults(typeIndex, subtypeIndex, { queue_types: next });
                                      }}
                                      className="h-4 w-4"
                                    />
                                    {queueType}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {subtype.id && type.id && flattenedIds.has(`${type.id}:${subtype.id}`) && (
                          <p className="text-xs text-gray-400 mt-3">
                            Tag saved as: event_subtype:{subtype.id}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {status && (
            <div className="text-sm text-gray-600">{status}</div>
          )}
        </div>
      )}
    </Container>
  );
}
