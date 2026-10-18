import type { ReactNode } from 'react';

/** A labelled group on the panel, built on fieldset/legend. */
export default function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
