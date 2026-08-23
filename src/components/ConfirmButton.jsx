import React from 'react';
import { useState } from 'react';
import Modal from './Modal';

export default function ConfirmButton({label='Confirm & Save',title='Confirm Changes',message='Are you sure you want to save these changes?',onConfirm,disabled=false,className='btn btn-primary'}) {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  async function confirm(){
    setBusy(true);
    try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
  }
  return <>
    <button disabled={disabled} className={className} onClick={()=>setOpen(true)}>{label}</button>
    <Modal open={open} title={title} onClose={()=>!busy&&setOpen(false)}
      footer={<><button className="btn btn-secondary" onClick={()=>setOpen(false)} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy?'Saving…':label}</button></>}>
      <p>{message}</p>
    </Modal>
  </>;
}
