/* Reference transport only. Browser -> authenticated Java HTTPS facade; no Python HMAC. */
import { restoreErrorMessage, COPY } from './agiloshield-v2-copy.js';
export async function digestListDirectives({anon2InclusionList, anon2ExclusionList}) {
  if (!Array.isArray(anon2InclusionList) || !Array.isArray(anon2ExclusionList))
    throw new Error('Both V2 list arrays are required');
  const canonical = JSON.stringify({anon2ExclusionList, anon2InclusionList});
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function freezeJobSelection({policy, lists, mode}) {
  if (!policy || !Array.isArray(policy.selectedTypes) || typeof policy.digest !== 'string' ||
      !['ANONYMIZE', 'PSEUDONYMIZE'].includes(mode)) throw new Error('Invalid job selection');
  if (lists && (!Array.isArray(lists.anon2InclusionList) ||
      !Array.isArray(lists.anon2ExclusionList))) throw new Error('Invalid job lists');
  const selectedTypes = [...policy.selectedTypes];
  return {
    digest: policy.digest, selectedTypes, mode,
    policy: {schemaVersion:1, selectedTypes:[...selectedTypes],
      sensitiveKeepAcknowledged:policy.sensitiveKeepAcknowledged===true},
    lists:lists?{anon2InclusionList:[...lists.anon2InclusionList],
      anon2ExclusionList:[...lists.anon2ExclusionList]}:null,
  };
}
export function defaultRestoreUrl(baseUrl) {
  const trimmed = String(baseUrl || '').replace(/\/$/, '');
  if (/\/agiloshield-v2$/.test(trimmed))
    return trimmed.replace(/\/agiloshield-v2$/, '/v1/reconcileAnon2Text');
  const origin = trimmed.match(/^(https:\/\/[^/]+\/api)(?:\/.*)?$/);
  return origin ? origin[1] + '/v1/reconcileAnon2Text' : trimmed + '/v1/reconcileAnon2Text';
}

export function v2Capabilities(capabilities) {
  // Java 12.0.6 no longer advertises a workerCodeSha. Feature flags describe
  // the HTTP contract; deployment qualification remains a staging gate.
  const modes = Array.isArray(capabilities?.processingModes) ? capabilities.processingModes : [];
  return {
    lists: capabilities?.listDirectives === true,
    pseudonymize: modes.includes('PSEUDONYMIZE') && capabilities?.pseudonymKeyDownload === true,
    addOccurrence: capabilities?.addOccurrence === true,
    qaReport: capabilities?.qaReport === true,
    humanVerification: capabilities?.humanVerification === true,
    pseudonymKeyReviewRequired: capabilities?.pseudonymKeyReviewRequired === true,
    pseudonymRestore: capabilities?.pseudonymRestore === true,
  };
}
export function assertCreatedJob(created, {digest, listDigest, mode}) {
  if (!digest || !listDigest || !created?.jobId || created?.protectionPolicy?.digest !== digest ||
      created?.processingMode !== mode ||
      created?.listDigest !== listDigest ||
      !['PENDING', 'PROCESSING', 'READY', 'REVIEW_REQUIRED', 'FAILED']
        .includes(created.anonStatus || created.status)) {
    throw new Error('Réponse de création incohérente avec la sélection du document');
  }
  return created;
}
export function currentResultAvailable(job, review) {
  const status = job?.anonStatus || job?.status;
  if (!['READY', 'REVIEW_REQUIRED'].includes(status) ||
      job?.workflowState !== 'RESULT' || review?.workflowState !== 'RESULT' ||
      review?.status !== status || !job?.reviewRevision ||
      String(review?.revision) !== String(job.reviewRevision)) return false;
  const assurance = status === 'READY' ? 'technical-ready' : 'non-verified';
  // REVIEW_REQUIRED is only a candidate: Java verifies anon and QA on GET.
  return job.assurance === assurance &&
    (status === 'READY' ? review.deliverable === true : review.previewAvailable === true);
}
export function assertPreviewHeaders(response, {kind, digest, listDigest, revision, status, mode}) {
  const headers = response?.headers;
  const expectedAssurance = kind === 'origin' ? 'original-unprotected' : 'review-preview';
  if (!headers || !digest || !listDigest || !revision || !status || !mode ||
      headers.get('X-Agiloshield-Policy-Digest') !== digest ||
      headers.get('X-Agiloshield-Revision') !== String(revision) ||
      headers.get('X-Agiloshield-Status') !== status ||
      headers.get('X-Agiloshield-Processing-Mode') !== mode ||
      headers.get('X-Agiloshield-Assurance') !== expectedAssurance ||
      (headers.get('X-Agiloshield-List-Digest') !== null &&
        headers.get('X-Agiloshield-List-Digest') !== listDigest))
    throw new Error('Aperçu non conforme au job courant');
  return response;
}
export class AgiloShieldV2Client {
  constructor({baseUrl, authHeaders, restoreUrl, credentials = 'omit', fetchImpl = (...args) => globalThis.fetch(...args),
    xhrFactory = () => new XMLHttpRequest()}) {
    if (!/^https:\/\//.test(baseUrl)) throw new Error('HTTPS staging baseUrl required');
    if (typeof authHeaders !== 'function') throw new Error('authHeaders callback required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.restoreUrl = restoreUrl || defaultRestoreUrl(this.baseUrl);
    if (!/^https:\/\//.test(this.restoreUrl)) throw new Error('HTTPS restore URL required');
    this.authHeaders = authHeaders;
    this.credentials = credentials;
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.xhrFactory = xhrFactory;
  }
  async request(path, {method = 'GET', body, digest, headers = {}} = {}) {
    const auth = await this.authHeaders();
    const response = await this.fetchImpl(this.baseUrl + path, {
      method, credentials: this.credentials, cache: 'no-store',
      headers: {...auth, ...(digest ? {'X-Agiloshield-Policy-Digest': digest} : {}), ...headers}, body,
    });
    if (!response.ok) {
      let detail; try { detail = await response.json(); } catch (_) { detail = {}; }
      const error = new Error(detail.errorMessage || detail.error || `HTTP_${response.status}`);
      error.status = response.status; error.code = detail.error || detail.errorCode || detail.code;
      if (detail.revision != null) error.revision = detail.revision;
      if (detail.appliedCount != null) error.appliedCount = detail.appliedCount;
      console.error('[AgiloShield V2]', method, path, response.status, detail.error || '', detail.errorMessage || '');
      throw error;
    }
    return response;
  }
  path(id, tail = '') { return `/jobs/${encodeURIComponent(String(id))}${tail}`; }
  json(path, options) { return this.request(path, options).then(r => r.json()); }
  historyRoute(path) {
    if (typeof path !== 'string' || !/^\/[a-z0-9/_-]+$/i.test(path) ||
        path.includes('//') || path.includes('..')) throw new Error('Invalid history route');
    return path;
  }
  listHistory(path, {cursor, limit = 50} = {}) {
    const query = new URLSearchParams({limit:String(limit)});
    if (cursor) query.set('cursor', cursor);
    return this.json(this.historyRoute(path) + '?' + query);
  }
  downloadZip(path, jobs) {
    if (!Array.isArray(jobs) || jobs.length < 2 || jobs.length > 12 ||
        jobs.some(job => !job.jobId || !job.revision || !job.policyDigest))
      throw new Error('Invalid certified ZIP selection');
    return this.request(this.historyRoute(path), {method:'POST',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({jobs})});
  }
  preferences() { return this.json('/preferences'); }
  savePreferences(policy) { return this.json('/preferences', {method:'POST', body:JSON.stringify(policy), headers:{'Content-Type':'application/json'}}); }
  async upload(file, policy, {removeImages, anon2InclusionList, anon2ExclusionList,
    processingMode, onUploadProgress, uploadId} = {}) {
    const form = new FormData(); form.append('file', file);
    form.append('protectionPolicy', JSON.stringify(policy));
    if (removeImages !== undefined) form.append('removeImages', String(removeImages));
    if (processingMode !== undefined) {
      if (!['ANONYMIZE', 'PSEUDONYMIZE'].includes(processingMode)) throw new Error('Invalid processing mode');
      form.append('processingMode', processingMode);
    }
    if (anon2InclusionList !== undefined || anon2ExclusionList !== undefined) {
      if (!Array.isArray(anon2InclusionList) || !Array.isArray(anon2ExclusionList))
        throw new Error('Both V2 list arrays are required');
      form.append('anon2InclusionList', JSON.stringify(anon2InclusionList));
      form.append('anon2ExclusionList', JSON.stringify(anon2ExclusionList));
    }
    if (typeof onUploadProgress !== 'function') return this.json('/jobs', {method:'POST', body:form,
      headers:uploadId ? {'X-Agiloshield-Upload-Id':uploadId} : {}});
    const auth = await this.authHeaders();
    return new Promise((resolve, reject) => {
      let xhr;
      try {
        xhr = this.xhrFactory();
        xhr.open('POST', this.baseUrl + '/jobs', true);
        xhr.withCredentials = this.credentials === 'include';
        xhr.timeout = 180000;
        for (const [name, value] of Object.entries(auth)) xhr.setRequestHeader(name, value);
        if (uploadId) xhr.setRequestHeader('X-Agiloshield-Upload-Id', uploadId);
        xhr.upload.onprogress = event => {
          if (event.lengthComputable && event.total > 0) onUploadProgress(event.loaded, event.total);
        };
        xhr.onload = () => {
          let body;
          try { body = JSON.parse(xhr.responseText || '{}'); }
          catch (_) { body = {}; }
          if (xhr.status >= 200 && xhr.status < 300) { resolve(body); return; }
          const error = new Error(body.errorMessage || body.error || `HTTP_${xhr.status}`);
          error.status = xhr.status; error.code = body.error || body.errorCode || body.code; reject(error);
        };
        xhr.onerror = () => reject(new Error('NETWORK_ERROR'));
        xhr.ontimeout = () => reject(new Error('UPLOAD_TIMEOUT'));
        xhr.onabort = () => reject(new Error('UPLOAD_ABORTED'));
        xhr.send(form);
      } catch (error) { reject(error); }
    });
  }
  status(id) { return this.json(this.path(id)); }
  review(id) { return this.json(this.path(id, '/review')); }
  issues(id) { return this.review(id); }
  report(id) { return this.json(this.path(id, '/report')); }
  regions(id) { return this.json(this.path(id, '/regions')); }
  preview(id, kind = 'origin') {
    if (!['origin', 'anon'].includes(kind)) throw new Error('Invalid preview kind');
    return this.request(this.path(id, `/preview?kind=${kind}`));
  }
  async command(id, digest, payload) {
    if (!digest) throw new Error('Current policy digest required');
    if (!payload?.revision) throw new Error('Current revision required');
    return this.json(this.path(id, '/review/commands'), {method:'POST', digest,
      headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  }
  decide(id, digest, {revision, occurrenceId, action, reason}) {
    if (!['KEEP', 'MASK'].includes(action)) throw new Error('Invalid decision');
    return this.command(id, digest, {revision, commandId:crypto.randomUUID(), occurrenceId, action, reason});
  }
  decideAll(id, digest, {revision, action, reason = 'review_batch'}) {
    if (!['KEEP', 'MASK'].includes(action)) throw new Error('Invalid decision');
    return this.command(id, digest, {revision, commandId:crypto.randomUUID(),
      op:'DECIDE_ALL_REVIEW', action, reason});
  }
  addLinkedRegion(id, digest, {revision, page, rect, occurrenceId, maskOccurrenceId, sourceRevision, documentId, reason}) {
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) ||
        rect[0] >= rect[2] || rect[1] >= rect[3]) throw new Error('Invalid PDF rectangle');
    if (!occurrenceId && !maskOccurrenceId) throw new Error('Linked obligation required');
    return this.command(id, digest, {op:'ADD_MANUAL_REGION', revision,
      commandId:crypto.randomUUID(), page, rect, reason, sourceRevision, documentId,
      ...(occurrenceId ? {occurrenceId} : {maskOccurrenceId})});
  }
  addManualRegion(id, digest, {revision, page, rect, reason = 'ZONE_MASQUEE_MANUELLEMENT'}) {
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) ||
        rect[0] >= rect[2] || rect[1] >= rect[3]) throw new Error('Invalid PDF rectangle');
    return this.command(id, digest, {op:'ADD_MANUAL_REGION', revision,
      commandId:crypto.randomUUID(), page, rect, reason});
  }
  addOccurrence(id, digest, {revision, surfaceId, page, start, end, selectedText}) {
    if (!revision || !surfaceId || !Number.isInteger(start) || !Number.isInteger(end) ||
        start < 0 || end <= start || !selectedText ||
        [...selectedText].length !== end - start || (page !== undefined && (!Number.isInteger(page) || page < 1)))
      throw new Error('Sélection originale invalide');
    return this.command(id, digest, {op:'ADD_OCCURRENCE',revision,commandId:crypto.randomUUID(),
      surfaceId,...(page === undefined ? {} : {page}),start,end,selectedText,
      action:'MASK',reason:'human_added'});
  }
  approveHumanVerification(id, digest, {revision, checks}) {
    const names=['names','addresses','phones','identifiers','logos_images','visual_regions',
      'original_vs_final_all_pages'];
    if (!revision || !checks || Object.keys(checks).length !== names.length ||
        names.some(name=>checks[name]!==true)) throw new Error('Vérifications humaines incomplètes');
    return this.json(this.path(id, '/review/human-verification'), {method:'POST',digest,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({revision,commandId:crypto.randomUUID(),checks})});
  }
  execute(id, digest, revision) {
    if (!revision) throw new Error('Current revision required');
    return this.json(this.path(id, '/review/execute'), {method:'POST', digest,
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({revision})});
  }
  async poll(id, {intervalMs = 1200, timeoutMs = 180000} = {}) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const job = await this.status(id);
      const state = job.anonStatus || job.status;
      if (!['PENDING', 'PROCESSING'].includes(state)) return job;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    throw new Error('Polling timeout');
  }
  async result(id, {confirmNonVerified = false} = {}) {
    return this.request(this.path(id, '/result'), {headers:confirmNonVerified ?
      {'X-Agiloshield-Confirm-Non-Verifie':'true'} : {}});
  }
  certifiedDownload(id) { return this.request(this.path(id, '/download')); }
  pseudonymKey(id, {confirmNonVerified = false} = {}) {
    return this.request(this.path(id, '/pseudonym-key'), {headers:confirmNonVerified ?
      {'X-Agiloshield-Confirm-Non-Verifie':'true'} : {}});
  }
  humanVerifiedDownload(id) { return this.request(this.path(id, '/human-verified-download')); }
  async reconcile(files, keys) {
    const docs = Array.from(files || []), props = Array.from(keys || []);
    if (!docs.length || !props.length) throw new Error(COPY.errors.restoreMissing);
    const auth = await this.authHeaders();
    const username = auth['X-Agilotext-Username'], token = auth['X-Agilotext-Token'],
      edition = auth['X-Agilotext-Edition'];
    if (!username || !token || !edition) throw new Error('Session Agilotext introuvable');
    const form = new FormData();
    form.append('username', username);
    form.append('token', token);
    form.append('edition', edition);
    for (const file of docs) form.append('anonFile', file, file.name);
    for (const file of props) form.append('propertiesFile', file, file.name);
    const response = await this.fetchImpl(this.restoreUrl, {method:'POST', body:form,
      credentials:this.credentials, cache:'no-store'});
    const type = (response.headers.get('Content-Type') || '').toLowerCase();
    const textual = type.includes('json') || type.includes('text/plain') || type.includes('text/json');
    if (!response.ok || textual) {
      const raw = await response.text();
      let message = raw;
      try { const body = JSON.parse(raw); message = body.errorMessage || body.error || raw; } catch (_) {}
      const error = new Error(restoreErrorMessage(message));
      error.status = response.status || 400;
      error.code = 'RESTORE_FAILED';
      throw error;
    }
    if (docs.length > 1) {
      const head = new Uint8Array(await response.clone().arrayBuffer()).subarray(0, 2);
      if (head[0] !== 0x50 || head[1] !== 0x4b) throw new Error(COPY.errors.restoreZip);
    }
    return response;
  }
  inspectRestore(file, key) {
    if (!file || !key) throw new Error('Document et clé requis');
    const form=new FormData();form.append('file',file);form.append('key',key);
    return this.json('/pseudonym/restore/inspect',{method:'POST',body:form});
  }
  executeRestore(inspectionId) {
    if (!/^restore-[0-9a-f]{32}$/.test(inspectionId||'')) throw new Error('Inspection invalide');
    return this.request('/pseudonym/restore',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({inspectionId,confirmSensitiveRestore:true})});
  }
  async checkedArtifact(id, {certified = true, kind = 'document', expectedDigest,
    expectedListDigest, expectedRevision, expectedMode} = {}) {
    if (!expectedDigest || !expectedListDigest || !expectedRevision || !expectedMode)
      throw new Error('Current job fingerprints required');
    const [job, review] = await Promise.all([this.status(id), this.review(id)]);
    const status = job.anonStatus || job.status;
    const human=kind==='human';
    const assurance = human ? 'human-verified' : certified ? 'technical-ready' : 'non-verified';
    const jobAssurance = certified ? 'technical-ready' : 'non-verified';
    if (job.protectionPolicy?.digest !== expectedDigest ||
        review.protectionPolicy?.digest !== expectedDigest ||
        job.listDigest !== expectedListDigest || review.listDigest !== expectedListDigest ||
        job.processingMode !== expectedMode || review.processingMode !== expectedMode ||
        String(review.revision) !== String(expectedRevision) || String(job.reviewRevision) !== String(expectedRevision) ||
        review.status !== status ||
        job.workflowState !== 'RESULT' || review.workflowState !== 'RESULT' ||
        job.assurance !== jobAssurance ||
        (certified && review.deliverable !== true) ||
        (!certified && review.previewAvailable !== true) ||
        (certified && status !== 'READY') ||
        (!certified && status !== 'REVIEW_REQUIRED') ||
        (human && (review.humanVerifiedDeliverable !== true || !review.humanVerification))) {
      throw new Error('Stale job state');
    }
    if (kind === 'key' && expectedMode !== 'PSEUDONYMIZE')
      throw new Error('Pseudonym key unavailable');
    const response = kind === 'key' ? await this.pseudonymKey(id,{confirmNonVerified:!certified}) :
      human ? await this.humanVerifiedDownload(id) : certified ? await this.certifiedDownload(id) :
      await this.result(id, {confirmNonVerified:status === 'REVIEW_REQUIRED'});
    if (response.headers.get('X-Agiloshield-Policy-Digest') !== expectedDigest ||
        response.headers.get('X-Agiloshield-Revision') !== String(expectedRevision) ||
        (response.headers.get('X-Agiloshield-List-Digest') !== null &&
          response.headers.get('X-Agiloshield-List-Digest') !== expectedListDigest) ||
        response.headers.get('X-Agiloshield-Processing-Mode') !== expectedMode ||
        response.headers.get('X-Agiloshield-Status') !== status ||
        response.headers.get('X-Agiloshield-Assurance') !== assurance) {
      throw new Error('Stale artifact');
    }
    if (kind === 'key' && response.headers.get('X-Agiloshield-Processing-Mode') !== 'PSEUDONYMIZE')
      throw new Error('Stale pseudonym key');
    return response;
  }
}
