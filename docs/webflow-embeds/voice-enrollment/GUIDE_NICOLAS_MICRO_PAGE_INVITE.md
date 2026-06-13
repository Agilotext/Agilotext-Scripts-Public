# Guide Nicolas — Ajouter l'enregistrement micro sur la page d'invitation vocale

**Date :** 13 juin 2026  
**Page concernée :** `https://api.agilotext.com/api/v1/speakerVoiceInvite?inviteToken=sv_...`  
**Objectif :** permettre à l'invité d'enregistrer sa voix directement au micro, en plus de l'upload de fichier, **sans rien changer au flux de soumission existant** (`submitSpeakerVoiceInvite`).

---

## 1. Principe — zéro changement de contrat

Ta page contient déjà un formulaire qui marche :

```html
<form id="voiceInviteForm" action=".../submitSpeakerVoiceInvite" method="post" enctype="multipart/form-data">
  <input type="hidden" name="inviteToken" value="sv_...">
  <input type="text" name="firstName" required>
  <input type="text" name="lastName" required>
  <input type="file" name="voiceFile" accept="audio/*" required>
  <button type="submit">Envoyer</button>
</form>
```

L'astuce : le micro **fabrique un fichier** et l'injecte dans le champ `voiceFile` existant via l'API `DataTransfer`. Le submit reste un POST multipart classique, identique à un upload manuel. Côté backend tu n'as **qu'une seule chose** à faire (section 4 : accepter webm/mp4).

C'est exactement ce qu'on fait côté Webflow (onboarding + Mon compte) et ça marche sur Chrome, Firefox, Safari, Edge, iOS et Android.

## 2. Snippet à intégrer (vanilla JS, aucune dépendance)

Ajouter ce bloc HTML juste au-dessus du champ fichier :

```html
<div class="field">
    <label>Ou enregistrez votre voix au micro</label>
    <button type="button" id="recordBtn">Démarrer l'enregistrement</button>
    <span id="recordTimer" style="margin-left:10px;font-weight:700;display:none">00:00 / 00:45</span>
    <audio id="recordPreview" controls style="display:none;width:100%;margin-top:10px"></audio>
    <p class="hint" id="recordHint">Parlez seul(e), clairement, dans un endroit calme — entre 15 et 45 secondes.</p>
</div>
```

Et ce script avant `</body>` :

```html
<script>
(function () {
    var MIN_SEC = 15;
    var MAX_SEC = 45;
    var btn = document.getElementById("recordBtn");
    var timerEl = document.getElementById("recordTimer");
    var preview = document.getElementById("recordPreview");
    var fileInput = document.getElementById("voiceFile");

    var mediaRecorder = null;
    var mediaStream = null;
    var chunks = [];
    var elapsed = 0;
    var timerId = null;

    function pickMimeType() {
        if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return "";
        var candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
        for (var i = 0; i < candidates.length; i++) {
            if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
        }
        return "";
    }

    function fileNameFor(mime) {
        if (mime.indexOf("mp4") !== -1) return "voice-enrollment.mp4";
        if (mime.indexOf("ogg") !== -1) return "voice-enrollment.ogg";
        return "voice-enrollment.webm";
    }

    function fmt(sec) {
        return ("0" + Math.floor(sec / 60)).slice(-2) + ":" + ("0" + (sec % 60)).slice(-2);
    }

    function stopTracks() {
        if (mediaStream) mediaStream.getTracks().forEach(function (t) { t.stop(); });
        mediaStream = null;
    }

    function stopRecording() {
        if (!mediaRecorder) return;
        if (elapsed < MIN_SEC) return;
        clearInterval(timerId);
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
        stopTracks();
    }

    async function startRecording() {
        if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
            alert("Votre navigateur ne permet pas l'enregistrement micro. Utilisez l'upload de fichier.");
            return;
        }
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            alert("Accès micro refusé. Autorisez le micro ou utilisez l'upload de fichier.");
            return;
        }

        var mime = pickMimeType();
        try {
            mediaRecorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
        } catch (e) {
            mediaRecorder = new MediaRecorder(mediaStream);
        }
        mime = mediaRecorder.mimeType || mime || "audio/webm";

        chunks = [];
        mediaRecorder.ondataavailable = function (ev) {
            if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };
        mediaRecorder.onstop = function () {
            var blob = new Blob(chunks, { type: mime });
            var file = new File([blob], fileNameFor(mime), { type: mime });
            var dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            preview.src = URL.createObjectURL(blob);
            preview.style.display = "block";
            timerEl.style.display = "none";
            btn.textContent = "Réenregistrer";
            btn.disabled = false;
        };

        mediaRecorder.start(250);
        elapsed = 0;
        btn.textContent = "Arrêter (min " + MIN_SEC + " s)";
        btn.disabled = true;
        timerEl.style.display = "inline";
        preview.style.display = "none";

        timerId = setInterval(function () {
            elapsed++;
            timerEl.textContent = fmt(elapsed) + " / " + fmt(MAX_SEC);
            if (elapsed >= MIN_SEC) {
                btn.disabled = false;
                btn.textContent = "Arrêter l'enregistrement";
            }
            if (elapsed >= MAX_SEC) stopRecording();
        }, 1000);
    }

    btn.addEventListener("click", function () {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            stopRecording();
        } else {
            startRecording();
        }
    });
}());
</script>
```

## 3. Comportement obtenu

1. L'invité clique « Démarrer l'enregistrement » → le navigateur demande l'autorisation micro.
2. Timer visible, arrêt impossible avant 15 s, arrêt automatique à 45 s.
3. À l'arrêt : lecteur audio de contrôle + fichier injecté dans `voiceFile`.
4. L'invité clique « Envoyer » → POST `submitSpeakerVoiceInvite` identique à un upload manuel.
5. Upload fichier toujours possible : le dernier choix (micro ou fichier) gagne.

## 4. Prérequis backend : accepter webm / mp4

| Navigateur | Format MediaRecorder |
|------------|----------------------|
| Chrome / Edge / Firefox | `audio/webm` (opus) |
| Safari macOS / iOS | `audio/mp4` (AAC) |

`submitSpeakerVoiceInvite` doit convertir webm/mp4 → mp3 ou wav avant Speechmatics, **comme `enrollSpeakerVoice`**.

## 5. Points d'attention

1. **Durées** : alignées front Agilotext sur **15 s min / 45 s max**.
2. **HTTPS obligatoire** pour `getUserMedia` — OK sur `api.agilotext.com`.
3. **Pages succès/erreur** après submit : message clair pour l'invité non technique.
4. **Validation durée côté serveur** : rejeter si < 15 s avec message lisible.

---

*Snippet adapté du code Webflow en production (onboarding + Mon compte).*
