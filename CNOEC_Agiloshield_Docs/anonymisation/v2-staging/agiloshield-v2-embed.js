import { AgiloShieldV2Client } from './agiloshield-v2-client.js';

const mount = document.getElementById('agiloshield-v2-staging');
const config = window.AGILOSHIELD_V2_CONFIG;
if (!mount || !config) throw new Error('AgiloShield V2 staging mount/config absent');
if (!/^https:\/\//.test(config.BASE_URL || '') || typeof config.getAuthHeaders !== 'function') {
  throw new Error('AgiloShield V2 staging URL/auth invalides');
}
const api = new AgiloShieldV2Client({baseUrl:config.BASE_URL, authHeaders:config.getAuthHeaders});
const codes = ['ADR','DAT','EML','IBA','IDN','JOB','LOC','ORG','PER','PII','PRO','TEL','URL'];
const defaults = ['ADR','EML','IBA','IDN','PER','TEL','URL'];
const labels = {ADR:'Adresse',DAT:'Date',EML:'Email',IBA:'IBAN',IDN:'Identifiant',JOB:'Intitulé de poste',LOC:'Lieu',ORG:'Organisation',PER:'Personne',PII:'Donnée personnelle générique',PRO:'Profession',TEL:'Téléphone',URL:'URL'};
const state = {preferencesReady:false, jobId:null, file:null, digest:null, status:null, revision:null,
  review:null, pdf:null, page:1, target:null, pollToken:0, previewKind:'origin',selectedSnapshot:null};

function node(tag, text, klass, parent) {
  const n = document.createElement(tag);
  if (text !== undefined && text !== null) n.textContent = String(text);
  if (klass) n.className = klass;
  if (parent) parent.appendChild(n);
  return n;
}
function empty(n) { n.replaceChildren(); }
const root = node('section',null,'v2-card',mount);
node('h2','AgiloShield V2 — recette',null,root);
node('p','Choisissez les catégories à protéger, déposez le fichier puis vérifiez le résultat réel.',null,root);
const notice = node('div','Connexion et préférences en cours…','v2-notice',root);
notice.setAttribute('role','status'); notice.setAttribute('aria-live','polite');
const form = node('form',null,null,root);
const fileLabel = node('label','Document PDF, DOCX, XLSX, PPTX, TXT ou CSV',null,form);
const fileInput = node('input',null,null,fileLabel); fileInput.type='file'; fileInput.required=true;
fileInput.accept='.pdf,.docx,.xlsx,.pptx,.txt,.csv'; fileInput.disabled=true;
node('h3','Types de données à anonymiser (13)',null,form);
const grid = node('div',null,'v2-grid',form);
const checks = new Map();
for (const code of codes) {
  const lab=node('label',null,'v2-type',grid);
  const box=node('input',null,null,lab); box.type='checkbox'; box.disabled=true; box.dataset.code=code;
  node('span',code,'v2-code',lab); node('span',labels[code],null,lab);
  checks.set(code,box);
}
const shortcuts=node('div',null,'v2-actions',form);
for (const [caption,values] of [['Paramètres par défaut',defaults],['Tout sélectionner',codes],['Tout désélectionner',[]]]) {
  const button=node('button',caption,'secondary',shortcuts); button.type='button'; button.disabled=true;
  button.addEventListener('click',()=>{ for(const [code,box] of checks) box.checked=values.includes(code); });
}
const retry=node('button','Réessayer les préférences','secondary',form); retry.type='button'; retry.hidden=true;
const upload=node('button','Anonymiser ce document',null,form); upload.type='submit'; upload.disabled=true;
const policyNote=node('p','La sélection est enregistrée avec chaque job. Une catégorie décochée reste visible si elle est détectée.',null,form);
const result=node('section',null,null,root);
const issues=node('section',null,null,root);
const previewSection=node('section',null,null,root);

