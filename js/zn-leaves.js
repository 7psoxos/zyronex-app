// ZyroNex modular extraction — Phase 1: pure formatters

var eur=(n)=> (n||0).toFixed(2).replace('.',',')+' €';
var fmt=(n)=> new Intl.NumberFormat('el-GR').format(n);
var dateGR=(s)=>{if(!s)return '—';const d=new Date(s);return d.toLocaleDateString('el-GR')};
function formatHours(h){
  if(!h || h < 0) return '0ω 0λ';
  const totalMin = Math.round(h * 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}ω ${mins.toString().padStart(2,'0')}λ`;
}
