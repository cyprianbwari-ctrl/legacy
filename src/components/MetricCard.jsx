import React from 'react';
export default function MetricCard({label,value,sub,icon, tone=''}) {
  return <div className={`metric-card ${tone}`}>
    <div className="metric-top"><span>{label}</span>{icon && <span className="metric-icon">{icon}</span>}</div>
    <strong>{value}</strong>
    {sub && <small>{sub}</small>}
  </div>;
}
