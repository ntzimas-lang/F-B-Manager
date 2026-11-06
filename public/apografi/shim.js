// Web build: login with store name + password, and the app's storage on Supabase.
// Exposes window.claude.use(name) with the same small API the app already uses.
(function(){
const SB_URL='https://holeggpnaibvcqmdlxey.supabase.co',SB_KEY='sb_publishable_lWI_Dwdx72hcRDsInqOmkA_ru3wc1hG';
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
let profile=null,resolveReady;const ready=new Promise(r=>resolveReady=r);
const unorm=u=>u.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').trim().toLowerCase().replace(/ς/g,'σ').replace(/\s+/g,' ');
async function emailFor(u){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(unorm(u)));return 'u'+[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32)+'@apografi.app'}
async function fn(action,body={}){
  const {data:{session}}=await sb.auth.getSession();
  const r=await fetch(SB_URL+'/functions/v1/admin-users',{method:'POST',headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+(session?session.access_token:SB_KEY)},body:JSON.stringify({action,...body})});
  const j=await r.json().catch(()=>({error:'network'}));if(!r.ok||j.error)throw j;return j;
}

// ---------- documents ----------
const err=(e,code)=>({code:code||(/not_found|P0002/.test((e&&e.message)||'')?'invalid_argument':(e&&/row-level|permission|42501/.test(e.message+(e.code||'')))?'not_granted':'unavailable'),message:(e&&e.message)||String(e)});
const snapOf=(path,row)=>({id:path.split('/').pop(),exists:!!row,data:()=>row?row.data:undefined,metadata:{}});
let chanN=0;
function watch(filter,refetch){ // realtime: refetch on any change matching the filter
  let t=null;const ch=sb.channel('w'+(++chanN)).on('postgres_changes',{event:'*',schema:'public',table:'docs',filter},()=>{clearTimeout(t);t=setTimeout(refetch,250)}).subscribe();
  const poll=setInterval(refetch,60000);
  return ()=>{clearInterval(poll);sb.removeChannel(ch)};
}
async function fetchColl(coll,where){
  const out=[];for(let from=0;;from+=1000){let q=sb.from('docs').select('path,data').eq('coll',coll);
    for(const [f,v] of where)q=q.filter('data->>'+f,'eq',String(v));
    const {data,error}=await q.order('path').range(from,from+999);if(error)throw err(error);out.push(...data);if(data.length<1000)break}
  return {docs:out.map(r=>snapOf(r.path,r))};
}
function docRef(path){
  const coll=path.split('/')[0];
  // the signed-in store user's own membership, kept in profiles
  if(coll==='members'&&profile&&path==='members/'+profile.user_id){
    const s=()=>snapOf(path,{data:{shops:profile.shop?[profile.shop]:[]}});
    return {get:async()=>s(),onSnapshot:(next)=>{setTimeout(()=>next(s()));return ()=>{}},set:async()=>{},update:async()=>{},delete:async()=>{}};
  }
  const get=async()=>{const {data,error}=await sb.from('docs').select('path,data').eq('path',path).maybeSingle();if(error)throw err(error);return snapOf(path,data)};
  return {
    get,
    set:async d=>{const {error}=await sb.from('docs').upsert({path,coll,data:d,updated_at:new Date().toISOString()});if(error)throw err(error)},
    update:async d=>{const {error}=await sb.rpc('doc_update',{p_path:path,p_patch:d});if(error)throw err(error)},
    delete:async()=>{const {error}=await sb.from('docs').delete().eq('path',path);if(error)throw err(error)},
    onSnapshot:(next,onErr)=>{let live=true;const run=()=>get().then(s=>{if(live)next(s)},e=>onErr&&onErr(e));run();const stop=watch('path=eq.'+path,run);return ()=>{live=false;stop()}},
    collection:()=>{throw new TypeError('nested collections are not used')}
  };
}
function query(coll,where){
  return {
    where:(f,op,v)=>query(coll,[...where,[f,v]]),
    orderBy:()=>query(coll,where),limit:()=>query(coll,where),
    get:()=>fetchColl(coll,where),
    onSnapshot:(next,onErr)=>{
      if(coll==='members'){setTimeout(()=>next({docs:[]}));return ()=>{}}
      let live=true;const run=()=>fetchColl(coll,where).then(s=>{if(live)next(s)},e=>onErr&&onErr(e));run();const stop=watch('coll=eq.'+coll,run);return ()=>{live=false;stop()}},
    doc:id=>docRef(coll+'/'+id),
    add:async d=>{const r=docRef(coll+'/'+Math.random().toString(36).slice(2));await r.set(d);return r}
  };
}
const db={doc:docRef,collection:c=>query(c,[])};
const user={isOwner:async()=>!!profile&&(profile.role==='super'||profile.role==='admin'),canEdit:async()=>!!profile&&(profile.role==='super'||profile.role==='admin'),id:async()=>profile&&profile.user_id,
  me:async()=>({id:profile.user_id,name:profile.username}),profiles:async()=>({}),search:async()=>[]};
