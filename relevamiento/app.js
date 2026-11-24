/* Relevamiento de equipos · interfaz "Liquid Glass"
   Usa la misma API del servidor (/api/data, /api/records, /api/import): no requiere cambios en el backend ni en la base. */
'use strict';
const COLORS=[['none','Sin color'],['orange','Naranja'],['yellow','Amarillo'],['green','Verde'],['blue','Azul'],['red','Rojo'],['purple','Violeta']];
const COLOR_IDS=COLORS.map(c=>c[0]);
const S={categories:[],active:null,q:'',editing:null,busy:false,color:'none',sort:{key:null,dir:1},colorFilter:'all',initial:''};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>S.categories.find(c=>c.id===S.active);
const safeColor=c=>COLOR_IDS.includes(c)?c:'none';
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const collator=new Intl.Collator('es',{numeric:true,sensitivity:'base'});

/* ---------- utilidades ---------- */
function toast(s){const n=$('#toast');n.textContent=s;n.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.remove('show'),3200)}
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});let d={};try{d=await r.json()}catch{}if(r.status===401){location.reload();throw Error('Sesión vencida. Volvé a iniciar sesión.')}if(!r.ok)throw Error(d.error||`Error ${r.status}`);return d}
// Cerrar sesión con la misma sesión del sitio principal.
document.getElementById('logout')?.addEventListener('click',async()=>{try{await fetch('/api/logout',{method:'POST'})}catch{}location.href='/'});
function showError(s){$('#errorText').textContent=s;$('#error').hidden=false}
function hideError(){$('#error').hidden=true}
function formatDate(v){if(!v)return'';const d=new Date(String(v).includes('T')?v:String(v).replace(' ','T')+'Z');return isNaN(d)?'':d.toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'})}

/* Resalta la búsqueda sin distinguir mayúsculas ni acentos */
function highlight(value,q){
  const text=String(value);if(!q)return esc(text);
  let flat='',map=[];
  for(let i=0;i<text.length;i++){const n=text[i].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');for(const ch of n){flat+=ch;map.push(i)}}
  let out='',last=0,from=0,idx;
  while(q&&(idx=flat.indexOf(q,from))!==-1){const a=map[idx],b=map[idx+q.length-1]+1;if(a<last){from=idx+1;continue}out+=esc(text.slice(last,a))+'<mark>'+esc(text.slice(a,b))+'</mark>';last=b;from=idx+q.length}
  return out+esc(text.slice(last));
}

/* Diálogo de confirmación con el mismo estilo del sitio */
function ask(title,text,{ok='Aceptar',danger=false}={}){
  return new Promise(resolve=>{
    const box=$('#confirm'),yes=$('#confirmYes'),no=$('#confirmNo');
    $('#confirmTitle').textContent=title;$('#confirmText').textContent=text;yes.textContent=ok;yes.className=danger?'danger solid':'primary';
    const done=v=>{box.hidden=true;yes.onclick=no.onclick=box.onclick=null;document.removeEventListener('keydown',key,true);resolve(v)};
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();done(false)}};
    yes.onclick=()=>done(true);no.onclick=()=>done(false);box.onclick=e=>{if(e.target.hasAttribute('data-cancel'))done(false)};
    document.addEventListener('keydown',key,true);box.hidden=false;setTimeout(()=>yes.focus(),30);
  });
}

