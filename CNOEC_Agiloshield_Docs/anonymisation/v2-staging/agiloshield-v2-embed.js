import { AgiloShieldV2Client } from './agiloshield-v2-client.js';

const mount = document.getElementById('agiloshield-v2-staging');
const config = window.AGILOSHIELD_V2_CONFIG;
if (!mount || !config || !/^https:\/\//.test(config.BASE_URL || '') ||
    typeof config.getAuthHeaders !== 'function') throw new Error('Configuration V2 staging invalide');
const api = new AgiloShieldV2Client({baseUrl:config.BASE_URL, authHeaders:config.getAuthHeaders});
const codes = ['ADR','DAT','EML','IBA','IDN','JOB','LOC','ORG','PER','PII','PRO','TEL','URL'];
const defaults = ['ADR','EML','IBA','IDN','PER','TEL','URL'];
const labels = {ADR:'Adresse',DAT:'Date',EML:'Email',IBA:'IBAN',IDN:'Identifiant',JOB:'Intitulé de poste',
  LOC:'Lieu',ORG:'Organisation',PER:'Personne',PII:'Donnée personnelle générique',PRO:'Profession',
  TEL:'Téléphone',URL:'URL'};
const supported = /\.(pdf|docx|xlsx|pptx|txt|csv)$/i;
const storageKey = 'agiloshield-v2-staging-session-jobs';
const state = {preferencesReady:false, entries:[], active:null, running:false, drawerOpen:false,
  lastFocus:null, previewSerial:0, previewCleanup:null};
const el = (tag,text,klass,parent) => {
  const out=document.createElement(tag);
  if(text!==null && text!==undefined) out.textContent=String(text);
  if(klass) out.className=klass;
  if(parent) parent.appendChild(out);
  return out;
};
const clear = element => element.replaceChildren();
const button = (text,klass,parent,handler) => {
  const out=el('button',text,klass,parent);out.type='button';if(handler)out.addEventListener('click',handler);return out;
};
const statusOf = job => job.anonStatus || job.status;
const activeEntry = () => state.entries.find(entry=>entry.key===state.active);
const selected = () => codes.filter(code=>checks.get(code).checked);
const isTerminal = status => ['READY','REVIEW_REQUIRED','FAILED'].includes(status);
const formatOf = name => (supported.exec(name||'')?.[1]||'').toLowerCase();
const errorText = error => location.protocol==='file:'?
  'Ouvrez la page Webflow staging en HTTPS : un fichier local ne peut pas utiliser la session et l’API Agilotext.':
  error?.status===401?'Session Agilotext requise ou expirée.':
  error?.status===409?'Révision périmée : actualisez ce document.':error?.message||'Erreur inconnue';

const shell=el('section',null,'asv2-shell',mount);
const head=el('header',null,'asv2-landing-head',shell);
el('span','AgiloShield V2 · recette','asv2-brand',head);
el('h2','Anonymiser vos données avant usage IA',null,head);
el('p','Déposez un document, puis consultez son original et son résultat dans le panneau de revue.',null,head);
const notice=el('div','Chargement des préférences…','asv2-notice',shell);
notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
const form=el('form',null,'asv2-form',shell);
const surfaceTabs=el('div',null,'asv2-surface-tabs',form);
surfaceTabs.setAttribute('role','tablist');surfaceTabs.setAttribute('aria-label','Modes de traitement');
const fileTab=button('', 'asv2-surface-tab is-active',surfaceTabs,()=>setSurface('file'));
el('strong','Traitement de fichier',null,fileTab);
el('small','PDF, Word, Excel, PowerPoint, TXT, CSV',null,fileTab);
const textTab=button('', 'asv2-surface-tab',surfaceTabs,()=>setSurface('text'));
el('strong','Traitement de texte',null,textTab);el('small','Saisi ou collé',null,textTab);
const restoreTab=button('', 'asv2-surface-tab',surfaceTabs,()=>setSurface('restore'));
el('strong','Restauration',null,restoreTab);el('small','Fichier et clé V2',null,restoreTab);
restoreTab.disabled=config.PSEUDONYMIZATION_ENABLED!==true;
if(restoreTab.disabled)restoreTab.title='Restauration V2 non disponible sur cette recette.';
for(const tab of [fileTab,textTab,restoreTab])tab.setAttribute('role','tab');
fileTab.setAttribute('aria-selected','true');textTab.setAttribute('aria-selected','false');
restoreTab.setAttribute('aria-selected','false');
const layout=el('div',null,'asv2-layout',form);
const main=el('div',null,'asv2-main',layout);
const side=el('aside',null,'asv2-side',layout);side.setAttribute('aria-label','Paramètres');
const filePane=el('div',null,'asv2-file-pane',main);filePane.setAttribute('role','tabpanel');
const textPane=el('div',null,'asv2-text-pane',main);textPane.setAttribute('role','tabpanel');textPane.hidden=true;
const restorePane=el('div',null,'asv2-text-pane',main);restorePane.setAttribute('role','tabpanel');restorePane.hidden=true;
fileTab.id='asv2-tab-file';textTab.id='asv2-tab-text';
filePane.id='asv2-pane-file';textPane.id='asv2-pane-text';
restorePane.id='asv2-pane-restore';restoreTab.id='asv2-tab-restore';
fileTab.setAttribute('aria-controls',filePane.id);textTab.setAttribute('aria-controls',textPane.id);
restoreTab.setAttribute('aria-controls',restorePane.id);
filePane.setAttribute('aria-labelledby',fileTab.id);textPane.setAttribute('aria-labelledby',textTab.id);
restorePane.setAttribute('aria-labelledby',restoreTab.id);
el('h3','Traitement de texte',null,textPane);
el('p','Ce texte sera envoyé comme fichier TXT et suivra le même parcours de revue.',
  'asv2-muted',textPane);
const textInput=el('textarea',null,'asv2-text-input',textPane);
textInput.placeholder='Collez ou saisissez le texte à anonymiser…';
textInput.setAttribute('aria-label','Texte à anonymiser');
const textAdd=button('Ajouter ce texte à la file','asv2-secondary',textPane,()=>{
  if(!textInput.value.trim()){notify('Saisissez du texte avant de l’ajouter.','is-warning');return;}
  addFiles([new File([textInput.value],`texte-${Date.now()}.txt`,{type:'text/plain;charset=utf-8'})]);
  textInput.value='';
});textAdd.disabled=true;
el('h3','Restituer un fichier pseudonymisé',null,restorePane);
el('p','Choisissez le fichier et sa clé .properties. La restitution recrée des données sensibles. Un fichier édité ne peut pas être certifié identique à l’original.',
  'asv2-muted',restorePane);
