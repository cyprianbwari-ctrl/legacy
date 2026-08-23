export function downloadCsv(filename,rows){
  const keys=Object.keys(rows[0]||{});
  const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const csv=[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}
export function parseCsv(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const lines=String(reader.result).split(/\r?\n/).filter(Boolean);
      if(!lines.length)return resolve([]);
      const parseLine=line=>line.match(/("([^"]|"")*"|[^,]*)/g)?.filter((_,i,a)=>i<a.length-1).map(v=>v.startsWith('"')?v.slice(1,-1).replaceAll('""','"'):v) || [];
      const headers=parseLine(lines[0]);
      resolve(lines.slice(1).map(line=>Object.fromEntries(parseLine(line).map((v,i)=>[headers[i],v]))));
    };
    reader.onerror=reject;reader.readAsText(file);
  });
}
