// Dormant until Java advertises a qualified, non-persistent V2 text preview.
export function textPreviewAvailable(config, capabilities) {
  const preview = capabilities?.textPreview;
  return config?.TEXT_PREVIEW_READY === true && preview?.enabled === true &&
    preview?.ephemeral === true && preview?.schemaVersion === 1 &&
    preview?.processingModes?.includes('ANONYMIZE') &&
    Number.isInteger(preview.maxChars) && preview.maxChars >= 10;
}

export class TextPreviewController {
  constructor({request, snapshot, render, delay = 1000, setTimer = setTimeout,
    clearTimer = clearTimeout}) {
    this.request = request; this.snapshot = snapshot; this.render = render;
    this.delay = delay; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.serial = 0; this.timer = null; this.abort = null; this.enabled = false;
    this.maxChars = 0;
  }
  configure(enabled, maxChars = 0) {
    this.invalidate(); this.enabled = enabled === true; this.maxChars = maxChars;
  }
  invalidate() {
    this.serial++;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null; this.abort?.abort(); this.abort = null;
    this.render({state:'empty'});
  }
  input(text) {
    this.invalidate();
    if (!this.enabled) return;
    const value = String(text);
    if (value.length < 10) return;
    if (value.length > this.maxChars) {
      this.render({state:'error',message:`Limite de ${this.maxChars} caractères atteinte.`}); return;
    }
    const serial = this.serial;
    this.render({state:'waiting'});
    this.timer = this.setTimer(() => { this.timer = null; this.run(value, serial); }, this.delay);
  }
  async run(text, serial) {
    const abort = new AbortController(); this.abort = abort;
    try {
      const selection = await this.snapshot();
      if (serial !== this.serial || abort.signal.aborted) return;
      const requestId = crypto.randomUUID();
      const response = await this.request({schemaVersion:1, requestId,
        text, processingMode:'ANONYMIZE', protectionPolicy:{
          schemaVersion:1,selectedTypes:[...selection.policy.selectedTypes],
          sensitiveKeepAcknowledged:selection.policy.sensitiveKeepAcknowledged === true},
        anon2InclusionList:selection.lists.anon2InclusionList,
        anon2ExclusionList:selection.lists.anon2ExclusionList}, abort.signal);
      if (serial !== this.serial || abort.signal.aborted) return;
      if (response?.requestId !== requestId || response.policyDigest !== selection.policy.digest ||
        response.listDigest !== selection.listDigest ||
        !['READY','REVIEW_REQUIRED','FAILED'].includes(response.status) ||
        response.assurance !== 'EPHEMERAL_PREVIEW' ||
        !response.qa || !Array.isArray(response.fragments) ||
        response.fragments.some(part => !['plain','masked'].includes(part.kind) ||
          typeof part.text !== 'string')) throw new Error('Réponse d’aperçu invalide');
      this.render({state:'result',response});
    } catch (error) {
      if (serial === this.serial && !abort.signal.aborted)
        this.render({state:'error',message:'Aperçu indisponible. Utilisez le dépôt TXT.'});
    } finally { if (this.abort === abort) this.abort = null; }
  }
}
