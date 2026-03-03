"use client";

import { useEffect, useMemo, useState } from "react";

type InlineEditableCellProps = {
  value: string | null | undefined;
  onSave: (nextValue: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  trim?: boolean;
};

export default function InlineEditableCell({
  value,
  onSave,
  placeholder = "—",
  className = "",
  inputClassName = "",
  disabled = false,
  trim = true,
}: InlineEditableCellProps) {
  const normalizedValue = useMemo(() => (typeof value === "string" ? value : ""), [value]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(normalizedValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraft(normalizedValue);
  }, [normalizedValue, editing]);

  const finishSave = async () => {
    if (saving || disabled) return;
    const nextValue = trim ? draft.trim() : draft;
    if (nextValue === normalizedValue) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(nextValue);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing && !disabled) {
    return (
      <input
        autoFocus
        className={`w-full rounded border border-amber-500/70 bg-stone-950 px-1.5 py-1 text-xs text-stone-100 outline-none focus:border-amber-300 ${inputClassName}`}
        onBlur={() => {
          if (!saving) {
            setEditing(false);
            setDraft(normalizedValue);
            setError(null);
          }
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setEditing(false);
            setDraft(normalizedValue);
            setError(null);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            void finishSave();
          }
        }}
        title={error ?? undefined}
        value={draft}
      />
    );
  }

  return (
    <button
      className={`w-full rounded px-1.5 py-1 text-left text-xs transition hover:bg-stone-800/70 ${normalizedValue ? "text-stone-100" : "text-stone-500 italic"} ${className}`}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setEditing(true);
        setError(null);
      }}
      title={error ?? "Click to edit. Press Enter to save."}
      type="button"
    >
      {saving ? "Saving..." : normalizedValue || placeholder}
    </button>
  );
}
