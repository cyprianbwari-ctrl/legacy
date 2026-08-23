import React from 'react';
import { X } from 'lucide-react';

export default function Modal({open,title,children,onClose,footer}) {
  if(!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget && onClose?.()}>
      <div className="modal">
        <div className="modal-head"><div><h3>{title}</h3></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
