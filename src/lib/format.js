export const UNIT_LABELS = {
  case: 'Case',
  pack: 'Pack',
  packet: 'Packet',
  roll: 'Roll',
  piece: 'Piece',
  pad: 'Pad',
  kg: 'KG',
  litre: 'L',
  gram: 'Gram',
  box: 'Box',
  bottle: 'Bottle',
  other: 'Unit'
};

export function unitLabel(unit) {
  return UNIT_LABELS[unit] || unit || 'Unit';
}

export function statusFor(balance, product) {
  const b = Number(balance || 0);
  if (b < Number(product.low_stock_point || 0)) return 'low';
  if (b < Number(product.order_point || 0)) return 'order';
  return 'normal';
}


export function formatQuantity(value, product){
  const n=Number(value||0);
  const packaging=product?.packaging||{};
  const levels=Object.entries(packaging)
    .filter(([k,v])=>k!=='base' && Number(v)>1)
    .sort((a,b)=>Number(b[1])-Number(a[1]));
  let remaining=Math.abs(n);
  const parts=[];
  for(const [name,size] of levels){
    const count=Math.floor(remaining/Number(size));
    if(count){parts.push(`${count} ${count===1?name:name+'s'}`);remaining-=count*Number(size);}
  }
  const base=product?.unit||packaging.base;
  if(remaining || !parts.length) parts.push(`${Number(remaining.toFixed(3))} ${base||'unit'}${Number(remaining.toFixed(3))===1?'':'s'}`);
  return (n<0?'-':'')+parts.join(' + ');
}
