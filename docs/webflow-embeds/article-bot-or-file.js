/* Quiz article : bot dans la visio, ou fichier déposé après.
   Aucun chiffre. Shell Webflow : <div id="agilo-bot-or-file"></div>
   jsDelivr : épingler @SHA après le push de ce fichier. */
(function () {
  var root = document.getElementById("agilo-bot-or-file");
  if (!root) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function track(name) {
    if (window.posthog && window.posthog.capture) window.posthog.capture(name);
    if (window.gtag) window.gtag("event", name);
  }
  root.innerHTML =
    '<form style="margin:1.5rem 0;padding:20px;border-radius:12px;border:1px solid #174a96;background:#f8f9fa;font-family:Inter,sans-serif;">' +
    '<p style="margin:0 0 12px;font-weight:700;color:#174a96;">Votre réunion accepte-t-elle un participant de plus ?</p>' +
    '<label style="display:block;margin:6px 0;"><input type="radio" name="agilo-bot" value="oui"> Oui, un assistant peut rejoindre la visio.</label>' +
    '<label style="display:block;margin:6px 0;"><input type="radio" name="agilo-bot" value="non"> Non, personne d\'autre n\'entre. Le fichier est déposé après.</label>' +
    '<p id="agilo-bot-answer" style="margin:12px 0 0;font-weight:600;"></p></form>';
  root.querySelector("form").addEventListener("change", function (ev) {
    var v = ev.target && ev.target.value;
    var out = document.getElementById("agilo-bot-answer");
    if (v === "oui") out.textContent = "Un assistant qui rejoint la visio peut convenir. Vérifiez où part l'audio.";
    if (v === "non") out.textContent = "Déposez le fichier après la réunion. Personne n'entre dans l'appel.";
    if (!reduce) out.style.transition = "opacity .2s";
    track("agilo_widget_bot_or_file");
  });
})();
