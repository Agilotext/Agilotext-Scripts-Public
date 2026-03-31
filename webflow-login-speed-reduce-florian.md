# Webflow Login - `loginSpeedReduce` Pour Florian

## Version **1.01** (branche GitHub `1.01`)

Cette note regroupe **deux lots** : (A) anti-bruteforce login Webflow, (B) correctifs **jeton Agilotext** / UX après rotation serveur (ex. toutes les 12 h).

### Déploiement GitHub

- **Branche de référence** : `1.01` — copie de `main` au moment de la création de la branche, **sans modifier** `main` (prod continue de pointer sur `main`).
- **Scripts concernés dans ce dépôt** (à référencer dans Webflow en remplaçant `@main` par `@1.01` dans les URL `raw.githubusercontent.com` si tu bascules le site sur cette version) :
  - `scripts/pages/dashboard/free.js`
  - `scripts/pages/dashboard/pro.js`
  - `scripts/pages/dashboard/ent.js`
  - `scripts/pages/dashboard/free_v2.js`
  - `scripts/pages/dashboard/pro_v2.js`
  - `scripts/pages/dashboard/mount-streaming.js`

Exemple d’URL :

```text
https://raw.githubusercontent.com/Agilotext/Agilotext-Scripts-Public/1.01/scripts/pages/dashboard/free.js
```

### Lot B — Modifications effectuées (jeton Agilotext + messages)

**Contexte** : le backend peut **renouveler** le jeton Agilotext (`getToken`) alors que l’onglet garde l’**ancien** `globalToken` en mémoire (sessions longues, Meet, etc.). La session **Memberstack** peut rester valide : l’utilisateur ne doit pas croire qu’il doit « se reconnecter ».

**Comportement ajouté dans les scripts dashboard (v1.01)** :

1. **`refreshAgiloTokenFromApi(email)`** — rappelle `GET …/getToken` et met à jour `globalToken` (+ `window.globalToken` quand présent).
2. **`ensureValidToken(email, forceRefresh)`** — si `forceRefresh === true`, rappelle toujours `getToken` (ex. **juste avant** upload / envoi).
3. **Soumission formulaire** — `await ensureValidToken(email, true)` avant l’envoi pour éviter l’échec après rotation pendant une longue session.
4. **`sendWithRetry`** — en cas de **`error_invalid_token`** ou **401/403**, une tentative de **rafraîchissement** puis **nouvel essai** ; correction du retour d’erreur API (`responseData` au lieu du payload requête).
5. **Polling `getTranscriptStatus`** — sur **401**, tentative de renouvellement du jeton avant d’afficher l’erreur définitive.
6. **AssemblyAI / dictée** — jeton frais au démarrage + **retry** après 401 ; **`mount-streaming.js`** appelle `ensureValidToken(email, true)` avant auth et upload blob.
7. **Textes utilisateur** — formulation du type : *recharger la page pour continuer, vous restez connecté (Memberstack)* ; suppression du vocabulaire trompeur « reconnectez-vous » pour ce cas.

**Côté produit / backend (à discuter avec Nicolas)** : allonger la fenêtre de rotation (ex. **24 h**) réduit la fréquence du problème mais ne remplace pas le **rafraîchissement côté client** ni la trajectoire **JWT Memberstack** (voir `PLAN-backend-gettoken-nicolas.md` si présent dans le repo).

**Mobile React Native** : ne pas appliquer un filtre **Origin** strict sur `/getToken` sans stratégie « sans Origin » ; ce point reste dans le plan sécurité, pas dans ce fichier login.

---

## Message prêt à envoyer

Florian,

Nicolas a déjà implémenté côté backend l'API anti-bruteforce pour ralentir les tentatives de guess password.

Il faudrait maintenant l'appeler sur la page de login Webflow, ici :

- `https://www.agilotext.com/auth/login`

L'objectif est simple :

1. quand l'utilisateur clique sur `Se connecter`
2. on garde les validations front actuelles
3. on appelle `https://api.agilotext.com/api/v1/loginSpeedReduce?username=<email>`
4. on attend la fin de cet appel
5. seulement après, on lance le `ms.loginMemberEmailPassword(...)`

Important :

- ne rien changer au flux Google dans ce lot
- si l'appel `loginSpeedReduce` échoue, on bloque le login email/password
- il ne faut rien changer côté Java, tout est déjà implémenté

J'ai vérifié la page live : le login email/password est géré aujourd'hui par un script inline Webflow sur le formulaire `#ms-login-custom`, donc la modif doit être faite directement dans ce script de page.

## Plan d'implémentation

### 1. Localiser le handler de login email/password

Sur la page `https://www.agilotext.com/auth/login`, repérer le bloc :