el('label','Fichier pseudonymisé',null,restorePane);
const restoreFile=el('input',null,'asv2-restore-input',restorePane);restoreFile.type='file';
restoreFile.accept='.pdf,.docx,.xlsx,.pptx,.txt,.csv';
el('label','Clé de correspondance',null,restorePane);
const restoreKey=el('input',null,'asv2-restore-input',restorePane);restoreKey.type='file';restoreKey.accept='.properties,.txt';
const restoreInspect=button('Voir les substitutions','asv2-secondary',restorePane,inspectRestore);
const restoreSummary=el('div','Aucune clé chargée.','asv2-preview-help',restorePane);
const restoreConfirm=button('Confirmer et restituer','asv2-primary',restorePane,doRestore);
restoreConfirm.disabled=true;
el('h3','Mode de traitement',null,side);
const anonMode=el('label',null,'asv2-mode is-selected',side);
const anonRadio=el('input',null,null,anonMode);anonRadio.type='radio';anonRadio.name='asv2Mode';anonRadio.checked=true;
el('span','Anonymiser','asv2-mode-title',anonMode);
const pseudoMode=el('label',null,'asv2-mode'+(config.PSEUDONYMIZATION_ENABLED===true?'':' is-unavailable'),side);
const pseudoRadio=el('input',null,null,pseudoMode);pseudoRadio.type='radio';pseudoRadio.name='asv2Mode';
pseudoRadio.disabled=config.PSEUDONYMIZATION_ENABLED!==true;
el('span','Pseudonymiser','asv2-mode-title',pseudoMode);
el('small',pseudoRadio.disabled?'Non disponible sur cette recette.':'Étiquettes visibles et clé de restitution contrôlée.',null,pseudoMode);
for(const radio of [anonRadio,pseudoRadio])radio.addEventListener('change',()=>{
  anonMode.classList.toggle('is-selected',anonRadio.checked);
  pseudoMode.classList.toggle('is-selected',pseudoRadio.checked);
  submit.textContent=pseudoRadio.checked?'Pseudonymiser les documents':'Anonymiser les documents';
});
el('h3','Paramètres',null,side);
const typesButton=button('Types de données','asv2-types-button',side,openTypes);
const typeCount=el('span','…','asv2-count',typesButton);
typesButton.disabled=true;
el('p','Cliquez pour choisir les 13 catégories. Les préférences sont enregistrées pour les prochains jobs.',
  'asv2-muted asv2-side-help',side);
el('p','Une catégorie décochée peut rester visible. READY porte uniquement sur la sélection du job.',
  'asv2-policy-note',side);
const policyModal=el('div',null,'asv2-policy-modal',mount);policyModal.hidden=true;
const policyDialog=el('section',null,'asv2-policy-dialog',policyModal);
policyDialog.setAttribute('role','dialog');policyDialog.setAttribute('aria-modal','true');
policyDialog.setAttribute('aria-labelledby','asv2-policy-title');
const policyHeader=el('header',null,'asv2-policy-header',policyDialog);
const policyHeading=el('div',null,null,policyHeader);
const policyTitle=el('h2','Sélectionnez les types de données',null,policyHeading);policyTitle.id='asv2-policy-title';
el('p','Ces préférences sont enregistrées et appliquées aux prochains traitements.',
  'asv2-muted',policyHeading);
const policyClose=button('×','asv2-close',policyHeader,()=>closeTypes(false));
policyClose.setAttribute('aria-label','Fermer les types de données');
const policy=el('section',null,'asv2-policy',policyDialog);
const policyHead=el('div',null,'asv2-section-head',policy);
el('h3','Types de données à anonymiser',null,policyHead);
el('span','13 catégories','asv2-count',policyHead);
const grid=el('div',null,'asv2-grid',policy);
const checks=new Map();
for(const code of codes){
  const label=el('label',null,'asv2-type',grid);
  const box=el('input',null,null,label);box.type='checkbox';box.disabled=true;box.dataset.code=code;
  el('span',code,'asv2-code',label);el('span',labels[code],null,label);checks.set(code,box);
}
const shortcuts=el('div',null,'asv2-shortcuts',policyDialog);
for(const [caption,values] of [['Paramètres par défaut',defaults],['Tout sélectionner',codes],['Tout désélectionner',[]]]){
  const control=button(caption,'asv2-link',shortcuts,()=>{
    for(const [code,box] of checks) box.checked=values.includes(code);
  });control.disabled=true;
}
const policyActions=el('div',null,'asv2-policy-actions',policyDialog);
const policyError=el('p','', 'asv2-policy-error',policyDialog);policyError.hidden=true;
const policyCancel=button('Annuler','asv2-secondary',policyActions,()=>closeTypes(false));
const policySave=button('Enregistrer','asv2-primary',policyActions,saveTypes);policySave.disabled=true;
const drop=el('div',null,'asv2-drop',filePane);drop.tabIndex=0;drop.setAttribute('role','button');
drop.setAttribute('aria-label','Choisir ou déposer jusqu’à 12 documents');
el('span','Déposez vos documents ici','asv2-drop-title',drop);
el('span','ou cliquez pour choisir des fichiers · 12 maximum','asv2-drop-subtitle',drop);
el('span','PDF · DOCX · XLSX · PPTX · TXT · CSV','asv2-drop-types',drop);
const fileInput=el('input',null,'asv2-file-input',form);fileInput.type='file';fileInput.multiple=true;
fileInput.accept='.pdf,.docx,.xlsx,.pptx,.txt,.csv';fileInput.disabled=true;
const queue=el('ul',null,'asv2-queue',main);queue.setAttribute('aria-label','Documents sélectionnés');
const actions=el('div',null,'asv2-form-actions',main);
const retry=button('Réessayer le chargement','asv2-secondary',actions,loadPreferences);retry.hidden=true;
const submit=el('button','Anonymiser les documents','asv2-primary',actions);submit.type='submit';submit.disabled=true;
el('p','Sélectionnez un fichier pour ouvrir son aperçu et sa vérification.',
  'asv2-preview-help',main);