function message(text,kind='') {notice.textContent=text; notice.className='v2-notice '+kind;}
function setEnabled(yes) {
  state.preferencesReady=yes; fileInput.disabled=!yes; upload.disabled=!yes;
  for(const box of checks.values()) box.disabled=!yes;
  for(const button of shortcuts.querySelectorAll('button')) button.disabled=!yes;
}
function selected() {return codes.filter(code=>checks.get(code).checked);}
function statusOf(job) {return job.anonStatus || job.status;}
function assertDigest(value) {
  if(!state.digest || value?.protectionPolicy?.digest!==state.digest) throw new Error('Empreinte de politique incohérente');
}
function errorText(error) {
  if(error.status===401) return 'Session Agilotext requise ou expirée.';
  if(error.status===409) return 'Révision périmée : rechargez le job avant une nouvelle action.';
  return error?.message || 'Erreur inconnue';
}
function reportError(error) {
  if(error.status===401 && typeof window.agiloshieldV2ClearUserToken==='function') window.agiloshieldV2ClearUserToken();
  message(errorText(error),'v2-error');
}
function confirmAction(text) {
  return new Promise(resolve=>{
    const box=node('div',null,'v2-confirm',root); node('p',text,null,box);
    const yes=node('button','Confirmer',null,box); yes.type='button';
    const no=node('button','Annuler','secondary',box); no.type='button';
    yes.onclick=()=>{box.remove();resolve(true);}; no.onclick=()=>{box.remove();resolve(false);};
  });
}
async function loadPreferences() {
  setEnabled(false); retry.hidden=true; message('Chargement des préférences…');
  try {
    const response=await api.preferences();
    if(!Array.isArray(response?.protectionPolicy?.selectedTypes) ||
       response.protectionPolicy.selectedTypes.some(code=>!codes.includes(code))) throw new Error('Préférences serveur invalides');
    const active=new Set(response.protectionPolicy.selectedTypes);
    for(const [code,box] of checks) box.checked=active.has(code);
    setEnabled(true); message('Préférences chargées. Vous pouvez déposer un document.');
  } catch(error) {retry.hidden=false;reportError(error);}
}
retry.onclick=loadPreferences;

async function submit(event) {
  event.preventDefault();
  if(!state.preferencesReady || !fileInput.files?.[0]) return;
  const file=fileInput.files[0];
  if(!/\.(pdf|docx|xlsx|pptx|txt|csv)$/i.test(file.name)) return message('Format non pris en charge.','v2-error');
  const active=selected(); const sensitive=defaults.some(code=>!active.includes(code));
  if(sensitive && !await confirmAction(active.length ?
     'Des données directement identifiantes resteront visibles. Confirmer cette sélection ?' :
     'Aucune catégorie n’est sélectionnée : les données détectées resteront visibles. Confirmer ?')) return;
  upload.disabled=true; state.pollToken++; empty(result);empty(issues);empty(previewSection);
  const policy={schemaVersion:1,selectedTypes:active,sensitiveKeepAcknowledged:sensitive};
  try {
    const saved=await api.savePreferences(policy);
    if(!Array.isArray(saved?.protectionPolicy?.selectedTypes) ||
       JSON.stringify(saved.protectionPolicy.selectedTypes.slice().sort())!==JSON.stringify(active.slice().sort()))
      throw new Error('Préférences non enregistrées par la façade');
    const created=await api.upload(file,policy);
    if(!created.jobId || created?.protectionPolicy?.digest!==saved.protectionPolicy.digest)
      throw new Error('Politique du job différente des préférences enregistrées');
    state.jobId=created.jobId;state.file=file;state.digest=created.protectionPolicy.digest;
    state.selectedSnapshot=active.slice();
    state.status=null;state.revision=null;state.review=null;state.target=null;state.page=1;
    message('Uploadé / En attente. Job '+state.jobId); await poll(state.pollToken);
  } catch(error) {upload.disabled=false;reportError(error);}
}
form.addEventListener('submit',submit);

async function poll(token) {
  const deadline=Date.now()+(config.MAX_WAIT_MS||180000);
  while(token===state.pollToken && Date.now()<deadline) {
    try {
      const job=await api.status(state.jobId); assertDigest(job);
      state.status=statusOf(job);
      if(state.status==='PENDING') message('Uploadé / En attente');
      else if(state.status==='PROCESSING') message('Traitement en cours');
      else if(['READY','REVIEW_REQUIRED','FAILED'].includes(state.status)) {
        await loadCurrent();upload.disabled=false;return;
      } else throw new Error('Statut non reconnu : '+state.status);
    } catch(error) {upload.disabled=false;reportError(error);return;}
    await new Promise(resolve=>setTimeout(resolve,config.POLL_MS||1500));
  }
  if(token===state.pollToken) {upload.disabled=false;message('Délai dépassé. Le job reste consultable par son identifiant.','v2-warning');}
}

