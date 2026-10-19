import type { ReactNode } from 'react';

/** A labelled group that fills the height it is given; its list scrolls inside. */
export default function FillSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="section section--fill">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
