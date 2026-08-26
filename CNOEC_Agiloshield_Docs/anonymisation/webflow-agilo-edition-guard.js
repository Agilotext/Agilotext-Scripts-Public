/**
 * Garde page anonymiser : empêche readyCount / token-resolver d’écraser
 * agilo:edition=agiloshield par business/ent. Ne change pas tools-navigation.
 * À coller en head custom code des pages /anonymiser (et tools/agiloshield).
 */
(function () {
  var ls = window.localStorage;
  if (!ls || ls.__agiloEditionGuard) return;
  var orig = ls.setItem.bind(ls);
  ls.setItem = function (key, val) {
    if (key === 'agilo:edition') {
      var incoming = String(val || '').toLowerCase();
      var current = String(ls.getItem('agilo:edition') || '').toLowerCase();
      if (
        current === 'agiloshield' &&
        incoming !== 'agiloshield' &&
        incoming !== 'anonymisation' &&
        incoming !== 'shield' &&
        incoming !== 'agiloshield-classic'
      ) {
        if (window.AGILO_DEBUG) console.log('[agiloshield-edition] blocked clobber', incoming);
        return;
      }
    }
    return orig(key, val);
  };
  ls.__agiloEditionGuard = true;
})();
