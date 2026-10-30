'use client';

import { useRef } from 'react';

interface SimpleRichEditorProps {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Lightweight editor: plain textarea plus helpers that insert markdown-style markers.
 * Stored value is plain text (newlines + **bold** markers); rendered as pre-wrap in viewers.
 */
export function SimpleRichEditor({ value, onChange, minRows = 6, placeholder, disabled }: SimpleRichEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function wrapSelection(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected || 'text'}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + (selected ? selected.length : 4);
      el.setSelectionRange(pos, pos + (selected ? 0 : 0));
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded border border-neutral-100 bg-white px-2 py-1 text-xs font-medium text-secondary-700 hover:bg-neutral-50"
          onClick={() => wrapSelection('**', '**')}
          disabled={disabled}
        >
          Bold
        </button>
        <button
          type="button"
          className="rounded border border-neutral-100 bg-white px-2 py-1 text-xs font-medium text-secondary-700 hover:bg-neutral-50"
          onClick={() => wrapSelection('*', '*')}
          disabled={disabled}
        >
          Italic
        </button>
        <button
          type="button"
          className="rounded border border-neutral-100 bg-white px-2 py-1 text-xs font-medium text-secondary-700 hover:bg-neutral-50"
          onClick={() => onChange(`${value}\n- `)}
          disabled={disabled}
        >
          List
        </button>
      </div>
      <textarea
        ref={ref}
        className="input w-full font-mono text-sm"
        rows={minRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
