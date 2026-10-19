/**
 * Status lamp. Yellow = active or OK, blinking yellow = in progress,
 * red = needs attention, off = inactive. Decorative: the state is always also
 * stated in text next to it.
 */
export type LedState = 'off' | 'yellow' | 'blink' | 'red';

export default function Led({ state }: { state: LedState }) {
  return <span className={state === 'off' ? 'led' : `led led--${state}`} aria-hidden="true" />;
}
