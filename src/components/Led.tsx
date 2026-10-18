export type LedState = 'off' | 'on' | 'ok' | 'error';

/** A small indicator lamp. Decorative: the state is always also stated in text. */
export default function Led({ state }: { state: LedState }) {
  return <span className={state === 'off' ? 'led' : `led led--${state}`} aria-hidden="true" />;
}