/* ---------- render ---------- */
function visibleRecords(c){
  const q=norm(S.q);
  let list=c.records.filter(r=>(!q||c.fields.some(f=>norm(f.label).includes(q)||norm(r.values[f.key]).includes(q)))&&(S.colorFilter==='all'||safeColor(r.color)===S.colorFilter));
  if(S.sort.key){const k=S.sort.key,d=S.sort.dir;list=[...list].sort((a,b)=>{const x=a.values[k],y=b.values[k],ex=x==null||x==='',ey=y==null||y==='';if(ex||ey)return ex===ey?0:ex?1:-1;return collator.compare(String(x),String(y))*d})}
  return list;
}
function renderTabs(){
  $('#tabs').innerHTML=S.categories.map(x=>`<button class="tab ${x.id===S.active?'active':''}" role="tab" aria-selected="${x.id===S.active}" data-id="${esc(x.id)}">${esc(x.name)}<span class="badge">${x.records.length}</span></button>`).join('');
  $$('.tab').forEach(b=>b.onclick=()=>{if(S.active===b.dataset.id)return;S.active=b.dataset.id;store.set('rel-tab',S.active);S.q='';$('#query').value='';S.sort={key:null,dir:1};S.colorFilter='all';render();b.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})});
}
function renderColorFilter(c){
  const counts=Object.fromEntries(COLOR_IDS.map(id=>[id,0]));c.records.forEach(r=>counts[safeColor(r.color)]++);
  const used=COLORS.filter(([id])=>id!=='none'&&counts[id]);
  if(!used.length&&S.colorFilter==='all'){$('#colorFilter').innerHTML='';return}
  const chip=(id,label,n)=>`<button type="button" class="chip ${S.colorFilter===id?'on':''}" data-color="${id}" title="${label}">${id==='all'?'':`<i class="swatch swatch-${id}"></i>`}<span>${label}</span>${n!=null?`<b>${n}</b>`:''}</button>`;
  $('#colorFilter').innerHTML=chip('all','Todos')+used.map(([id,label])=>chip(id,label,counts[id])).join('')+(counts.none&&used.length?chip('none','Sin color',counts.none):'');
  $$('#colorFilter .chip').forEach(b=>b.onclick=()=>{S.colorFilter=S.colorFilter===b.dataset.color?'all':b.dataset.color;render()});
}
function render(){
  const c=current();if(!c)return;
  renderTabs();renderColorFilter(c);
  const q=norm(S.q),records=visibleRecords(c);
  $('#thead').innerHTML=`<tr>${c.fields.map(f=>{const on=S.sort.key===f.key;return `<th><button type="button" class="sort ${on?'on':''}" data-key="${esc(f.key)}" aria-sort="${on?(S.sort.dir>0?'ascending':'descending'):'none'}">${esc(f.label)}<span>${on?(S.sort.dir>0?'↑':'↓'):'↕'}</span></button></th>`}).join('')}<th></th></tr>`;
  $$('#thead .sort').forEach(b=>b.onclick=()=>{const k=b.dataset.key;S.sort=S.sort.key!==k?{key:k,dir:1}:S.sort.dir>0?{key:k,dir:-1}:{key:null,dir:1};render()});
  $('#tbody').innerHTML=records.map(r=>`<tr class="row-${safeColor(r.color)}" data-id="${esc(r.id)}" tabindex="0">${c.fields.map((f,i)=>{const v=r.values[f.key],blank=v==null||v==='';return `<td class="${i?'':'first'} ${blank?'blank':''}" title="${esc(v??'')}">${blank?'—':highlight(v,q)}</td>`}).join('')}<td class="go">›</td></tr>`).join('');
  $$('#tbody tr').forEach(row=>{row.onclick=()=>open(row.dataset.id);row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(row.dataset.id)}}});
  const empty=!records.length;$('#empty').hidden=!empty;$('#tableWrap').hidden=empty;
  $('#count').textContent=c.records.length;$('#results').textContent=records.length;
  $('#total').textContent=S.categories.reduce((n,x)=>n+x.records.length,0);
  $('#marked').textContent=S.categories.reduce((n,x)=>n+x.records.filter(r=>safeColor(r.color)!=='none').length,0);
  $('#title').textContent=c.name;$('#info').textContent=`${c.fields.length} campos · ${c.records.length} registros`;
  $('#foot').textContent=`Mostrando ${records.length} de ${c.records.length} equipos`;
  $('#matches').textContent=q||S.colorFilter!=='all'?`${records.length} ${records.length===1?"coincidencia":"coincidencias"}`:'';
  $('#export').disabled=!c.records.length;
  $('#export').title=records.length!==c.records.length?'Exporta solo las filas filtradas':'Exporta toda la pestaña';
}

