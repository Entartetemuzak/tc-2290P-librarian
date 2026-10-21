import { useState } from 'react';

/** What the browser's Web MIDI provides, for troubleshooting. Hidden until opened. */
export default function MidiDetails({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <details className="midi-details">
      <summary>MIDI details</summary>
      <pre>{text}</pre>
      <button
        type="button"
        className="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? 'Copied' : 'Copy details'}
      </button>
    </details>
  );
}
