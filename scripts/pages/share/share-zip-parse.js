/* ================================================================
   AGILOTEXT — lecture d’un zip de partage public (…-download)
   Fichiers typiques : un .txt (transcription) + un .html (compte rendu).
   ================================================================ */
(function (root) {
  'use strict';

  var SKIP_EXT = /\.(mp3|m4a|wav|webm|mp4|aac|ogg|flac|zip|docx|doc|pdf|png|jpe?g|gif|webp|bin)$/i;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function basename(name) {
    return String(name || '').replace(/\\/g, '/').split('/').pop() || '';
  }

  function titleFromName(name) {
    var base = basename(name).replace(/\.[a-z0-9]+$/i, '');
    return String(base || '').replace(/[_-]+/g, ' ').trim();
  }

  function isZipBuffer(buf) {
    var u = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
    return u.length > 4 && u[0] === 0x50 && u[1] === 0x4b &&
      (u[2] === 0x03 || u[2] === 0x05 || u[2] === 0x07);
  }

  function looksLikeGoneHtml(text) {
    var s = String(text || '');
    return /n[’']existe plus|fichier n[’']existe|no longer exists|not found/i.test(s) &&
      /<!doctype html|<html/i.test(s);
  }

  function classifyName(name) {
    var base = basename(name).toLowerCase();
    if (!base || base.charAt(0) === '.' || /\/__macosx\//i.test(String(name))) return 'skip';
    if (SKIP_EXT.test(base)) return 'skip';
    if (/summary|compte.?rendu|synthese|synth[eè]se|\bpv\b|proc[eè]s/.test(base)) return 'summary';
    if (/transcript|transcription|verbatim/.test(base)) return 'transcript';
    var ext = (base.match(/\.([a-z0-9]+)$/) || [])[1] || '';
    if (ext === 'json') return 'json';
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'txt' || ext === 'md') return 'txt';
    return 'other';
  }

  function textToHtml(s) {
    var t = String(s || '').replace(/\r\n/g, '\n').trim();
    if (!t) return '';
    return '<p>' + escapeHtml(t).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  }

  function looksLikeSummaryHtml(html) {
    var s = String(html || '');
    if (/ag-seg|milli_start|speaker/i.test(s) && !/<h[1-3]/i.test(s)) return false;
    return /<h[1-3]|compte.?rendu|d[eé]cisions|prochaines.?[eé]tapes|proc[eè]s.?verbal/i.test(s);
  }

  function mapJsonSegments(j) {
    var arr = (j && Array.isArray(j.segments)) ? j.segments : [];
    return arr.map(function (r, i) {
      var startMs = r.milli_start != null ? r.milli_start : r.start;
      return {
        speaker: String(r.speaker || '').trim() || ('Intervenant ' + (i + 1)),
        start: Math.max(0, Math.floor((+startMs || 0) / (String(startMs).length > 6 ? 1000 : 1))),
        text: String(r.text || '').replace(/\\n/g, '\n')
      };
    }).filter(function (s) { return String(s.text || '').trim(); });
  }

  function txtToSegments(txt) {
    var lines = String(txt || '').replace(/\r\n/g, '\n').split('\n');
    var segs = [];
    var i;
    var re = /^(?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?([^:]{1,80}):\s+(\S.*)$/;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(re);
      if (!m) continue;
      var speaker = String(m[1] || '').trim();
      if (!speaker || /https?|http|www\./i.test(speaker)) continue;
      segs.push({ speaker: speaker, start: 0, text: String(m[2] || '').trim() });
    }
    return segs.length >= 2 ? segs : [];
  }

  function jobFromZipFiles(files) {
    var list = Array.isArray(files) ? files : [];
    var summaryHtml = '';
    var transcriptHtml = '';
    var segments = [];
    var title = '';
    var i;

    var htmls = [];
    var txts = [];

    for (i = 0; i < list.length; i++) {
      var f = list[i] || {};
      var name = String(f.name || '');
      var text = String(f.text || '');
      var kind = classifyName(name);
      if (kind === 'skip' || !text.trim()) continue;
      if (!title) title = titleFromName(name);

      if (kind === 'json') {
        try {
          var parsed = JSON.parse(text);
          var segs = mapJsonSegments(parsed);
          if (segs.length) segments = segs;
          if (parsed && (parsed.summary || parsed.summaryHtml || parsed.html)) {
            summaryHtml = String(parsed.summary || parsed.summaryHtml || parsed.html);
          }
          if (parsed && (parsed.jobTitle || parsed.title)) title = String(parsed.jobTitle || parsed.title);
        } catch (_) { /* ignore */ }
        continue;
      }

      if (kind === 'summary') {
        summaryHtml = /<[a-z][\s\S]*>/i.test(text) ? text : textToHtml(text);
        continue;
      }
      if (kind === 'transcript') {
        if (/<[a-z][\s\S]*>/i.test(text)) transcriptHtml = text;
        else {
          transcriptHtml = textToHtml(text);
          if (!segments.length) segments = txtToSegments(text);
        }
        continue;
      }
      if (kind === 'html') htmls.push({ name: name, text: text });
      else if (kind === 'txt') txts.push({ name: name, text: text });
    }

    if (!summaryHtml || !transcriptHtml) {
      htmls.sort(function (a, b) { return b.text.length - a.text.length; });
      txts.sort(function (a, b) { return b.text.length - a.text.length; });

      if (!summaryHtml) {
        for (i = 0; i < htmls.length; i++) {
          if (looksLikeSummaryHtml(htmls[i].text)) {
            summaryHtml = htmls[i].text;
            htmls.splice(i, 1);
            break;
          }
        }
      }
      if (!summaryHtml && htmls.length && txts.length) {
        summaryHtml = htmls[0].text;
        htmls.shift();
      }
      if (!transcriptHtml && txts.length) {
        transcriptHtml = textToHtml(txts[0].text);
        if (!segments.length) segments = txtToSegments(txts[0].text);
        if (!title) title = titleFromName(txts[0].name);
      }
      if (!transcriptHtml && htmls.length) {
        transcriptHtml = htmls[0].text;
      }
      if (!summaryHtml && htmls.length) {
        summaryHtml = htmls[0].text;
      }
    }

    if (!summaryHtml && !transcriptHtml && !segments.length) return null;

    return {
      status: 'OK',
      jobTitle: title || 'Document partagé',
      filename: '',
      sharedByName: '',
      expiresAt: '',
      audioUrl: '',
      audioAvailable: false,
      transcriptHtml: transcriptHtml,
      summaryHtml: summaryHtml,
      segments: segments,
      sharedDocumentType: summaryHtml ? 'cr' : 'transcript'
    };
  }

  var api = {
    basename: basename,
    classifyName: classifyName,
    isZipBuffer: isZipBuffer,
    looksLikeGoneHtml: looksLikeGoneHtml,
    jobFromZipFiles: jobFromZipFiles,
    textToHtml: textToHtml
  };

  root.AgiloShareZip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
