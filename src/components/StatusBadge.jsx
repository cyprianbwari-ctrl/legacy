import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function StatusBadge({status, children}) {
  const config = {
    submitted:{cls:'success',icon:<CheckCircle2 size={14}/>},
    normal:{cls:'success',icon:<CheckCircle2 size={14}/>},
    order:{cls:'warning',icon:<AlertTriangle size={14}/>},
    low:{cls:'danger',icon:<XCircle size={14}/>},
    pending:{cls:'muted',icon:null}
  }[status] || {cls:'muted',icon:null};
  return <span className={`status-badge ${config.cls}`}>{config.icon}{children}</span>;
}
