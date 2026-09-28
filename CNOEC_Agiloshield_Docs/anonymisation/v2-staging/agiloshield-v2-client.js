/* Reference transport only. Browser -> authenticated Java HTTPS facade; no Python HMAC. */
export class AgiloShieldV2Client {
  constructor({baseUrl, authHeaders, credentials = 'omit', fetchImpl = (...args) => globalThis.fetch(...args)}) {
    if (!/^https:\/\//.test(baseUrl)) throw new Error('HTTPS staging baseUrl required');
    if (typeof authHeaders !== 'function') throw new Error('authHeaders callback required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authHeaders = authHeaders;
    this.credentials = credentials;
    this.fetchImpl = (...args) => fetchImpl(...args);
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
  preferences() { return this.json('/preferences'); }
  savePreferences(policy) { return this.json('/preferences', {method:'POST', body:JSON.stringify(policy), headers:{'Content-Type':'application/json'}}); }
  async upload(file, policy, {removeImages} = {}) {
    const form = new FormData(); form.append('file', file);
    form.append('protectionPolicy', JSON.stringify(policy));
    if (removeImages !== undefined) form.append('removeImages', String(removeImages));
    return this.json('/jobs', {method:'POST', body:form});
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
  async checkedArtifact(id, {certified = true, expectedDigest, expectedRevision} = {}) {
    const [job, review] = await Promise.all([this.status(id), this.review(id)]);
    const status = job.anonStatus || job.status;
    if (job.protectionPolicy?.digest !== expectedDigest ||
        review.protectionPolicy?.digest !== expectedDigest ||
        String(review.revision) !== String(expectedRevision) || String(job.reviewRevision) !== String(expectedRevision) ||
        (review.status && review.status !== status) ||
        (certified && status !== 'READY') ||
        (!certified && !['REVIEW_REQUIRED', 'FAILED'].includes(status))) {
      throw new Error('Stale job state');
    }
    const response = certified ? await this.certifiedDownload(id) :
      await this.result(id, {confirmNonVerified:status === 'FAILED'});
    if (response.headers.get('X-Agiloshield-Policy-Digest') !== expectedDigest ||
        response.headers.get('X-Agiloshield-Revision') !== String(expectedRevision) ||
        response.headers.get('X-Agiloshield-Status') !== status ||
        response.headers.get('X-Agiloshield-Assurance') !==
          (certified ? 'technical-ready' : 'non-verified')) {
      throw new Error('Stale artifact');
    }
    return response;
  }
}