const downloads={save:async({filename,data})=>{const blob=data instanceof Blob?data:new Blob([data]);const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);return {status:'saved'}}};
window.claude={use:async n=>{await ready;return n==='db'?db:n==='user'?user:n==='downloads'?downloads:null}};
window.__web={sb,fn,get profile(){return profile}};

// ---------- login ----------
const $=id=>document.getElementById(id);
let setupMode=false;
async function showLogin(){
  document.body.classList.add('locked');$('login').hidden=false;
  try{setupMode=!!(await fn('needs_setup')).needsSetup}catch(e){setupMode=false}
  $('lp2wrap').hidden=!setupMode;
  $('loginHint').textContent=setupMode?'Πρώτη χρήση: δημιούργησε τον λογαριασμό διαχειριστή.':'Σύνδεση με το όνομα του καταστήματος και τον κωδικό σου.';
  $('loginBtn').textContent=setupMode?'Δημιουργία διαχειριστή':'Σύνδεση';
  $('lu').focus();
}
async function afterLogin(){
  const {data:{session}}=await sb.auth.getSession();if(!session)return showLogin();
  const {data:p}=await sb.from('profiles').select('user_id,username,role,shop').eq('user_id',session.user.id).maybeSingle();
  if(!p){await sb.auth.signOut();$('loginErr').textContent='Ο λογαριασμός δεν βρέθηκε.';return showLogin()}
  profile=p;
  // the shop and month the app opens on
  try{if(p.role!=='super'&&p.shop)localStorage.setItem('inv_shop',JSON.stringify(p.shop))}catch(e){}
  $('login').hidden=true;document.body.classList.remove('locked');
  $('meName').textContent=p.role==='store'?(p.shop||p.username):p.username+(p.role==='super'?' · κάτοχος':' · διαχειριστής');document.body.classList.toggle('owner',p.role==='super');$('meBar').hidden=false;
  resolveReady();
  if(p.role==='super')migrate();
}
// one-time copy of the data kept in the earlier Claude version (existing documents are never overwritten)
async function migrate(){
  try{
    const {data:done}=await sb.from('docs').select('path').eq('path','settings/migrated').maybeSingle();if(done)return;
    const r=await fetch('migration.json',{cache:'no-store'});if(!r.ok)return;const rows=await r.json();
    for(let i=0;i<rows.length;i+=25){const {error}=await sb.from('docs').upsert(rows.slice(i,i+25).map(x=>({path:x.path,coll:x.coll,data:x.data})),{onConflict:'path',ignoreDuplicates:true});if(error)throw error}
    await sb.from('docs').upsert({path:'settings/migrated',coll:'settings',data:{at:new Date().toISOString(),n:rows.length}});
    if(typeof toast==='function')toast('Μεταφέρθηκαν τα δεδομένα από την προηγούμενη εφαρμογή');
    setTimeout(()=>location.reload(),1500);
  }catch(e){console.warn('migration',e)}
}
document.addEventListener('DOMContentLoaded',()=>{
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('loginErr').textContent='';$('loginBtn').disabled=true;
    const u=$('lu').value,p=$('lp').value;
    try{
      if(setupMode){if(p!==$('lp2').value)throw {message:'Οι κωδικοί δεν ταιριάζουν.'};await fn('bootstrap',{username:u,password:p})}
      const {error}=await sb.auth.signInWithPassword({email:await emailFor(u),password:p});
      if(error)throw {message:'Λάθος όνομα χρήστη ή κωδικός.'};
      $('lp').value='';$('lp2').value='';await afterLogin();
    }catch(x){$('loginErr').textContent=x.message||(x.error==='invalid'?'Το όνομα θέλει 2+ χαρακτήρες και ο κωδικός 6+.':'Κάτι πήγε στραβά. Δοκίμασε ξανά.')}
    $('loginBtn').disabled=false;
  });
  $('logoutBtn').addEventListener('click',async()=>{await sb.auth.signOut();location.reload()});
  $('pwBtn').addEventListener('click',()=>{$('pwBox').hidden=!$('pwBox').hidden;if(!$('pwBox').hidden)$('pwNew').focus()});
  $('pwSave').addEventListener('click',async()=>{const p=$('pwNew').value;if(p.length<6){$('pwMsg').textContent='Τουλάχιστον 6 χαρακτήρες.';return}
    try{await fn('change_own_password',{password:p});$('pwNew').value='';$('pwMsg').textContent='Ο κωδικός άλλαξε.'}catch(e){$('pwMsg').textContent='Δεν άλλαξε. Δοκίμασε ξανά.'}});
  sb.auth.getSession().then(({data:{session}})=>session?afterLogin():showLogin());
});
})();
