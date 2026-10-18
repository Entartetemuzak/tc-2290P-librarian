import { useApp } from '../state/context';

export default function NoticeBar() {
  const { state, actions } = useApp();
  if (!state.notice) return null;
  const { tone, text } = state.notice;
  return (
    <div
      className={tone === 'error' ? 'notice notice--error' : 'notice'}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <p>{text}</p>
      <button type="button" className="button" onClick={actions.dismissNotice}>
        Dismiss
      </button>
    </div>
  );
}
