/**
 * Auth messages for the prompt library: never leak error_invalid_token or v2.l hashes.
 */
var AUTH_HINT_RE = /(invalid token|expired token|token invalide|jeton invalide|unauthorized|forbidden|authentication|authentification|missing token|error_invalid_token|error_token)/i;
var TOKEN_HASH_RE = /v2\.l[a-z0-9]+/i;
var AUTH_RETRY_MSG = "Session expirée, reconnexion…";
var AUTH_RELOAD_MSG = "Session expirée. Recharge la page.";

function sanitizeUserMessage(msg, duringRetry) {
  var s = String(msg == null ? "" : msg);
  if (!s) return duringRetry ? AUTH_RETRY_MSG : AUTH_RELOAD_MSG;
  if (AUTH_HINT_RE.test(s) || TOKEN_HASH_RE.test(s)) {
    return duringRetry ? AUTH_RETRY_MSG : AUTH_RELOAD_MSG;
  }
  return s;
}

var shot = "error_invalid_token: v2.l788290389.4a3707795a8eda5f4b9ae778fedc3a90352faca8";
var retry = sanitizeUserMessage(shot, true);
var reload = sanitizeUserMessage(shot, false);
if (retry !== AUTH_RETRY_MSG) throw new Error("retry: " + retry);
if (reload !== AUTH_RELOAD_MSG) throw new Error("reload: " + reload);
if (reload.indexOf("v2.l") !== -1) throw new Error("hash leaked");
if (sanitizeUserMessage("Impossible de charger les modèles.", false) !== "Impossible de charger les modèles.") {
  throw new Error("non-auth message rewritten");
}
console.log("library-auth.test.js ok");
