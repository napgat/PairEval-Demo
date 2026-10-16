"use client";
import { useEffect, useId, useRef } from "react";

export default function ConfirmationDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: {
  open: boolean; title: string; children: React.ReactNode; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className="fs-confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id={titleId}>{title}</h2>
    <div id={descriptionId} className="fs-dialog-copy">{children}</div>
    <div className="actions">
      <button className="secondary-button" onClick={onCancel}>กลับไปตรวจสอบ</button>
      <button className="primary-button" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  </dialog>;
}