async function loadCurrent() {
  const [job,review]=await Promise.all([api.status(state.jobId),api.review(state.jobId)]);
  assertDigest(job);assertDigest(review);
  state.status=statusOf(job);state.revision=review.revision;state.review=review;
  message(state.status==='READY'?'Document prêt selon la sélection du job.':
    state.status==='REVIEW_REQUIRED'?'Vérification nécessaire : résultat NON_VERIFIE.':
    'Échec : résultat NON_VERIFIE.',state.status==='READY'?'v2-success':
      state.status==='FAILED'?'v2-error':'v2-warning');
  renderResult();renderIssues();
  if(state.file?.name.toLowerCase().endsWith('.pdf')) await showPreview(state.previewKind).catch(reportError);
}
function renderResult() {
  empty(result);node('h3','Résultat',null,result);
  const kind=state.status==='READY'?'v2-success':state.status==='FAILED'?'v2-error':'v2-warning';
  node('p',state.status==='READY'?'Document prêt (selon la sélection du job)':
      state.status==='REVIEW_REQUIRED'?'Vérification nécessaire — non certifié':'Échec — non certifié','v2-notice '+kind,result);
  node('p','Catégories masquées pour ce job : '+(state.selectedSnapshot?.length?state.selectedSnapshot.join(', '):'aucune')+'.',null,result);
  node('p','Révision '+state.revision+' · politique '+state.digest,null,result);
  if(state.status==='READY') {
    const button=node('button','Télécharger le document prêt',null,result);button.type='button';
    button.onclick=()=>download(true);
  } else if(['REVIEW_REQUIRED','FAILED'].includes(state.status)) {
    const button=node('button','Télécharger le résultat NON_VERIFIE','secondary',result);button.type='button';
    button.onclick=()=>download(false);
  }
}
function occurrenceLabel(row) {
  return [row.text||row.surface||'Occurrence',row.category||row.semanticType||'',
    'p.'+(row.page||'?'),row.action||row.privacyAction||''].filter(Boolean).join(' · ');
}
function renderIssues() {
  empty(issues);node('h3','Problèmes et décisions par occurrence',null,issues);
  const review=state.review;
  const reasons=review.qaReasons||review.reasons||[];
  if(reasons.length) node('p',reasons.join(' · '),'v2-notice v2-warning',issues);
  const occurrences=Array.isArray(review.occurrences)?review.occurrences:[];
  for(const row of occurrences) {
    if(!row.id) continue;
    const line=node('div',null,'v2-issue',issues);
    node('div',occurrenceLabel(row),null,line);
    node('small','Occurrence '+row.id,null,line);
    for(const action of ['KEEP','MASK']) {
      const button=node('button',action,'secondary',line);button.type='button';
      button.disabled=!review.reviewable;
      button.onclick=()=>decide(row.id,action);
    }
  }
  const unresolved=Array.isArray(review.unresolvedMasks)?review.unresolvedMasks:[];
  if(unresolved.length) node('p','Obligations sans région vérifiée : '+unresolved.length,'v2-notice v2-warning',issues);
  for(const target of unresolved) {
    if(!target.maskOccurrenceId || !target.page) continue;
    const line=node('div',null,'v2-issue',issues);
    node('div',[target.category||target.semanticType||'MASK','page '+target.page,
      target.maskOccurrenceId].join(' · '),null,line);
    const button=node('button','Délimiter cette obligation dans le PDF','secondary',line);button.type='button';
    button.disabled=!review.reviewable || !state.file?.name.toLowerCase().endsWith('.pdf');
    button.onclick=async()=>{state.target=target;state.page=Number(target.page);await showPreview('origin');
      message('Tracez une région pour la seule obligation '+target.maskOccurrenceId+'.');};
  }
  if(!occurrences.length && !unresolved.length) node('p','Aucune correction interactive disponible pour ce job.',null,issues);
}
async function decide(occurrenceId,action) {
  if(!await confirmAction(action+' uniquement pour cette occurrence ?')) return;
  try {
    const receipt=await api.decide(state.jobId,state.digest,{revision:state.revision,occurrenceId,action,reason:'review_explicit'});
    await apply(receipt.revision);
  } catch(error) {reportError(error);}
}
async function apply(revision) {
  message('Nouvelle révision en vérification…');
  await api.execute(state.jobId,state.digest,revision);
  state.pollToken++; await poll(state.pollToken);
}
async function showPreview(kind='origin') {
  if(!state.file?.name.toLowerCase().endsWith('.pdf')) return;
  state.previewKind=kind;
  empty(previewSection);node('h3','Aperçu PDF',null,previewSection);
  const buttons=node('div',null,'v2-actions',previewSection);
  for(const [caption,value] of [['Original','origin'],['Résultat courant — non certifié','anon']]) {
    const button=node('button',caption,'secondary',buttons);button.type='button';
    button.onclick=()=>showPreview(value).catch(reportError);
  }
  const response=await api.preview(state.jobId,kind);
  const data=new Uint8Array(await response.arrayBuffer());
  if(!window.pdfjsLib) throw new Error('PDF.js indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=config.PDF_WORKER_URL;
  state.pdf=await window.pdfjsLib.getDocument({data}).promise;
  state.page=Math.min(Math.max(state.page,1),state.pdf.numPages);
  const nav=node('div',null,'v2-actions',previewSection);
  const prev=node('button','Page précédente','secondary',nav);prev.type='button';
  const count=node('span',' Page '+state.page+' / '+state.pdf.numPages+' ',null,nav);
  const next=node('button','Page suivante','secondary',nav);next.type='button';
  prev.disabled=state.page<=1;next.disabled=state.page>=state.pdf.numPages;
  prev.onclick=()=>{state.page--;renderPage().catch(reportError);};
  next.onclick=()=>{state.page++;renderPage().catch(reportError);};
  const pages=node('div',null,'v2-pages',previewSection);
  async function renderPage() {
    empty(pages);count.textContent=' Page '+state.page+' / '+state.pdf.numPages+' ';
    prev.disabled=state.page<=1;next.disabled=state.page>=state.pdf.numPages;
    const page=await state.pdf.getPage(state.page);
    const view=page.getViewport({scale:1});
    const scale=Math.min(1.7,Math.max(.6,850/view.width));
    const viewport=page.getViewport({scale});
    const wrap=node('div',null,'v2-page',pages);
    const canvas=node('canvas',null,null,wrap);
    canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    node('span','Page '+state.page,null,pages).className='v2-page-label';
    if(kind==='origin' && state.target && Number(state.target.page)===state.page && state.review?.reviewable) {
      if((page.rotate||0)!==0) {
        node('p','Cette page est tournée : le tracé manuel est désactivé pour éviter une mauvaise géométrie.','v2-notice v2-warning',pages);
      } else bindDrawing(wrap,view,state.page);
    }
  }
  await renderPage();
}
function bindDrawing(wrap,viewport,page) {
  const overlay=node('div',null,'v2-overlay',wrap);
  let start=null,ghost=null;
  const point=event=>{
    const box=overlay.getBoundingClientRect();
    return [Math.min(viewport.width,Math.max(0,(event.clientX-box.left)/box.width*viewport.width)),
      Math.min(viewport.height,Math.max(0,(event.clientY-box.top)/box.height*viewport.height))];
  };
  overlay.onpointerdown=event=>{
    if(!state.target || Number(state.target.page)!==page) return;
    overlay.setPointerCapture(event.pointerId); start=point(event);
    ghost=node('div',null,'v2-selection',overlay);
  };
  overlay.onpointermove=event=>{
    if(!start || !ghost) return;
    const end=point(event),box=overlay.getBoundingClientRect();
    ghost.style.left=(Math.min(start[0],end[0])/viewport.width*box.width)+'px';
    ghost.style.top=(Math.min(start[1],end[1])/viewport.height*box.height)+'px';
    ghost.style.width=(Math.abs(start[0]-end[0])/viewport.width*box.width)+'px';
    ghost.style.height=(Math.abs(start[1]-end[1])/viewport.height*box.height)+'px';
  };
  overlay.onpointerup=async event=>{
    if(!start) return;
    const end=point(event),rect=[Math.min(start[0],end[0]),Math.min(start[1],end[1]),
      Math.max(start[0],end[0]),Math.max(start[1],end[1])];
    start=null;if(ghost) ghost.remove();ghost=null;
    if(rect[2]-rect[0]<4 || rect[3]-rect[1]<4) return;
    const target=state.target;
    if(!target || Number(target.page)!==page || !await confirmAction(
      'Lier ce rectangle à l’obligation '+target.maskOccurrenceId+' (page '+page+') et régénérer ?')) return;
    try {
      const receipt=await api.addLinkedRegion(state.jobId,state.digest,{revision:state.revision,page,
        rect:rect.map(x=>Math.round(x*100)/100),maskOccurrenceId:target.maskOccurrenceId,
        sourceRevision:state.review.sourceRevision,documentId:state.review.documentId,
        reason:target.category==='ORG'?'human_confirmed_private_org':'human_added'});
      state.target=null;await apply(receipt.revision);
    } catch(error) {reportError(error);}
  };
  overlay.onpointercancel=()=>{start=null;if(ghost) ghost.remove();ghost=null;};
}

async function download(certified) {
  if(!certified && !await confirmAction('Ce résultat est NON_VERIFIE : des données sensibles peuvent rester visibles. Télécharger quand même ?')) return;
  try {
    const response=await api.checkedArtifact(state.jobId,{certified,
      expectedDigest:state.digest,expectedRevision:state.revision});
    const blob=await response.blob();
    const disposition=response.headers.get('Content-Disposition')||'';
    const filename=(/filename="?([^";]+)"?/i.exec(disposition)?.[1]||
      (certified?'document-anonymise':'document-NON_VERIFIE')+'.'+state.file.name.split('.').pop())
      .replace(/[^A-Za-z0-9._-]/g,'_');
    const url=URL.createObjectURL(blob);const link=node('a',null,null,document.body);
    link.href=url;link.download=filename;link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    message('Téléchargement '+(certified?'certifié':'NON_VERIFIE')+' démarré.');
  } catch(error) {reportError(error);}
}

window.addEventListener('pagehide',()=>{state.pollToken++;});
loadPreferences();
