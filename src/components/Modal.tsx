import { type ReactNode, useEffect, useRef } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal dialog built on the native <dialog> element, which traps focus and
 * closes on Escape by itself.
 */
export default function Modal({ title, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="modal" aria-label={title} onClose={onClose}>
      <header className="modal__header">
        <h2>{title}</h2>
        <button type="button" className="button" onClick={onClose}>Close</button>
      </header>
      <div className="modal__body">{children}</div>
    </dialog>
  );
}
