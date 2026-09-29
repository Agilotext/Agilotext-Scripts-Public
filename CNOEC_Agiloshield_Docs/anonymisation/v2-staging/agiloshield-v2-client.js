/* Reference transport only. Browser -> authenticated Java HTTPS facade; no Python HMAC. */
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
export class AgiloShieldV2Client {
  constructor({baseUrl, authHeaders, credentials = 'omit', fetchImpl = (...args) => globalThis.fetch(...args),
    xhrFactory = () => new XMLHttpRequest()}) {
    if (!/^https:\/\//.test(baseUrl)) throw new Error('HTTPS staging baseUrl required');
    if (typeof authHeaders !== 'function') throw new Error('authHeaders callback required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
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
      const error = new Error(detail.error || detail.errorMessage || `HTTP_${response.status}`);
      error.status = response.status; throw error;
    }
    return response;
  }
  path(id, tail = '') { return `/jobs/${encodeURIComponent(String(id))}${tail}`; }
  json(path, options) { return this.request(path, options).then(r => r.json()); }
  historyRoute(path) {
    if (typeof path !== 'string' || !/^\/[a-z0-9/_-]+$/i.test(path) ||
        path.includes('//') || path.includes('..')) throw new Error('Invalid Java history route');
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
          const error = new Error(body.error || body.errorMessage || `HTTP_${xhr.status}`);
          error.status = xhr.status; reject(error);
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
    return this.json(this.path(id, '/review/commands'), {method:'POST', digest,
      headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  }
  decide(id, digest, {revision, occurrenceId, action, reason}) {
    if (!['KEEP', 'MASK'].includes(action)) throw new Error('Invalid decision');
    return this.command(id, digest, {revision, commandId:crypto.randomUUID(), occurrenceId, action, reason});
  }
  addLinkedRegion(id, digest, {revision, page, rect, occurrenceId, maskOccurrenceId, sourceRevision, documentId, reason}) {
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) ||
        rect[0] >= rect[2] || rect[1] >= rect[3]) throw new Error('Invalid PDF rectangle');
    if (!occurrenceId && !maskOccurrenceId) throw new Error('Linked obligation required');
    return this.command(id, digest, {op:'ADD_MANUAL_REGION', revision,
      commandId:crypto.randomUUID(), page, rect, reason, sourceRevision, documentId,
      ...(occurrenceId ? {occurrenceId} : {maskOccurrenceId})});
  }
  execute(id, digest, revision) {
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
  pseudonymKey(id) { return this.request(this.path(id, '/pseudonym-key')); }
  async checkedArtifact(id, {certified = true, kind = 'document', expectedDigest,
    expectedListDigest, expectedRevision} = {}) {
    const [job, review] = await Promise.all([this.status(id), this.review(id)]);
    const status = job.anonStatus || job.status;
    if (job.protectionPolicy?.digest !== expectedDigest ||
        review.protectionPolicy?.digest !== expectedDigest ||
        (expectedListDigest && (job.listDigest !== expectedListDigest ||
          review.listDigest !== expectedListDigest)) ||
        String(review.revision) !== String(expectedRevision) || String(job.reviewRevision) !== String(expectedRevision) ||
        (review.status && review.status !== status) ||
        (certified && status !== 'READY') ||
        (!certified && !['REVIEW_REQUIRED', 'FAILED'].includes(status))) {
      throw new Error('Stale job state');
    }
    if (kind === 'key' && (!certified || job.processingMode !== 'PSEUDONYMIZE'))
      throw new Error('Pseudonym key unavailable');
    const response = kind === 'key' ? await this.pseudonymKey(id) : certified ? await this.certifiedDownload(id) :
      await this.result(id, {confirmNonVerified:status === 'FAILED'});
    if (response.headers.get('X-Agiloshield-Policy-Digest') !== expectedDigest ||
        response.headers.get('X-Agiloshield-Revision') !== String(expectedRevision) ||
        (expectedListDigest && response.headers.get('X-Agiloshield-List-Digest') !== expectedListDigest) ||
        response.headers.get('X-Agiloshield-Status') !== status ||
        response.headers.get('X-Agiloshield-Assurance') !==
          (certified ? 'technical-ready' : 'non-verified')) {
      throw new Error('Stale artifact');
    }
    if (kind === 'key' && response.headers.get('X-Agiloshield-Processing-Mode') !== 'PSEUDONYMIZE')
      throw new Error('Stale pseudonym key');
    return response;
  }
}