```js
form.addEventListener('submit', async function (e) {
```

et plus bas la ligne :

```js
await ms.loginMemberEmailPassword({ email: email, password: password });
```

### 2. Ajouter une fonction utilitaire pour l'appel anti-bruteforce

Ajouter une fonction `loginSpeedReduce(email)` dans le même script inline.

Cette fonction doit :

- appeler `https://api.agilotext.com/api/v1/loginSpeedReduce?username=<email encodé>`
- utiliser `fetch`
- attendre la réponse

### 3. Brancher l'appel avant Memberstack

Dans le submit email/password :

- conserver l'ordre actuel
- garder :
  - `isOffline()`
  - `checkRateLimit()`
  - validation `email/password`
  - `setLoading(true)`
- juste après `setLoading(true)`, faire :
  - `await loginSpeedReduce(email);`
- ensuite seulement continuer avec :

```js
await ms.loginMemberEmailPassword({ email: email, password: password });
```

### 4. Politique d'erreur

Si `loginSpeedReduce` échoue :

- afficher l'erreur réseau/générique existante
- faire `setLoading(false)`
- ne pas appeler Memberstack

### 5. Ce qui ne change pas

- le flux Google
- le wording existant des erreurs, sauf réutilisation de `MSG.network` / `MSG.generic`
- la redirection `/auth/post-login`

## Code à ajouter

### 1. Fonction utilitaire à ajouter dans le script de la page

À ajouter avant le bloc `form.addEventListener('submit', ...)` :

```js
async function loginSpeedReduce(email) {
    var url = 'https://api.agilotext.com/api/v1/loginSpeedReduce?username=' + encodeURIComponent(email);

    var response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
    });

    if (!response.ok) {
        throw new Error('login_speed_reduce_failed');
    }

    return response;
}
```

### 2. Bloc de login email/password à remplacer

Remplacer le bloc actuel de login email/password par celui-ci :

```js
/* ── LOGIN EMAIL / PASSWORD ─────────────────────────────────────── */
form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (isAuthInFlight) return;

    if (isOffline()) { showInlineError(MSG.offline); return; }
    if (checkRateLimit()) return;

    hideInlineError();

    var email = (emailInp && emailInp.value || '').trim();
    var password = (passInp && passInp.value || '');

    if (!email || !password) {
        showInlineError(MSG.fields_required);
        return;
    }
    if (!isValidEmail(email)) {
        showInlineError(MSG.email_invalid);
        return;
    }

    setLoading(true);

    try {
        log('login_speed_reduce_start', { email: email });
        await loginSpeedReduce(email);
        log('login_speed_reduce_success', { email: email });

        var ms = await waitMs(10000);
        if (!ms || typeof ms.loginMemberEmailPassword !== 'function') {
            throw new Error(MSG.memberstack_ko);
        }

        log('email_login_start', { email: email });
        await ms.loginMemberEmailPassword({ email: email, password: password });
        log('email_login_success');
        window.location.replace('/auth/post-login');
    } catch (err) {
        lastErrorAt = Date.now();

        var rawError = String(err && err.message ? err.message : err);
        var kind = rawError === 'login_speed_reduce_failed'
            ? 'network'
            : classifyError(err);

        var label = kind === 'no_account' ? MSG.no_account_email
            : kind === 'use_google' ? MSG.use_google
            : kind === 'wrong_password' ? MSG.wrong_password
            : kind === 'network' ? MSG.network
            : MSG.generic;

        showInlineError(label);
        log('email_login_error', { kind: kind, error: rawError });
        setLoading(false);
    }
});
```

## Vérifications à faire dans DevTools

### Cas nominal

- saisir un email + mot de passe valides
- cliquer sur `Se connecter`
- vérifier que l'appel `loginSpeedReduce` part avant `loginMemberEmailPassword`
- vérifier que la redirection vers `/auth/post-login` reste inchangée

### Mot de passe faux

- vérifier que `loginSpeedReduce` est bien appelé
- vérifier que l'erreur de mot de passe reste affichée normalement

### Champs invalides

- champs vides
- email invalide
- offline

Dans ces cas, vérifier qu'aucun appel `loginSpeedReduce` n'est lancé.

### API indisponible

- simuler un échec réseau ou une réponse non OK
- vérifier que le login email/password est bloqué
- vérifier que Memberstack n'est pas appelé

### Google

- vérifier que le bouton Google fonctionne comme avant
- vérifier qu'aucun changement n'a été introduit sur ce flux

## Résultat attendu

Après cette modif, tout login email/password sur la page Webflow passera d'abord par :

```text
https://api.agilotext.com/api/v1/loginSpeedReduce?username=<email>
```

et seulement ensuite par la validation Memberstack du mot de passe.
