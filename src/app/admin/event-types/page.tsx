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
const FIELD_OPTIONS = [
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
];

const fieldOrder = FIELD_OPTIONS.map((field) => field.id);
const sortPrefillFields = (fields: string[]) =>
  [...fields].sort((a, b) => fieldOrder.indexOf(a) - fieldOrder.indexOf(b));

const getTemplateFields = (templateFields?: string[]) =>
  templateFields?.length ? templateFields : ALL_TEMPLATE_FIELDS;

const getPrefillFields = (defaults?: EventSubtypeConfig["defaults"]) =>
  defaults?.prefill_fields ?? [];

const createEmptySubtype = (): EventSubtypeConfig => ({
  id: "",
  label: "",
  description: "",
  defaults: {
    prefill_fields: [],
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
  template_fields: [...ALL_TEMPLATE_FIELDS],
  defaults: {
    prefill_fields: [],
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
  subtypes: [],
});

const normalizeDefaults = (defaults?: EventSubtypeConfig["defaults"]) => {
  if (!defaults) return undefined;
  const prefill_fields = defaults.prefill_fields ?? defaults.enabled_fields ?? [];
  const { enabled_fields, ...rest } = defaults;
  return {
    ...rest,
    prefill_fields,
  };
};

const normalizeConfigState = (state: EventTypeConfigState): EventTypeConfigState => ({
  types: state.types.map((type) => ({
    ...type,
    template_fields: getTemplateFields(type.template_fields ?? type.defaults?.enabled_fields),
    defaults: normalizeDefaults(type.defaults),
    subtypes: (type.subtypes || []).map((subtype) => ({
      ...subtype,
      defaults: normalizeDefaults(subtype.defaults),
    })),
  })),
});

const resetDefaultsForField = (
  defaults: EventSubtypeConfig["defaults"],
  field: string
) => {
  if (!defaults) return defaults;
  const nextDefaults = { ...defaults };
  if (field === "date") nextDefaults.date = "";
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
  if (field === "crate") nextDefaults.crate_id = null;
  if (field === "formats") nextDefaults.allowed_formats = [];
  return nextDefaults;
};

export default function Page() {
  const [config, setConfig] = useState<EventTypeConfigState>(() =>
    normalizeConfigState(defaultEventTypeConfig)
  );
  const [initialConfig, setInitialConfig] = useState<EventTypeConfigState>(() =>
    normalizeConfigState(defaultEventTypeConfig)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedSubtypeId, setSelectedSubtypeId] = useState<string>("");
  const [typePrefillToAdd, setTypePrefillToAdd] = useState("");
  const [subtypePrefillToAdd, setSubtypePrefillToAdd] = useState("");

  useEffect(() => {
    void (async () => {
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
            throw error;
          }
          setConfig(normalizeConfigState(defaultEventTypeConfig));
          return;
        }

        const nextConfig = data?.value ? JSON.parse(data.value) : defaultEventTypeConfig;
        const normalizedConfig = normalizeConfigState(nextConfig);
        setConfig(normalizedConfig);
        setInitialConfig(normalizedConfig);
      } catch (err) {
        console.error("Error loading event type config:", err);
        setStatus("Error loading settings. Using defaults.");
        setInitialConfig(normalizeConfigState(defaultEventTypeConfig));
      } finally {
        setLoading(false);
      }
    })();
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

  const updateTypeDefaults = (
    index: number,
    updates: Partial<EventSubtypeConfig["defaults"]>
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== index) return type;
        return {
          ...type,
          defaults: {
            ...(type.defaults ?? {}),
            ...updates,
          },
        };
      }),
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

  const toggleTypeField = (typeIndex: number, field: string, enabled: boolean) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const currentFields = getTemplateFields(type.template_fields);
        const nextFields = enabled
          ? Array.from(new Set([...currentFields, field]))
          : currentFields.filter((item) => item !== field);
        const currentDefaults = type.defaults ?? { prefill_fields: [] };
        const nextPrefillFields = (currentDefaults.prefill_fields ?? []).filter(
          (item) => item !== field
        );
        const nextDefaults = {
          ...currentDefaults,
          prefill_fields: nextPrefillFields,
        };
        if (!enabled) {
          Object.assign(nextDefaults, resetDefaultsForField(nextDefaults, field));
        }
        const nextSubtypes = (type.subtypes || []).map((subtype) => {
          if (!enabled && subtype.defaults?.prefill_fields?.includes(field)) {
            const nextPrefillFields = (subtype.defaults.prefill_fields || []).filter(
              (item) => item !== field
            );
            return {
              ...subtype,
              defaults: resetDefaultsForField(
                { ...subtype.defaults, prefill_fields: nextPrefillFields },
                field
              ),
            };
          }
          return subtype;
        });
        return {
          ...type,
          template_fields: nextFields,
          defaults: nextDefaults,
          subtypes: nextSubtypes,
        };
      }),
    }));
  };

  const addTypePrefillField = (typeIndex: number, field: string) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const currentDefaults = type.defaults ?? { prefill_fields: [] };
        const nextPrefillFields = Array.from(
          new Set([...(currentDefaults.prefill_fields ?? []), field])
        );
        return {
          ...type,
          defaults: {
            ...currentDefaults,
            prefill_fields: nextPrefillFields,
          },
        };
      }),
    }));
  };

  const removeTypePrefillField = (typeIndex: number, field: string) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const currentDefaults = type.defaults ?? { prefill_fields: [] };
        const nextPrefillFields = (currentDefaults.prefill_fields ?? []).filter(
          (item) => item !== field
        );
        const nextDefaults = resetDefaultsForField(
          { ...currentDefaults, prefill_fields: nextPrefillFields },
          field
        );
        return {
          ...type,
          defaults: nextDefaults,
        };
      }),
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

  const addSubtypePrefillField = (
    typeIndex: number,
    subtypeIndex: number,
    field: string
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const subtypes = (type.subtypes || []).map((subtype, sIdx) => {
          if (sIdx !== subtypeIndex) return subtype;
          const currentDefaults = subtype.defaults ?? { prefill_fields: [] };
          const nextPrefillFields = Array.from(
            new Set([...(currentDefaults.prefill_fields ?? []), field])
          );
          return {
            ...subtype,
            defaults: {
              ...currentDefaults,
              prefill_fields: nextPrefillFields,
            },
          };
        });
        return { ...type, subtypes };
      }),
    }));
  };

  const removeSubtypePrefillField = (
    typeIndex: number,
    subtypeIndex: number,
    field: string
  ) => {
    setConfig((prev) => ({
      types: prev.types.map((type, idx) => {
        if (idx !== typeIndex) return type;
        const subtypes = (type.subtypes || []).map((subtype, sIdx) => {
          if (sIdx !== subtypeIndex) return subtype;
          const currentDefaults = subtype.defaults ?? { prefill_fields: [] };
          const nextPrefillFields = (currentDefaults.prefill_fields ?? []).filter(
            (item) => item !== field
          );
          const nextDefaults = resetDefaultsForField(
            { ...currentDefaults, prefill_fields: nextPrefillFields },
            field
          );
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
    setTypePrefillToAdd("");
    setSubtypePrefillToAdd("");
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

  const typeTemplateFields = selectedType
    ? getTemplateFields(selectedType.template_fields)
    : ALL_TEMPLATE_FIELDS;
  const typePrefillFields = selectedType ? getPrefillFields(selectedType.defaults) : [];
  const availableTypePrefillFields = typeTemplateFields.filter(
    (field) => !typePrefillFields.includes(field)
  );
  const availableSubtypePrefillFields = typeTemplateFields.filter(
    (field) => !typePrefillFields.includes(field)
  );
  const subtypePrefillFields = selectedSubtype ? getPrefillFields(selectedSubtype.defaults) : [];
  const remainingSubtypePrefillFields = availableSubtypePrefillFields.filter(
    (field) => !subtypePrefillFields.includes(field)
  );

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

  const handleTemplateImageUpload = async (onUpdate: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `event-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("event-images")
          .upload(filePath, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("event-images").getPublicUrl(filePath);
        if (data?.publicUrl) {
          onUpdate(data.publicUrl);
        }
      } catch (error) {
        console.error("Error uploading template image:", error);
        alert("Failed to upload image. Please try again.");
      }
    };

    input.click();
  };

  const renderPrefillField = (
    fieldId: string,
    defaults: EventSubtypeConfig["defaults"],
    onUpdate: (updates: Partial<EventSubtypeConfig["defaults"]>) => void,
    onRemove: () => void
  ) => {
    const label = FIELD_OPTIONS.find((field) => field.id === fieldId)?.label ?? fieldId;
    return (
      <div key={fieldId} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h6>
          <Button variant="secondary" size="sm" onClick={onRemove}>
            Remove
          </Button>
        </div>
        {fieldId === "date" && (
          <input
            type="date"
            value={defaults?.date || ""}
            onChange={(e) => onUpdate({ date: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        )}
        {fieldId === "info" && (
          <textarea
            value={defaults?.info || ""}
            onChange={(e) => onUpdate({ info: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Short description shown on events."
            rows={3}
          />
        )}
        {fieldId === "info_url" && (
          <input
            value={defaults?.info_url || ""}
            onChange={(e) => onUpdate({ info_url: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="https://..."
          />
        )}
        {fieldId === "time" && (
          <input
            value={defaults?.time || ""}
            onChange={(e) => onUpdate({ time: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="12:00 PM - 6:00 PM"
          />
        )}
        {fieldId === "location" && (
          <div className="space-y-2">
            <input
              value={defaults?.location || ""}
              onChange={(e) => onUpdate({ location: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Venue or address"
            />
            {defaults?.location && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  defaults.location
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Search in Google Maps
              </a>
            )}
          </div>
        )}
        {fieldId === "image_url" && (
          <div className="space-y-2">
            <input
              value={defaults?.image_url || ""}
              onChange={(e) => onUpdate({ image_url: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://..."
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleTemplateImageUpload((url) => onUpdate({ image_url: url }))}
            >
              Upload image
            </Button>
          </div>
        )}
        {fieldId === "queue" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={defaults?.has_queue || false}
                onChange={(e) => onUpdate({ has_queue: e.target.checked })}
                className="h-4 w-4"
              />
              Enable queue
            </label>
            <div className="flex flex-wrap gap-3 text-sm text-gray-700">
              {["side", "track", "album"].map((queueType) => {
                const current = defaults?.queue_types || [];
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
                        onUpdate({ queue_types: next });
                      }}
                      className="h-4 w-4"
                    />
                    {queueType}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {fieldId === "recurrence" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={defaults?.is_recurring || false}
                onChange={(e) => onUpdate({ is_recurring: e.target.checked })}
                className="h-4 w-4"
              />
              Recurring by default
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-500">Recurrence pattern</label>
                <select
                  value={defaults?.recurrence_pattern || "weekly"}
                  onChange={(e) => onUpdate({ recurrence_pattern: e.target.value })}
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
                  value={defaults?.recurrence_interval ?? 1}
                  onChange={(e) =>
                    onUpdate({ recurrence_interval: parseInt(e.target.value) || 1 })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
        {fieldId === "formats" && (
          <input
            value={(defaults?.allowed_formats || []).join(", ")}
            onChange={(e) =>
              onUpdate({
                allowed_formats: e.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="lp, 7in, cassette"
          />
        )}
        {fieldId === "crate" && (
          <input
            type="number"
            min="0"
            value={defaults?.crate_id ?? ""}
            onChange={(e) =>
              onUpdate({ crate_id: e.target.value ? parseInt(e.target.value) : null })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Crate ID"
          />
        )}
      </div>
    );
  };

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
                setTypePrefillToAdd("");
                setSubtypePrefillToAdd("");
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
                <h3 className="text-base font-semibold text-gray-800">Type template fields</h3>
                <p className="text-xs text-gray-500">
                  Choose which fields appear for this event type.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-gray-700">
                  {FIELD_OPTIONS.map((field) => {
                    const enabled = typeTemplateFields.includes(field.id);
                    return (
                      <label key={field.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) =>
                            toggleTypeField(selectedTypeIndex, field.id, e.target.checked)
                          }
                          className="h-4 w-4"
                        />
                        {field.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-base font-semibold text-gray-800">Type pre-fill fields</h3>
                <p className="text-xs text-gray-500">
                  Add the fields you want pre-populated for this event type.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={typePrefillToAdd}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTypePrefillToAdd(value);
                      if (value) {
                        addTypePrefillField(selectedTypeIndex, value);
                        setTypePrefillToAdd("");
                      }
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Add field…</option>
                    {availableTypePrefillFields.map((fieldId) => {
                      const field = FIELD_OPTIONS.find((option) => option.id === fieldId);
                      return (
                        <option key={fieldId} value={fieldId}>
                          {field?.label ?? fieldId}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {typePrefillFields.length === 0 ? (
                  <p className="text-sm text-gray-500">No pre-fill fields added yet.</p>
                ) : (
                  <div className="grid gap-4">
                    {sortPrefillFields(typePrefillFields).map((fieldId) =>
                      renderPrefillField(
                        fieldId,
                        selectedType.defaults,
                        (updates) => updateTypeDefaults(selectedTypeIndex, updates),
                        () => removeTypePrefillField(selectedTypeIndex, fieldId)
                      )
                    )}
                  </div>
                )}
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
                    setSubtypePrefillToAdd("");
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
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-gray-500">Description</label>
                        <input
                          value={selectedSubtype.description || ""}
                          onChange={(e) =>
                            updateSubtype(selectedTypeIndex, selectedSubtypeIndex, { description: e.target.value })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                          placeholder="Short helper text for admins."
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Subtype pre-fill fields
                      </h5>
                      <p className="text-xs text-gray-500">
                        Add pre-fill fields that are not already defined at the type level.
                      </p>
                      <select
                        value={subtypePrefillToAdd}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSubtypePrefillToAdd(value);
                          if (value) {
                            addSubtypePrefillField(selectedTypeIndex, selectedSubtypeIndex, value);
                            setSubtypePrefillToAdd("");
                          }
                        }}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Add field…</option>
                        {remainingSubtypePrefillFields.map((fieldId) => {
                          const field = FIELD_OPTIONS.find((option) => option.id === fieldId);
                          return (
                            <option key={fieldId} value={fieldId}>
                              {field?.label ?? fieldId}
                            </option>
                          );
                        })}
                      </select>

                      {subtypePrefillFields.length === 0 ? (
                        <p className="text-sm text-gray-500">No subtype pre-fill fields added yet.</p>
                      ) : (
                        <div className="grid gap-4">
                          {sortPrefillFields(subtypePrefillFields).map((fieldId) =>
                            renderPrefillField(
                              fieldId,
                              selectedSubtype.defaults,
                              (updates) =>
                                updateSubtypeDefaults(selectedTypeIndex, selectedSubtypeIndex, updates),
                              () => removeSubtypePrefillField(selectedTypeIndex, selectedSubtypeIndex, fieldId)
                            )
                          )}
                        </div>
                      )}
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
        </div>
      )}
    </Container>
  );
}
