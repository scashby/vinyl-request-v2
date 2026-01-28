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
const ALL_TEMPLATE_FIELDS = [
  "date",
  "time",
  "location",
  "image_url",
  "info",
  "info_url",
  "queue",
  "recurrence",
  "crate",
  "formats",
];

const createEmptySubtype = (): EventSubtypeConfig => ({
  id: "",
  label: "",
  defaults: {
    enabled_fields: [],
    info: "",
    info_url: "",
    time: "",
    location: "",
    image_url: "",
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
  const [initialConfig, setInitialConfig] = useState<EventTypeConfigState>(defaultEventTypeConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string>("");

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
          const errorStatus = "status" in error ? error.status : null;
          if (error.code !== "PGRST116" && errorStatus !== 404) {
          if (error.code !== "PGRST116") {
            throw error;
          }
          setConfig(defaultEventTypeConfig);
          return;
        }

        const nextConfig = data?.value ? JSON.parse(data.value) : defaultEventTypeConfig;
        setConfig(nextConfig);
        setInitialConfig(nextConfig);
      } catch (err) {
        console.error("Error loading event type config:", err);
        setStatus("Error loading settings. Using defaults.");
        setInitialConfig(defaultEventTypeConfig);
      } finally {
        setLoading(false);
      }
    };

    void loadConfig();
  }, []);

    loadConfig();
  }, []);

  useEffect(() => {
    if (!selectedTypeId && config.types.length > 0) {
      setSelectedTypeId(config.types[0]?.id || "");
    }
  }, [config.types, selectedTypeId]);

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
    const newType = createEmptyType();
    setConfig((prev) => ({
      types: [...prev.types, newType],
    }));
    setSelectedTypeId(newType.id);
    setSelectedSubtypeId("");
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
    setSelectedTypeId("");
    setSelectedSubtypeId("");
  };

  const addSubtype = (typeIndex: number) => {
    const newSubtype = createEmptySubtype();
    setConfig((prev) => ({
      types: prev.types.map((type, idx) =>
        idx === typeIndex
          ? { ...type, subtypes: [...(type.subtypes || []), newSubtype] }
          : type
      ),
    }));
    setSelectedSubtypeId(newSubtype.id);
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

  const toggleSubtypeField = (
    typeIndex: number,
    subtypeIndex: number,
    field: string,
    enabled: boolean
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const subtypes = (type.subtypes || []).map((subtype, sIdx) => {
          if (sIdx !== subtypeIndex) return subtype;
          const currentFields =
            subtype.defaults?.enabled_fields?.length ? subtype.defaults.enabled_fields : ALL_TEMPLATE_FIELDS;
          const currentFields = subtype.defaults?.enabled_fields || [];
          const nextFields = enabled
            ? Array.from(new Set([...currentFields, field]))
            : currentFields.filter((item) => item !== field);
          const nextDefaults = {
            ...subtype.defaults,
            enabled_fields: nextFields,
          };
          if (!enabled) {
            if (field === "time") nextDefaults.time = "";
            if (field === "location") nextDefaults.location = "";
            if (field === "image_url") nextDefaults.image_url = "";
            if (field === "info") nextDefaults.info = "";
            if (field === "info_url") nextDefaults.info_url = "";
            if (field === "queue") {
              nextDefaults.has_queue = false;
              nextDefaults.queue_types = [];
            }
            if (field === "recurrence") {
              nextDefaults.is_recurring = false;
              nextDefaults.recurrence_pattern = "weekly";
              nextDefaults.recurrence_interval = 1;
            }
          }
          return {
            ...subtype,
            defaults: nextDefaults,
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
    setSelectedSubtypeId("");
  };

  const handleCancel = () => {
    setConfig(initialConfig);
    setSelectedTypeId("");
    setSelectedSubtypeId("");
    setStatus("");
  };

  const selectedTypeIndex = useMemo(
    () => config.types.findIndex((type) => type.id === selectedTypeId),
    [config.types, selectedTypeId]
  );

  const selectedType = selectedTypeIndex >= 0 ? config.types[selectedTypeIndex] : null;
  const selectedSubtypeIndex = selectedType
    ? selectedType.subtypes?.findIndex((subtype) => subtype.id === selectedSubtypeId) ?? -1
    : -1;
  const selectedSubtype =
    selectedType && selectedSubtypeIndex >= 0
      ? selectedType.subtypes?.[selectedSubtypeIndex] || null
      : null;

  const typeOptions = config.types.map((type) => ({
    value: type.id,
    label: type.label || type.id || "(Untitled type)",
  }));

  const subtypeOptions = selectedType
    ? (selectedType.subtypes || []).map((subtype) => ({
        value: subtype.id,
        label: subtype.label || subtype.id || "(Untitled subtype)",
      }))
    : [];

  return (
    <Container size="md" className="py-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Manage Event Types</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure event categories, brewery subtypes, and default values applied to the editor.
          </p>
        </div>
      </div>

      {loading ? (
        <div>Loading settings…</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="text-xs font-semibold text-gray-500">Select Event Type</label>
            <select
              value={selectedTypeId}
              onChange={(e) => {
                if (e.target.value === "__create__") {
                  addType();
                  return;
                }
                setSelectedTypeId(e.target.value);
                setSelectedSubtypeId("");
              }}
              className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose an event type…</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="__create__">+ Create new event type</option>
            </select>
          </div>

          {selectedType && (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-base font-semibold text-gray-800">Event Type Details</h3>
                  <Button variant="danger" size="sm" onClick={() => removeType(selectedTypeIndex)}>
                    Remove Type
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Type ID</label>
                    <input
                      value={selectedType.id}
                      onChange={(e) => updateType(selectedTypeIndex, { id: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="brewery"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Label</label>
                    <input
                      value={selectedType.label}
                      onChange={(e) => updateType(selectedTypeIndex, { label: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Brewery Event"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500">Description</label>
                    <input
                      value={selectedType.description || ""}
                      onChange={(e) => updateType(selectedTypeIndex, { description: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Short helper text for admins."
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <label className="text-xs font-semibold text-gray-500">Select Subtype</label>
                <select
                  value={selectedSubtypeId}
                  onChange={(e) => {
                    if (e.target.value === "__create__") {
                      addSubtype(selectedTypeIndex);
                      return;
                    }
                    setSelectedSubtypeId(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Choose a subtype…</option>
                  {subtypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="__create__">+ Create new subtype</option>
                </select>

                {selectedSubtype && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-semibold text-gray-700">Subtype Details</h4>
                      <Button variant="danger" size="sm" onClick={() => removeSubtype(selectedTypeIndex, selectedSubtypeIndex)}>
                        Remove Subtype
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Subtype ID</label>
                        <input
                          value={selectedSubtype.id}
                          onChange={(e) => updateSubtype(selectedTypeIndex, selectedSubtypeIndex, { id: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="vinyl-sundays"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Label</label>
                        <input
                          value={selectedSubtype.label}
                          onChange={(e) =>
                            updateSubtype(selectedTypeIndex, selectedSubtypeIndex, { label: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Vinyl Sundays"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Template fields</h5>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose which fields appear when creating events for this subtype.
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-gray-700">
                        {[
                          { id: "date", label: "Date" },
                          { id: "time", label: "Time" },
                          { id: "location", label: "Location" },
                          { id: "image_url", label: "Image" },
                          { id: "info", label: "Description" },
                          { id: "info_url", label: "Link" },
                          { id: "queue", label: "Queue" },
                          { id: "recurrence", label: "Recurrence" },
                          { id: "crate", label: "Crate restriction" },
                          { id: "formats", label: "Allowed formats" },
                        ].map((field) => {
                          const enabled = (selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes(field.id);
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Defaults included</h5>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-gray-700">
                        {[
                          { id: "time", label: "Time" },
                          { id: "location", label: "Location" },
                          { id: "image_url", label: "Image" },
                          { id: "queue", label: "Queue" },
                          { id: "recurrence", label: "Recurrence" },
                        ].map((field) => {
                          const enabled = selectedSubtype.defaults?.enabled_fields?.includes(field.id) || false;
                          return (
                            <label key={field.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) =>
                                  toggleSubtypeField(
                                    selectedTypeIndex,
                                    selectedSubtypeIndex,
                                    field.id,
                                    e.target.checked
                                  )
                                }
                                className="h-4 w-4"
                              />
                              {field.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Default description</label>
                        <textarea
                          value={selectedSubtype.defaults?.info || ""}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { info: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Short description shown on events."
                          rows={3}
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("info"))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Default link</label>
                        <input
                          value={selectedSubtype.defaults?.info_url || ""}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { info_url: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="https://..."
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("info_url"))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Default time</label>
                        <input
                          value={selectedSubtype.defaults?.time || ""}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { time: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="12:00 PM - 6:00 PM"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("time"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("time")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Default location</label>
                        <input
                          value={selectedSubtype.defaults?.location || ""}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { location: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Devil's Purse Brewing Company"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("location"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("location")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Default image URL</label>
                        <input
                          value={selectedSubtype.defaults?.image_url || ""}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { image_url: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="https://..."
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("image_url"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("image_url")}
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          checked={selectedSubtype.defaults?.has_queue || false}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { has_queue: e.target.checked })
                          }
                          className="h-4 w-4"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("queue"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("queue")}
                        />
                        <span className="text-sm text-gray-700">Enable queue</span>
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <input
                          type="checkbox"
                          checked={selectedSubtype.defaults?.is_recurring || false}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { is_recurring: e.target.checked })
                          }
                          className="h-4 w-4"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("recurrence"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("recurrence")}
                        />
                        <span className="text-sm text-gray-700">Recurring by default</span>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Recurrence pattern</label>
                        <select
                          value={selectedSubtype.defaults?.recurrence_pattern || "weekly"}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { recurrence_pattern: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("recurrence"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("recurrence")}
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
                          value={selectedSubtype.defaults?.recurrence_interval ?? 1}
                          onChange={(e) =>
                            updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, {
                              recurrence_interval: parseInt(e.target.value) || 1,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                            ? selectedSubtype.defaults.enabled_fields
                            : ALL_TEMPLATE_FIELDS
                          ).includes("recurrence"))}
                          disabled={!selectedSubtype.defaults?.enabled_fields?.includes("recurrence")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Queue types</label>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-700">
                          {["side", "track", "album"].map((queueType) => {
                            const current = selectedSubtype.defaults?.queue_types || [];
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
                                    updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, { queue_types: next });
                                  }}
                                  className="h-4 w-4"
                                  disabled={!((selectedSubtype.defaults?.enabled_fields?.length
                                    ? selectedSubtype.defaults.enabled_fields
                                    : ALL_TEMPLATE_FIELDS
                                  ).includes("queue"))}
                                  disabled={!selectedSubtype.defaults?.enabled_fields?.includes("queue")}
                                />
                                {queueType}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {selectedSubtype.id && selectedType.id && (
                      <p className="text-xs text-gray-400">
                        Tag saved as: event_subtype:{selectedSubtype.id}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {selectedType && (
            <>
              {status && (
                <div className="text-sm text-gray-600">{status}</div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="secondary" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveConfig} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          )}
          {status && (
            <div className="text-sm text-gray-600">{status}</div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="secondary" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </Container>
  );
}