const drawer=el('div',null,'asv2-drawer',mount);drawer.hidden=true;
const backdrop=button('Fermer le panneau','asv2-backdrop',drawer,closeDrawer);backdrop.setAttribute('aria-label','Fermer la revue');
const panel=el('aside',null,'asv2-panel',drawer);panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
panel.setAttribute('aria-labelledby','asv2-drawer-title');
const drawerHead=el('header',null,'asv2-drawer-head',panel);
const drawerHeading=el('div',null,'asv2-drawer-heading',drawerHead);
el('span','AgiloShield V2 · revue documentaire','asv2-overline',drawerHeading);
const title=el('h2','Document','asv2-drawer-title',drawerHeading);title.id='asv2-drawer-title';
const meta=el('p','', 'asv2-meta',drawerHeading);
const close=button('×','asv2-close',drawerHead,closeDrawer);close.setAttribute('aria-label','Fermer le document');
const drawerNotice=el('div','', 'asv2-drawer-notice',panel);drawerNotice.setAttribute('role','status');
drawerNotice.setAttribute('aria-live','polite');
const tabs=el('div',null,'asv2-mobile-tabs',panel);
const tabDoc=button('Document','asv2-tab is-active',tabs,()=>setMobileTab('doc'));
const tabIssues=button('Vérification','asv2-tab',tabs,()=>setMobileTab('issues'));
const workspace=el('div',null,'asv2-workspace is-doc',panel);
const issuePane=el('section',null,'asv2-issues',workspace);issuePane.setAttribute('aria-label','Détections et problèmes');
const viewerPane=el('section',null,'asv2-viewer',workspace);viewerPane.setAttribute('aria-label','Aperçu du document');
const viewerToolbar=el('div',null,'asv2-viewer-toolbar',viewerPane);
const viewerBody=el('div',null,'asv2-viewer-body',viewerPane);
const drawerFooter=el('footer',null,'asv2-drawer-footer',panel);

function notify(text,kind='') {notice.textContent=text;notice.className='asv2-notice '+kind;}
function drawerMessage(text,kind='') {drawerNotice.textContent=text;drawerNotice.className='asv2-drawer-notice '+kind;}
function updateSubmit(){submit.disabled=!state.preferencesReady||state.running||
  !state.entries.some(entry=>entry.status==='LOCAL');}
