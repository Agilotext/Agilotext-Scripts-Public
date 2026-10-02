import { AgiloShieldV2Client, digestListDirectives, freezeJobSelection,
  v2Capabilities, assertCreatedJob, currentResultAvailable,
  assertPreviewHeaders } from './agiloshield-v2-client.js';
import { emptyLists, addTerms, validateLists, termKey, loadStoredLists,
  saveStoredLists, clearStoredLists } from './agiloshield-v2-lists.js';
import { originalPdfLocation } from './agiloshield-v2-location.js';
import { COPY, LOCAL_MESSAGES, jobErrorMessage, plural } from './agiloshield-v2-copy.js';
import { iconSvg } from './agiloshield-v2-icons.js';

const mount = document.getElementById('agiloshield-v2-staging');
const config = window.AGILOSHIELD_V2_CONFIG;
if (!mount || !config || !/^https:\/\//.test(config.BASE_URL || '') ||
    typeof config.getAuthHeaders !== 'function') throw new Error('Configuration V2 staging invalide');
const api = new AgiloShieldV2Client({baseUrl:config.BASE_URL, authHeaders:config.getAuthHeaders});
const codes = ['ADR','DAT','EML','IBA','IDN','JOB','LOC','ORG','PER','PII','PRO','TEL','URL'];
const defaults = ['ADR','EML','IBA','IDN','PER','TEL','URL'];
let listsReady = false;
let pseudoReady = false;
let editorCapabilities = {};
let listSelection = emptyLists();
let listDraft = emptyLists();
let listStorePersistent = false;
let preferencesRequest = 0;
const listSnapshot = () => ({anon2InclusionList:[...listSelection.anon2InclusionList],
  anon2ExclusionList:[...listSelection.anon2ExclusionList]});
const labels = {ADR:'Adresse',DAT:'Date',EML:'Email',IBA:'IBAN',IDN:'Identifiant',JOB:'Intitulé de poste',
  LOC:'Lieu',ORG:'Organisation',PER:'Personne',PII:'Donnée personnelle générique',PRO:'Profession',
  TEL:'Téléphone',URL:'URL'};
const supported = /\.(pdf|docx|xlsx|pptx|txt|csv)$/i;
const storageKey = 'agiloshield-v2-staging-session-jobs';
const recentSessionLimit = 50;
const tourKey = 'agiloshield-first-visit-guide-v1';
const terminal = new Set(['READY','REVIEW_REQUIRED','FAILED']);
const active = new Set(['LOCAL','UPLOADING','PENDING','PROCESSING','UNCERTAIN','AUTH_REQUIRED','TIMED_OUT']);
const copy = COPY;
const state = {preferencesReady:false, currentPolicy:null, accountRef:null, accountEpoch:0,
  capabilities:{}, entries:[], active:null, surface:'file',
  running:false, authPaused:false, disposed:false, drawerOpen:false,
  pollRequests:0, pollWaiters:[], autoOpenedBatches:new Set(), historyTab:'v2',
  history:{v2:[],anon2:[],v2Loaded:false,anon2Loaded:false,cursors:{v2:null,anon2:null}},
  selectedHistory:new Set(),
  lastFocus:null, previewSerial:0, previewCleanup:null, previewFocus:null};
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
const nucleoIcon = (name,parent,klass='asv2-btn-icon') => {
  const icon=el('span',null,klass,parent);
  icon.innerHTML=iconSvg(name,16);
  icon.setAttribute('aria-hidden','true');
  return icon;
};
const buttonWithIcon = (text,iconName,klass,parent,handler) => {
  const btn=el('button',null,(klass||'')+' asv2-btn-with-icon',parent);
  btn.type='button';
  if(iconName)nucleoIcon(iconName,btn,'asv2-btn-icon');
  if(text)el('span',text,null,btn);
  if(handler)btn.addEventListener('click',handler);
  return btn;
};
const svgIcon = (name,parent,size=18,klass='asv2-icon') => {
  const span=el('span',null,klass,parent);span.innerHTML=iconSvg(name,size);
  span.setAttribute('aria-hidden','true');return span;
};
const iconButton = (iconName,label,klass,parent,handler) => {
  const btn=el('button',null,(klass||'')+' asv2-icon-only-btn',parent);
  btn.type='button';
  btn.setAttribute('aria-label',label);btn.title=label;
  if(iconName)nucleoIcon(iconName,btn,'asv2-btn-icon');
  if(handler)btn.addEventListener('click',handler);
  return btn;
};
const statusOf = job => {
  const value=job.anonStatus || job.status;
  return ['ON_ERROR','UNSUPPORTED'].includes(value)?'FAILED':value;
};
const activeEntry = () => state.entries.find(entry=>entry.key===state.active);
const selected = () => codes.filter(code=>checks.get(code).checked);
const isTerminal = status => terminal.has(status);
const currentAccountEntry = entry => entry?.removed!==true &&
  entry?.accountRef===state.accountRef && entry?.accountEpoch===state.accountEpoch;
const accountStorageKey = suffix => state.accountRef?
  storageKey+':'+encodeURIComponent(state.accountRef)+suffix:null;
const canDownloadResult = entry => Boolean(entry?.hasCurrentResult &&
  ['READY','REVIEW_REQUIRED'].includes(entry.status));
const canDownloadKey = entry => Boolean(entry?.mode==='PSEUDONYMIZE'&&pseudoReady&&
  canDownloadResult(entry)&&(entry.status==='READY'||
    (entry.status==='REVIEW_REQUIRED'&&editorCapabilities.pseudonymKeyReviewRequired)));
// A review preview is a read-only view; Java independently checks whether a
// downloadable artifact exists when /result or /download is requested.
const canPreviewResult = entry => Boolean(entry?.hasCurrentResult &&
  ['pdf','txt','csv','docx'].includes(entry.format));
const protectedVersionLabel = entry => entry.mode==='PSEUDONYMIZE'?
  'Version pseudonymisée':'Version anonymisée';
const formatOf = name => (supported.exec(name||'')?.[1]||'').toLowerCase();
const localErrors = new Set(['Maximum 100 termes par liste, 256 caractères par terme.',
  'Un terme est présent plusieurs fois.',
  'Le compte a changé. Rechargez la page et redéposez les fichiers non envoyés.',
  'Réponse de masquage incomplète',
  'L’aperçu PDF met trop de temps à s’afficher. Réessayez, ou téléchargez le fichier.']);
const errorText = error => location.protocol==='file:'?
  'Ouvrez la page de test publiée : une copie locale ne peut pas utiliser votre connexion.':
  error?.status===401?'Votre session a expiré. Reconnectez-vous, puis reprenez.':
  error?.status===403?'Vous n’avez pas accès à ce document.':
  error?.status===404?'Ce document n’est plus accessible. Actualisez la liste.':
  error?.code==='RESULT_NOT_AVAILABLE'? 'Le résultat de cette révision n’est pas disponible. Consultez les vérifications avant de réessayer.':
  error?.status===409?'Le document a changé. Actualisez-le avant de continuer.':
  error?.status===413?'Ce fichier dépasse la taille autorisée.':
  error?.code==='COMMAND_INVALID'||error?.status===422?
    'Le masquage n’a pas pu être appliqué. Le document n’a pas changé. Réessayez.':
  error?.code==='JOB_FORBIDDEN'?'Vous n’avez pas accès à ce document.':
  localErrors.has(error?.message)||LOCAL_MESSAGES.has(error?.message)?error.message:copy.errors.generic;
const policySummary = types => Array.isArray(types)?types.length?
  types.length+' catégorie'+(types.length>1?'s':'')+' sur 13 · '+
    types.map(code=>labels[code]||code).join(', '):
  'Aucune catégorie sélectionnée : les données détectées resteront visibles.':
  'Sélection en cours de chargement';
const safeStatus = status => copy.status[status]||copy.status.ERROR;