/* ---------- ficha ---------- */
function formSnapshot(){return JSON.stringify([$$('#fields input').map(i=>i.value),S.color])}
function open(id=null,prefill=null){
  const c=current(),r=id?c.records.find(x=>x.id===id):null,src=r?.values||prefill||{};
  S.editing=r?id:null;S.color=r?.color?safeColor(r.color):'none';
  $('#formTitle').textContent=r?'Editar equipo':prefill?'Duplicar equipo':'Nuevo equipo';
  const upd=r?formatDate(r.updatedAt):'';$('#formSub').textContent=c.name+(upd?` · Última modificación: ${upd}`:'');
  $('#fields').innerHTML=c.fields.map((f,i)=>`<div class="field"><label for="fld-${esc(f.key)}">${esc(f.label||`Campo ${i+1}`)}</label><input id="fld-${esc(f.key)}" value="${esc(src[f.key]??'')}" autocomplete="off"></div>`).join('');
  $('#colorPicker').innerHTML=COLORS.map(([value,label])=>`<button type="button" class="color-choice ${S.color===value?'selected':''}" data-color="${value}" aria-pressed="${S.color===value}" title="${label}"><i class="swatch swatch-${value}"></i><span>${label}</span></button>`).join('');
  $$('.color-choice').forEach(button=>button.onclick=()=>{S.color=button.dataset.color;$$('.color-choice').forEach(b=>{const sel=b.dataset.color===S.color;b.classList.toggle('selected',sel);b.setAttribute('aria-pressed',sel)})});
  $('#del').hidden=!r;$('#dup').hidden=!r;$('#save').textContent=r?'Guardar cambios':'Agregar equipo';
  $('#modal').hidden=false;document.body.style.overflow='hidden';S.initial=formSnapshot();
  setTimeout(()=>$('#fields input')?.focus(),25);
}
async function close(force=false){
  if(S.busy&&!force)return;
  if(!force&&formSnapshot()!==S.initial&&!await ask('¿Descartar cambios?','Hay datos modificados en la ficha que todavía no se guardaron.',{ok:'Descartar',danger:true}))return;
  $('#modal').hidden=true;document.body.style.overflow='';
}

/* ---------- eventos ---------- */
$('#add').onclick=()=>open();
$('#close').onclick=$('#cancel').onclick=()=>close();
$('#modal').onclick=e=>{if(e.target.hasAttribute('data-close'))close()};
$('#errorClose').onclick=hideError;
$('#dup').onclick=()=>{const c=current(),values=Object.fromEntries(c.fields.map(f=>[f.key,$(`#fld-${CSS.escape(f.key)}`).value]));$('#modal').hidden=true;open(null,values);S.initial='';toast('Revisá los datos (por ejemplo, la serie) y guardá el nuevo equipo')};
document.addEventListener('keydown',e=>{
  if(!$('#confirm').hidden)return;
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if(e.key==='Escape'){if(!$('#modal').hidden)close();else if(S.q||S.colorFilter!=='all'){$('#query').value='';S.q='';S.colorFilter='all';render()}return}
  if($('#modal').hidden&&((e.key==='/'&&!typing)||(e.key.toLowerCase()==='k'&&(e.ctrlKey||e.metaKey)))){e.preventDefault();$('#query').focus();$('#query').select()}
});
let searchTimer;$('#query').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{S.q=e.target.value;render()},110)};
$('#clear').onclick=()=>{$('#query').value='';S.q='';S.colorFilter='all';render();$('#query').focus()};

