import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const close = () => closeRef.current();
    dialog.addEventListener("close", close);
    return () => {
      dialog.removeEventListener("close", close);
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`sw-dialog ${wide ? "sw-dialog-wide" : ""}`}
      aria-label={title}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="sw-dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="sw-icon"
          aria-label="Cerrar ventana"
          title="Cerrar ventana"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