const shell=el('section',null,'asv2-shell',mount);
const head=el('header',null,'asv2-landing-head',shell);
const headText=el('div',null,'asv2-landing-text',head);
el('h1',copy.heading,'asv2-main-title',headText);
el('p',copy.intro,'asv2-landing-intro',headText);
const tourReplay=buttonWithIcon('Comment ça marche','circle-question','asv2-help-pill',head,()=>startTour(true));
const notice=el('div','Chargement des préférences…','asv2-notice',shell);let noticeTimer=null;
notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
const form=el('form',null,'asv2-form',shell);
const surfaceTabs=el('div',null,'asv2-surface-tabs',form);
surfaceTabs.setAttribute('role','tablist');surfaceTabs.setAttribute('aria-label','Modes de traitement');
const fileTab=button('', 'asv2-surface-tab is-active',surfaceTabs,()=>setSurface('file'));
svgIcon('file',fileTab,16);el('span','Fichiers',null,fileTab);
const textTab=button('', 'asv2-surface-tab',surfaceTabs,()=>setSurface('text'));
svgIcon('text',textTab,16);el('span','Texte',null,textTab);
const restoreTab=button('', 'asv2-surface-tab',surfaceTabs,()=>setSurface('restore'));
svgIcon('key',restoreTab,16);el('span','Restauration',null,restoreTab);
for(const tab of [fileTab,textTab,restoreTab])tab.setAttribute('role','tab');
fileTab.setAttribute('aria-selected','true');textTab.setAttribute('aria-selected','false');
restoreTab.setAttribute('aria-selected','false');
fileTab.tabIndex=0;textTab.tabIndex=-1;restoreTab.tabIndex=-1;
surfaceTabs.addEventListener('keydown',event=>{
  const tabs=[fileTab,textTab,restoreTab].filter(tab=>!tab.hidden);
  if(!tabs.includes(event.target)||!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();
  const index=tabs.indexOf(event.target);
  const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:
    (index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].click();tabs[next].focus();
});
surfaceTabs.remove();
const layout=el('div',null,'asv2-layout',form);
const main=el('div',null,'asv2-main',layout);
const side=el('aside',null,'asv2-side',layout);side.setAttribute('aria-label','Paramètres');
const filePane=el('div',null,'asv2-file-pane',main);filePane.setAttribute('role','tabpanel');
const textPane=el('div',null,'asv2-text-pane',main);textPane.setAttribute('role','tabpanel');textPane.hidden=true;
const restorePane=el('div',null,'asv2-restore-pane',main);restorePane.setAttribute('role','tabpanel');
restorePane.hidden=true;
fileTab.id='asv2-tab-file';textTab.id='asv2-tab-text';restoreTab.id='asv2-tab-restore';
filePane.id='asv2-pane-file';textPane.id='asv2-pane-text';restorePane.id='asv2-pane-restore';
for(const [tab,pane] of [[fileTab,filePane],[textTab,textPane],[restoreTab,restorePane]]){
  tab.setAttribute('aria-controls',pane.id);pane.setAttribute('aria-labelledby',tab.id);
}
const textHead=el('div',null,'asv2-text-head',textPane);
el('h3','Texte à protéger','asv2-text-title',textHead);
el('p','Traité comme un fichier TXT, avec la même vérification.',
  'asv2-pane-hint',textHead);
const textInput=el('textarea',null,'asv2-text-input',textPane);
textInput.placeholder='Collez ou saisissez le texte à anonymiser…';
textInput.setAttribute('aria-label','Texte à protéger');
const textAdd=button('Protéger ce texte','asv2-primary asv2-text-submit',textPane,()=>{
  if(!textInput.value.trim()){notify('Saisissez du texte avant de l’ajouter.','is-warning');return;}
  addFiles([new File([textInput.value],`texte-${Date.now()}.txt`,{type:'text/plain;charset=utf-8'})]);
  textInput.value='';
});textAdd.disabled=true;
button('Revenir au dépôt','asv2-link asv2-restore-back',restorePane,()=>setSurface('file'));
el('h3','Restaurer un fichier pseudonymisé',null,restorePane);
el('p','Préparez un fichier et sa clé de correspondance. La restauration sera activée après qualification complète.',
  'asv2-muted',restorePane);
const restoreNotice=el('p','Restauration bientôt disponible sur cette recette.',
  'asv2-restore-notice',restorePane);
restoreNotice.setAttribute('role','status');
const restoreInputs=el('div',null,'asv2-restore-inputs',restorePane);
function restorePicker(title,hint,chooseLabel,accept,valid){
  const card=el('div',null,'asv2-restore-card',restoreInputs);
  el('strong',title,'asv2-restore-label',card);
  const input=el('input',null,'asv2-restore-input',card);
  input.type='file';input.accept=accept;input.multiple=false;input.hidden=true;
  input.setAttribute('aria-label',title);
  el('p',hint,'asv2-muted',card);
  button(chooseLabel,'asv2-secondary asv2-restore-choose',card,()=>input.click());
  const selected=el('p','', 'asv2-restore-selected',card);selected.hidden=true;
  const reset=()=>{
    input.value='';selected.textContent='';selected.hidden=true;remove.hidden=true;
    resetRestoreInspection();
  };
  const remove=button('Retirer','asv2-link',card,reset);remove.hidden=true;
  input.addEventListener('change',()=>{
    resetRestoreInspection();
    const file=input.files?.[0];
    if(!file){selected.textContent='';selected.hidden=true;remove.hidden=true;return;}
    if(!valid.test(file.name)){
      input.value='';selected.textContent='Format non pris en charge. Choisissez un autre fichier.';
      selected.hidden=false;remove.hidden=true;return;
    }
    const size=file.size<1024?file.size+' octets':
      file.size<1024*1024?Math.ceil(file.size/1024)+' Ko':
      (file.size/1024/1024).toFixed(2)+' Mio';
    selected.textContent=file.name+' · '+size;
    selected.hidden=false;remove.hidden=false;
  });
  reset.getFile=()=>input.files?.[0]||null;
  return reset;
}
const clearRestoreDocument=restorePicker('Fichier pseudonymisé','TXT, CSV, DOCX, XLSX ou PPTX','Choisir le document',
  '.txt,.csv,.docx,.xlsx,.pptx',/\.(txt|csv|docx|xlsx|pptx)$/i);
const clearRestoreKey=restorePicker('Clé de correspondance','Fichier .properties associé au document','Choisir la clé',
  '.properties',/\.properties$/i);
el('p','Le fichier restauré contiendra de nouveau des données sensibles. Après édition, '
  +'il n’est pas certifié identique à l’original.', 'asv2-restore-safety',restorePane);
const restoreInspection=el('div',null,'asv2-restore-inspection',restorePane);
restoreInspection.hidden=true;
const restoreAction=button('Inspecter le fichier et sa clé','asv2-primary',restorePane,
  ()=>inspectRestore().catch(error=>{restoreNotice.textContent=errorText(error);restoreNotice.classList.add('is-error');}));
// Enable after the staging restore workflow is qualified end to end.
const RESTORE_WORKFLOW_QUALIFIED=false;
restoreTab.hidden=!RESTORE_WORKFLOW_QUALIFIED&&config.SHOW_RESTORE!==true;
restoreAction.disabled=true;
restoreAction.setAttribute('aria-describedby','asv2-restore-unavailable');
restoreNotice.id='asv2-restore-unavailable';
let restoreInspectionId=null;
let restoreInspectionMeta=null;
let restoreBusy=false;
function resetRestoreInspection(){
  restoreInspectionId=null;restoreInspectionMeta=null;
  clear(restoreInspection);restoreInspection.hidden=true;
  updateRestoreAction();
}
function updateRestoreAction(){
  const ready=state.preferencesReady&&editorCapabilities.pseudonymRestore&&
    RESTORE_WORKFLOW_QUALIFIED&&!restoreBusy;
  restoreAction.disabled=!ready||(!restoreInspectionId&&
    (!clearRestoreDocument.getFile()||!clearRestoreKey.getFile()));
  restoreAction.textContent=restoreInspectionId?'Restaurer le fichier':'Inspecter le fichier et sa clé';
  restoreNotice.textContent=ready?
    'Les fichiers seront analysés pour inspection, puis vous confirmerez la restitution.':
    'Restauration en attente de qualification sur cette recette.';
}
async function inspectRestore(){
  if(restoreBusy||!RESTORE_WORKFLOW_QUALIFIED||!editorCapabilities.pseudonymRestore)return;
  const epoch=state.accountEpoch;
  restoreBusy=true;restoreAction.disabled=true;
  try{
    if(!restoreInspectionId){
      const file=clearRestoreDocument.getFile(),key=clearRestoreKey.getFile();
      if(!file||!key)throw new Error('Sélectionnez le document et sa clé.');
      const inspection=await api.inspectRestore(file,key);
      if(epoch!==state.accountEpoch)return;
      if(!/^restore-[0-9a-f]{32}$/.test(inspection?.inspectionId||'')||
          inspection.confirmationRequired!==true||!inspection.sourceRevision)
        throw new Error('Inspection incomplète');
      restoreInspectionId=inspection.inspectionId;restoreInspectionMeta=inspection;
      clear(restoreInspection);restoreInspection.hidden=false;
      el('strong','Inspection terminée',null,restoreInspection);
      el('p',inspection.inputMatchesPublishedArtifact?
        'Le fichier correspond à la version pseudonymisée publiée.':
        'Ce fichier a été modifié depuis la version publiée ; sa restitution ne sera pas certifiée.',
        null,restoreInspection);
      const missing=inspection.missingTags||[],unknown=inspection.unrecognizedTags||{};
      el('p',plural(missing.length,'étiquette absente','étiquettes absentes')+' · '+
        plural(Object.keys(unknown).length,'étiquette inconnue','étiquettes inconnues')+'.',null,restoreInspection);
      el('p','Le document restitué contiendra de nouveau des données sensibles.',
        'asv2-restore-safety',restoreInspection);
      return;
    }
    if(!await confirmAction('Restaurer ce document ? Il contiendra de nouveau des données sensibles et ne sera pas certifié identique à l’original.'))return;
    const expected=restoreInspectionMeta;
    const response=await api.executeRestore(restoreInspectionId);
    if(response.headers.get('X-Agiloshield-Assurance')!=='sensitive-non-certified'||
        response.headers.get('X-Agiloshield-Revision')!==String(expected.sourceRevision)||
        response.headers.get('X-Agiloshield-Status')!==expected.sourceArtifactStatus)
      throw new Error('Restitution incomplète');
    const blob=await response.blob();
    if(epoch!==state.accountEpoch)return;
    const filename=('restaure-'+clearRestoreDocument.getFile().name)
      .replace(/[^A-Za-z0-9._-]/g,'_');
    const url=URL.createObjectURL(blob),link=el('a',null,null,document.body);
    link.href=url;link.download=filename;link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    clearRestoreDocument();clearRestoreKey();resetRestoreInspection();
    notify('Fichier sensible restitué. Conservez-le dans un espace privé.');
  }finally{restoreBusy=false;updateRestoreAction();}
}
el('p','La restauration par clé s’applique aux fichiers Word, Excel, PowerPoint, texte et CSV. Le masquage des fichiers PDF est définitif.', 'asv2-restore-pdf-note',restorePane);
const modeGroup=el('div',null,'asv2-mode-group',side);
modeGroup.setAttribute('role','radiogroup');modeGroup.setAttribute('aria-label','Mode de traitement');
const anonMode=el('label',null,'asv2-mode is-selected',modeGroup);
const anonRadio=el('input',null,null,anonMode);anonRadio.type='radio';anonRadio.name='asv2Mode';anonRadio.checked=true;
el('span','Anonymiser','asv2-mode-title',anonMode);
const pseudoMode=el('label',null,'asv2-mode',modeGroup);
const pseudoRadio=el('input',null,null,pseudoMode);pseudoRadio.type='radio';pseudoRadio.name='asv2Mode';
pseudoRadio.disabled=true;el('span','Pseudonymiser','asv2-mode-title',pseudoMode);
const pseudoHelp=el('small','','asv2-sr-only',pseudoMode);
modeGroup.classList.add('is-loading');
const modeHint=el('p',copy.mode.loading,'asv2-mode-hint',side);
modeHint.setAttribute('aria-live','polite');
function updateModeHint(){
  modeHint.textContent=!state.preferencesReady?copy.mode.loading:
    pseudoRadio.checked?copy.mode.pseudo:copy.mode.anon;
  textInput.placeholder=pseudoRadio.checked?
    'Collez ou saisissez le texte à pseudonymiser…':'Collez ou saisissez le texte à anonymiser…';
}
for(const radio of [anonRadio,pseudoRadio])radio.addEventListener('change',()=>{
  anonMode.classList.toggle('is-selected',anonRadio.checked);
  pseudoMode.classList.toggle('is-selected',pseudoRadio.checked);
  updateModeFormats();updatePolicySummary();updateModeHint();
});
const typesButton=button('', 'asv2-types-button',side,openTypes);
svgIcon('eye-slash',typesButton,16);el('span','Données à masquer',null,typesButton);
const typeCount=el('span','…','asv2-count',typesButton);
typesButton.disabled=true;
typesButton.title='Une catégorie décochée peut rester visible dans le résultat.';
const listsButton=button('', 'asv2-types-button asv2-lists-button',side,openLists);
svgIcon('text',listsButton,16);el('span','Termes',null,listsButton);
const listsCount=el('span',null,'asv2-list-summary',listsButton);listsCount.hidden=true;
const inclusionCount=el('span','', 'asv2-count',listsCount);
const exclusionCount=el('span','', 'asv2-count',listsCount);
listsButton.setAttribute('aria-label','Termes, à masquer : 0 ; à garder : 0');
listsButton.disabled=true;
listsButton.title='Préparer les termes pour vos prochains documents';
const listsHelp=el('p','Ces listes s’appliquent aux prochains documents déposés.','asv2-sr-only',side);
listsButton.setAttribute('aria-describedby','asv2-lists-help');listsHelp.id='asv2-lists-help';
typesButton.hidden=true;listsButton.hidden=true;
form.insertBefore(side,layout);
const policyModal=el('div',null,'asv2-policy-modal',mount);policyModal.hidden=true;
const policyDialog=el('section',null,'asv2-policy-dialog',policyModal);
policyDialog.setAttribute('role','dialog');policyDialog.setAttribute('aria-modal','true');
policyDialog.setAttribute('aria-labelledby','asv2-policy-title');
const policyHeader=el('header',null,'asv2-policy-header',policyDialog);
const policyHeading=el('div',null,null,policyHeader);
const policyTitle=el('h2','Choisissez les données à masquer',null,policyHeading);policyTitle.id='asv2-policy-title';
el('p','Ces préférences sont enregistrées et appliquées aux prochains traitements.',
  'asv2-muted',policyHeading);
const policyClose=button('×','asv2-close',policyHeader,()=>closeTypes(false));
policyClose.setAttribute('aria-label','Fermer les types de données');
const policy=el('section',null,'asv2-policy',policyDialog);
const policyHead=el('div',null,'asv2-section-head',policy);
el('h3','Catégories détectées',null,policyHead);
const policyCount=el('span','13 catégories','asv2-count',policyHead);
const grid=el('div',null,'asv2-grid',policy);
const checks=new Map();
const typeIcons={ADR:'house',DAT:'calendar',EML:'envelope',IBA:'credit-card',IDN:'id-badge',JOB:'suitcase',
  LOC:'map-pin',ORG:'building',PER:'user',PII:'fingerprint',PRO:'suitcase-user',TEL:'phone',URL:'link'};
function updatePolicyCount(){
  const count=[...checks.values()].filter(box=>box.checked).length;
  policyCount.textContent=count+' sur '+codes.length;
}
for(const code of codes){
  const label=el('label',null,'asv2-type',grid);
  const box=el('input',null,null,label);box.type='checkbox';box.disabled=true;box.dataset.code=code;
  svgIcon(typeIcons[code],label,16,'asv2-icon asv2-type-icon');
  el('span',labels[code],null,label);checks.set(code,box);
  box.addEventListener('change',updatePolicyCount);
}
const termsSection=el('section',null,'asv2-terms-section',policyDialog);
svgIcon('tag',termsSection,18,'asv2-icon asv2-terms-icon');
const termsBody=el('div',null,'asv2-terms-text',termsSection);
el('strong','Autre chose à masquer ?',null,termsBody);
const termsSummary=el('span','Aucun terme pour l’instant.','asv2-muted',termsBody);
el('span','Un nom de client, de projet ou de lieu absent des catégories : ajoutez-le en terme à toujours masquer.',
  'asv2-terms-help',termsBody);
const termsAdd=buttonWithIcon('Ajouter un terme','plus','asv2-secondary asv2-terms-add',termsSection,()=>{closeTypes(false);openLists();});
termsSection.hidden=true;
const shortcuts=el('div',null,'asv2-shortcuts',policyDialog);
policyDialog.insertBefore(shortcuts,termsSection);
for(const [caption,values] of [['Paramètres par défaut',defaults],['Tout sélectionner',codes],['Tout désélectionner',[]]]){
  const control=button(caption,'asv2-link',shortcuts,()=>{
    for(const [code,box] of checks) box.checked=values.includes(code);
    updatePolicyCount();
  });control.disabled=true;
}
const policyActions=el('div',null,'asv2-policy-actions',policyDialog);
const policyError=el('p','', 'asv2-policy-error',policyDialog);policyError.hidden=true;
const policyCancel=button('Annuler','asv2-secondary',policyActions,()=>closeTypes(false));
const policySave=button('Enregistrer','asv2-primary',policyActions,saveTypes);policySave.disabled=true;
const listsModal=el('div',null,'asv2-policy-modal',mount);listsModal.hidden=true;
const listsDialog=el('section',null,'asv2-policy-dialog',listsModal);
listsDialog.setAttribute('role','dialog');listsDialog.setAttribute('aria-modal','true');
listsDialog.setAttribute('aria-labelledby','asv2-lists-title');
const listsHeader=el('header',null,'asv2-policy-header',listsDialog);
const listsHeading=el('div',null,null,listsHeader);
const listsTitle=el('h2','Termes à toujours masquer ou garder',null,listsHeading);
listsTitle.id='asv2-lists-title';
el('p','Un terme à masquer l’est toujours. Un terme à garder demande une vérification si un masque est nécessaire.',
  'asv2-muted',listsHeading);
const listsAvailability=el('p','', 'asv2-list-availability',listsDialog);
listsAvailability.setAttribute('role','status');
const listsClose=button('×','asv2-close',listsHeader,()=>closeLists());
listsClose.setAttribute('aria-label','Fermer les termes');
const listsBody=el('div',null,'asv2-list-fields',listsDialog);
el('p','La casse et les accents sont ignorés. Seuls les prochains documents utilisent ces termes.',
  'asv2-muted asv2-list-guide',listsBody);
const listCards={};
for(const [kind,title,hint,placeholder] of [
  ['include','Toujours masquer','Masqué partout, même hors des catégories cochées.',
    'Ajouter un terme à masquer…'],
  ['exclude','Garder visible','Reste visible, sauf conflit avec un masque nécessaire (vérification demandée).',
    'Ajouter un terme à garder…']]){
  const card=el('section',null,'asv2-list-card asv2-list-card-'+kind,listsBody);
  const cardHead=el('div',null,'asv2-list-card-head',card);
  el('h3',title,null,cardHead);
  const count=el('span','0 / 100','asv2-count',cardHead);
  el('p',hint,'asv2-muted',card);
  const addRow=el('div',null,'asv2-list-add',card);
  const input=el('textarea',null,'asv2-list-input',addRow);
  input.rows=1;input.placeholder=placeholder;
  input.setAttribute('aria-label',placeholder.replace('…',''));
  input.setAttribute('aria-describedby','asv2-list-error-'+kind);
  const add=button('Ajouter','asv2-secondary',addRow,()=>addListTerms(kind));
  const error=el('p','', 'asv2-list-field-error',card);
  error.id='asv2-list-error-'+kind;error.setAttribute('role','alert');error.hidden=true;
  const rows=el('ul',null,'asv2-list-terms',card);
  rows.setAttribute('aria-label',title);
  listCards[kind]={card,count,input,add,error,rows,title};
}
const listsWarning=el('p','', 'asv2-list-warning',listsDialog);
listsWarning.setAttribute('role','status');listsWarning.hidden=true;
const listsStorageNote=el('p','', 'asv2-list-storage-note',listsDialog);
const listsError=el('p','', 'asv2-policy-error',listsDialog);listsError.hidden=true;
const listsActions=el('div',null,'asv2-policy-actions asv2-list-actions',listsDialog);
const listsClear=button('Effacer les termes mémorisés','asv2-link',listsActions,clearLists);
button('Annuler','asv2-secondary',listsActions,()=>closeLists());
const listsSave=button('Enregistrer sur ce navigateur','asv2-primary',listsActions,saveLists);
const drop=el('div',null,'asv2-drop',filePane);drop.tabIndex=0;drop.setAttribute('role','button');
drop.setAttribute('aria-label','Choisir ou déposer jusqu’à 12 documents');
svgIcon('cloud-upload',drop,28,'asv2-drop-icon');
el('span','Déposez vos documents ici','asv2-drop-title',drop);
el('span','ou cliquez pour les choisir · 12 fichiers maximum','asv2-drop-subtitle',drop);
const dropTypes=el('span','PDF, Word, Excel, PowerPoint, TXT, CSV','asv2-drop-types',drop);
function updateModeFormats(){
  dropTypes.textContent='PDF, Word, Excel, PowerPoint, TXT, CSV';
  fileInput.accept='.pdf,.docx,.xlsx,.pptx,.txt,.csv';
}
const secondaryRow=el('div',null,'asv2-secondary-row',filePane);
const secondaryLeft=el('div',null,'asv2-secondary-left',secondaryRow);
const pasteLink=buttonWithIcon('Coller du texte','text','asv2-secondary asv2-paste-link',secondaryLeft,
  ()=>setSurface(state.surface==='text'?'file':'text'));
const pasteLabel=pasteLink.querySelector('span:last-child');
const restoreLink=buttonWithIcon('Restaurer avec une clé','key','asv2-secondary',secondaryLeft,()=>openRestore());
restoreLink.hidden=!RESTORE_WORKFLOW_QUALIFIED&&config.SHOW_RESTORE!==true;
const settingsRow=el('div',null,'asv2-settings-row',secondaryRow);
svgIcon('sliders',settingsRow,16,'asv2-icon asv2-settings-icon');
const settingsText=el('span','Chargement de vos réglages…','asv2-settings-text',settingsRow);
const settingsEdit=buttonWithIcon('Modifier','pen','asv2-secondary asv2-settings-edit',settingsRow,openTypes);
settingsEdit.setAttribute('aria-label','Modifier les données à masquer et les termes');
settingsEdit.disabled=true;
function openRestore(){setSurface('restore');restorePane.scrollIntoView({block:'start',behavior:'auto'});}
if(typeof config.TRUST_LINE==='string'&&config.TRUST_LINE.trim()){
  const trust=el('p',null,'asv2-trust',filePane);svgIcon('shield-check',trust,16);
  el('span',config.TRUST_LINE.trim(),null,trust);
}
// The former “Dernier document” card duplicated the history and review drawer.
function updateLastDocCard(){ /* Intentionally no-op: one source of truth is enough. */ }
const fileInput=el('input',null,'asv2-file-input',form);fileInput.type='file';fileInput.multiple=true;
fileInput.accept='.pdf,.docx,.xlsx,.pptx,.txt,.csv';fileInput.disabled=true;
fileInput.setAttribute('aria-label','Choisir des documents');
const mobileSettings=el('div',null,'asv2-mobile-settings',null);
const mobileSettingsText=el('p','Chargement de vos réglages…',null,mobileSettings);
const mobileSettingsEdit=button('Modifier','asv2-secondary',mobileSettings,openTypes);
mobileSettingsEdit.disabled=true;
const emptyPolicyWarning=el('p','Aucune catégorie sélectionnée : les données détectées resteront visibles dans les prochains fichiers.',
  'asv2-empty-policy-warning',filePane);
emptyPolicyWarning.hidden=true;filePane.insertBefore(emptyPolicyWarning,drop);
const queue=el('ul',null,'asv2-queue',main);queue.setAttribute('aria-label','Documents en cours');
const queueHeading=el('h3','En cours','asv2-queue-heading asv2-sr-only',main);
main.insertBefore(queueHeading,queue);
const rejectedList=el('ul',null,'asv2-rejections',main);rejectedList.setAttribute('aria-label','Fichiers refusés');
const actions=el('div',null,'asv2-form-actions',main);actions.hidden=true;
const retry=button('Réessayer','asv2-secondary',actions,loadPreferences);retry.hidden=true;
const resumeAuthButton=button('Se reconnecter','asv2-secondary',actions,
  ()=>resumeAfterAuth().catch(error=>notify(errorText(error),'is-error')));
resumeAuthButton.hidden=true;
const previewHelp=el('p',copy.historySessionOnly,
  'asv2-preview-help',main);previewHelp.hidden=true;

const historySection=el('section',null,'asv2-history',shell);
const historyHead=el('div',null,'asv2-history-head',historySection);
const historyTitle=el('h3',copy.historySession,null,historyHead);
const historyCount=el('span','0 document','asv2-history-count',historyHead);
const historyTabs=el('div',null,'asv2-history-tabs',historySection);
historyTabs.setAttribute('role','tablist');historyTabs.setAttribute('aria-label','Source de l’historique');
const v2HistoryTab=button('Documents récents','asv2-history-tab is-active',historyTabs,()=>setHistoryTab('v2'));
const anon2HistoryTab=button(copy.historyOld,'asv2-history-tab',historyTabs,()=>setHistoryTab('anon2'));
historyTabs.hidden=true;anon2HistoryTab.hidden=true;
for(const tab of [v2HistoryTab,anon2HistoryTab])tab.setAttribute('role','tab');
v2HistoryTab.setAttribute('aria-selected','true');anon2HistoryTab.setAttribute('aria-selected','false');
const historyHint=el('p',copy.historySessionOnly,
  'asv2-history-hint',historySection);
const historyActions=el('div',null,'asv2-history-actions',historySection);
const refreshHistoryButton=button('Actualiser','asv2-secondary',historyActions,()=>loadHistory().catch(error=>{
  historyHint.textContent=errorText(error);renderHistory();}));
const zipHistoryButton=button('Télécharger la sélection (.zip)','asv2-secondary',historyActions,
  ()=>downloadSelectedZip().catch(error=>notify(errorText(error),'is-error')));
const moreHistoryButton=button('Charger plus','asv2-secondary',historyActions,
  ()=>loadHistory(true).catch(error=>{historyHint.textContent=errorText(error);renderHistory();}));
const historyList=el('div',null,'asv2-doc-list',historySection);
historyList.setAttribute('role','list');historyList.setAttribute('aria-label','Documents traités');

const drawer=el('div',null,'asv2-drawer',mount);drawer.hidden=true;
const backdrop=button('Fermer le panneau','asv2-backdrop',drawer,closeDrawer);backdrop.setAttribute('aria-label','Fermer la revue');
const panel=el('aside',null,'asv2-panel',drawer);panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
panel.setAttribute('aria-labelledby','asv2-drawer-title');
const drawerHead=el('header',null,'asv2-drawer-head',panel);
const drawerHeading=el('div',null,'asv2-drawer-heading',drawerHead);
el('span','AgiloShield','asv2-overline',drawerHeading);
const title=el('h2','Document','asv2-drawer-title',drawerHeading);title.id='asv2-drawer-title';
const meta=el('p','', 'asv2-meta',drawerHeading);
const drawerStatus=el('span',null,'asv2-drawer-status',drawerHeading);
const reviewTools=el('div',null,'asv2-review-tools',drawerHead);
const drawerHeadActions=el('div',null,'asv2-drawer-head-actions',drawerHead);
const drawerDownloads=el('div',null,'asv2-drawer-downloads',drawerHeadActions);
const drawerRemove=iconButton('trash','Retirer ce document de cet écran','asv2-drawer-icon asv2-remove-btn',drawerHeadActions,()=>{
  const cur=state.entries.find(e=>e.key===state.active);
  if(cur)removeEntryFromSession(cur);
  else closeDrawer();
});
const close=button('×','asv2-close',drawerHead,()=>closeDrawer());close.setAttribute('aria-label','Fermer le document');
const drawerNotice=el('div','', 'asv2-drawer-notice',panel);drawerNotice.setAttribute('role','status');
drawerNotice.setAttribute('aria-live','polite');
const tabs=el('div',null,'asv2-mobile-tabs',panel);
const tabDoc=button('Document','asv2-tab is-active',tabs,()=>setMobileTab('doc'));
const tabIssues=button('Vérification','asv2-tab',tabs,()=>setMobileTab('issues'));
const workspace=el('div',null,'asv2-workspace is-doc',panel);
const viewerPane=el('section',null,'asv2-viewer',workspace);viewerPane.setAttribute('aria-label','Aperçu du document');
const viewerToolbar=el('div',null,'asv2-viewer-toolbar',viewerPane);
const viewerBody=el('div',null,'asv2-viewer-body',viewerPane);
viewerBody.setAttribute('tabindex','0');
const issuePane=el('section',null,'asv2-issues',workspace);issuePane.setAttribute('aria-label','Détections et problèmes');
issuePane.setAttribute('tabindex','0');
const drawerFooter=el('footer',null,'asv2-drawer-footer',issuePane);

function notify(text,kind='') {
  clearTimeout(noticeTimer);notice.textContent=text||'';notice.className='asv2-notice '+kind;
  notice.hidden=!text;
  if(text&&!kind)noticeTimer=setTimeout(()=>{notice.hidden=true;},6000);
}
function drawerMessage(text,kind='') {
  drawerNotice.textContent=text||'';
  drawerNotice.className='asv2-drawer-notice '+(kind||'');
  drawerNotice.hidden=!text;
}
form.addEventListener('submit',event=>event.preventDefault());
let typesSnapshot=[];let modalLastFocus=null;let savingTypes=false;
const tourSteps=[
  {target:side,title:'1. Choisissez le mode',body:'Anonymiser masque pour de bon. Pseudonymiser remplace par des étiquettes, réversibles avec la clé. Les données à masquer se règlent sous la zone de dépôt, avec « Modifier ».'},
  {target:drop,title:'2. Déposez',body:'Jusqu’à 12 fichiers à la fois. Le traitement démarre tout seul. Pour un simple extrait, utilisez « Coller du texte ».'},
  {target:historyHead,title:'3. Vérifiez et téléchargez',body:'Un document prêt se télécharge. Un document à vérifier s’ouvre en grand pour décider passage par passage.'},
];
let tourIndex=-1;let tourLastFocus=null;let firstTourTimer=null;let guideDoneInMemory=false;
const tour=el('div',null,'asv2-tour',mount);tour.hidden=true;
const tourBackdrop=el('div',null,'asv2-tour-backdrop',tour);
const tourCard=el('section',null,'asv2-tour-card',tour);tourCard.setAttribute('role','dialog');
tourCard.setAttribute('aria-modal','true');tourCard.setAttribute('aria-labelledby','asv2-tour-title');
const tourCount=el('span','', 'asv2-tour-count',tourCard);
const tourTitle=el('h2','',null,tourCard);tourTitle.id='asv2-tour-title';
const tourBody=el('p','',null,tourCard);
const tourControls=el('div',null,'asv2-tour-controls',tourCard);
const tourPrev=button('Précédent','asv2-secondary',tourControls,()=>showTourStep(tourIndex-1));
const tourNext=button('Suivant','asv2-primary',tourControls,()=>tourIndex===tourSteps.length-1?closeTour():showTourStep(tourIndex+1));
const tourSkip=button('Passer','asv2-link',tourControls,closeTour);
function guideSeen(){try{return localStorage.getItem(tourKey)==='seen';}
  catch(_){return guideDoneInMemory;}}
function rememberGuide(){guideDoneInMemory=true;
  try{localStorage.setItem(tourKey,'seen');}catch(_){/* Browser storage may be unavailable. */}}
function anotherTourOpen(){return !!document.querySelector('.driver-overlay,.driver-popover,[data-driverjs-tour]')||
  !!window.__agiloPendingFirstTour;}
function showTourStep(index){
  if(tourIndex>=0)tourSteps[tourIndex].target.classList.remove('asv2-tour-target');
  tourIndex=index;const step=tourSteps[index];
  step.target.classList.add('asv2-tour-target');
  step.target.scrollIntoView({block:'center',behavior:'auto'});
  tourCount.textContent=(index+1)+' sur '+tourSteps.length;
  tourTitle.textContent=step.title;tourBody.textContent=step.body;
  tourPrev.hidden=index===0;tourNext.textContent=index===tourSteps.length-1?'Terminer':'Suivant';
  const rect=step.target.getBoundingClientRect();
  tourCard.style.setProperty('--asv2-tour-top',Math.max(16,Math.min(innerHeight-250,rect.bottom+12))+'px');
  tourCard.style.setProperty('--asv2-tour-left',Math.max(16,Math.min(innerWidth-390,rect.left))+'px');
  tourNext.focus();
}
function startTour(manual=false){
  if(!tour.hidden)return true;
  if(!state.preferencesReady||state.drawerOpen||!policyModal.hidden||!listsModal.hidden||
      state.entries.some(entry=>active.has(entry.status))||anotherTourOpen()){
    if(manual)notify('Terminez l’action en cours, puis rouvrez le guide.','is-warning');
    return false;
  }
  tourLastFocus=document.activeElement;tour.hidden=false;document.body.classList.add('asv2-tour-open');
  showTourStep(0);return true;
}
function closeTour(){tour.hidden=true;tourIndex=-1;document.body.classList.remove('asv2-tour-open');
  for(const step of tourSteps)step.target.classList.remove('asv2-tour-target');
  rememberGuide();if(tourLastFocus?.isConnected)tourLastFocus.focus();}
tourBackdrop.addEventListener('click',closeTour);
tour.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeTour();}
  if(event.key!=='Tab')return;
  const controls=[...tourCard.querySelectorAll('button:not([hidden]):not([disabled])')];
  if(!controls.length)return;
  if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
});
function scheduleFirstTour(){
  if(guideSeen()||firstTourTimer)return;
  let attempts=0;
  firstTourTimer=setInterval(()=>{
    if(state.disposed||guideSeen()||++attempts>30){clearInterval(firstTourTimer);firstTourTimer=null;return;}
    if(startTour()){clearInterval(firstTourTimer);firstTourTimer=null;}
  },1000);
}
function setSurface(kind){
  state.surface=kind;
  const restore=kind==='restore';
  filePane.hidden=restore;textPane.hidden=kind!=='text';restorePane.hidden=!restore;
  pasteLabel.textContent=kind==='text'?'Fermer le texte':'Coller du texte';
  pasteLink.classList.toggle('is-active',kind==='text');
  pasteLink.setAttribute('aria-expanded',String(kind==='text'));
  if(kind==='text')textInput.focus();
  side.hidden=restore;layout.classList.toggle('is-restore',restore);
  for(const element of [queueHeading,queue,rejectedList,actions])element.hidden=restore;
}
function openTypes(){
  if(!state.preferencesReady)return;
  typesSnapshot=selected();modalLastFocus=document.activeElement;
  policyError.hidden=true;policyModal.hidden=false;document.body.classList.add('asv2-policy-open');
  updatePolicyCount();policyClose.focus();
}
function openLists(){
  if(!state.preferencesReady)return;
  modalLastFocus=document.activeElement;
  listDraft=listSnapshot();
  for(const card of Object.values(listCards)){card.input.value='';card.error.hidden=true;}
  renderListDraft();
  listsAvailability.textContent=listsReady?
    'Les termes enregistrés seront appliqués aux prochains dépôts.':
    'Les termes ne sont pas disponibles sur cette recette.';
  listsAvailability.classList.toggle('is-ready',listsReady);
  listsError.hidden=true;listsModal.hidden=false;document.body.classList.add('asv2-policy-open');
  listCards.include.input.focus();
}
function closeLists(force=false){
  if(!force&&listsDialog.querySelector('.asv2-confirm'))return;
  if(force)listsDialog.querySelector('.asv2-confirm')?.remove();
  listsModal.hidden=true;document.body.classList.remove('asv2-policy-open');
  if(modalLastFocus?.isConnected)modalLastFocus.focus();
}
function listField(kind){return kind==='include'?'anon2InclusionList':'anon2ExclusionList';}
function updateListSummary(){
  const included=listSelection.anon2InclusionList.length,excluded=listSelection.anon2ExclusionList.length;
  inclusionCount.textContent=included+' inclus';inclusionCount.hidden=!included;
  exclusionCount.textContent=excluded+' exclus';exclusionCount.hidden=!excluded;
  listsCount.hidden=!included&&!excluded;
  listsButton.setAttribute('aria-label','Termes, à masquer : '+included+' ; à garder : '+excluded);
  updatePolicySummary();
}
function renderListDraft(){
  for(const kind of ['include','exclude']){
    const card=listCards[kind],terms=listDraft[listField(kind)];
    card.count.textContent=terms.length+' / 100';clear(card.rows);
    if(!terms.length){el('li',kind==='include'?'Aucun terme à masquer.':'Aucun terme à garder.',
      'asv2-list-empty',card.rows);continue;}
    for(const [index,term] of terms.entries()){
      const row=el('li',null,'asv2-list-term',card.rows);
      el('span',term,'asv2-list-term-text',row);
      const remove=button('Retirer','asv2-link',row,()=>{
        listDraft[listField(kind)].splice(index,1);renderListDraft();card.input.focus();
      });
      remove.setAttribute('aria-label','Retirer « '+term+' » des '+card.title.toLowerCase());
    }
  }
  const included=new Set(listDraft.anon2InclusionList.map(termKey));
  const conflicts=listDraft.anon2ExclusionList.filter(term=>included.has(termKey(term)));
  const messages=[];
  if(conflicts.length)messages.push(plural(conflicts.length,'terme figure','termes figurent')+' dans les deux listes : '
    +'une contradiction pourra exiger une vérification du document.');
  listsWarning.textContent=messages.join(' ');listsWarning.hidden=!messages.length;
}
function addListTerms(kind){
  const card=listCards[kind],field=listField(kind);
  try{
    const updated=addTerms(listDraft[field],card.input.value,kind==='include'?'inclure':'exclure');
    listDraft[field]=updated;card.input.value='';card.error.hidden=true;renderListDraft();card.input.focus();
  }catch(error){card.error.textContent=error.message;card.error.hidden=false;card.input.focus();}
}
for(const kind of ['include','exclude'])listCards[kind].input.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addListTerms(kind);}
});
async function saveLists(){
  listsError.hidden=true;
  let next={anon2InclusionList:[...listDraft.anon2InclusionList],
    anon2ExclusionList:[...listDraft.anon2ExclusionList]};
  for(const kind of ['include','exclude']){
    const card=listCards[kind],field=listField(kind);
    if(!card.input.value.trim())continue;
    try{next[field]=addTerms(next[field],card.input.value,kind==='include'?'inclure':'exclure');
      card.error.hidden=true;}
    catch(error){card.error.textContent=error.message;card.error.hidden=false;card.input.focus();return;}
  }
  try{next=validateLists(next);}
  catch(error){listsError.textContent=error.message;listsError.hidden=false;return;}
  listsSave.disabled=true;
  const persisted=await saveStoredLists(state.accountRef,next);
  listSelection=next;listDraft=listSnapshot();listStorePersistent=persisted;
  listsSave.textContent=persisted?'Enregistrer sur ce navigateur':'Garder pendant cette page';
  listsStorageNote.textContent=persisted?
    'Ces termes restent sur ce navigateur pour ce compte. Évitez un appareil partagé.':
    'Ces termes restent uniquement pendant cette page ouverte. Ils ne sont pas mémorisés.';
  updateListSummary();listsSave.disabled=false;closeLists();
  notify(listsReady?
    (persisted?'Termes enregistrés pour les prochains documents.':
      'Termes appliqués aux prochains documents pendant cette page ouverte.'):
    (persisted?'Termes mémorisés ici. Ils ne sont pas encore transmis aux documents.':
      'Termes gardés pour cette page uniquement. Ils ne sont pas encore transmis aux documents.'),
    listsReady&&persisted?'':'is-warning');
}
async function clearLists(){
  if(!await confirmAction('Effacer les termes mémorisés pour ce compte sur ce navigateur ? '
    +'Les documents déjà déposés ne changent pas.'))return;
  const removed=await clearStoredLists(state.accountRef);
  if(listStorePersistent&&!removed){listsError.textContent='Impossible d’effacer le stockage local. Réessayez.';
    listsError.hidden=false;return;}
  listSelection=emptyLists();listDraft=emptyLists();
  for(const card of Object.values(listCards)){card.input.value='';card.error.hidden=true;}
  renderListDraft();updateListSummary();listsError.hidden=true;
  notify(removed?'Termes effacés pour les prochains documents de ce compte.':
    'Termes effacés pour cette page ; le stockage du navigateur reste indisponible.',
    removed?'':'is-warning');
}
listsModal.addEventListener('click',event=>{if(event.target===listsModal)closeLists();});
listsModal.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();
    const cancel=listsDialog.querySelector('.asv2-confirm button:last-child');
    if(cancel)cancel.click();else closeLists();return;}
  if(event.key!=='Tab')return;
  const items=[...listsDialog.querySelectorAll('button:not([disabled]),textarea:not([disabled])')]
    .filter(item=>item.getClientRects().length);
  if(!items.length)return;
  if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===items.at(-1)){
    event.preventDefault();items[0].focus();}
});
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
    if(!Array.isArray(saved)||!response.protectionPolicy.digest||
      JSON.stringify([...saved].sort())!==JSON.stringify([...types].sort()))
      throw new Error('Préférences non enregistrées par la façade');
    state.currentPolicy={...response.protectionPolicy,selectedTypes:[...saved]};
    updatePolicySummary();typesSnapshot=[...types];savingTypes=false;closeTypes(true);
    notify(types.length?'Préférences enregistrées pour les prochains documents.':
      'Aucune catégorie sélectionnée. Les données détectées resteront visibles dans les prochains documents.',
      types.length?'':'is-warning');
  }catch(error){policyError.textContent=errorText(error);policyError.hidden=false;}
  finally{savingTypes=false;policySave.disabled=!state.preferencesReady;
    policyClose.disabled=false;policyCancel.disabled=false;}
}
function setEnabled(yes){
  state.preferencesReady=yes;fileInput.disabled=!yes;textInput.disabled=!yes;
  typesButton.disabled=!yes;textAdd.disabled=!yes;policySave.disabled=!yes;
  listsButton.disabled=!yes;settingsEdit.disabled=!yes;
  pseudoRadio.disabled=!yes||!pseudoReady;
  pseudoMode.classList.toggle('is-unavailable',yes&&!pseudoReady);
  modeGroup.classList.toggle('is-loading',!yes);
  termsSection.hidden=!listsReady;
  if(pseudoRadio.disabled&&pseudoRadio.checked){anonRadio.checked=true;pseudoRadio.checked=false;
    anonMode.classList.add('is-selected');pseudoMode.classList.remove('is-selected');}
  updateModeFormats();updateModeHint();updatePolicySummary();
  pseudoHelp.textContent=pseudoReady||!yes?'Les passages protégés reçoivent des étiquettes. Conservez la clé pour les restituer.':
    'Ce mode n’est pas encore disponible sur cette page.';
  pseudoMode.title=pseudoHelp.textContent;
  listsButton.title=listsReady?'Choisir les termes pour les prochains documents':
    'Termes indisponibles sur cette recette';
  listsHelp.textContent=listsReady?'Une inclusion force le masquage. Une exclusion en conflit demande une vérification.':
    'Les termes ne sont pas disponibles sur cette recette.';
  updateRestoreAction();
  listsStorageNote.textContent=listStorePersistent?
    'Ces termes restent sur ce navigateur pour ce compte. Évitez un appareil partagé.':
    'Ces termes restent uniquement pendant cette page ouverte. Ils ne sont pas mémorisés.';
  listsSave.textContent=listStorePersistent?'Enregistrer sur ce navigateur':
    'Garder pendant cette page';
  mobileSettingsEdit.disabled=!yes;
  for(const box of checks.values())box.disabled=!yes;
  for(const control of shortcuts.querySelectorAll('button'))control.disabled=!yes;
  drop.classList.toggle('is-disabled',!yes);
  drop.setAttribute('aria-disabled',String(!yes));
}
function updatePolicySummary(){
  const types=state.currentPolicy?.selectedTypes;
  typeCount.textContent=Array.isArray(types)?types.length+'/13':'…';
  const included=listSelection.anon2InclusionList.length,excluded=listSelection.anon2ExclusionList.length;
  const terms=included+excluded;
  const termsText=terms?plural(terms,'terme','termes'):'aucun terme';
  termsSummary.textContent=terms?plural(included,'terme à masquer','termes à masquer')+' · '+
    plural(excluded,'terme à garder','termes à garder'):'Aucun terme pour l’instant.';
  termsAdd.lastChild.textContent=terms?'Gérer les termes':'Ajouter un terme';
  settingsText.textContent=!Array.isArray(types)?'Chargement de vos réglages…':
    (types.length?plural(types.length,'catégorie masquée','catégories masquées'):'Aucune catégorie masquée')+
    (listsReady?' · '+termsText:'');
  mobileSettingsText.textContent='Mode : '+(pseudoRadio.checked?'Pseudonymiser':'Anonymiser')+
    ' · Données à masquer : '+policySummary(types);
  emptyPolicyWarning.hidden=!Array.isArray(types)||types.length>0;
  if(!emptyPolicyWarning.hidden){
    emptyPolicyWarning.textContent='0/13, aucune catégorie sélectionnée : les données détectées resteront visibles dans les prochains fichiers.';
  }
}
async function loadPreferences(){
  const request=++preferencesRequest;
  state.currentPolicy=null;listsReady=false;pseudoReady=false;
  setEnabled(false);retry.hidden=true;notify('');drop.classList.add('is-loading');
  try{
    const response=await api.preferences();
    if(request!==preferencesRequest)return;
    const types=response?.protectionPolicy?.selectedTypes;
    if(!Array.isArray(types)||types.some(code=>!codes.includes(code))||
      typeof response.protectionPolicy.digest!=='string')throw new Error('Préférences serveur invalides');
    state.currentPolicy={...response.protectionPolicy,selectedTypes:[...types]};
    const accountRef=typeof response.accountRef==='string'&&response.accountRef?response.accountRef:null;
    const sameAccount=state.accountRef===accountRef;
    const memoryLists=sameAccount?listSnapshot():emptyLists();
    if(!sameAccount){
      state.accountEpoch++;
      closeDrawer();state.entries=[];state.active=null;
      state.history={v2:[],anon2:[],v2Loaded:false,anon2Loaded:false,cursors:{v2:null,anon2:null}};
      state.selectedHistory.clear();state.authPaused=false;resumeAuthButton.hidden=true;
      renderQueue();renderHistory();
      if(!listsModal.hidden)closeLists(true);
      clearRestoreDocument();clearRestoreKey();
      listSelection=emptyLists();listDraft=emptyLists();
      updateListSummary();}
    state.accountRef=accountRef;
    try{sessionStorage.removeItem(storageKey);sessionStorage.removeItem('asv2-open-drawer-key');}catch(_){}
    state.capabilities=response.capabilities||{};
    const available=v2Capabilities(state.capabilities);
    editorCapabilities=available;
    listsReady=available.lists;
    pseudoReady=available.pseudonymize;
    if(!pseudoReady)console.warn('[AgiloShield V2] Pseudonymisation indisponible : capacités Java reçues',state.capabilities);
    const stored=await loadStoredLists(accountRef);
    if(request!==preferencesRequest)return;
    listSelection=stored.persistent?stored.lists:memoryLists;
    listDraft=listSnapshot();listStorePersistent=stored.persistent;
    updateListSummary();
    const set=new Set(types);for(const [code,box] of checks)box.checked=set.has(code);
    updatePolicySummary();setEnabled(true);drop.classList.remove('is-loading');
    notify('');
    scheduleFirstTour();
  }catch(error){
    retry.hidden=true;
    drop.classList.remove('is-loading');
    notify('Impossible de charger vos réglages. Rechargez la page puis réessayez.','is-error');
  }
}
function addFiles(files){
  if(!state.preferencesReady||!state.currentPolicy)return;
  const additions=[...files];
  const available=Math.max(0,12-state.entries.filter(item=>active.has(item.status)).length);
  const maxBytes=Number(state.capabilities.maxUploadBytes||config.MAX_UPLOAD_BYTES||0);
  const current=state.currentPolicy;
  const types=[...current.selectedTypes];
  if(defaults.some(code=>!types.includes(code))&&current.sensitiveKeepAcknowledged!==true){
    notify('Confirmez les catégories conservées dans les paramètres avant le dépôt.','is-warning');
    openTypes();return;
  }
  const mode=pseudoRadio.checked?'PSEUDONYMIZE':'ANONYMIZE';
  const lists=listsReady?listSnapshot():emptyLists();
  const batchId=crypto.randomUUID();
  let accepted=0;const rejections=[];clear(rejectedList);
  for(const file of additions){
    if(!supported.test(file.name)){rejections.push(file.name+' : format non pris en charge');continue;}
    if(maxBytes&&file.size>maxBytes){rejections.push(file.name+' : taille supérieure à la limite de recette');continue;}
    if(accepted>=available){rejections.push(file.name+' : limite de 12 fichiers en cours atteinte');continue;}
    const snapshot=freezeJobSelection({policy:current,lists,mode});
    const entry={key:crypto.randomUUID(),file,name:file.name,format:formatOf(file.name),jobId:null,
      accountRef:state.accountRef,accountEpoch:state.accountEpoch,
      ...snapshot,listDigest:null,batchId,createdAt:new Date().toISOString(),sizeBytes:file.size,
      uploadId:crypto.randomUUID(),uploadProgress:null,status:'LOCAL',
      revision:null,review:null,regions:null,hasCurrentResult:false,
      previewKind:'anon',page:1,zoom:1,target:null,error:null,previewSerial:0};
    state.entries.push(entry);
    accepted++;
  }
  for(const reason of rejections)el('li',reason,null,rejectedList);
  if(rejections.length)notify(plural(rejections.length,'fichier refusé','fichiers refusés')+'. Le détail est affiché sous la liste.','is-warning');
  else if(accepted)notify(plural(accepted,'fichier ajouté','fichiers ajoutés')+'.');
  renderQueue();drainQueue().catch(error=>notify(errorText(error),'is-error'));
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
const statusTone = status => status==='READY'?'ok':status==='REVIEW_REQUIRED'?'warn':
  ['FAILED','ERROR'].includes(status)?'err':['AUTH_REQUIRED','TIMED_OUT','UNCERTAIN'].includes(status)?'warn':'busy';
function statusPill(status,parent,text){
  const pill=el('span',null,'asv2-pill asv2-pill-'+statusTone(status),parent);
  el('span',null,'asv2-pill-dot',pill);el('span',text||safeStatus(status),null,pill);
  return pill;
}
let openMenu=null;let historyDeferred=false;
function closeDocMenu(){
  if(!openMenu)return;
  openMenu.menu.hidden=true;openMenu.toggle.setAttribute('aria-expanded','false');openMenu=null;
  if(historyDeferred){historyDeferred=false;scheduleHistoryRender();}
}
document.addEventListener('click',event=>{if(openMenu&&!openMenu.wrap.contains(event.target))closeDocMenu();});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!openMenu)return;
  const toggle=openMenu.toggle;closeDocMenu();toggle.focus();
});
function docMenu(parent,items,label){
  const wrap=el('div',null,'asv2-menu',parent);
  const toggle=button('', 'asv2-menu-toggle',wrap);svgIcon('dots',toggle,18);
  toggle.setAttribute('aria-label',label);toggle.title=label;
  toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-expanded','false');
  const menu=el('div',null,'asv2-menu-list',wrap);menu.setAttribute('role','menu');menu.hidden=true;
  for(const item of items){
    if(item==='separator'){el('div',null,'asv2-menu-separator',menu).setAttribute('role','separator');continue;}
    const control=button('', 'asv2-menu-item'+(item.danger?' is-danger':''),menu,()=>{closeDocMenu();item.run();});
    control.setAttribute('role','menuitem');svgIcon(item.icon,control,16);el('span',item.label,null,control);
    control.disabled=!!item.disabled;if(item.title)control.title=item.title;
  }
  toggle.addEventListener('click',event=>{
    event.stopPropagation();
    const wasOpen=openMenu?.wrap===wrap;closeDocMenu();if(wasOpen)return;
    menu.hidden=false;toggle.setAttribute('aria-expanded','true');openMenu={wrap,menu,toggle};
    menu.querySelector('button:not(:disabled)')?.focus();
  });
  menu.addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    const options=[...menu.querySelectorAll('button:not(:disabled)')];
    const index=options.indexOf(document.activeElement);
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:
      (index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[next]?.focus();
  });
  return wrap;
}
function copyReference(jobId){
  const done=()=>notify('Référence copiée. Donnez-la au support si vous le contactez.');
  if(!navigator.clipboard?.writeText){notify('Copie impossible sur ce navigateur.','is-warning');return;}
  navigator.clipboard.writeText(String(jobId)).then(done,()=>notify('Copie impossible sur ce navigateur.','is-warning'));
}
function renderQueue(){
  clear(queue);
  const underway=state.entries.filter(entry=>!isTerminal(entry.status)&&entry.removed!==true);
  queueHeading.hidden=state.surface==='restore'||!underway.length;
  for(const entry of underway){
    const line=el('li',null,'asv2-doc asv2-queue-item is-'+entry.status.toLowerCase(),queue);
    svgIcon('file',line,18,'asv2-icon asv2-doc-icon');
    const details=el('div',null,'asv2-doc-info asv2-queue-details',line);
    el('span',entry.name,'asv2-doc-name asv2-queue-name',details).title=entry.name;
    if(entry.status==='UPLOADING'){
      const track=el('div',null,'asv2-upload-track',details);
      track.setAttribute('role','progressbar');track.setAttribute('aria-label','Envoi de '+entry.name);
      if(entry.uploadProgress!==null){track.setAttribute('aria-valuemin','0');
        track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(entry.uploadProgress));}
      const fill=el('div',null,'asv2-upload-fill'+(entry.uploadProgress===null?' is-indeterminate':''),track);
      if(entry.uploadProgress!==null)fill.style.width=entry.uploadProgress+'%';
    }else if(['PENDING','PROCESSING'].includes(entry.status)){
      el('div',null,'asv2-processing-line',details);
    }else if(!entry.error){
      el('span',historySize(entry.sizeBytes??entry.file?.size),'asv2-doc-meta',details);
    }
    if(entry.error)el('span',entry.error,'asv2-doc-meta asv2-queue-error',details);
    if(entry.status==='AUTH_REQUIRED'){
      const reconnect=button('Se reconnecter','asv2-link asv2-queue-reconnect',details,
        ()=>resumeAfterAuth().catch(error=>notify(errorText(error),'is-error')));
      reconnect.title='Rétablir votre session puis reprendre les fichiers non envoyés';
    }
    statusPill(entry.status,line,entry.status==='UPLOADING'&&entry.uploadProgress!==null?
      'Envoi '+entry.uploadProgress+' %':null);
    const acts=el('div',null,'asv2-doc-actions',line);
    const remove=iconButton('trash','Retirer ce document de cet écran','asv2-queue-remove',acts,
      ()=>removeEntryFromSession(entry));
    remove.classList.add('asv2-remove-btn');
  }
  scheduleHistoryRender();
}
let historyRenderScheduled=false;
function scheduleHistoryRender(){
  if(historyRenderScheduled)return;
  historyRenderScheduled=true;
  requestAnimationFrame(()=>{historyRenderScheduled=false;renderHistory();});
}
function setHistoryTab(source){
  state.historyTab=source;state.selectedHistory.clear();
  v2HistoryTab.classList.toggle('is-active',source==='v2');
  anon2HistoryTab.classList.toggle('is-active',source==='anon2');
  v2HistoryTab.setAttribute('aria-selected',String(source==='v2'));
  anon2HistoryTab.setAttribute('aria-selected',String(source==='anon2'));
  renderHistory();
  loadHistory().catch(error=>{historyHint.textContent=errorText(error);});
}
function removeEntryFromSession(target){
  if(!target)return;
  target.removed=true;
  const jobId=String(target.jobId||'');
  const key=target.key;
  if(state.active&&(state.active===key||(jobId&&state.entries.find(e=>e.key===state.active&&String(e.jobId)===jobId)))){
    closeDrawer();
  }
  state.entries=state.entries.filter(item=>(key?item.key!==key:true)&&(jobId?String(item.jobId)!==jobId:true));
  if(jobId){
    state.selectedHistory.delete(jobId);
    state.history.v2=state.history.v2.filter(r=>String(r.jobId)!==jobId);
    state.history.anon2=state.history.anon2.filter(r=>String(r.jobId)!==jobId);
  }
  saveSession();
  renderQueue();
  renderHistory();
  updateLastDocCard();
  notify('Document retiré de cet écran.');
}
function historyRows(source){
  const rows=source==='v2'?[...state.history.v2]:[...state.history.anon2];
  if(source==='v2'){
    const known=new Map(rows.map((row,index)=>[String(row.jobId),index]));
    for(const entry of state.entries){
      if(!entry.jobId)continue;
      const current={jobId:entry.jobId,fileName:entry.name,createdAt:entry.createdAt,
        sizeBytes:entry.sizeBytes,status:entry.status,processingMode:entry.mode,
        reviewRevision:entry.revision,protectionPolicy:{digest:entry.digest,
          selectedTypes:entry.selectedTypes},listDigest:entry.listDigest};
      const index=known.get(String(entry.jobId));
      if(index===undefined)rows.push(current);
      else{
        const knownRow=rows[index];
        const present=Object.fromEntries(Object.entries(current)
          .filter(([,value])=>value!==null&&value!==undefined));
        rows[index]={...knownRow,...present,
          protectionPolicy:{...knownRow.protectionPolicy,...current.protectionPolicy,
            selectedTypes:entry.selectedTypes??knownRow.protectionPolicy?.selectedTypes}};
      }
    }
  }
  return rows.filter(row=>isTerminal(historyStatus(row))).sort((a,b)=>{
    const left=Date.parse(a.createdAt||a.dtCreation||0)||0;
    const right=Date.parse(b.createdAt||b.dtCreation||0)||0;
    return right-left||String(b.jobId).localeCompare(String(a.jobId));
  });
}
function historyStatus(row){return statusOf(row)||'PENDING';}
function historyIcon(name,parent){
  return nucleoIcon(name,parent,'asv2-nucleo-icon');
}
function historyDate(value){
  const date=new Date(value||'');
  return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('fr-FR',
    {dateStyle:'short',timeStyle:'short'}).format(date);
}
function historySize(value){
  const size=Number(value);
  return Number.isFinite(size)&&size>=0?(size<1024?size+' o':
    (size/1024/1024>=1?(size/1024/1024).toFixed(1)+' Mio':(size/1024).toFixed(1)+' Kio')):'—';
}
function renderHistory(){
  if(openMenu){historyDeferred=true;return;}
  const source=state.historyTab;
  const serverReady=source==='v2'?state.capabilities.historyV2===true:
    state.capabilities.historyAnon2===true;
  const oldReady=config.OLD_HISTORY_READY===true&&
    state.capabilities.historyAnon2===true&&!!config.HISTORY_ANON2_PATH;
  historyTabs.hidden=!oldReady;anon2HistoryTab.hidden=!oldReady;
  if(!oldReady&&source==='anon2'){state.historyTab='v2';return renderHistory();}
  historyTitle.textContent=source==='anon2'?copy.historyOld:
    serverReady?copy.historyDurable:copy.historySession;
  const rows=historyRows(source);
  const availableIds=new Set(rows.filter(row=>historyStatus(row)==='READY')
    .map(row=>String(row.jobId)));
  for(const id of state.selectedHistory)if(!availableIds.has(id))state.selectedHistory.delete(id);
  const ready=rows.filter(row=>historyStatus(row)==='READY').length;
  historyCount.textContent=rows.length?plural(rows.length,'document','documents')+
    (ready?' · '+plural(ready,'prêt','prêts'):''):'';
  historyCount.hidden=!rows.length;
  historyHint.textContent=source==='v2'&&!serverReady?
    copy.historySessionOnly:copy.historyServer;
  refreshHistoryButton.hidden=!serverReady;
  moreHistoryButton.hidden=!serverReady||!state.history.cursors[source];
  const zipReady=source==='v2'&&state.capabilities.bulkZipV2===true&&
    typeof config.BULK_ZIP_V2_PATH==='string';
  zipHistoryButton.hidden=!zipReady;
  zipHistoryButton.disabled=!zipReady||state.selectedHistory.size<2;
  zipHistoryButton.title=zipReady?'Télécharger les résultats prêts sélectionnés':'';
  zipHistoryButton.textContent='Télécharger la sélection (.zip)'+
    (state.selectedHistory.size?' · '+state.selectedHistory.size:'');
  clear(historyList);
  historyList.classList.toggle('is-selectable',zipReady);
  if(!rows.length){
    const empty=el('div',null,'asv2-doc-empty',historyList);empty.setAttribute('role','listitem');
    svgIcon('file',empty,20);
    el('p','Vos documents traités apparaîtront ici.',null,empty);
    return;
  }
  for(const row of rows){
    const status=historyStatus(row),name=row.fileName||row.filename||'Document';
    const v2=source==='v2'&&!!row.jobId;
    const item=el('div',null,'asv2-doc is-'+status.toLowerCase(),historyList);item.setAttribute('role','listitem');
    if(zipReady){
      const selectable=v2&&status==='READY';
      const box=el('input',null,'asv2-doc-select',item);
      box.type='checkbox';box.disabled=!selectable;box.checked=state.selectedHistory.has(String(row.jobId));
      box.setAttribute('aria-label','Sélectionner '+name);
      box.addEventListener('change',()=>{
        if(box.checked)state.selectedHistory.add(String(row.jobId));
        else state.selectedHistory.delete(String(row.jobId));
        zipHistoryButton.disabled=state.selectedHistory.size<2;
        zipHistoryButton.textContent='Télécharger la sélection (.zip) · '+state.selectedHistory.size;
      });
    }
    svgIcon('file',item,18,'asv2-icon asv2-doc-icon');
    const info=el('div',null,'asv2-doc-info',item);
    el('span',name,'asv2-doc-name',info).title=name;
    el('span',[historySize(row.sizeBytes??row.fileLength),
      row.processingMode==='PSEUDONYMIZE'?'Pseudonymisé':'Anonymisé',
      historyDate(row.createdAt||row.dtCreation)].join(' · '),'asv2-doc-meta',info);
    statusPill(status,item);
    const acts=el('div',null,'asv2-doc-actions',item);
    if(!v2)continue;
    const fail=error=>notify(errorText(error),'is-error');
    const open=()=>openHistoryRow(row).catch(fail);
    const canDownload=status==='READY'||(status==='REVIEW_REQUIRED'&&
      state.entries.some(entry=>String(entry.jobId)===String(row.jobId)&&canDownloadResult(entry)));
    if(status==='READY')
      buttonWithIcon('Télécharger','download','asv2-primary asv2-doc-primary',acts,
        ()=>downloadHistoryRow(row).catch(fail));
    else if(status==='REVIEW_REQUIRED')
      buttonWithIcon('Vérifier','eye','asv2-primary asv2-doc-primary',acts,open);
    else button('Voir le détail','asv2-secondary asv2-doc-primary',acts,open);
    const items=[];
    if(status==='READY')items.push({label:'Voir le résultat',icon:'eye',run:open});
    if(status==='REVIEW_REQUIRED'&&canDownload)
      items.push({label:'Télécharger sans finir la vérification',icon:'download',run:()=>downloadHistoryRow(row).catch(fail)});
    if(['READY','REVIEW_REQUIRED'].includes(status))
      items.push({label:'Voir l’original (données en clair)',icon:'eye-slash',run:()=>openHistoryOriginal(row).catch(fail)});
    if(row.processingMode==='PSEUDONYMIZE'){
      const keyReady=pseudoReady&&(status==='READY'||
        (status==='REVIEW_REQUIRED'&&editorCapabilities.pseudonymKeyReviewRequired));
      items.push({label:'Télécharger la clé',icon:'key',disabled:!keyReady,
        title:keyReady?'':'La clé n’est pas encore disponible pour ce document.',
        run:()=>downloadHistoryKey(row).catch(fail)});
      if((RESTORE_WORKFLOW_QUALIFIED||config.SHOW_RESTORE===true)&&!/\.pdf$/i.test(String(name||'')))
        items.push({label:'Restaurer avec la clé',icon:'key',run:()=>openRestore()});
    }
    items.push({label:'Copier la référence support',icon:'circle-info',run:()=>copyReference(row.jobId)});
    items.push('separator',{label:'Retirer de cet écran',icon:'trash',danger:true,run:()=>removeEntryFromSession(row)});
    docMenu(acts,items,'Plus d’actions pour '+name);
  }
}
async function loadHistory(more=false){
  const epoch=state.accountEpoch;
  const source=state.historyTab;
  const enabled=source==='v2'?state.capabilities.historyV2===true:
    state.capabilities.historyAnon2===true;
  const path=source==='v2'?config.HISTORY_V2_PATH:config.HISTORY_ANON2_PATH;
  if(!enabled||!path){renderHistory();return;}
  const cursor=more?state.history.cursors[source]:null;
  if(more&&!cursor)return;
  const response=await api.listHistory(path,{cursor,limit:50});
  if(epoch!==state.accountEpoch)return;
  if(!Array.isArray(response?.items))throw new Error('Historique indisponible');
  const prior=more?state.history[source]:[];
  const merged=new Map(prior.map(row=>[String(row.jobId),row]));
  for(const row of response.items)if(row&&row.jobId)merged.set(String(row.jobId),row);
  state.history[source]=[...merged.values()];state.history[source+'Loaded']=true;
  state.history.cursors[source]=response.nextCursor||null;
  renderHistory();
}
async function entryForHistory(row){
  let entry=state.entries.find(item=>String(item.jobId)===String(row.jobId));
  if(!entry){
    if(!row.protectionPolicy?.digest)throw new Error('Empreinte de politique manquante dans l’historique');
    entry={key:crypto.randomUUID(),file:null,name:row.fileName||row.filename||'Document',
      accountRef:state.accountRef,accountEpoch:state.accountEpoch,
      format:formatOf(row.fileName||row.filename),jobId:row.jobId,digest:row.protectionPolicy.digest,
      listDigest:row.listDigest||null,mode:row.processingMode||'ANONYMIZE',
      selectedTypes:row.protectionPolicy.selectedTypes||null,status:historyStatus(row),
      createdAt:row.createdAt||row.dtCreation,sizeBytes:row.sizeBytes??row.fileLength,
      revision:row.reviewRevision||null,review:null,regions:null,hasCurrentResult:false,
      previewKind:'anon',page:1,zoom:1,
      target:null,error:null,previewSerial:0};
  }
  const job=await api.status(entry.jobId);assertDigest(entry,job);
  if(!currentAccountEntry(entry))throw new Error('Le compte a changé. Actualisez la page.');
  if(!state.entries.includes(entry)){state.entries.push(entry);saveSession();}
  entry.status=statusOf(job);
  if(['PENDING','PROCESSING'].includes(entry.status)){
    renderQueue();pollEntry(entry).catch(error=>{
      entry.status='TIMED_OUT';entry.error=errorText(error);renderQueue();});
  }else await loadCurrent(entry);
  return entry;
}
async function openHistoryRow(row){const entry=await entryForHistory(row);openDrawer(entry);}
async function openHistoryOriginal(row){
  const entry=await entryForHistory(row);
  openDrawer(entry,{showOriginal:true});
}
async function downloadHistoryRow(row){
  const entry=await entryForHistory(row);
  if(!canDownloadResult(entry))throw new Error('Le résultat courant n’est pas disponible au téléchargement.');
  await download(entry,entry.status==='READY');
}
async function downloadHistoryKey(row){
  const entry=await entryForHistory(row);
  if(!canDownloadKey(entry))throw new Error('Clé indisponible');
  await downloadKey(entry);
}
async function downloadSelectedZip(){
  if(state.historyTab!=='v2'||state.capabilities.bulkZipV2!==true||!config.BULK_ZIP_V2_PATH)
    throw new Error('Archive de téléchargement indisponible');
  const chosen=historyRows('v2').filter(row=>state.selectedHistory.has(String(row.jobId)));
  if(chosen.length<2||chosen.length>12||chosen.some(row=>historyStatus(row)!=='READY'))
    throw new Error('Sélectionnez entre 2 et 12 documents READY');
  const jobs=[];
  for(const row of chosen){
    const entry=await entryForHistory(row);
    if(entry.status!=='READY'||!entry.revision||
        String(row.reviewRevision)!==String(entry.revision)||
        row.protectionPolicy?.digest!==entry.digest||
        (row.listDigest||null)!==(entry.listDigest||null))
      throw new Error('Une ligne a changé : actualisez la sélection avant le ZIP');
    jobs.push({jobId:entry.jobId,revision:entry.revision,policyDigest:entry.digest,
      listDigest:entry.listDigest||null});
  }
  const response=await api.downloadZip(config.BULK_ZIP_V2_PATH,jobs);
  if(response.headers.get('X-Agiloshield-Zip-Certified')!=='true'||
      !/application\/zip/i.test(response.headers.get('Content-Type')||''))
    throw new Error('Archive non certifiée');
  const url=URL.createObjectURL(await response.blob());
  const link=el('a',null,null,document.body);link.href=url;link.download='agiloshield-v2-selection.zip';
  link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function saveSession(){
  const key=accountStorageKey('');if(!key)return;
  const known=state.entries.filter(entry=>entry.jobId);
  const pending=known.filter(entry=>!isTerminal(entry.status)).slice(-12);
  const slots=recentSessionLimit-pending.length;
  const recent=slots?known.filter(entry=>isTerminal(entry.status)).slice(-slots):[];
  try{sessionStorage.setItem(key,JSON.stringify([...pending,...recent]
    .map(entry=>({jobId:entry.jobId,digest:entry.digest,
      listDigest:entry.listDigest||null,mode:entry.mode}))));}
  catch(_){/* Session recovery is optional when storage is unavailable. */}
}
async function restoreSession(){
  const key=accountStorageKey('');if(!state.preferencesReady||!key)return;
  const epoch=state.accountEpoch;
  let saved=[];try{saved=JSON.parse(sessionStorage.getItem(key)||'[]');}catch(_){return;}
  if(!Array.isArray(saved))return;
  const savedEntries=saved.slice(-recentSessionLimit);
  let nextSaved=0;
  async function restoreNext(){while(nextSaved<savedEntries.length&&epoch===state.accountEpoch){
    const item=savedEntries[nextSaved++];
    if(!item||!item.jobId||!item.digest||state.entries.some(e=>e.jobId===item.jobId))continue;
    const entry={key:crypto.randomUUID(),file:null,name:'Document',format:'',jobId:item.jobId,
      accountRef:state.accountRef,accountEpoch:epoch,
      digest:item.digest,listDigest:item.listDigest||null,mode:item.mode||null,
      selectedTypes:null,status:'PENDING',revision:null,review:null,regions:null,
      hasCurrentResult:false,previewKind:'anon',page:1,zoom:1,target:null,error:null,previewSerial:0};
    try{
      const job=await api.status(entry.jobId);assertDigest(entry,job);
      if(!currentAccountEntry(entry))return;
      state.entries.push(entry);
      entry.status=statusOf(job);entry.name=job.fileName||job.filename||job.originalFilename||entry.name;
      entry.mode=job.processingMode||entry.mode;
      entry.format=formatOf(entry.name);entry.selectedTypes=job.protectionPolicy?.selectedTypes||null;
      if(isTerminal(entry.status))await loadCurrent(entry);
      else pollEntry(entry).catch(error=>{entry.error=errorText(error);renderQueue();});
    }catch(error){
      if([403,404].includes(error?.status))state.entries=state.entries.filter(candidate=>candidate!==entry);
      else{entry.status='ERROR';entry.error=errorText(error);}
    }
  }}
  await Promise.all([restoreNext(),restoreNext()]);
  saveSession();
  renderQueue();
}
function assertDigest(entry,value){
  if(!entry.digest||value?.protectionPolicy?.digest!==entry.digest)throw new Error('Empreinte de politique incohérente');
  if(!entry.listDigest&&value?.listDigest){entry.listDigest=value.listDigest;}
  else if(!entry.listDigest||value?.listDigest!==entry.listDigest)throw new Error('Empreinte des listes incohérente');
  if(entry.mode&&value?.processingMode!==entry.mode)
    throw new Error('Mode de traitement incohérent');
}
async function confirmAction(text){
  return new Promise(resolve=>{
    const host=!listsModal.hidden?listsDialog:!policyModal.hidden?policyDialog:drawer.hidden?shell:panel;
    const box=el('div',null,'asv2-confirm',host);
    el('p',text,null,box);
    const yes=button('Confirmer','asv2-primary',box,()=>{box.remove();resolve(true);});
    button('Annuler','asv2-secondary',box,()=>{box.remove();resolve(false);});yes.focus();
  });
}
async function drainQueue(){
  if(!state.preferencesReady||state.running||state.authPaused)return;
  state.running=true;
  try{
    while(true){
      if(state.authPaused)break;
      const entry=state.entries.find(item=>item.status==='LOCAL'&&currentAccountEntry(item));
      if(!entry)break;
      entry.status='UPLOADING';renderQueue();renderDrawer(entry);
      try{
        entry.listDigest=entry.lists?await digestListDirectives(entry.lists):await digestListDirectives(emptyLists());
        const progress=config.UPLOAD_PROGRESS===false||typeof XMLHttpRequest==='undefined'?undefined:
          (loaded,total)=>{entry.uploadProgress=Math.min(100,Math.round(loaded/total*100));renderQueue();};
        const created=await api.upload(entry.file,entry.policy,{
          ...(entry.lists||{}),processingMode:entry.mode,onUploadProgress:progress,
          uploadId:state.capabilities.uploadIdempotency===true?entry.uploadId:undefined});
        if(!currentAccountEntry(entry))break;
        entry.jobId=created?.jobId||null;
        assertCreatedJob(created,{digest:entry.digest,listDigest:entry.listDigest,mode:entry.mode});
        // Keep the local original available while the worker has no preview yet.
        entry.lists=null;entry.status=statusOf(created)||'PENDING';
        entry.createdAt=created.createdAt||entry.createdAt;
        entry.sizeBytes=created.sizeBytes||entry.sizeBytes;
        saveSession();renderQueue();
        pollEntry(entry).catch(error=>{entry.status='TIMED_OUT';entry.error=errorText(error);
          renderQueue();renderDrawer(entry);});
      }catch(error){
        if(!currentAccountEntry(entry))break;
        if(error?.status===401){
          state.authPaused=true;resumeAuthButton.hidden=true;
          entry.status='AUTH_REQUIRED';entry.error='Votre session a expiré.';
          renderQueue();notify('Votre session a expiré. Reconnectez-vous puis utilisez « Se reconnecter » sur le document.','is-warning');break;
        }
        entry.lists=null;
        let parisTime='';
        try{parisTime=new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Paris'}).format(new Date());}catch(_){parisTime=new Date().toISOString();}
        entry.diagnosticTrace={
          parisTime,
          httpStatus:error?.status||'Réseau / Inconnu',
          errorBody:error?.message||errorText(error),
          jobId:entry.jobId||null
        };
        entry.status=entry.jobId||!error.status||error.status>=500?'UNCERTAIN':'ERROR';
        entry.error=entry.status==='UNCERTAIN'?
          'Le fichier a peut-être été reçu. Vérifiez son état avant de le déposer à nouveau.':errorText(error);
        renderQueue();renderDrawer(entry);
      }
    }
  }catch(error){notify(errorText(error),'is-error');}
  finally{
    state.running=false;renderQueue();
    if(!state.authPaused&&state.entries.some(entry=>entry.status==='LOCAL'))
      queueMicrotask(()=>drainQueue().catch(error=>notify(errorText(error),'is-error')));
  }
}
async function resumeAfterAuth(){
  if(!state.accountRef){location.reload();return;}
  const response=await api.preferences();
  if(response?.accountRef!==state.accountRef){
    await loadPreferences();
    throw new Error('Le compte a changé. Rechargez la page et redéposez les fichiers non envoyés.');
  }
  state.authPaused=false;resumeAuthButton.hidden=true;
  for(const entry of state.entries)if(entry.status==='AUTH_REQUIRED'){
    entry.status='LOCAL';entry.error=null;
  }
  renderQueue();notify('Session rétablie. Reprise des fichiers non envoyés.');
  for(const entry of state.entries)if(entry.status==='TIMED_OUT'&&entry.jobId)
    pollEntry(entry).catch(error=>{entry.error=errorText(error);renderQueue();});
  await drainQueue();
}
async function limitedStatus(jobId){
  if(state.pollRequests>=2)await new Promise(resolve=>state.pollWaiters.push(resolve));
  state.pollRequests++;
  try{return await api.status(jobId);}
  catch(error){
    if(error?.status===401&&!state.authPaused){state.authPaused=true;
      resumeAuthButton.hidden=true;
      notify('Votre session a expiré. Reconnectez-vous pour poursuivre.','is-warning');}
    throw error;
  }
  finally{
    state.pollRequests--;
    state.pollWaiters.shift()?.();
  }
}
async function pollEntry(entry){
  if(entry.polling||!entry.jobId||!currentAccountEntry(entry))return;
  entry.polling=true;
  try{while(!state.disposed&&currentAccountEntry(entry)){
    const job=await limitedStatus(entry.jobId);assertDigest(entry,job);
    if(!currentAccountEntry(entry))return;
    entry.status=statusOf(job);entry.selectedTypes=job.protectionPolicy?.selectedTypes||entry.selectedTypes;
    if(!isTerminal(entry.status))entry.hasCurrentResult=false;
    renderQueue();renderDrawer(entry);
    if(isTerminal(entry.status)){await loadCurrent(entry);return;}
    if(job.workflowState==='DIRTY'){
      await loadCurrent(entry);
      drawerMessage('Modifications en attente de confirmation.','is-warning');
      return;
    }
    if(!['PENDING','PROCESSING'].includes(entry.status))throw new Error('Statut non reconnu : '+entry.status);
    const interval=document.visibilityState==='hidden'?Math.max(15000,config.POLL_MS||5000):
      Math.max(1000,config.POLL_MS||5000);
    await new Promise(resolve=>setTimeout(resolve,interval));
  }}finally{entry.polling=false;}
}
function extractJobError(job, jobId){
  const prefix = jobId ? '[' + jobId + '] ' : '';
  if(!job)return prefix + 'Échec du traitement côté serveur';
  if(typeof job.error==='string')return prefix + job.error;
  if(typeof job.errorMessage==='string')return prefix + job.errorMessage;
  if(typeof job.message==='string')return prefix + job.message;
  if(typeof job.reason==='string')return prefix + job.reason;
  if(typeof job.errorCode==='string')return prefix + job.errorCode;
  if(job.error&&typeof job.error==='object'){
    return prefix + (job.error.code||job.error.message||job.error.detail||JSON.stringify(job.error));
  }
  return prefix + 'ENGINE_FAILED';
}
async function loadCurrent(entry){
  if(!currentAccountEntry(entry))return;
  const job=await api.status(entry.jobId);assertDigest(entry,job);
  if(!currentAccountEntry(entry))return;
  const currentStatus=statusOf(job);
  const [review,regions]=await Promise.all([
    api.review(entry.jobId).catch(error=>{if(currentStatus!=='FAILED')throw error;return null;}),
    api.regions(entry.jobId).catch(()=>null)]);
  if(review)assertDigest(entry,review);
  if(!currentAccountEntry(entry))return;
  if(review&&(String(review.revision)!==String(job.reviewRevision)||
    review.status!==currentStatus||review.processingMode!==job.processingMode||
    review.workflowState!==job.workflowState))throw new Error(copy.errors.reviewStale);
  const previousRevision=entry.revision;
  entry.status=currentStatus;entry.revision=review?.revision||job.reviewRevision||null;
  if(previousRevision&&String(previousRevision)!==String(entry.revision)){
    entry.focusId=null;entry.pageOnlyLocation=null;entry.target=null;entry.previewKind='anon';entry.page=1;
    entry.report=null;entry.reportError=null;entry.pendingMask=null;
  }
  entry.review=review;entry.regions=regions;
  entry.hasCurrentResult=currentResultAvailable(job,review);
  if(isTerminal(currentStatus)){entry.file=null;if(currentStatus==='FAILED')entry.pendingMask=null;}
  entry.error=currentStatus==='FAILED'?jobErrorMessage(job):null;
  if(currentStatus==='FAILED'){
    console.error('[AgiloShield V2] Le traitement du document a échoué côté serveur :', {
      jobId:entry.jobId, name:entry.name, status:currentStatus, error:extractJobError(job,entry.jobId), rawJob:job
    });
  }
  entry.mode=job.processingMode||entry.mode;
  entry.selectedTypes=job.protectionPolicy?.selectedTypes||entry.selectedTypes;
  entry.name=job.fileName||job.filename||job.originalFilename||entry.name;
  entry.createdAt=job.createdAt||job.dtCreation||entry.createdAt;
  entry.sizeBytes=job.sizeBytes||job.fileLength||entry.sizeBytes;
  entry.format=formatOf(entry.name)||entry.format;
  if(editorCapabilities.qaReport&&entry.hasCurrentResult&&entry.revision){
    try{
      const report=await api.report(entry.jobId);
      if(!currentAccountEntry(entry)||entry.revision!==String(report?.revision)||
        report.status!==entry.status||report.protectionPolicy?.digest!==entry.digest||
        report.listDigest!==entry.listDigest||report.processingMode!==entry.mode)
        throw new Error('stale QA report');
      entry.report=report;entry.reportError=null;
    }catch(error){entry.report=null;entry.reportError='Rapport QA indisponible pour cette révision.';}
  }else{entry.report=null;entry.reportError=null;}
  renderQueue();renderDrawer(entry);if(state.active===entry.key)await renderPreview(entry);
  if(isTerminal(currentStatus)&&!entry.announcedComplete){
    entry.announcedComplete=true;
    notify(entry.name+' : '+safeStatus(currentStatus)+'. Retrouvez ce fichier dans « '+
      (state.capabilities.historyV2===true?copy.historyDurable:copy.historySession)+' ».');
    updateLastDocCard(entry);
  }
  if((currentStatus==='READY'||currentStatus==='REVIEW_REQUIRED')&&entry.batchId&&!state.autoOpenedBatches.has(entry.batchId)){
    state.autoOpenedBatches.add(entry.batchId);
    if(state.surface!=='restore'&&!state.drawerOpen&&policyModal.hidden&&listsModal.hidden&&
        !drop.classList.contains('is-dragging')&&
        !document.activeElement?.matches?.('textarea, input[type="text"], input[type="search"]')&&
        document.visibilityState==='visible')
      openDrawer(entry);
    else notify('Un résultat est prêt. Ouvrez-le depuis « Documents de cette session ».');
  }
}
function setMobileTab(value){
  workspace.classList.toggle('is-doc',value==='doc');workspace.classList.toggle('is-issues',value==='issues');
  tabDoc.classList.toggle('is-active',value==='doc');tabIssues.classList.toggle('is-active',value==='issues');
}
function openDrawer(entry,{showOriginal=false}={}){
  if(!entry||!currentAccountEntry(entry))return;state.active=entry.key;
  entry.previewKind=showOriginal?'origin':'anon';entry.focusId=null;
  entry.pageOnlyLocation=null;entry.target=null;
  try{const key=accountStorageKey(':drawer');if(key)sessionStorage.setItem(key,entry.key);}catch(_){}
  if(!state.drawerOpen){state.lastFocus=document.activeElement;drawer.hidden=false;state.drawerOpen=true;
    requestAnimationFrame(()=>drawer.classList.add('is-open'));document.body.classList.add('asv2-drawer-open');close.focus();}
  setMobileTab('doc');renderDrawer(entry);renderPreview(entry).catch(showError);
}
function closeDrawer(){
  if(!state.drawerOpen)return;state.drawerOpen=false;drawer.classList.remove('is-open');
  document.body.classList.remove('asv2-drawer-open');state.previewSerial++;state.previewFocus=null;
  const active=activeEntry();if(active)active.target=null;
  try{const key=accountStorageKey(':drawer');if(key)sessionStorage.removeItem(key);}catch(_){}
  if(state.previewCleanup)state.previewCleanup();
  setTimeout(()=>{if(!state.drawerOpen)drawer.hidden=true;},260);
  if(state.lastFocus?.isConnected)state.lastFocus.focus();
}
drawer.addEventListener('keydown',event=>{
  const current=activeEntry();
  if(event.key==='Escape'){
    event.preventDefault();
    if(current&&(current.manualMaskActive||current.target)){
      current.manualMaskActive=false;current.target=null;
      drawerMessage('');renderPreview(current).catch(showError);
      return;
    }
    closeDrawer();return;
  }
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){
    event.preventDefault();
    if(current&&state.drawerOpen)undoLastReview(current).catch(showError);
    return;
  }
  const typing=event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
  const confirming=panel.querySelector('.asv2-confirm');
  if(!typing&&!confirming&&!event.metaKey&&!event.ctrlKey&&!event.altKey){
    const letter=event.key.length===1?event.key.toLowerCase():'';
    if(letter==='j'||letter==='k'||letter==='m'||letter==='v'){
      if(current&&state.drawerOpen){event.preventDefault();handleReviewShortcut(current,letter);return;}
    }
  }
  if(event.key!=='Tab')return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,a[href],[tabindex]:not([tabindex="-1"])')]
    .filter(item=>!item.hidden&&item.getClientRects().length);
  if(!focusables.length)return;
  if(event.shiftKey&&document.activeElement===focusables[0]){event.preventDefault();focusables.at(-1).focus();}
  else if(!event.shiftKey&&document.activeElement===focusables.at(-1)){event.preventDefault();focusables[0].focus();}
});
function showError(error){drawerMessage(errorText(error),'is-error');}
function copyDiagnosticTrace(entry){
  const trace=entry?.diagnosticTrace||{};
  const lines=[
    '=== DIAGNOSTIC AGILOSHIELD V2 (STAGING) ===',
    'Fichier : '+(entry?.name||'N/A'),
    'Job ID : '+(entry?.jobId||trace.jobId||'Non attribué'),
    'Heure de Paris : '+(trace.parisTime||new Date().toISOString()),
    'Statut HTTP : '+(trace.httpStatus||'N/A'),
    'Détail erreur : '+(trace.errorBody||entry?.error||'N/A'),
    'Mode : '+(entry?.mode||'ANONYMIZE'),
    'Statut UI : '+(entry?.status||'N/A')
  ];
  const payload=lines.join('\n');
  if(navigator?.clipboard?.writeText){
    navigator.clipboard.writeText(payload).then(()=>notify('Diagnostic copié dans le presse-papier !'))
      .catch(()=>prompt('Copiez ce diagnostic technique :',payload));
  }else{
    prompt('Copiez ce diagnostic technique :',payload);
  }
}
function remainingReviewWork(entry){
  const review=entry.review||{};
  const rows=(review.occurrences||[]).filter(r=>r.action==='REVIEW'||r.privacyAction==='REVIEW');
  const unresolved=(review.unresolvedMasks||[]).filter(t=>t.maskOccurrenceId&&t.page);
  const problems=Array.isArray(review.listProblems)?review.listProblems:[];
  return {rows,unresolved,problems,count:rows.length+unresolved.length+problems.length};
}
function reviewQueue(entry){
  const {rows,unresolved,problems}=remainingReviewWork(entry);
  return [
    ...unresolved.map(target=>({kind:'unresolved',target})),
    ...problems.map(problem=>({kind:'problem',problem})),
    ...rows.map(row=>({kind:'row',row}))
  ];
}
function reviewProgress(entry){
  const work=remainingReviewWork(entry);
  const stamp=String(entry.jobId||'')+':'+String(entry.revision||'');
  if(entry.reviewStamp!==stamp){
    entry.reviewStamp=stamp;entry.reviewTotal=work.count;entry.reviewFocusIndex=0;entry.reviewVisibleCount=20;
  }
  if(work.count>(entry.reviewTotal||0))entry.reviewTotal=work.count;
  const total=entry.reviewTotal||work.count;
  const remaining=work.count;
  return {done:Math.max(0,total-remaining),total,remaining,work};
}
function occurrenceContext(entry,current){
  const source=entry.review?.pages?.find(page=>page.surfaceId===current.surfaceId)?.text;
  if(typeof source!=='string'||!Number.isInteger(current.start)||!Number.isInteger(current.end)||
    current.start<0||current.end<=current.start)return null;
  const cpStart=codePointOffset(source,current.start),cpEnd=codePointOffset(source,current.end);
  const hit=source.slice(cpStart,cpEnd);
  if(hit!==(current.text||current.surface))return null;
  return {
    before:source.slice(Math.max(0,cpStart-45),cpStart).replace(/\s+/g,' '),
    hit,
    after:source.slice(cpEnd,Math.min(source.length,cpEnd+45)).replace(/\s+/g,' ')
  };
}
function addPassLocate(parent,entry,current){
  const pdfLocation=originalPdfLocation(entry,current);
  const textSource=entry.review?.pages?.find(page=>page.surfaceId===current.surfaceId)?.text;
  const textExact=['txt','csv'].includes(entry.format)&&typeof textSource==='string'&&
    Number.isInteger(current.start)&&Number.isInteger(current.end)&&
    current.start>=0&&current.end>current.start&&
    textSource.slice(codePointOffset(textSource,current.start),
      codePointOffset(textSource,current.end))===(current.text||current.surface);
  if(pdfLocation.kind==='exact'||textExact){
    iconButton('eye','Voir dans le document','asv2-issue-locate-icon',parent,()=>focusOccurrence(entry,current));
  }else if(pdfLocation.kind==='page'){
    iconButton('eye','Ouvrir la page '+pdfLocation.page,'asv2-issue-locate-icon',parent,
      ()=>focusOccurrence(entry,current,{pageOnly:true}));
  }
}
function renderShortcutHelp(parent){
  const row=el('div',null,'asv2-kbd',parent);
  for(const [keys,label] of [[['J','K'],'suivant'],[['M'],'masquer'],[['V'],'laisser visible'],[['⌘Z'],'annuler'],[['Échap'],'fermer']]){
    const span=el('span',null,null,row);
    for(const key of keys){el('kbd',key,null,span);span.append(' ');}
    span.append(label);
  }
}
function handleReviewShortcut(entry,key){
  const queue=reviewQueue(entry);
  if(!queue.length)return;
  if(typeof entry.reviewFocusIndex!=='number')entry.reviewFocusIndex=0;
  if(key==='j'||key==='k'){
    entry.reviewFocusIndex=key==='j'?
      Math.min(entry.reviewFocusIndex+1,queue.length-1):
      Math.max(entry.reviewFocusIndex-1,0);
    if(entry.reviewFocusIndex>=(entry.reviewVisibleCount||20))
      entry.reviewVisibleCount=entry.reviewFocusIndex+1;
    renderIssues(entry);renderFooter(entry);
    const item=queue[entry.reviewFocusIndex];
    if(item?.kind==='row')focusOccurrence(entry,item.row);
    return;
  }
  const item=queue[entry.reviewFocusIndex];
  if(!item||entry.commandBusy)return;
  if(key==='m'){
    if(item.kind==='row')decide(entry,item.row.id,'MASK');
    else if(item.kind==='problem'&&item.problem.occurrenceId)decide(entry,item.problem.occurrenceId,'MASK');
  }
  if(key==='v'){
    if(item.kind==='row')decide(entry,item.row.id,'KEEP');
    else if(item.kind==='problem'&&item.problem.occurrenceId)decide(entry,item.problem.occurrenceId,'KEEP');
  }
}
function renderDrawer(entry){
  if(state.active!==entry.key||!state.drawerOpen)return;
  title.textContent=entry.name;
  meta.textContent=[entry.format.toUpperCase()||'Document',
    entry.mode==='PSEUDONYMIZE'?'Pseudonymisé':'Anonymisé'].filter(Boolean).join(' · ');
  clear(drawerStatus);
  statusPill(entry.status,drawerStatus);
  clear(drawerDownloads);
  if(canDownloadResult(entry)){
    const downloadControl=iconButton('download','Télécharger',
      'asv2-drawer-icon'+(entry.status==='READY'?' is-primary':''),drawerDownloads,
      ()=>download(entry,entry.status==='READY').catch(showError));
    downloadControl.title=entry.status==='READY'?'Télécharger':'Télécharger (une confirmation sera demandée)';
    if(canDownloadKey(entry)){
      const keyControl=iconButton('key','Télécharger la clé','asv2-drawer-icon',drawerDownloads,
        ()=>downloadKey(entry).catch(showError));
      keyControl.title='Télécharger la clé de pseudonymisation';
    }
  }
  if(entry.status==='REVIEW_REQUIRED'){
    if(!drawerNotice.classList.contains('is-error'))drawerMessage('');
  }else drawerMessage(safeStatus(entry.status),
    entry.status==='FAILED'||entry.status==='ERROR'?'is-error':
    entry.status==='TIMED_OUT'?'is-warning':'');
  renderIssues(entry);renderFooter(entry);
}
function renderIssues(entry){
  const footer=drawerFooter;
  issuePane.replaceChildren();
  issuePane.appendChild(footer);
  if(entry.status==='FAILED'){
    const errBox=el('div',null,'asv2-issue asv2-error-box',issuePane);
    el('strong','Ce document n’a pas pu être traité',null,errBox);
    el('p',entry.error||copy.errors.failed,'asv2-error-detail',errBox);
    const actions=el('div',null,'asv2-error-actions',errBox);
    buttonWithIcon('Retirer','trash','asv2-secondary asv2-remove-btn',actions,
      ()=>removeEntryFromSession(entry));
    issuePane.appendChild(footer);
    return;
  }
  if(entry.status==='UNCERTAIN'){
    const errBox=el('div',null,'asv2-issue asv2-warning-box',issuePane);
    el('strong','Traitement à vérifier',null,errBox);
    el('p','Le statut de ce document n’est pas confirmé. Vous pouvez le retirer de cet écran et réessayer.',
      'asv2-error-detail',errBox);
    const actions=el('div',null,'asv2-error-actions',errBox);
    buttonWithIcon('Retirer','trash','asv2-secondary asv2-remove-btn',actions,
      ()=>removeEntryFromSession(entry));
    issuePane.appendChild(footer);
    return;
  }
  const review=entry.review;
  if(!review){
    const empty=el('div',null,'asv2-review-empty',issuePane);
    el('strong',entry.jobId?'Analyse en cours':'Aucun document sélectionné',null,empty);
    el('p',entry.jobId?'La vérification apparaîtra dès que le résultat sera disponible.':
      'Ouvrez un document pour afficher sa vérification.','asv2-muted',empty);
    issuePane.appendChild(footer);
    return;
  }

  const progress=reviewProgress(entry);
  const queue=reviewQueue(entry);
  if(typeof entry.reviewFocusIndex!=='number')entry.reviewFocusIndex=0;
  if(entry.reviewFocusIndex>=queue.length)entry.reviewFocusIndex=Math.max(0,queue.length-1);
  const visibleLimit=Math.max(entry.reviewVisibleCount||20, (entry.reviewFocusIndex||0)+1);

  const reviewSummary=el('div',null,'asv2-review-summary',issuePane);
  el('h3',progress.remaining?copy.review.toCheck(progress.remaining):copy.review.readyToValidate,null,reviewSummary);
  if(progress.total){
    const row=el('div',null,'asv2-review-progress',reviewSummary);
    el('span',copy.review.progress(progress.done,progress.total),null,row);
    const bar=el('span',null,'asv2-review-progress-bar',row);
    const fill=el('i',null,null,bar);
    fill.style.width=(progress.total?Math.round(100*progress.done/progress.total):0)+'%';
  }

  const issuesContent=el('div',null,'asv2-issues-content',issuePane);
  issuesContent.setAttribute('tabindex','0');
  issuesContent.setAttribute('role','region');
  issuesContent.setAttribute('aria-label','Passages à vérifier');

  function renderPass(item,index){
    const open=index===entry.reviewFocusIndex;
    const card=el('article',null,'asv2-pass'+(open?' is-open':''),issuesContent);
    const top=el('div',null,'asv2-pass-top',card);
    const stateIcon=el('span',null,'asv2-pass-state',top);
    svgIcon(open?'circle-warning':'circle-info',stateIcon,18);
    const what=el('div',null,'asv2-pass-what',top);
    if(item.kind==='unresolved'){
      const target=item.target;
      const label=labels[target.category||target.semanticType]||'Donnée à masquer';
      el('strong',label,null,what);
      el('small','Page '+target.page+' · à placer',null,what);
      if(open){
        const actions=el('div',null,'asv2-pass-actions',card);
        const control=buttonWithIcon('Placer une zone de masquage','select-area','asv2-secondary',actions,()=>{
          entry.target=target;entry.page=Number(target.page);
          if(entry.previewKind==='compare')entry.previewKind='anon';
          entry.pageOnlyLocation=null;
          setMobileTab('doc');renderPreview(entry).catch(showError);
          drawerMessage('Tracez la zone correspondant uniquement à ce passage.','is-warning');
        });
        control.disabled=!review.reviewable||entry.format!=='pdf';
      }else card.addEventListener('click',event=>{
        if(event.target.closest('button'))return;
        entry.reviewFocusIndex=index;renderIssues(entry);renderFooter(entry);
      });
      return;
    }
    if(item.kind==='problem'){
      const problem=item.problem;
      el('strong',problem.reason==='LIST_EXCLUSION_REVIEW'?
        'Une règle de conservation contredit un masquage nécessaire':
        'Un passage demandé n’a pas été localisé avec certitude',null,what);
      el('small','Liste',null,what);
      if(open&&problem.occurrenceId&&review.reviewable){
        const actions=el('div',null,'asv2-pass-actions',card);
        for(const action of ['MASK','KEEP']){
          const control=button(copy.reviewAction[action],
            action==='MASK'?'asv2-primary asv2-action-mask':'asv2-secondary asv2-action-keep',actions,
            ()=>decide(entry,problem.occurrenceId,action));
          control.disabled=entry.commandBusy;
        }
      }else if(open) el('small','La correction de ce format n’est pas disponible ici. Ajustez les règles et déposez un nouveau fichier.',null,card);
      else card.addEventListener('click',event=>{
        if(event.target.closest('button'))return;
        entry.reviewFocusIndex=index;renderIssues(entry);renderFooter(entry);
      });
      return;
    }
    const current=item.row;
    const label=labels[current.category||current.semanticType]||'Donnée repérée';
    el('strong',current.text||current.surface||'Passage à vérifier',null,what);
    el('small',[label,current.page?'page '+current.page:null].filter(Boolean).join(' · '),null,what);
    addPassLocate(top,entry,current);
    if(open){
      const ctx=occurrenceContext(entry,current);
      const quote=el('p',null,'asv2-pass-quote',card);
      if(ctx){
        quote.append(document.createTextNode((ctx.before?'…'+ctx.before+' ':'')));
        el('mark',ctx.hit,null,quote);
        quote.append(document.createTextNode((ctx.after?' '+ctx.after+'…':'')));
      }else quote.textContent=current.text||current.surface||'Passage à vérifier';
      const actions=el('div',null,'asv2-pass-actions',card);
      for(const action of ['MASK','KEEP']){
        const control=action==='MASK'?
          buttonWithIcon(copy.reviewAction.MASK,'eye-slash','asv2-primary asv2-action-mask',actions,
            ()=>decide(entry,current.id,action)):
          buttonWithIcon(copy.reviewAction.KEEP,'eye','asv2-secondary asv2-action-keep',actions,
            ()=>decide(entry,current.id,action));
        control.title=copy.reviewAction[action]+' (ce passage uniquement)';
        control.setAttribute('aria-label',control.title);
        control.disabled=!review.reviewable||entry.commandBusy;
      }
    }else card.addEventListener('click',event=>{
      if(event.target.closest('button'))return;
      entry.reviewFocusIndex=index;renderIssues(entry);renderFooter(entry);
      focusOccurrence(entry,current);
    });
  }

  const shown=queue.slice(0,visibleLimit);
  shown.forEach((item,index)=>renderPass(item,index));
  if(queue.length>visibleLimit){
    const more=button('Afficher d’autres passages · '+copy.review.moreGroups(queue.length-visibleLimit),
      'asv2-secondary asv2-issues-more',issuesContent,()=>{
        entry.reviewVisibleCount=visibleLimit+20;renderIssues(entry);
      });
  }

  const rawReasons=review.qaReasons||review.reasons||[];
  const hiddenTechnicalSignals=rawReasons.length+
    (Array.isArray(entry.report?.reasons)?entry.report.reasons.length:0);
  if(!progress.remaining&&hiddenTechnicalSignals&&review.canApproveHumanVerification===false){
    const note=el('div',null,'asv2-review-safety-note',issuesContent);
    el('strong','Vérification finale nécessaire',null,note);
    el('p','Vérifiez l’aperçu. Si une donnée reste visible, utilisez « Masquer une zone », puis validez.',
      'asv2-muted',note);
  }

  const allRows=Array.isArray(review.occurrences)?review.occurrences:[];
  const masked=allRows.filter(r=>(r.action||r.privacyAction)==='MASK');
  if(masked.length){
    const others=button('', 'asv2-others',issuesContent,()=>{body.hidden=!body.hidden;});
    el('span',copy.review.othersMasked,null,others);
    el('span',String(masked.length),null,others);
    const body=el('div',null,'asv2-others-body',issuesContent);body.hidden=true;
    for(const row of masked.slice(0,40)){
      el('p',(row.text||row.surface||'Passage')+' · '+(labels[row.category||row.semanticType]||''),
        'asv2-muted',body);
    }
    if(masked.length>40)el('p','+ '+(masked.length-40)+' autres','asv2-muted',body);
  }

  if(!queue.length&&!masked.length&&!hiddenTechnicalSignals){
    el('p','Aucune correction interactive disponible.','asv2-muted',issuesContent);
  }
  issuePane.appendChild(footer);
}
function renderFooter(entry){
  clear(drawerFooter);
  if(entry.status==='TIMED_OUT')button('Reprendre le suivi','asv2-secondary',drawerFooter,()=>pollEntry(entry).catch(showError));
  if(entry.status==='ERROR'&&entry.jobId)button('Actualiser le document','asv2-secondary',drawerFooter,
    ()=>loadCurrent(entry).catch(showError));
  if(entry.status==='REVIEW_REQUIRED'){
    const work=remainingReviewWork(entry);
    const safety=el('p',null,'asv2-review-safety',drawerFooter);
    svgIcon('shield-check',safety,18);
    el('span',work.rows.length?copy.review.pendingLine(work.rows.length):
      work.unresolved.length?copy.review.batch.blockedZones(work.unresolved.length)+'.':
      work.problems.length?copy.review.batch.blockedRules(work.problems.length)+'.':
      copy.review.safetyLine,null,safety);
    if(editorCapabilities.humanVerification){
      const verified=entry.review?.humanVerifiedDeliverable===true;
      const validate=buttonWithIcon(verified?'Vérifié':copy.review.validate,'shield-check','asv2-primary',drawerFooter,
        ()=>approveHumanReview(entry,validate).catch(showError));
      validate.disabled=!verified&&(Boolean(entry.commandBusy)||Boolean(entry.batchRunning));
    }
    renderShortcutHelp(drawerFooter);
  }
  drawerFooter.hidden=!drawerFooter.children.length;
}
function guideToPendingReview(entry){
  setMobileTab('issues');
  const progress=reviewProgress(entry);
  const first=issuePane.querySelector('.asv2-pass.is-open');
  if(first){
    first.scrollIntoView({block:'center',behavior:'smooth'});
    first.querySelector('button')?.focus();
  }
  if(progress.work.rows.length){
    drawerMessage('Il reste '+progress.work.rows.length+' décision'+(progress.work.rows.length>1?'s':'')+' à confirmer.','is-warning');
    return;
  }
  if(progress.work.unresolved.length){
    drawerMessage('Il reste '+progress.work.unresolved.length+' zone'+(progress.work.unresolved.length>1?'s':'')+' à placer.','is-warning');
    return;
  }
  if(progress.work.problems.length){
    drawerMessage('Il reste '+progress.work.problems.length+' règle'+(progress.work.problems.length>1?'s':'')+' à vérifier.','is-warning');
    return;
  }
  const blockers=Array.isArray(entry.review?.humanVerificationBlockers)?entry.review.humanVerificationBlockers:[];
  if(blockers.length){
    drawerMessage(blockers.includes('artifact_inconsistent')?copy.review.batch.serverArtifact:
      copy.review.batch.serverBlocked,'is-warning');
    return;
  }
  drawerMessage(entry.format==='pdf'?
    'Vérifiez l’aperçu. Si une donnée reste visible, utilisez « Masquer une zone », puis validez.':
    'Vérifiez l’aperçu, puis validez.','is-warning');
}
function reviewModal(build){
  const overlay=el('div',null,'asv2-validate-overlay',panel);
  const box=el('div',null,'asv2-validate-dialog',overlay);
  box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');
  const close=()=>{overlay.remove();document.removeEventListener('keydown',onKey,true);};
  function onKey(event){if(event.key==='Escape'&&overlay.dataset.closable!=='false'){event.stopPropagation();overlay.dispatchEvent(new CustomEvent('asv2-dismiss'));}}
  document.addEventListener('keydown',onKey,true);
  build(box,close,overlay);
  return {overlay,box,close};
}
function askBatchDecision(entry,work){
  return new Promise(resolve=>{
    reviewModal((box,close,overlay)=>{
      const done=value=>{close();resolve(value);};
      overlay.addEventListener('asv2-dismiss',()=>done('REVIEW'));
      const blocked=work.unresolved.length+work.problems.length;
      const icon=el('span',null,'asv2-validate-icon',box);icon.innerHTML=iconSvg(blocked?'circle-warning':'shield-check',22);
      const titleId='asv2-validate-title';
      const title=el('h3',blocked?copy.review.batch.blockedTitle:copy.review.batch.title(work.rows.length),null,box);
      title.id=titleId;box.setAttribute('aria-labelledby',titleId);
      if(blocked){
        const list=el('ul',null,'asv2-validate-list',box);
        if(work.unresolved.length)el('li',copy.review.batch.blockedZones(work.unresolved.length),null,list);
        if(work.problems.length)el('li',copy.review.batch.blockedRules(work.problems.length),null,list);
        if(work.rows.length)el('li',copy.review.toCheck(work.rows.length),null,list);
      }else{
        el('p',copy.review.batch.body,null,box);
        if(work.rows.length>20)el('p',copy.review.batch.slow,'asv2-validate-note',box);
      }
      const actions=el('div',null,'asv2-validate-actions',box);
      if(!blocked){
        const mask=buttonWithIcon(copy.review.batch.maskAll,'shield-check','asv2-primary',actions,()=>done('MASK'));
        buttonWithIcon(copy.review.batch.keepAll,'eye','asv2-secondary',actions,()=>done('KEEP'));
        mask.focus();
      }
      const back=button(copy.review.batch.back,'asv2-secondary asv2-validate-back',actions,()=>done('REVIEW'));
      if(blocked)back.focus();
    });
  });
}
async function applyBatchDecision(entry,action){
  const total=remainingReviewWork(entry).rows.length;
  let stopped=false,failed=false,done=0;
  const modal=reviewModal((box,close,overlay)=>{
    overlay.dataset.closable='false';
    el('h3',action==='MASK'?copy.review.batch.maskAll:copy.review.batch.keepAll,null,box);
    const label=el('p',copy.review.batch.progress(0,total),'asv2-validate-progress-label',box);
    label.setAttribute('aria-live','polite');
    const bar=el('div',null,'asv2-validate-progress',box);
    const fill=el('span',null,null,bar);
    const actions=el('div',null,'asv2-validate-actions',box);
    const stop=buttonWithIcon(copy.review.batch.stop,'xmark','asv2-secondary',actions,()=>{
      stopped=true;stop.disabled=true;
    });
    box.update=()=>{label.textContent=copy.review.batch.progress(Math.min(done+1,total),total);
      fill.style.width=Math.round(done/Math.max(total,1)*100)+'%';};
  });
  entry.batchRunning=true;renderFooter(entry);
  try{
    for(let guard=0;guard<total+2&&!stopped;guard++){
      const row=remainingReviewWork(entry).rows[0];
      if(!row||entry.status!=='REVIEW_REQUIRED')break;
      modal.box.update();
      const before=entry.revision;
      await decide(entry,row.id,action);
      if(entry.revision===before){failed=true;break;}
      done++;
    }
  }finally{
    entry.batchRunning=false;modal.close();renderFooter(entry);
  }
  if(failed)return false;
  if(stopped){drawerMessage(copy.review.batch.stopped,'is-info');return false;}
  return true;
}
async function approveHumanReview(entry,control){
  if(entry.commandBusy||entry.batchRunning)return;
  let review=entry.review;
  if(review?.humanVerifiedDeliverable===true){
    await downloadHumanVerified(entry);return;
  }
  let work=remainingReviewWork(entry);
  if(work.count){
    const choice=await askBatchDecision(entry,work);
    if(choice==='REVIEW'){guideToPendingReview(entry);return;}
    if(!await applyBatchDecision(entry,choice))return;
    await loadCurrent(entry).catch(()=>{});
    review=entry.review;
    work=remainingReviewWork(entry);
    if(work.count){guideToPendingReview(entry);return;}
  }
  if(review?.canApproveHumanVerification!==true){
    await loadCurrent(entry).catch(()=>{});
    review=entry.review;
    if(review?.humanVerifiedDeliverable===true){
      await downloadHumanVerified(entry);return;
    }
    if(review?.canApproveHumanVerification!==true){
      guideToPendingReview(entry);return;
    }
  }
  if(control?.isConnected)control.disabled=true;
  const checks={names:true,addresses:true,phones:true,identifiers:true,
    logos_images:true,visual_regions:true,original_vs_final_all_pages:true};
  try{
    await api.approveHumanVerification(entry.jobId,entry.digest,{revision:entry.revision,checks});
    await loadCurrent(entry);
    drawerMessage('Document validé.');
  }catch(error){
    if(error?.status===409){
      await loadCurrent(entry).catch(()=>{});
      guideToPendingReview(entry);
    }else showError(error);
    if(control?.isConnected)control.disabled=false;
  }
}
async function undoLastReview(entry){
  if(!entry||entry.commandBusy)return;
  const last=(entry.undoStack||[]).pop();
  if(!last){notify('Rien à annuler.');return;}
  if(last.kind==='decide'&&last.occurrenceId){
    const opposite=last.action==='MASK'?'KEEP':'MASK';
    await decide(entry,last.occurrenceId,opposite,{fromUndo:true});
    return;
  }
  notify('L’annulation d’une zone tracée n’est pas encore disponible.');
}
async function decide(entry,occurrenceId,action,{fromUndo=false}={}){
  if(entry.commandBusy)return;
  entry.commandBusy=true;renderIssues(entry);
  try{const receipt=await api.decide(entry.jobId,entry.digest,{revision:entry.revision,occurrenceId,
    action,reason:fromUndo?'review_undo':'review_explicit'});
    if(!receipt?.revision)throw new Error('Réponse de masquage incomplète');
    await apply(entry,receipt.revision);
    if(!fromUndo){
      entry.undoStack=entry.undoStack||[];
      entry.undoStack.push({kind:'decide',occurrenceId,action});
    }
  }catch(error){
      if(error?.status===409||error?.status===422)await loadCurrent(entry).catch(()=>{});
      showError(error);
    }
  finally{entry.commandBusy=false;}
}
async function apply(entry,revision){
  const restore={
    manualMaskActive:entry.manualMaskActive,target:entry.target,focusId:entry.focusId,
    pageOnlyLocation:entry.pageOnlyLocation,locateNeedle:entry.locateNeedle,previewKind:entry.previewKind
  };
  entry.status='PROCESSING';entry.hasCurrentResult=false;
  entry.focusId=null;entry.pageOnlyLocation=null;entry.target=null;
  entry.manualMaskActive=false;
  entry.commandBusy=true;
  state.previewSerial++;state.previewCleanup?.();
  renderDrawer(entry);renderQueue();
  try{
    await api.execute(entry.jobId,entry.digest,revision);
    await pollEntry(entry);
  }catch(error){
    await loadCurrent(entry).catch(()=>{});
    Object.assign(entry,restore);
    throw error;
  }finally{
    entry.commandBusy=false;
    renderIssues(entry);
  }
}
function focusOccurrence(entry,row,{pageOnly=false}={}){
  const location=originalPdfLocation(entry,row);
  const previousKind=entry.previewKind;
  if(entry.format==='pdf'&&location.page)entry.page=location.page;
  entry.focusId=row.id;
  entry.locateNeedle=String(row.text||row.surface||'').trim();
  entry.pageOnlyLocation=(pageOnly||location.kind!=='exact')?(location.page?'page':'unknown'):null;
  if(entry.previewKind!=='origin')entry.previewKind='origin';
  setMobileTab('doc');
  const fast=entry.format==='pdf'&&previousKind==='origin'&&
    state.previewFocus?.entryKey===entry.key&&state.previewFocus?.kind==='origin';
  if(fast)state.previewFocus.run().catch(showError);
  else renderPreview(entry).catch(showError);
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
  const location=originalPdfLocation(entry,row);
  if(!row||String(entry.review.revision)!==String(entry.revision)||
    location.page!==entry.page||!pageGeometry(entry,entry.page,base))return [];
  return location.fragments;
}
async function previewBytes(entry,kind){
  if(!currentAccountEntry(entry))throw new Error('Le compte a changé. Actualisez la page.');
  if(kind==='origin'&&entry.file&&!entry.revision)return {bytes:await entry.file.arrayBuffer(),format:entry.format};
  if(!entry.jobId)throw new Error('Document non déposé');
  if(kind==='anon'&&!canPreviewResult(entry))throw new Error('Aperçu du résultat indisponible');
  if(!entry.listDigest||!entry.revision)throw new Error('Empreinte ou révision du document manquante');
  const expected={digest:entry.digest,listDigest:entry.listDigest,revision:entry.revision,
    status:entry.status,mode:entry.mode,accountEpoch:state.accountEpoch};
  // Java must identify the exact current preview; a subsequent status/review
  // read also catches a revision changed while its bytes were transferred.
  async function current(){
    const [job,review]=await Promise.all([api.status(entry.jobId),api.review(entry.jobId)]);
    assertDigest(entry,job);assertDigest(entry,review);
    if(!currentAccountEntry(entry)||state.accountEpoch!==expected.accountEpoch||
      entry.revision!==expected.revision||entry.status!==expected.status||entry.mode!==expected.mode||
      statusOf(job)!==expected.status||String(job.reviewRevision)!==String(expected.revision)||
      String(review.revision)!==String(expected.revision)||
      review.status!==expected.status||job.processingMode!==expected.mode||
      review.processingMode!==expected.mode||job.workflowState!==review.workflowState||
      (kind==='anon'&&!currentResultAvailable(job,review)))throw new Error(copy.errors.previewStale);
  }
  await current();
  const response=assertPreviewHeaders(await api.preview(entry.jobId,kind),{
    kind,...expected});
  const mime=response.headers.get('Content-Type')||'';
  const format=entry.format||(mime.includes('pdf')?'pdf':mime.includes('wordprocessingml')?'docx':
    mime.includes('csv')?'csv':mime.includes('text/plain')?'txt':'');
  const bytes=await response.arrayBuffer();
  await current();
  return {bytes,format};
}
async function renderPreview(entry){
  if(state.active!==entry.key||!state.drawerOpen)return;
  const serial=++state.previewSerial;
  state.previewFocus=null;
  if(state.previewCleanup){state.previewCleanup();state.previewCleanup=null;}
  clear(viewerToolbar);clear(viewerBody);clear(reviewTools);
  const kind=entry.previewKind;
  const switcher=el('div',null,'asv2-preview-switch',reviewTools);
  const options=[['Original','origin','eye'],
    [entry.mode==='PSEUDONYMIZE'?'Pseudonymisé':'Anonymisé','anon','shield-check']];
  if(['pdf','txt','csv','docx'].includes(entry.format)&&canPreviewResult(entry))
    options.push(['Comparer','compare','split-view']);
  for(const [label,value,iconName] of options){
    const control=buttonWithIcon(label,iconName,'asv2-secondary'+(value===kind?' is-active':''),switcher,()=>{
      entry.previewKind=value;renderPreview(entry).catch(showError);
    });
    control.setAttribute('aria-pressed',String(value===kind));
    control.disabled=(value==='anon'||value==='compare')&&!canPreviewResult(entry);
  }
  if(entry.format==='pdf'&&entry.status==='REVIEW_REQUIRED'){
    const maskZone=buttonWithIcon('Masquer une zone','select-area',
      'asv2-secondary asv2-manual-mask-btn'+(entry.manualMaskActive?' is-active':''),reviewTools,()=>{
        entry.manualMaskActive=!entry.manualMaskActive;
        entry.target=null;
        if(entry.manualMaskActive){
          entry.previewKind='origin';
          setMobileTab('doc');
          renderPreview(entry).catch(showError);
          drawerMessage('Tracez la zone à masquer directement sur le document affiché.','is-info');
        }else{
          drawerMessage('');
          renderPreview(entry).catch(showError);
        }
      });
    maskZone.title='Tracer une zone rectangulaire à masquer sur ce PDF';
  }
  // Downloads live beside the file name so they remain visible above the document.
  const loading=el('p','Préparation de l’aperçu…','asv2-loading',viewerBody);
  try{
    if((kind==='anon'||kind==='compare')&&!canPreviewResult(entry)&&
        !['xlsx','pptx'].includes(entry.format)){
      clear(viewerBody);
      el('p',entry.status==='FAILED'?(entry.error?entry.error:'Le traitement a échoué. Aucun résultat protégé n’est disponible.'):
        isTerminal(entry.status)?'Aperçu du résultat indisponible pour cette révision. Vous pouvez ouvrir l’original volontairement.':
          'Le résultat protégé apparaîtra ici après le traitement.',
        'asv2-preview-unavailable',viewerBody);
      return;
    }
    if(['xlsx','pptx'].includes(entry.format)){
      clear(viewerBody);
      const card=el('div',null,'asv2-office-action-card',viewerBody);
      historyIcon('file',card);
      el('h3','Document '+entry.format.toUpperCase()+' '+(entry.status==='READY'?'prêt':'traité'),null,card);
      el('p','L’aperçu interactif n’est pas disponible pour ce format. Le téléchargement dépend du résultat courant vérifié.',null,card);
      const cardActions=el('div',null,'asv2-office-card-actions',card);
      if(canDownloadResult(entry)){
        buttonWithIcon('Télécharger le résultat ('+entry.format.toUpperCase()+')','download','asv2-primary',cardActions,
          ()=>download(entry,entry.status==='READY').catch(showError));
        if(canDownloadKey(entry))
          buttonWithIcon('Télécharger la clé de pseudonymisation','key','asv2-secondary',cardActions,
            ()=>downloadKey(entry).catch(showError));
      } else if(entry.status==='FAILED') {
        el('p','Le traitement de ce fichier a échoué. Consultez le détail dans le panneau de gauche.','asv2-error',card);
      } else if(isTerminal(entry.status)) {
        el('p','Aucun résultat courant téléchargeable pour cette révision.','asv2-muted',card);
      } else {
        el('p','Traitement en cours…','asv2-muted',card);
      }
      return;
    }
    if(kind==='compare'&&['pdf','txt','csv','docx'].includes(entry.format)){
      if(entry.format==='pdf')await renderPdfCompare(entry,serial);
      else await renderOtherCompare(entry,serial);
      return;
    }
    const source=await previewBytes(entry,kind);
    if(serial!==state.previewSerial||state.active!==entry.key)return;
    clear(viewerBody);
    if(kind==='origin'&&entry.pageOnlyLocation&&entry.format!=='pdf')
      el('p','Ce passage ne peut pas être situé avec certitude dans cet aperçu. L’original est ouvert sans surlignage.',
        'asv2-geometry-note',viewerBody);
    if(source.format==='pdf'){
      el('p','Affichage du PDF…','asv2-loading asv2-pdf-loading',viewerBody);
      await renderPdf(entry,source.bytes,kind,serial);
    }
    else if(source.format==='docx'){
      el('p','Cet aperçu Word est indicatif : sa mise en page peut différer du fichier téléchargé.',
        'asv2-geometry-note',viewerBody);
      await renderDocx(source.bytes,serial);
    }
    else if(source.format==='txt')renderText(source.bytes,entry,kind);
    else if(source.format==='csv'){
      if(kind==='origin'&&entry.focusId){
        el('p','Vue source CSV : le passage est localisé par ses positions exactes. La cellule visuelle n’est pas encore fournie par l’API.',
          'asv2-geometry-note',viewerBody);
        renderText(source.bytes,entry,kind);
      }else renderCsv(source.bytes);
    }
    else el('p','Aperçu indisponible pour ce format.','asv2-muted',viewerBody);
  }catch(error){if(serial===state.previewSerial){viewerBody.querySelectorAll('.asv2-loading').forEach(node=>node.remove());if(!viewerBody.children.length)el('p',errorText(error),'asv2-error',viewerBody);else drawerMessage(errorText(error),'is-error');}}
}
async function renderPdfCompare(entry,serial){
  if(!window.pdfjsLib)throw new Error('PDF.js indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=config.PDF_WORKER_URL;
  let origSrc,anonSrc;
  try{
    [origSrc,anonSrc]=await Promise.all([previewBytes(entry,'origin'),previewBytes(entry,'anon')]);
  }catch(error){
    if(serial!==state.previewSerial)return;
    drawerMessage('Comparaison indisponible pour cette révision : affichage du résultat.','is-warning');
    entry.previewKind='anon';
    await renderPreview(entry);
    return;
  }
  if(serial!==state.previewSerial)return;
  let origPdf,anonPdf;
  try{
    [origPdf,anonPdf]=await Promise.all([
      window.pdfjsLib.getDocument({data:new Uint8Array(origSrc.bytes),enableScripting:false}).promise,
      window.pdfjsLib.getDocument({data:new Uint8Array(anonSrc.bytes),enableScripting:false}).promise
    ]);
  }catch(error){
    if(serial!==state.previewSerial)return;
    drawerMessage('Impossible de charger le document PDF pour la comparaison.','is-warning');
    entry.previewKind='anon';
    await renderPreview(entry);
    return;
  }
  if(serial!==state.previewSerial){origPdf.destroy();anonPdf.destroy();return;}
  state.previewCleanup=()=>{origPdf.destroy();anonPdf.destroy();};
  const maxPages=Math.min(origPdf.numPages,anonPdf.numPages);
  entry.page=Math.min(Math.max(1,entry.page),maxPages);

  clear(viewerBody);
  const nav=el('div',null,'asv2-pdf-nav',viewerBody);
  const prev=iconButton('arrow-left','Page précédente','asv2-secondary',nav,()=>{entry.page--;draw().catch(showError);});
  const pageLabel=el('span','',null,nav);
  const next=iconButton('arrow-right','Page suivante','asv2-secondary',nav,()=>{entry.page++;draw().catch(showError);});
  const less=iconButton('magnifier-minus','Zoom arrière','asv2-secondary',nav,()=>{entry.zoom=Math.max(.5,entry.zoom-.2);draw().catch(showError);});
  const zoomLabel=el('span','',null,nav);
  const more=iconButton('magnifier-plus','Zoom avant','asv2-secondary',nav,()=>{entry.zoom=Math.min(1.8,entry.zoom+.2);draw().catch(showError);});

  const compareContainer=el('div',null,'asv2-compare-container asv2-page-scroll',viewerBody);
  const colOrig=el('div',null,'asv2-compare-col',compareContainer);
  el('span','Original, données visibles','asv2-compare-title',colOrig);
  const wrapOrig=el('div',null,'asv2-page',colOrig);

  const colAnon=el('div',null,'asv2-compare-col',compareContainer);
  el('span',protectedVersionLabel(entry),
    'asv2-compare-title',colAnon);
  const wrapAnon=el('div',null,'asv2-page',colAnon);

  async function draw(){
    if(serial!==state.previewSerial)return;
    clear(wrapOrig);clear(wrapAnon);
    pageLabel.textContent='Page '+entry.page+' / '+maxPages;
    prev.disabled=entry.page<=1;next.disabled=entry.page>=maxPages;
    less.disabled=entry.zoom<=.5;more.disabled=entry.zoom>=1.8;
    zoomLabel.textContent=Math.round(entry.zoom*100)+' %';

    const [pageO,pageA]=await Promise.all([origPdf.getPage(entry.page),anonPdf.getPage(entry.page)]);
    const baseO=pageO.getViewport({scale:1});
    const fit=Math.min(1.5,Math.max(.35,((compareContainer.clientWidth/2)-30||400)/baseO.width));
    const viewportO=pageO.getViewport({scale:fit*entry.zoom});
    const viewportA=pageA.getViewport({scale:fit*entry.zoom});
    const pixelRatio=Math.min(window.devicePixelRatio||1,2);

    const canvasOrig=el('canvas',null,null,wrapOrig);
    canvasOrig.width=Math.ceil(viewportO.width*pixelRatio);canvasOrig.height=Math.ceil(viewportO.height*pixelRatio);
    canvasOrig.style.width=viewportO.width+'px';canvasOrig.style.height=viewportO.height+'px';
    const ctxO=canvasOrig.getContext('2d');ctxO.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    await pageO.render({canvasContext:ctxO,viewport:viewportO}).promise;

    const canvasAnon=el('canvas',null,null,wrapAnon);
    canvasAnon.width=Math.ceil(viewportA.width*pixelRatio);canvasAnon.height=Math.ceil(viewportA.height*pixelRatio);
    canvasAnon.style.width=viewportA.width+'px';canvasAnon.style.height=viewportA.height+'px';
    const ctxA=canvasAnon.getContext('2d');ctxA.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    await pageA.render({canvasContext:ctxA,viewport:viewportA}).promise;
  }
  await draw();
}
async function renderOtherCompare(entry,serial){
  const [origin,result]=await Promise.all([previewBytes(entry,'origin'),previewBytes(entry,'anon')]);
  if(serial!==state.previewSerial||state.active!==entry.key)return;
  clear(viewerBody);
  if(entry.format==='docx')el('p','Comparaison indicative : la mise en page Word peut différer du fichier final rouvert par la QA. Faites défiler chaque page horizontalement si nécessaire.',
    'asv2-geometry-note',viewerBody);
  const compare=el('div',null,'asv2-compare-container asv2-compare-text',viewerBody);
  const left=el('section',null,'asv2-compare-col',compare);
  el('h3','Original, données visibles','asv2-compare-title',left);
  const leftBody=el('div',null,'asv2-compare-content',left);
  const right=el('section',null,'asv2-compare-col',compare);
  el('h3',protectedVersionLabel(entry),
    'asv2-compare-title',right);
  const rightBody=el('div',null,'asv2-compare-content',right);
  if(entry.format==='txt'){
    renderText(origin.bytes,null,'origin',leftBody);
    renderText(result.bytes,null,'anon',rightBody);
  }else if(entry.format==='csv'){
    renderCsv(origin.bytes,leftBody);
    renderCsv(result.bytes,rightBody);
  }else{
    const cleanups=[];
    state.previewCleanup=()=>{for(const cleanup of cleanups)cleanup();};
    await Promise.all([
      renderDocx(origin.bytes,serial,leftBody,cleanup=>cleanups.push(cleanup)),
      renderDocx(result.bytes,serial,rightBody,cleanup=>cleanups.push(cleanup))
    ]);
  }
}
async function renderPdf(entry,bytes,kind,serial){
  if(!window.pdfjsLib)throw new Error('PDF.js indisponible');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc=config.PDF_WORKER_URL;
  const task=window.pdfjsLib.getDocument({data:new Uint8Array(bytes),enableScripting:false});
  let timer=null;
  const pdf=await Promise.race([task.promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>{task.destroy();reject(new Error('L’aperçu PDF met trop de temps à s’afficher. Réessayez, ou téléchargez le fichier.'));},25000);
  })]).finally(()=>clearTimeout(timer));
  if(serial!==state.previewSerial){pdf.destroy();return;}
  state.previewCleanup=()=>pdf.destroy();
  viewerBody.querySelector('.asv2-pdf-loading')?.remove();
  if(!pdf.numPages){el('p','Ce PDF ne contient aucune page affichable.','asv2-preview-unavailable',viewerBody);return;}
  entry.page=Math.min(Math.max(1,entry.page),pdf.numPages);
  const nav=el('div',null,'asv2-pdf-nav',viewerBody);
  const prev=iconButton('arrow-left','Page précédente','asv2-secondary',nav,()=>{entry.page--;draw().catch(showError);});
  const pageLabel=el('span','',null,nav);
  const next=iconButton('arrow-right','Page suivante','asv2-secondary',nav,()=>{entry.page++;draw().catch(showError);});
  const less=iconButton('magnifier-minus','Zoom arrière','asv2-secondary',nav,()=>{entry.zoom=Math.max(.6,entry.zoom-.2);draw().catch(showError);});
  const zoomLabel=el('span','',null,nav);
  const more=iconButton('magnifier-plus','Zoom avant','asv2-secondary',nav,()=>{entry.zoom=Math.min(2,entry.zoom+.2);draw().catch(showError);});
  const canMask=entry.format==='pdf'&&entry.status==='REVIEW_REQUIRED'&&
    Boolean(entry.revision)&&(Boolean(entry.target)||Boolean(entry.manualMaskActive));
  const toolInstruction=el('p','', 'asv2-tool-instruction',viewerBody);
  function updateToolInstruction(){
    toolInstruction.textContent=entry.target?
      copy.review.targetInstruction:
      entry.manualMaskActive?
      copy.review.zoneInstruction:'';
    toolInstruction.hidden=!toolInstruction.textContent;
  }
  if(kind==='origin'&&entry.status==='REVIEW_REQUIRED') updateToolInstruction();
  updateToolInstruction();
  const pageBox=el('div',null,'asv2-page-scroll',viewerBody);
  if(kind==='origin'&&entry.pageOnlyLocation)
    el('p',entry.pageOnlyLocation==='page'?
      'Page connue. Les mots du passage sont surlignés dans le texte.':
      'La page et la position exacte de ce passage ne sont pas fournies. L’original est ouvert.',
      'asv2-geometry-note',viewerBody);
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
    const maskRows=kind==='origin'?(entry.review?.occurrences||[]).filter(row=>
      (row.action||row.privacyAction)==='MASK'&&originalPdfLocation(entry,row).kind==='exact'&&
      originalPdfLocation(entry,row).page===entry.page):[];
    const shouldOverlay=Boolean(entry.pendingMask)||Boolean(entry.focusId||entry.locateNeedle||entry.target||entry.manualMaskActive)||
      maskRows.length>0;
    if(!shouldOverlay)return;
    const overlay=el('div',null,'asv2-page-overlay',wrap);
    if(kind==='origin'&&(page.rotate||0)===0&&pageGeometry(entry,entry.page,base)){
      for(const row of maskRows){
        const location=originalPdfLocation(entry,row);
        for(const rect of location.fragments){
          const marker=el('div',null,'asv2-mask-marker',overlay);
          marker.title='Masqué dans le résultat';
          marker.style.left=(rect[0]/base.width*100)+'%';
          marker.style.top=(rect[1]/base.height*100)+'%';
          marker.style.width=((rect[2]-rect[0])/base.width*100)+'%';
          marker.style.height=((rect[3]-rect[1])/base.height*100)+'%';
        }
      }
    }
    if(entry.pendingMask&&Number(entry.pendingMask.page)===Number(entry.page)&&Array.isArray(entry.pendingMask.rect)){
      const pRect=entry.pendingMask.rect;
      const pendingMarker=el('div',null,'asv2-pending-mask',overlay);
      pendingMarker.style.left=(pRect[0]/base.width*100)+'%';
      pendingMarker.style.top=(pRect[1]/base.height*100)+'%';
      pendingMarker.style.width=((pRect[2]-pRect[0])/base.width*100)+'%';
      pendingMarker.style.height=((pRect[3]-pRect[1])/base.height*100)+'%';
      el('span','Application du masque…','asv2-pending-mask-label',pendingMarker);
    }
    if(kind==='origin'&&entry.focusId){
      const regions=(page.rotate||0)===0?strictRegions(entry,base):[];
      let firstMarker=null;
      for(const rect of regions){
        const marker=el('div',null,'asv2-region-marker',overlay);
        firstMarker ||= marker;
        marker.title='Localisation de l’occurrence dans l’original';
        marker.style.left=(rect[0]/base.width*100)+'%';marker.style.top=(rect[1]/base.height*100)+'%';
        marker.style.width=((rect[2]-rect[0])/base.width*100)+'%';
        marker.style.height=((rect[3]-rect[1])/base.height*100)+'%';
      }
      if(firstMarker)requestAnimationFrame(()=>{
        if(serial!==state.previewSerial||!firstMarker.isConnected)return;
        const box=pageBox.getBoundingClientRect(),mark=firstMarker.getBoundingClientRect();
        pageBox.scrollTop+=mark.top-box.top-pageBox.clientHeight/2+mark.height/2;
        pageBox.scrollLeft+=mark.left-box.left-pageBox.clientWidth/2+mark.width/2;
      });
      if(!regions.length){
        const needle=entry.locateNeedle||entry.review?.occurrences?.find(item=>String(item.id)===String(entry.focusId))?.text||'';
        const textHit=await highlightPdfText(page,viewport,overlay,needle);
        if(textHit)requestAnimationFrame(()=>{
          if(serial!==state.previewSerial||!textHit.isConnected)return;
          const box=pageBox.getBoundingClientRect(),mark=textHit.getBoundingClientRect();
          pageBox.scrollTop+=mark.top-box.top-pageBox.clientHeight/2+mark.height/2;
        });
        else el('p',copy.review.regionUnknown,'asv2-geometry-note',pageBox);
      }
    }
    const canDraw=canMask&&((entry.target&&Number(entry.target.page)===entry.page)||entry.manualMaskActive);
    if(canDraw){
      if((page.rotate||0)!==0||!pageGeometry(entry,entry.page,base))
        el('p','Tracé indisponible : géométrie de la page non garantie.','asv2-geometry-note',pageBox);
      else bindDrawing(entry,overlay,base,serial);
    }
  }
  await draw();
  if(serial===state.previewSerial&&state.active===entry.key){
    state.previewFocus={entryKey:entry.key,kind,run:draw};
  }
}
async function highlightPdfText(page,viewport,overlay,needle){
  const n=String(needle||'').trim().toLowerCase();
  if(!n||n.length<3)return null;
  const tokens=n.split(/\s+/).filter(token=>token.length>=3);
  if(!tokens.length)return null;
  let content; try{content=await page.getTextContent();}catch(_){return null;}
  const transform=window.pdfjsLib?.Util?.transform;
  if(typeof transform!=='function')return null;
  let first=null;
  for(const item of content.items||[]){
    const str=String(item.str||'').trim().toLowerCase();
    if(str.length<3||!tokens.some(token=>str===token||str.includes(token)||token.includes(str)))continue;
    const tx=transform(viewport.transform,item.transform);
    const marker=el('div',null,'asv2-text-hit',overlay);
    const height=Math.hypot(tx[2],tx[3])||12;
    const width=(Number(item.width)||0)*viewport.scale||Math.max(str.length*height*0.5,8);
    marker.style.left=tx[4]+'px';
    marker.style.top=(tx[5]-height)+'px';
    marker.style.width=width+'px';
    marker.style.height=height+'px';
    first=first||marker;
  }
  return first;
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
    if(entry.commandBusy)return;
    const target=entry.target;
    if(target){
      const roundedRect=rect.map(value=>Math.round(value*100)/100);
      entry.commandBusy=true;
      try{
        entry.pendingMask={page:Number(entry.page),rect:roundedRect,kind:'linked'};
        const receipt=await api.addLinkedRegion(entry.jobId,entry.digest,{revision:entry.revision,
          page:entry.page,rect:roundedRect,
          maskOccurrenceId:target.maskOccurrenceId,sourceRevision:entry.review.sourceRevision,
          documentId:entry.review.documentId,reason:target.category==='ORG'?'human_confirmed_private_org':'human_added'});
        entry.target=null;await apply(entry,receipt.revision);
      }catch(error){entry.pendingMask=null;showError(error);}
      finally{entry.commandBusy=false;}
    }else if(entry.manualMaskActive){
      const roundedRect=rect.map(value=>Math.round(value*100)/100);
      entry.commandBusy=true;
      try{
        entry.pendingMask={page:Number(entry.page),rect:roundedRect,kind:'manual'};
        const receipt=await api.addManualRegion(entry.jobId,entry.digest,{revision:entry.revision,
          page:Number(entry.page),rect:roundedRect,
          reason:'ZONE_MASQUEE_MANUELLEMENT'});
        entry.manualMaskActive=false;
        await apply(entry,receipt.revision);
        entry.undoStack=entry.undoStack||[];
        entry.undoStack.push({kind:'region'});
      }catch(error){entry.pendingMask=null;showError(error);}
      finally{entry.commandBusy=false;}
    }
  };
  overlay.onpointercancel=()=>{start=null;ghost?.remove();ghost=null;};
}
async function renderDocx(bytes,serial,parent=viewerBody,registerCleanup=cleanup=>{state.previewCleanup=cleanup;}){
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
  const frame=el('iframe',null,'asv2-docx-frame',parent);
  frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('title','Aperçu Word isolé');
  frame.referrerPolicy='no-referrer';
  const nonce=crypto.randomUUID();
  const completion=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error(copy.errors.wordTimeout));},20000);
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
    registerCleanup(()=>{cleanup();frame.remove();});
  });
  frame.srcdoc=html;
  await completion;
}
function codePointOffset(text,count){
  let unit=0;
  for(let point=0;point<count&&unit<text.length;point++)unit+=text.codePointAt(unit)>0xFFFF?2:1;
  return unit;
}
function exactSourceSelection(element,source){
  const selection=window.getSelection();
  if(!selection||selection.rangeCount!==1||selection.isCollapsed)return null;
  const range=selection.getRangeAt(0);
  if(!element.contains(range.startContainer)||!element.contains(range.endContainer))return null;
  const prefix=range.cloneRange();prefix.selectNodeContents(element);
  prefix.setEnd(range.startContainer,range.startOffset);
  const start=[...prefix.toString()].length;
  const selectedText=range.toString();
  const end=start+[...selectedText].length;
  if(!selectedText.trim()||source.slice(codePointOffset(source,start),codePointOffset(source,end))!==selectedText)
    return null;
  return {start,end,text:selectedText};
}
function renderText(bytes,entry=null,kind='anon',parent=viewerBody){
  const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);
  const row=kind==='origin'&&entry?.focusId&&String(entry.review?.revision)===String(entry.revision)?
    entry.review?.occurrences?.find(item=>String(item.id)===String(entry.focusId)):null;
  const surface=entry?.review?.pages?.find(page=>page.surfaceId===row?.surfaceId);
  if(row&&surface?.text===text&&Number.isInteger(row.start)&&Number.isInteger(row.end)&&
    row.start>=0&&row.end>row.start){
    const start=codePointOffset(text,row.start),end=codePointOffset(text,row.end);
    if(text.slice(start,end)===row.text){
      const from=Math.max(0,start-1600),to=Math.min(text.length,end+1600);
      el('p','Extrait de l’original lié à cette occurrence et à la révision courante.',
        'asv2-geometry-note',parent);
      const pre=el('pre',null,'asv2-text-preview',parent);
      pre.append(document.createTextNode((from?'…\n':'')+text.slice(from,start)));
      const mark=el('mark',text.slice(start,end),'asv2-focused-text',pre);
      pre.append(document.createTextNode(text.slice(end,to)+(to<text.length?'\n…':'')));
      requestAnimationFrame(()=>{if(mark.isConnected)mark.scrollIntoView({block:'center'});});
      return;
    }
  }
  if(row)el('p','La position de ce passage ne correspond pas aux octets de l’original : aucun surlignage approximatif n’est affiché.',
    'asv2-geometry-note',parent);
  if(text.length>2_000_000)el('p','Aperçu limité aux deux premiers millions de caractères.',
    'asv2-geometry-note',parent);
  el('pre',text.slice(0,2_000_000),'asv2-text-preview',parent);
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
function renderCsv(bytes,parent=viewerBody){
  const text=new TextDecoder('utf-8',{fatal:false}).decode(bytes).replace(/^\uFEFF/,'');
  const rows=parseCsv(text);
  if(rows.length>=300)el('p','Aperçu limité aux 300 premières lignes.','asv2-geometry-note',parent);
  const wrap=el('div',null,'asv2-csv-scroll',parent);
  const table=el('table',null,'asv2-csv',wrap);
  for(const cells of rows){const tr=el('tr',null,null,table);
    for(const value of cells.slice(0,80))el('td',value,null,tr);
  }
}
async function download(entry,certified){
  if(!currentAccountEntry(entry))throw new Error('Le compte a changé. Actualisez la page.');
  if(!canDownloadResult(entry))throw new Error('Le résultat courant n’est pas disponible au téléchargement.');
  if(!certified&&!await confirmAction('Ce résultat n’est pas vérifié et peut encore contenir des données visibles. Le télécharger quand même ?'))return;
  const expected={status:entry.status,revision:entry.revision,digest:entry.digest,
    listDigest:entry.listDigest,mode:entry.mode,accountEpoch:state.accountEpoch};
  const response=await api.checkedArtifact(entry.jobId,{certified,expectedDigest:entry.digest,
    expectedListDigest:entry.listDigest,
    expectedRevision:entry.revision,expectedMode:entry.mode});
  const blob=await response.blob();
  await assertDownloadStillCurrent(entry,expected);
  const disposition=response.headers.get('Content-Disposition')||'';
  const fallback=(certified?'document-protege':'document-non-verifie')+'.'+(entry.format||'bin');
  const filename=(/filename="?([^";]+)"?/i.exec(disposition)?.[1]||fallback).replace(/[^A-Za-z0-9._-]/g,'_');
  const url=URL.createObjectURL(blob);const link=el('a',null,null,document.body);
  link.href=url;link.download=filename;link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
  const msg=certified?'Téléchargement du résultat démarré.':
    'Téléchargement du résultat démarré (document avec signalements).';
  drawerMessage(msg);
  notify(msg);
}
async function downloadKey(entry){
  if(!currentAccountEntry(entry))throw new Error('Le compte a changé. Actualisez la page.');
  if(!canDownloadKey(entry))
    throw new Error('Clé indisponible pour ce document');
  const certified=entry.status==='READY';
  if(!certified&&!await confirmAction('Cette clé appartient à un résultat non vérifié pouvant encore contenir des données sensibles. La télécharger quand même ?'))return;
  const expected={status:entry.status,revision:entry.revision,digest:entry.digest,
    listDigest:entry.listDigest,mode:entry.mode,accountEpoch:state.accountEpoch};
  const response=await api.checkedArtifact(entry.jobId,{kind:'key',certified,expectedDigest:entry.digest,
    expectedListDigest:entry.listDigest,expectedRevision:entry.revision,expectedMode:entry.mode});
  const blob=await response.blob();
  await assertDownloadStillCurrent(entry,expected);
  const url=URL.createObjectURL(blob);const link=el('a',null,null,document.body);
  link.href=url;link.download='cle-pseudonymes-'+(certified?'':'NON-VERIFIE-')+String(entry.jobId).replace(/[^A-Za-z0-9_-]/g,'')+
    '-'+String(entry.revision).replace(/[^A-Za-z0-9_-]/g,'')+'.properties';
  link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  drawerMessage('Clé de la révision courante téléchargée. Conservez-la dans un espace privé.');
}
async function downloadHumanVerified(entry){
  if(!currentAccountEntry(entry)||entry.status!=='REVIEW_REQUIRED'||
      entry.review?.humanVerifiedDeliverable!==true)throw new Error('Attestation indisponible');
  const expected={status:entry.status,revision:entry.revision,digest:entry.digest,
    listDigest:entry.listDigest,mode:entry.mode,accountEpoch:state.accountEpoch};
  const response=await api.checkedArtifact(entry.jobId,{kind:'human',certified:false,
    expectedDigest:entry.digest,expectedListDigest:entry.listDigest,
    expectedRevision:entry.revision,expectedMode:entry.mode});
  const blob=await response.blob();
  await assertDownloadStillCurrent(entry,expected);
  const review=await api.review(entry.jobId);
  if(review.humanVerifiedDeliverable!==true||String(review.revision)!==String(expected.revision))
    throw new Error(copy.errors.approvalStale);
  const url=URL.createObjectURL(blob),link=el('a',null,null,document.body);
  link.href=url;link.download='document-verifie-par-une-personne-'+
    String(entry.jobId).replace(/[^A-Za-z0-9_-]/g,'')+'.'+(entry.format||'bin');
  link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  drawerMessage('Document vérifié par une personne téléchargé. Le statut technique reste inchangé.');
}
async function assertDownloadStillCurrent(entry,expected){
  const [job,review]=await Promise.all([api.status(entry.jobId),api.review(entry.jobId)]);
  if(!currentAccountEntry(entry)||state.accountEpoch!==expected.accountEpoch||
    entry.status!==expected.status||entry.revision!==expected.revision||entry.mode!==expected.mode||
    job.protectionPolicy?.digest!==expected.digest||review.protectionPolicy?.digest!==expected.digest||
    job.listDigest!==expected.listDigest||review.listDigest!==expected.listDigest||
    statusOf(job)!==expected.status||review.status!==expected.status||
    job.processingMode!==expected.mode||review.processingMode!==expected.mode||
    String(job.reviewRevision)!==String(expected.revision)||
    String(review.revision)!==String(expected.revision)||!currentResultAvailable(job,review))
    throw new Error('Le document a changé pendant le téléchargement. Actualisez la révision.');
}
function suppressGeneralTourLauncher(){
  try{
    document.querySelectorAll('[data-agilo-tour="start"], [data-agilo-tour], .agilo-tour-launcher, #agilo-tour-start').forEach(node=>{
      node.style.setProperty('display','none','important');
    });
  }catch(_){}
}
suppressGeneralTourLauncher();
setInterval(suppressGeneralTourLauncher, 1000);

window.addEventListener('pagehide',()=>{state.disposed=true;state.previewSerial++;state.previewCleanup?.();});
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return;
  state.disposed=false;
  for(const entry of state.entries)if(['PENDING','PROCESSING'].includes(entry.status))
    pollEntry(entry).catch(error=>{entry.status='TIMED_OUT';entry.error=errorText(error);renderQueue();});
});
loadPreferences().then(async()=>{
  await restoreSession();
  await loadHistory();
  try{
    const key=accountStorageKey(':drawer');
    const activeKey=key?sessionStorage.getItem(key):null;
    if(activeKey){
      const entry=state.entries.find(e=>e.key===activeKey);
      if(entry)openDrawer(entry);
    }
  }catch(_){}
}).catch(error=>{
  historyHint.textContent=errorText(error);renderHistory();});