$('#form').onsubmit=async e=>{
  e.preventDefault();if(S.busy)return;
  const c=current(),values=Object.fromEntries(c.fields.map(f=>[f.key,$(`#fld-${CSS.escape(f.key)}`).value.trim()])),color=S.color;
  if(!Object.values(values).some(v=>v)){showError('Completá al menos un campo antes de guardar.');return}
  S.busy=true;$('#save').disabled=true;
  try{
    if(S.editing){await api(`api/records/${encodeURIComponent(S.editing)}`,{method:'PUT',body:JSON.stringify({values,color})});const record=c.records.find(r=>r.id===S.editing);record.values=values;record.color=color;record.updatedAt=new Date().toISOString();toast('Cambios guardados')}
    else{const d=await api('api/records',{method:'POST',body:JSON.stringify({categoryId:c.id,values,color})});c.records.push({id:d.id,values,color,updatedAt:new Date().toISOString()});toast('Equipo agregado')}
    hideError();await close(true);render();
  }catch(err){showError(err.message)}finally{S.busy=false;$('#save').disabled=false}
};
$('#del').onclick=async()=>{
  if(!S.editing||S.busy)return;
  const c=current(),r=c.records.find(x=>x.id===S.editing),name=r?.values[c.fields[0]?.key]||'este equipo';
  if(!await ask(`¿Eliminar ${name}?`,'Esta acción no se puede deshacer.',{ok:'Eliminar',danger:true}))return;
  S.busy=true;
  try{await api(`api/records/${encodeURIComponent(S.editing)}`,{method:'DELETE'});c.records=c.records.filter(x=>x.id!==S.editing);await close(true);render();toast('Equipo eliminado')}
  catch(err){showError(err.message)}finally{S.busy=false}
};
$('#export').onclick=()=>{
  const c=current(),list=visibleRecords(c),quote=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[c.fields.map(f=>f.label),...list.map(r=>c.fields.map(f=>r.values[f.key]??''))];
  const csv='\uFEFF'+rows.map(row=>row.map(quote).join(';')).join('\r\n'),a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=norm(c.name).replace(/[^a-z0-9]+/g,'-')+(list.length!==c.records.length?'-filtrado':'')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(`Se exportaron ${list.length} equipos`);
};
$('#importButton').onclick=()=>$('#excelFile').click();
$('#excelFile').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>18000000){showError('El Excel debe pesar menos de 18 MB.');e.target.value='';return}
  if(!await ask('¿Importar planilla?',`"${file.name}" reemplaza los datos de las cinco pestañas. Actualiza las coincidencias, agrega equipos nuevos y elimina los registros que ya no estén en el Excel. Se conservan los colores de los equipos que coincidan por serie.`,{ok:'Importar'})){e.target.value='';return}
  const button=$('#importButton');button.disabled=true;button.textContent='Importando…';
  try{
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('No se pudo leer el archivo'));reader.readAsDataURL(file)});
    const encoded=String(dataUrl).split(',')[1];
    const result=await api('api/import',{method:'POST',body:JSON.stringify({fileName:file.name,file:encoded})});
    const activeId=S.active,updated=await api('api/data');S.categories=updated.categories;S.active=S.categories.some(c=>c.id===activeId)?activeId:S.categories[0]?.id;render();
    const skipped=result.unmatchedSheets?.length?` Se omitieron pestañas no reconocidas: ${result.unmatchedSheets.join(', ')}.`:'';
    toast(`Importación completa: ${result.updated} actualizados, ${result.added} agregados y ${result.removed} eliminados.${skipped}`);hideError();
  }catch(err){showError(`No se pudo importar la planilla: ${err.message}`)}
  finally{button.disabled=false;button.textContent='⇧　Importar Excel';e.target.value=''}
};

/* ---------- tema claro / oscuro ---------- */
$('#theme').onclick=()=>{const root=document.documentElement,dark=root.dataset.theme?root.dataset.theme==='dark':matchMedia('(prefers-color-scheme: dark)').matches,next=dark?'light':'dark';root.dataset.theme=next;store.set('rel-theme',next)};

/* ---------- carga inicial ---------- */
$('#tbody').innerHTML='';$('#tableWrap').classList.add('loading');
api('api/data').then(d=>{S.categories=d.categories;const saved=store.get('rel-tab');S.active=S.categories.some(c=>c.id===saved)?saved:S.categories[0]?.id;$('#tableWrap').classList.remove('loading');render()})
.catch(e=>{$('#tableWrap').classList.remove('loading');showError(`No se pudo cargar el relevamiento: ${e.message}. Revisá el servidor y actualizá.`)});
