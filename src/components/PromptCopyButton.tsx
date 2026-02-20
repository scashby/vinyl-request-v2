"use client";

import { useState } from "react";

type PromptCopyButtonProps = {
  prompt: string;
};

export default function PromptCopyButton({ prompt }: PromptCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
      setCopied(false);
      setTimeout(() => setFailed(false), 2000);
    }
  };

  return (
    <div className="mb-3 flex items-center gap-3">
      <button
        type="button"
        onClick={onCopy}
        className="rounded border border-amber-700 px-2 py-1 text-xs uppercase tracking-[0.15em] text-amber-200 transition hover:border-amber-400 hover:text-amber-100"
      >
        Copy Prompt
      </button>
      {copied ? <span className="text-xs text-emerald-300">Copied</span> : null}
      {failed ? <span className="text-xs text-rose-300">Copy failed</span> : null}
    </div>
  );
}
