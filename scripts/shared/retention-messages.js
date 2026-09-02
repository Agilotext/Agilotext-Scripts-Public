/**
 * Messages rétention audio / texte / transcript fantôme.
 * Source unique : ne jamais promettre que le texte reste accessible.
 *
 * window.agiloRetentionMessages(edition, kind, opts)
 * kinds : audio_expired | text_retention | ghost_transcript
 *
 * @version 1.0
 */
(function (root) {
  'use strict';

  function normalizeEdition(v) {
    var s = String(v || '').trim().toLowerCase();
    if (s === 'free' || s === 'gratuit') return 'free';
    if (s === 'pro' || s === 'premium') return 'pro';
    if (s === 'ent' || s === 'enterprise' || s === 'entreprise' || s === 'business' || s === 'team' || s === 'biz') {
      return 'ent';
    }
    if (typeof location !== 'undefined' && location.pathname) {
      var p = location.pathname;
      if (p.indexOf('/app/free/') !== -1) return 'free';
      if (p.indexOf('/app/pro/') !== -1 || p.indexOf('/app/premium/') !== -1) return 'pro';
      if (p.indexOf('/app/ent/') !== -1 || p.indexOf('/app/business/') !== -1) return 'ent';
    }
    return 'ent';
  }

  function jobBit(opts) {
    var id = opts && (opts.jobId || opts.jobid);
    return id ? ' (job ' + id + ')' : '';
  }

  function message(edition, kind, opts) {
    var ed = normalizeEdition(edition);
    var k = String(kind || '');
    var job = jobBit(opts);

    if (k === 'audio_expired') {
      if (ed === 'free') {
        return 'Cet audio n’est plus disponible : il a été supprimé après 24 heures (offre Gratuit).';
      }
      if (ed === 'pro') {
        return 'Cet audio n’est plus disponible : il a été supprimé après 30 jours (offre Pro).';
      }
      return 'Cet audio n’est plus disponible : il a été supprimé après 30 jours (offre Business).';
    }

    if (k === 'ghost_transcript') {
      if (ed === 'ent') {
        return 'Cette transcription n’est plus sur le serveur. Ce n’est pas le comportement prévu de l’offre Business. Contactez le support avec le numéro du job' + job + '.';
      }
      return 'Cette transcription n’est plus sur le serveur. Contactez le support avec le numéro du job' + job + '.';
    }

    if (ed === 'free') {
      return 'Cette transcription ou ce compte rendu n’est plus disponible : conservation 7 jours (offre Gratuit).';
    }
    if (ed === 'pro') {
      return 'Cette transcription ou ce compte rendu n’est plus disponible : conservation 1 an (offre Pro).';
    }
    return 'Cette transcription n’est plus sur le serveur. Ce n’est pas le comportement prévu de l’offre Business. Contactez le support avec le numéro du job' + job + '.';
  }

  function fromPath(kind, opts) {
    return message(normalizeEdition((opts && opts.edition) || ''), kind, opts);
  }

  var api = {
    normalizeEdition: normalizeEdition,
    message: message,
    fromPath: fromPath
  };

  if (root) {
    root.agiloRetentionMessages = message;
    root.agiloRetentionNormalizeEdition = normalizeEdition;
    root.agiloRetentionApi = api;
    if (!root.agiloAudioExpiredMessage) {
      root.agiloAudioExpiredMessage = message(normalizeEdition(''), 'audio_expired');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