let typesSnapshot=[];let modalLastFocus=null;let savingTypes=false;
function setSurface(kind){
  const file=kind==='file',text=kind==='text',restore=kind==='restore';
  if(restore&&restoreTab.disabled)return;
  filePane.hidden=!file;textPane.hidden=!text;restorePane.hidden=!restore;
  fileTab.classList.toggle('is-active',file);textTab.classList.toggle('is-active',text);
  restoreTab.classList.toggle('is-active',restore);
  fileTab.setAttribute('aria-selected',String(file));textTab.setAttribute('aria-selected',String(text));
  restoreTab.setAttribute('aria-selected',String(restore));
}
function openTypes(){
  if(!state.preferencesReady)return;
  typesSnapshot=selected();modalLastFocus=document.activeElement;
  policyError.hidden=true;policyModal.hidden=false;document.body.classList.add('asv2-policy-open');
  policyClose.focus();
}
function closeTypes(saved){
  if(savingTypes||policyDialog.querySelector('.asv2-confirm'))return;
  if(!saved){const keep=new Set(typesSnapshot);for(const [code,box] of checks)box.checked=keep.has(code);}
  policyModal.hidden=true;document.body.classList.remove('asv2-policy-open');
  if(modalLastFocus?.isConnected)modalLastFocus.focus();
}
policyModal.addEventListener('click',event=>{if(event.target===policyModal)closeTypes(false);});
policyModal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeTypes(false);return;}
  if(event.key!=='Tab')return;
  const items=[...policyDialog.querySelectorAll('button:not([disabled]),input:not([disabled])')]
    .filter(item=>item.getClientRects().length);
  if(!items.length)return;
  if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
});
async function saveTypes(){
  const types=selected(),sensitive=defaults.some(code=>!types.includes(code));
  if(sensitive&&!await confirmAction(types.length?
    'Certaines données directement identifiantes resteront visibles. Enregistrer ce choix ?':
    'Aucune catégorie n’est sélectionnée. Enregistrer ce choix ?'))return;
  savingTypes=true;policySave.disabled=true;policyClose.disabled=true;policyCancel.disabled=true;
  policyError.hidden=true;
  try{
    const response=await api.savePreferences({schemaVersion:1,selectedTypes:types,
      sensitiveKeepAcknowledged:sensitive});
    const saved=response?.protectionPolicy?.selectedTypes;
    if(!Array.isArray(saved)||JSON.stringify([...saved].sort())!==JSON.stringify([...types].sort()))
      throw new Error('Préférences non enregistrées par la façade');
    typeCount.textContent=String(types.length);typesSnapshot=[...types];savingTypes=false;closeTypes(true);
    notify('Préférences enregistrées. Elles seront appliquées aux prochains documents.');
  }catch(error){policyError.textContent=errorText(error);policyError.hidden=false;}
  finally{savingTypes=false;policySave.disabled=!state.preferencesReady;
    policyClose.disabled=false;policyCancel.disabled=false;}
}
function setEnabled(yes){
  state.preferencesReady=yes;fileInput.disabled=!yes;textInput.disabled=!yes;
  typesButton.disabled=!yes;textAdd.disabled=!yes;policySave.disabled=!yes;
  for(const box of checks.values())box.disabled=!yes;
  for(const control of shortcuts.querySelectorAll('button'))control.disabled=!yes;
  drop.classList.toggle('is-disabled',!yes);
  drop.setAttribute('aria-disabled',String(!yes));updateSubmit();
}
async function loadPreferences(){
  setEnabled(false);retry.hidden=true;notify('Chargement des préférences…');
  try{
    const response=await api.preferences();const types=response?.protectionPolicy?.selectedTypes;
    if(!Array.isArray(types)||types.some(code=>!codes.includes(code)))throw new Error('Préférences serveur invalides');
    const set=new Set(types);for(const [code,box] of checks)box.checked=set.has(code);
    typeCount.textContent=String(types.length);
    setEnabled(true);notify('Préférences chargées. Vous pouvez déposer vos documents.');
  }catch(error){retry.hidden=false;notify(errorText(error),'is-error');}
}
function addFiles(files){
  if(!state.preferencesReady)return;
  const additions=[...files];
  if(state.entries.length+additions.length>12){notify('Limite de 12 documents par session.','is-error');return;}
  let firstAdded=null;
  for(const file of additions){
    if(!supported.test(file.name)){notify('Format non pris en charge : '+file.name,'is-error');continue;}
    const entry={key:crypto.randomUUID(),file,name:file.name,format:formatOf(file.name),jobId:null,
      digest:null,selectedTypes:null,processingMode:pseudoRadio.checked?'PSEUDONYMIZE':'ANONYMIZE',
      status:'LOCAL',revision:null,review:null,regions:null,
      previewKind:'origin',page:1,zoom:1,target:null,error:null,previewSerial:0};
    state.entries.push(entry);
    firstAdded ||= entry;
  }
  renderQueue();if(firstAdded)openDrawer(firstAdded);
  fileInput.value='';
}
fileInput.addEventListener('change',()=>addFiles(fileInput.files));
drop.addEventListener('click',()=>{if(state.preferencesReady)fileInput.click();});
drop.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&state.preferencesReady){event.preventDefault();fileInput.click();}});
for(const name of ['dragenter','dragover'])drop.addEventListener(name,event=>{
  event.preventDefault();if(state.preferencesReady)drop.classList.add('is-dragging');
});
for(const name of ['dragleave','drop'])drop.addEventListener(name,event=>{
  event.preventDefault();drop.classList.remove('is-dragging');
});
drop.addEventListener('drop',event=>addFiles(event.dataTransfer?.files||[]));
function renderQueue(){
  clear(queue);
  for(const entry of state.entries){
    const line=el('li',null,'asv2-queue-item',queue);
    const open=button(entry.name,'asv2-queue-name',line,()=>openDrawer(entry));
    open.title='Ouvrir le document';
    el('span',entry.status==='LOCAL'?'À envoyer':entry.status==='UPLOADING'?'Envoi…':
      entry.status==='TIMED_OUT'?'Suivi interrompu':entry.status==='ERROR'?'Erreur':entry.status,
      'asv2-status asv2-status-'+entry.status.toLowerCase(),line);
    if(entry.status==='LOCAL')button('Retirer','asv2-link',line,()=>{
      state.entries=state.entries.filter(item=>item!==entry);if(state.active===entry.key)closeDrawer();renderQueue();
    });
  }
  updateSubmit();
}
function saveSession(){
  try{sessionStorage.setItem(storageKey,JSON.stringify(state.entries.filter(e=>e.jobId).slice(-12)
    .map(e=>({jobId:e.jobId,digest:e.digest,processingMode:e.processingMode}))));}
  catch(_){/* Session recovery is optional when storage is unavailable. */}
}
async function restoreSession(){
  if(!state.preferencesReady)return;
  let saved=[];try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'[]');}catch(_){return;}
  if(!Array.isArray(saved))return;
  for(const item of saved.slice(-12)){
    if(!item||!item.jobId||!item.digest||state.entries.some(e=>e.jobId===item.jobId))continue;
    const entry={key:crypto.randomUUID(),file:null,name:'Job '+item.jobId,format:'',jobId:item.jobId,
      digest:item.digest,selectedTypes:null,processingMode:item.processingMode||'ANONYMIZE',
      status:'PENDING',revision:null,review:null,regions:null,
      previewKind:'anon',page:1,zoom:1,target:null,error:null,previewSerial:0};
    state.entries.push(entry);
    try{
      const job=await api.status(entry.jobId);assertDigest(entry,job);
      assertMode(entry,job);
      entry.status=statusOf(job);entry.name=job.fileName||job.filename||job.originalFilename||entry.name;
      entry.format=formatOf(entry.name);entry.selectedTypes=job.protectionPolicy?.selectedTypes||null;
      if(isTerminal(entry.status))await loadCurrent(entry);
      else pollEntry(entry).catch(error=>{entry.error=errorText(error);renderQueue();});
    }catch(error){entry.status='ERROR';entry.error=errorText(error);}
  }
  renderQueue();
}
function assertDigest(entry,value){
  if(!entry.digest||value?.protectionPolicy?.digest!==entry.digest)throw new Error('Empreinte de politique incohérente');
}
function assertMode(entry,value){
  if((value?.processingMode||'ANONYMIZE')!==entry.processingMode)
    throw new Error('Mode de traitement incohérent avec le job');
}
async function confirmAction(text){
  return new Promise(resolve=>{
    const host=!policyModal.hidden?policyDialog:drawer.hidden?shell:panel;
    const box=el('div',null,'asv2-confirm',host);
    el('p',text,null,box);
    const yes=button('Confirmer','asv2-primary',box,()=>{box.remove();resolve(true);});
    button('Annuler','asv2-secondary',box,()=>{box.remove();resolve(false);});yes.focus();
  });
}
let inspectedRestore=null;
async function inspectRestore(){
  restoreConfirm.disabled=true;inspectedRestore=null;clear(restoreSummary);
  const file=restoreFile.files?.[0],key=restoreKey.files?.[0];
  if(!file||!key){el('p','Choisissez le fichier et la clé .properties.','asv2-policy-error',restoreSummary);return;}
  try{
    const inspected=await api.inspectRestoration(file,key);
    if(inspected.mode!=='PSEUDONYMIZE'||inspected.confirmationRequired!==true)
      throw new Error('Contrat de restitution inattendu');
    inspectedRestore={file,key};
    el('p','La sortie contiendra de nouveau des données sensibles. Contrôlez ces substitutions :',
      'asv2-policy-note',restoreSummary);
    const list=el('ul',null,null,restoreSummary);
    for(const row of inspected.substitutions||[])
      el('li',`${row.marker} → ${row.original} (${row.count} occurrence(s))`,null,list);
    if(inspected.pdfOriginalOnly)
      el('p','Pour un PDF, seul l’original conservé du job peut être rendu. Après purge, la restitution est impossible.',
        'asv2-policy-note',restoreSummary);
    if(inspected.nonTextMediaAltered)
      el('p','Des médias ont changé : la clé textuelle ne les restaure pas. Le résultat ne sera pas certifié identique à l’original.',
        'asv2-policy-note',restoreSummary);
    restoreConfirm.disabled=false;
  }catch(error){el('p',errorText(error),'asv2-policy-error',restoreSummary);}
}
for(const input of [restoreFile,restoreKey])input.addEventListener('change',()=>{
  restoreConfirm.disabled=true;inspectedRestore=null;restoreSummary.textContent='Vérifiez à nouveau le fichier et sa clé.';
});
async function doRestore(){
  if(!inspectedRestore)return;
  if(!await confirmAction('Cette opération recrée des données sensibles. Confirmer la restitution contrôlée ?'))return;
  restoreConfirm.disabled=true;
  try{
    const response=await api.restore(inspectedRestore.file,inspectedRestore.key,{confirmed:true});
    const assurance=response.headers.get('X-Agiloshield-Assurance');
    if(!['sensitive-restored-not-original-certified','original-retained'].includes(assurance))
      throw new Error('Réponse de restitution non vérifiée');
    const blob=await response.blob();
    const disposition=response.headers.get('Content-Disposition')||'';
    const fallback='document.RESTORED.'+(formatOf(inspectedRestore.file.name)||'bin');
    const filename=(/filename="?([^";]+)"?/i.exec(disposition)?.[1]||fallback).replace(/[^A-Za-z0-9._-]/g,'_');
    const href=URL.createObjectURL(blob),link=el('a',null,null,document.body);
    link.href=href;link.download=filename;link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1500);
    restoreFile.value='';restoreKey.value='';inspectedRestore=null;
    restoreSummary.textContent='Fichier sensible restitué. Conservez-le dans un espace protégé.';
  }catch(error){el('p',errorText(error),'asv2-policy-error',restoreSummary);restoreConfirm.disabled=false;}
}
async function submitQueue(event){
  event.preventDefault();if(!state.preferencesReady||state.running)return;
  if(state.entries.some(entry=>['PENDING','PROCESSING','TIMED_OUT'].includes(entry.status)&&entry.jobId)){
    notify('Reprenez d’abord le suivi du job déjà lancé avant d’envoyer la suite.','is-warning');return;
  }
  const pending=state.entries.filter(entry=>entry.status==='LOCAL');if(!pending.length)return;
  const types=selected();const sensitive=defaults.some(code=>!types.includes(code));
  if(sensitive&&!await confirmAction(types.length?
    'Des catégories directement identifiantes resteront visibles. Confirmer la sélection ?':
    'Aucune catégorie n’est sélectionnée. Confirmer que les données détectées resteront visibles ?'))return;
  const policy={schemaVersion:1,selectedTypes:types,sensitiveKeepAcknowledged:sensitive};
  const processingMode=pseudoRadio.checked?'PSEUDONYMIZE':'ANONYMIZE';
  state.running=true;submit.disabled=true;
  try{
    const saved=await api.savePreferences(policy);
    if(!Array.isArray(saved?.protectionPolicy?.selectedTypes)||
      JSON.stringify([...saved.protectionPolicy.selectedTypes].sort())!==JSON.stringify([...types].sort()))
      throw new Error('Préférences non enregistrées par la façade');
    for(const entry of pending){
      entry.selectedTypes=[...types];entry.digest=saved.protectionPolicy.digest;
      entry.processingMode=processingMode;
      entry.status='UPLOADING';renderQueue();renderDrawer(entry);
      try{
        const created=await api.upload(entry.file,policy,{processingMode});
        if(!created.jobId||created?.protectionPolicy?.digest!==entry.digest)
          throw new Error('Politique du job différente de la sélection');
        assertMode(entry,created);
        entry.jobId=created.jobId;entry.status=statusOf(created)||'PENDING';saveSession();renderQueue();
        await pollEntry(entry);
        if(entry.status==='TIMED_OUT')break;
      }catch(error){entry.status='ERROR';entry.error=errorText(error);renderQueue();renderDrawer(entry);
        if(error?.status===401)break;
      }
    }
  }catch(error){notify(errorText(error),'is-error');}
  finally{state.running=false;renderQueue();}
}
form.addEventListener('submit',submitQueue);
async function pollEntry(entry){
  const deadline=Date.now()+(config.MAX_WAIT_MS||180000);
  while(Date.now()<deadline){
    const job=await api.status(entry.jobId);assertDigest(entry,job);
    assertMode(entry,job);
    entry.status=statusOf(job);entry.selectedTypes=job.protectionPolicy?.selectedTypes||entry.selectedTypes;
    renderQueue();renderDrawer(entry);
    if(isTerminal(entry.status)){await loadCurrent(entry);return;}
    if(!['PENDING','PROCESSING'].includes(entry.status))throw new Error('Statut non reconnu : '+entry.status);
    await new Promise(resolve=>setTimeout(resolve,config.POLL_MS||1500));
  }
  entry.status='TIMED_OUT';entry.error='Le job existe toujours. Reprenez son suivi depuis cette session.';
  renderQueue();renderDrawer(entry);
}
async function loadCurrent(entry){
  const [job,review,regions]=await Promise.all([
    api.status(entry.jobId),api.review(entry.jobId),api.regions(entry.jobId).catch(()=>null)]);
  assertDigest(entry,job);assertDigest(entry,review);
  assertMode(entry,job);assertMode(entry,review);
  entry.status=statusOf(job);entry.revision=review.revision;entry.review=review;entry.regions=regions;
  entry.selectedTypes=job.protectionPolicy?.selectedTypes||entry.selectedTypes;
  entry.name=job.fileName||job.filename||job.originalFilename||entry.name;
  entry.format=formatOf(entry.name)||entry.format;
  if(entry.previewKind==='origin')entry.previewKind='anon';
  renderQueue();renderDrawer(entry);if(state.active===entry.key)await renderPreview(entry);
}
function setMobileTab(value){
  workspace.classList.toggle('is-doc',value==='doc');workspace.classList.toggle('is-issues',value==='issues');
  tabDoc.classList.toggle('is-active',value==='doc');tabIssues.classList.toggle('is-active',value==='issues');
}
function openDrawer(entry){
  if(!entry)return;state.active=entry.key;
  if(!state.drawerOpen){state.lastFocus=document.activeElement;drawer.hidden=false;state.drawerOpen=true;
    requestAnimationFrame(()=>drawer.classList.add('is-open'));document.body.classList.add('asv2-drawer-open');close.focus();}
  setMobileTab('doc');renderDrawer(entry);renderPreview(entry).catch(showError);
}
function closeDrawer(){
  if(!state.drawerOpen)return;state.drawerOpen=false;drawer.classList.remove('is-open');
  document.body.classList.remove('asv2-drawer-open');state.previewSerial++;
  if(state.previewCleanup)state.previewCleanup();
  setTimeout(()=>{if(!state.drawerOpen)drawer.hidden=true;},260);
  if(state.lastFocus?.isConnected)state.lastFocus.focus();
}
drawer.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeDrawer();return;}
  if(event.key!=='Tab')return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(item=>!item.hidden&&item.getClientRects().length);
  if(!focusables.length)return;
  if(event.shiftKey&&document.activeElement===focusables[0]){event.preventDefault();focusables.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===focusables.at(-1)){event.preventDefault();focusables[0].focus();}
});
function showError(error){drawerMessage(errorText(error),'is-error');}
function renderDrawer(entry){
  if(state.active!==entry.key||!state.drawerOpen)return;
  title.textContent=entry.name;meta.textContent=[entry.format.toUpperCase()||'Document',
    entry.processingMode==='PSEUDONYMIZE'?'Pseudonymisé':'Anonymisé',
    entry.revision?'Révision '+entry.revision:null,entry.jobId?'Job '+entry.jobId:null].filter(Boolean).join(' · ');
  drawerMessage(entry.error||({LOCAL:'Original local — données sensibles visibles.',UPLOADING:'Envoi du document…',
    PENDING:'Uploadé / En attente',PROCESSING:'Traitement en cours',READY:'Document prêt selon la sélection de ce job.',
    REVIEW_REQUIRED:'Vérification nécessaire — résultat NON_VERIFIE.',FAILED:'Échec — résultat NON_VERIFIE.',
    TIMED_OUT:'Suivi interrompu — le job reste consultable.'}[entry.status]||entry.status),
    entry.status==='FAILED'||entry.status==='ERROR'?'is-error':
    entry.status==='REVIEW_REQUIRED'||entry.status==='TIMED_OUT'?'is-warning':'');
  renderIssues(entry);renderFooter(entry);
}
function renderIssues(entry){
  clear(issuePane);el('h3','Détections et vérification',null,issuePane);
  el('p','Une décision concerne une seule occurrence. Les changements sont revérifiés par le serveur.','asv2-muted',issuePane);
  if(entry.selectedTypes)el('p','Catégories sélectionnées : '+(entry.selectedTypes.length?entry.selectedTypes.join(', '):'aucune'),
    'asv2-policy-summary',issuePane);
  const review=entry.review;
  if(!review){el('p',entry.jobId?'Les problèmes seront affichés après traitement.':'Déposez le fichier pour voir les décisions du moteur.',
    'asv2-muted',issuePane);return;}
  const reasons=review.qaReasons||review.reasons||[];
  if(reasons.length)el('p',reasons.join(' · '),'asv2-reasons',issuePane);
  const rows=Array.isArray(review.occurrences)?review.occurrences:[];
  for(const row of rows){
    if(!row.id)continue;
    const card=el('article',null,'asv2-issue',issuePane);
    const top=el('div',null,'asv2-issue-head',card);
    el('span',row.category||row.semanticType||'Donnée','asv2-badge',top);
    if(row.page)el('span','Page '+row.page,'asv2-muted',top);
    el('strong',row.text||row.surface||'Occurrence '+row.id,null,card);
    el('small','ID '+row.id+' · '+(row.action||row.privacyAction||'à vérifier'),null,card);
    const issueActions=el('div',null,'asv2-issue-actions',card);
    if(row.page)button('Voir dans le document','asv2-secondary',issueActions,()=>focusOccurrence(entry,row));
    for(const action of ['KEEP','MASK']){
      const control=button(action,'asv2-secondary',issueActions,()=>decide(entry,row.id,action));
      control.disabled=!review.reviewable;
    }
  }
  const unresolved=Array.isArray(review.unresolvedMasks)?review.unresolvedMasks:[];
  if(unresolved.length)el('h4',unresolved.length+' obligation(s) sans région vérifiée',null,issuePane);
  for(const target of unresolved){
    if(!target.maskOccurrenceId||!target.page)continue;
    const card=el('article',null,'asv2-issue asv2-unresolved',issuePane);
    el('strong',(target.category||target.semanticType||'MASK')+' · page '+target.page,null,card);
    el('small','Obligation '+target.maskOccurrenceId,null,card);
    const control=button('Tracer une région liée','asv2-secondary',card,()=>{
      entry.target=target;entry.page=Number(target.page);entry.previewKind='origin';
      setMobileTab('doc');renderPreview(entry).catch(showError);
      drawerMessage('Tracez uniquement la cible de l’obligation '+target.maskOccurrenceId+'.','is-warning');
    });
    control.disabled=!review.reviewable||entry.format!=='pdf';
  }
  if(!rows.length&&!unresolved.length)el('p','Aucune correction interactive disponible.','asv2-muted',issuePane);
}
function renderFooter(entry){
  clear(drawerFooter);
  el('span',entry.status==='READY'?'Prêt selon la politique de ce job':
    entry.status==='REVIEW_REQUIRED'||entry.status==='FAILED'?'NON_VERIFIE — vérification nécessaire':
    'Aucun résultat certifié disponible','asv2-footer-status',drawerFooter);
  if(entry.status==='TIMED_OUT')button('Reprendre le suivi','asv2-secondary',drawerFooter,()=>pollEntry(entry).catch(showError));
  if(entry.status==='ERROR'&&entry.jobId)button('Actualiser le job','asv2-secondary',drawerFooter,
    ()=>loadCurrent(entry).catch(showError));
  if(entry.status==='READY')button('Télécharger le document prêt','asv2-primary',drawerFooter,
    ()=>download(entry,true).catch(showError));
  if(entry.status==='READY'&&entry.processingMode==='PSEUDONYMIZE')
    button('Télécharger la clé de restitution','asv2-secondary',drawerFooter,
      ()=>downloadKey(entry).catch(showError));
  else if(['REVIEW_REQUIRED','FAILED'].includes(entry.status))button('Télécharger NON_VERIFIE','asv2-secondary',drawerFooter,
    ()=>download(entry,false).catch(showError));
}
async function decide(entry,occurrenceId,action){
  if(!await confirmAction(action+' uniquement pour cette occurrence ?'))return;
  try{const receipt=await api.decide(entry.jobId,entry.digest,{revision:entry.revision,occurrenceId,
    action,reason:'review_explicit'});await apply(entry,receipt.revision);}catch(error){showError(error);}
}
async function apply(entry,revision){
  entry.status='PROCESSING';renderDrawer(entry);renderQueue();
  await api.execute(entry.jobId,entry.digest,revision);
  await pollEntry(entry);
}
function focusOccurrence(entry,row){
  entry.page=Number(row.page);entry.focusId=row.id;entry.previewKind='origin';
  setMobileTab('doc');renderPreview(entry).catch(showError);
}
function pageGeometry(entry,pageNumber,base){
  const page=(entry.regions?.pages||[]).find(item=>Number(item.page)===pageNumber);
  const size=page?.size;
  if(!Array.isArray(size)||size.length!==2||!size.every(Number.isFinite)||
    Math.abs(size[0]-base.width)>1||Math.abs(size[1]-base.height)>1||
    Number(page.rotation||0)!==0)return null;
  return page;
}
function strictRegions(entry,base){
  // The review ledger binds these fragments to the exact occurrence and current revision.
  // regions.json supplies only the original page geometry; it has no revision field.
  const row=entry.review?.occurrences?.find(item=>String(item.id)===String(entry.focusId));
  if(!row||String(entry.review.revision)!==String(entry.revision)||
    Number(row.page)!==entry.page||!pageGeometry(entry,entry.page,base))return [];
  return (row.fragments||[]).filter(rect=>Array.isArray(rect)&&rect.length===4&&
    rect.every(Number.isFinite)&&rect[0]>=0&&rect[1]>=0&&
    rect[0]<rect[2]&&rect[1]<rect[3]&&rect[2]<=base.width&&rect[3]<=base.height);
}
async function previewBytes(entry,kind){
  if(kind==='origin'&&entry.file&&!entry.jobId)return {bytes:await entry.file.arrayBuffer(),format:entry.format};
  if(!entry.jobId)throw new Error('Document non déposé');
  const response=await api.preview(entry.jobId,kind);
  const revision=response.headers.get('X-Agiloshield-Revision');
  if(kind==='anon'&&revision&&String(revision)!==String(entry.revision))throw new Error('Aperçu périmé');
  const mime=response.headers.get('Content-Type')||'';
  const format=entry.format||(mime.includes('pdf')?'pdf':mime.includes('wordprocessingml')?'docx':
    mime.includes('csv')?'csv':mime.includes('text/plain')?'txt':'');
  const bytes=await response.arrayBuffer();
  if(kind==='anon'){
    // The current preview route does not always provide a revision header.
    // Refuse a response that raced with a new review revision.
    const [job,review]=await Promise.all([api.status(entry.jobId),api.review(entry.jobId)]);
    assertDigest(entry,job);assertDigest(entry,review);
    if(String(job.reviewRevision)!==String(entry.revision)||
      String(review.revision)!==String(entry.revision)||statusOf(job)!==entry.status)
      throw new Error('Aperçu périmé : actualisez la révision');
  }
  return {bytes,format};
}
async function renderPreview(entry){
  if(state.active!==entry.key||!state.drawerOpen)return;
  const serial=++state.previewSerial;
  if(state.previewCleanup){state.previewCleanup();state.previewCleanup=null;}
  clear(viewerToolbar);clear(viewerBody);
  const kind=entry.previewKind;
  const switcher=el('div',null,'asv2-preview-switch',viewerToolbar);
  for(const [label,value] of [['Original','origin'],['Résultat courant','anon']]){
    const control=button(label,'asv2-secondary'+(value===kind?' is-active':''),switcher,()=>{
      entry.previewKind=value;renderPreview(entry).catch(showError);
    });control.disabled=value==='anon'&&!isTerminal(entry.status);
  }
  el('span',kind==='origin'?'Original — données sensibles visibles':
    entry.status==='READY'?'Résultat courant · READY':'Résultat courant · NON_VERIFIE',
    'asv2-preview-label',viewerToolbar);
  const loading=el('p','Chargement de l’aperçu…','asv2-loading',viewerBody);
  try{
    if(['xlsx','pptx'].includes(entry.format)){
      loading.textContent='Aperçu visuel '+entry.format.toUpperCase()+' non disponible dans cette version. Le traitement et la QA restent consultables.';
      return;
    }
    const source=await previewBytes(entry,kind);
    if(serial!==state.previewSerial||state.active!==entry.key)return;
    clear(viewerBody);
    if(source.format==='pdf')await renderPdf(entry,source.bytes,kind,serial);
    else if(source.format==='docx')await renderDocx(source.bytes,serial);
    else if(source.format==='txt')renderText(source.bytes);
    else if(source.format==='csv')renderCsv(source.bytes);
    else el('p','Aperçu indisponible pour ce format.','asv2-muted',viewerBody);
  }catch(error){if(serial===state.previewSerial){clear(viewerBody);el('p',errorText(error),'asv2-error',viewerBody);}}
}
async function renderPdf(entry,bytes,kind,serial){
  if(!window.pdfjsLib)throw new Error('PDF.js indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=config.PDF_WORKER_URL;
  const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(bytes),enableScripting:false}).promise;
  if(serial!==state.previewSerial){pdf.destroy();return;}
  state.previewCleanup=()=>pdf.destroy();
  entry.page=Math.min(Math.max(1,entry.page),pdf.numPages);
  const nav=el('div',null,'asv2-pdf-nav',viewerBody);
  const prev=button('←','asv2-secondary',nav,()=>{entry.page--;draw().catch(showError);});
  const pageLabel=el('span','',null,nav);
  const next=button('→','asv2-secondary',nav,()=>{entry.page++;draw().catch(showError);});
  const less=button('−','asv2-secondary',nav,()=>{entry.zoom=Math.max(.6,entry.zoom-.2);draw().catch(showError);});
  const zoomLabel=el('span','',null,nav);
  const more=button('+','asv2-secondary',nav,()=>{entry.zoom=Math.min(2,entry.zoom+.2);draw().catch(showError);});
  const pageBox=el('div',null,'asv2-page-scroll',viewerBody);
  async function draw(){
    if(serial!==state.previewSerial)return;
    clear(pageBox);pageLabel.textContent='Page '+entry.page+' / '+pdf.numPages;
    prev.disabled=entry.page<=1;next.disabled=entry.page>=pdf.numPages;
    less.disabled=entry.zoom<=.6;more.disabled=entry.zoom>=2;
    zoomLabel.textContent=Math.round(entry.zoom*100)+' %';
    const page=await pdf.getPage(entry.page);
    const base=page.getViewport({scale:1});
    const fit=Math.min(1.8,Math.max(.4,(pageBox.clientWidth-30||750)/base.width));
    const viewport=page.getViewport({scale:fit*entry.zoom});
    const wrap=el('div',null,'asv2-page',pageBox);
    const canvas=el('canvas',null,null,wrap);
    const pixelRatio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.ceil(viewport.width*pixelRatio);canvas.height=Math.ceil(viewport.height*pixelRatio);
    canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    const context=canvas.getContext('2d');context.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    await page.render({canvasContext:context,viewport}).promise;
    if(serial!==state.previewSerial)return;
    if(kind!=='origin')return;
    const overlay=el('div',null,'asv2-page-overlay',wrap);
    if(entry.focusId){
      const regions=(page.rotate||0)===0?strictRegions(entry,base):[];
      for(const rect of regions){
        const marker=el('div',null,'asv2-region-marker',overlay);
        marker.title='Localisation de l’occurrence dans l’original';
        marker.style.left=(rect[0]/base.width*100)+'%';marker.style.top=(rect[1]/base.height*100)+'%';
        marker.style.width=((rect[2]-rect[0])/base.width*100)+'%';
        marker.style.height=((rect[3]-rect[1])/base.height*100)+'%';
      }
      if(!regions.length)el('p','La région exacte de cette occurrence n’est pas vérifiée pour cet aperçu.',
        'asv2-geometry-note',pageBox);
    }
    if(entry.target&&Number(entry.target.page)===entry.page&&entry.review?.reviewable){
      if((page.rotate||0)!==0||!pageGeometry(entry,entry.page,base))
        el('p','Tracé indisponible : géométrie de la page non garantie.','asv2-geometry-note',pageBox);
      else bindDrawing(entry,overlay,base,serial);
    }
  }
  await draw();
}
function bindDrawing(entry,overlay,base,serial){
  overlay.classList.add('is-drawing');let start=null,ghost=null;
  const point=event=>{
    const box=overlay.getBoundingClientRect();
    return [Math.min(base.width,Math.max(0,(event.clientX-box.left)/box.width*base.width)),
      Math.min(base.height,Math.max(0,(event.clientY-box.top)/box.height*base.height))];
  };
  overlay.onpointerdown=event=>{
    overlay.setPointerCapture(event.pointerId);start=point(event);ghost=el('div',null,'asv2-selection',overlay);
  };
  overlay.onpointermove=event=>{
    if(!start||!ghost)return;const end=point(event),box=overlay.getBoundingClientRect();
    ghost.style.left=Math.min(start[0],end[0])/base.width*box.width+'px';
    ghost.style.top=Math.min(start[1],end[1])/base.height*box.height+'px';
    ghost.style.width=Math.abs(start[0]-end[0])/base.width*box.width+'px';
    ghost.style.height=Math.abs(start[1]-end[1])/base.height*box.height+'px';
  };
  overlay.onpointerup=async event=>{
    if(!start||serial!==state.previewSerial)return;
    const end=point(event),rect=[Math.min(start[0],end[0]),Math.min(start[1],end[1]),
      Math.max(start[0],end[0]),Math.max(start[1],end[1])];
    start=null;ghost?.remove();ghost=null;
    if(rect[2]-rect[0]<4||rect[3]-rect[1]<4)return;
    const target=entry.target;
    if(!target||!await confirmAction('Lier cette région uniquement à '+target.maskOccurrenceId+' et régénérer ?'))return;
    try{
      const receipt=await api.addLinkedRegion(entry.jobId,entry.digest,{revision:entry.revision,
        page:entry.page,rect:rect.map(value=>Math.round(value*100)/100),
        maskOccurrenceId:target.maskOccurrenceId,sourceRevision:entry.review.sourceRevision,
        documentId:entry.review.documentId,reason:target.category==='ORG'?'human_confirmed_private_org':'human_added'});
      entry.target=null;await apply(entry,receipt.revision);
    }catch(error){showError(error);}
  };
  overlay.onpointercancel=()=>{start=null;ghost?.remove();ghost=null;};
}
async function renderDocx(bytes,serial){
  if(!config.DOCX_FRAME_URL)throw new Error('Lecteur Word non configuré');
  // jsDelivr serves .html as text/plain. Read the immutable template and mount it
  // as srcdoc, preserving the opaque sandbox origin and its restrictive CSP.
  const frameUrl=new URL(config.DOCX_FRAME_URL,location.href);
  if(frameUrl.protocol!=='https:'&&frameUrl.origin!==location.origin)
    throw new Error('Origine du lecteur Word non autorisée');
  const template=await fetch(frameUrl.href,{cache:'force-cache'});
  if(!template.ok)throw new Error('Lecteur Word indisponible');
  let html=await template.text();
  let scripts=0;
  html=html.replace(/src="\.\/([^"]+)"/g,(_,path)=>{
    scripts++;return 'src="'+new URL(path,frameUrl).href+'"';
  });
  if(scripts!==3||serial!==state.previewSerial)return;
  const frame=el('iframe',null,'asv2-docx-frame',viewerBody);
  frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('title','Aperçu Word isolé');
  frame.referrerPolicy='no-referrer';
  const nonce=crypto.randomUUID();
  const completion=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('Délai de rendu Word dépassé'));},20000);
    const onMessage=event=>{
      if(event.source!==frame.contentWindow||serial!==state.previewSerial)return;
      if(event.data?.type==='AGILOSHIELD_DOCX_READY'){
        frame.contentWindow.postMessage({type:'AGILOSHIELD_DOCX_RENDER',nonce,bytes},'*',[bytes]);
      }else if(event.data?.nonce===nonce&&event.data?.type==='AGILOSHIELD_DOCX_DONE'){
        cleanup();resolve();
      }else if(event.data?.nonce===nonce&&event.data?.type==='AGILOSHIELD_DOCX_ERROR'){
        cleanup();reject(new Error(event.data.error||'Rendu Word impossible'));
      }
    };
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',onMessage);}
    window.addEventListener('message',onMessage);
    state.previewCleanup=()=>{cleanup();frame.remove();};
  });
  frame.srcdoc=html;
  await completion;
}
function renderText(bytes){
  const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  if(text.length>2_000_000)el('p','Aperçu limité aux deux premiers millions de caractères.','asv2-geometry-note',viewerBody);
  el('pre',text.slice(0,2_000_000),'asv2-text-preview',viewerBody);
}
function parseCsv(text,maxRows=300){
  const firstLine=text.split(/\r?\n/,1)[0]||'';
  const delimiter=(firstLine.match(/;/g)||[]).length>(firstLine.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length&&rows.length<maxRows;i++){
    const char=text[i];
    if(char==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(char===delimiter&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){
      if(char==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';
    }else cell+=char;
  }
  if(row.length||cell)rows.push([...row,cell]);
  return rows;
}
function renderCsv(bytes){
  const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes).replace(/^\uFEFF/,'');
  const rows=parseCsv(text);
  if(rows.length>=300)el('p','Aperçu limité aux 300 premières lignes.','asv2-geometry-note',viewerBody);
  const wrap=el('div',null,'asv2-csv-scroll',viewerBody);
  const table=el('table',null,'asv2-csv',wrap);
  for(const cells of rows){const tr=el('tr',null,null,table);
    for(const value of cells.slice(0,80))el('td',value,null,tr);
  }
}
async function download(entry,certified){
  if(!certified&&!await confirmAction('Ce fichier est NON_VERIFIE : des données sensibles peuvent rester visibles. Télécharger ?'))return;
  const response=await api.checkedArtifact(entry.jobId,{certified,expectedDigest:entry.digest,
    expectedRevision:entry.revision,expectedMode:entry.processingMode});
  const blob=await response.blob();
  const disposition=response.headers.get('Content-Disposition')||'';
  const fallback=(certified?'document-anonymise':'document-NON_VERIFIE')+'.'+(entry.format||'bin');
  const filename=(/filename="?([^";]+)"?/i.exec(disposition)?.[1]||fallback).replace(/[^A-Za-z0-9._-]/g,'_');
  const url=URL.createObjectURL(blob);const link=el('a',null,null,document.body);
  link.href=url;link.download=filename;link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  drawerMessage('Téléchargement '+(certified?'certifié':'NON_VERIFIE')+' démarré.');
}
async function downloadKey(entry){
  const response=await api.checkedKey(entry.jobId,{expectedDigest:entry.digest,
    expectedRevision:entry.revision});
  const blob=await response.blob();
  const href=URL.createObjectURL(blob),link=el('a',null,null,document.body);
  link.href=href;link.download='anon.properties';link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(href),1500);
  drawerMessage('Clé téléchargée. Elle contient des données sensibles : conservez-la dans un espace protégé.');
}
window.addEventListener('pagehide',()=>{state.previewSerial++;state.previewCleanup?.();});
loadPreferences().then(restoreSession);
