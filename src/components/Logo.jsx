import React from 'react';
export default function Logo({compact=false}) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <div className="brand-mark">SL</div>
      {!compact && <div><div className="brand-name">STOCK</div><div className="brand-sub">CONTROL</div></div>}
    </div>
  );
}
