/* ================================================================ */
/* AGILOTEXT - LOGIN SCRIPT v7 (/auth/login uniquement)             */
/* ================================================================ */
/* FIX v7 :                                                          */
/*  - Prefetch Memberstack + loginWithProvider synchrone (gesture)  */
/*  - Neutralisation Tabs Webflow cassés (show/hide mot de passe)    */
/* FIX v6 :                                                          */
/*  - _agilo_redirect_count n'est réinitialisé QUE si logged_out=1  */
/* ================================================================ */
/* Déploiement Webflow : coller ce script dans l'embed code-login   */
/* de la page /auth/login (avant les scripts Webflow jQuery/IX2).   */
/* ================================================================ */

(function () {
    if (window.__agiloLoginScriptInit) return;
    window.__agiloLoginScriptInit = true;

    var PAGE = window.location.pathname || '';
    if (!/^\/auth\/login\/?$/.test(PAGE)) return;

    /* ── Neutraliser les Tabs Webflow sans panes (évite changeTab crash) */
    (function neutralizeBrokenPasswordTabs() {
        var wrap = document.querySelector('.show-password-wrap.w-tabs');
        if (!wrap) return;
        wrap.classList.remove('w-tabs');
        var menu = wrap.querySelector('.w-tab-menu');
        if (menu) menu.classList.remove('w-tab-menu');
        wrap.querySelectorAll('.w-tab-link').forEach(function (link) {
            link.classList.remove('w-tab-link');
        });
    })();

    /* ── Remise à zéro du compteur anti-boucle UNIQUEMENT si logout volontaire */
    var _urlParams = new URLSearchParams(window.location.search || '');
    if (_urlParams.get('logged_out') === '1') {
        sessionStorage.removeItem('_agilo_redirect_count');
    }

    var isAuthInFlight = false;
    var lastErrorAt = 0;
    var flowId = 'lgn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

    /* ── Logger ─────────────────────────────────────────────────────── */
    function log(evt, data) {
        console.info('[AGILO_LOGIN]', Object.assign({ flow_id: flowId, event: evt, version: 'v7' }, data || {}));
    }

    /* ── Utilitaires ─────────────────────────────────────────────────── */
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    async function waitMs(timeoutMs) {
        var t = Date.now();
        while (Date.now() - t < timeoutMs) {
            if (window.$memberstackDom) return window.$memberstackDom;
            await sleep(100);
        }
        return null;
    }

    /* ── Eager Memberstack cache (OAuth popup exige un user gesture sync) */
    var _msEager = null;
    (function prefetchMs() {
        waitMs(10000).then(function (ms) {
            _msEager = ms;
            if (ms) log('memberstack_ready');
            else log('memberstack_prefetch_timeout');
        });
    })();

    function getMemberstackForOAuth() {
        return _msEager || window.$memberstackDom || null;
    }

    async function getMember(ms, tries, delay) {
        for (var i = 0; i < tries; i++) {
            try {
                var r = await ms.getCurrentMember({ useCache: false });
                if (r && r.data) return r.data;
            } catch (_) { }
            await sleep(delay);
        }
        return null;
    }

    /* ── Validation email ───────────────────────────────────────────── */
    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
    }

    /* ── Gestion erreurs ─────────────────────────────────────────────── */
    (function injectErrorStyles() {
        if (document.getElementById('_agilo_error_style')) return;
        var s = document.createElement('style');
        s.id = '_agilo_error_style';
        s.textContent = [
            '@keyframes _agilo_slidein {',
            '  from { opacity:0; transform:translateY(-6px); }',
            '  to   { opacity:1; transform:translateY(0);    }',
            '}',
            '#ms-login-error {',
            '  display:none;',
            '  background:rgba(168,38,51,.08);',
            '  border:1px solid #a82633;',
            '  border-radius:.5rem;',
            '  padding:12px 14px;',
            '  margin-top:12px;',
            '  animation:_agilo_slidein .22s ease;',
            '}',
            '#ms-login-error ._agilo_err_inner {',
            '  display:flex;',
            '  align-items:flex-start;',
            '  gap:10px;',
            '}',
            '#ms-login-error ._agilo_err_icon {',
            '  flex-shrink:0;',
            '  color:#a82633;',
            '  margin-top:1px;',
            '}',
            '#ms-login-error ._agilo_err_text {',
            '  flex:1;',
            '  font-family:Poppins,sans-serif;',
            '  font-size:.8125rem;',
            '  line-height:1.5;',
            '  color:#a82633;',
            '  font-weight:500;',
            '}',
            '#ms-login-error ._agilo_err_close {',
            '  flex-shrink:0;',
            '  background:none;',
            '  border:none;',
            '  cursor:pointer;',
            '  padding:0;',
            '  color:#a82633;',
            '  opacity:.7;',
            '  line-height:1;',
            '}',
            '#ms-login-error ._agilo_err_close:hover { opacity:1; }'
        ].join('\n');
        document.head.appendChild(s);
    })();

    function showInlineError(msg) {
        var box = document.getElementById('ms-login-error');
        if (!box) return;

        box.innerHTML = '';

        var inner = document.createElement('div');
        inner.className = '_agilo_err_inner';

        var iconWrap = document.createElement('div');
        iconWrap.className = '_agilo_err_icon';
        iconWrap.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">'
            + '<path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"'
            + ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
            + '</svg>';

        var txt = document.createElement('span');
        txt.className = '_agilo_err_text';
        txt.textContent = msg || 'Erreur de connexion.';

        var closeBtn = document.createElement('button');
        closeBtn.className = '_agilo_err_close';
        closeBtn.setAttribute('aria-label', 'Fermer');
        closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">'
            + '<path d="M9.414 8l4.293-4.293-1.414-1.414L8 6.586 3.707 2.293 2.293 3.707'
            + ' 6.586 8l-4.293 4.293 1.414 1.414L8 9.414l4.293 4.293 1.414-1.414L9.414 8z"/>'
            + '</svg>';
        closeBtn.addEventListener('click', function () { hideInlineError(); });

        inner.appendChild(iconWrap);
        inner.appendChild(txt);
        inner.appendChild(closeBtn);
        box.appendChild(inner);

        box.style.animation = 'none';
        box.style.display = 'block';
        requestAnimationFrame(function () {
            box.style.animation = '';
        });
    }

    function hideInlineError() {
        var box = document.getElementById('ms-login-error');
        if (box) { box.style.display = 'none'; box.innerHTML = ''; }
    }

    /* ── Classification erreurs ─────────────────────────────────────── */
    function classifyError(err) {
        var raw = '';
        try {
            raw = String(err && err.message ? err.message : err)
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        } catch (_) {
            raw = String(err || '').toLowerCase();
        }

        if (
            raw.includes('no member found') ||
            raw.includes('no matching member') ||
            raw.includes('member not found') ||
            raw.includes('account not found') ||
            raw.includes('no account') ||
            raw.includes('not exist') ||
            raw.includes('does not exist') ||
            raw.includes('compte introuvable') ||
            raw.includes('aucun compte')
        ) return 'no_account';

        if (
            raw.includes('oauth') ||
            raw.includes('this account uses google') ||
            raw.includes('sign in with google') ||
            raw.includes('use google') ||
            (raw.includes('password') && raw.includes('google'))
        ) return 'use_google';

        if (
            raw.includes('signups disabled') ||
            raw.includes('signup not allowed') ||
            (raw.includes('allow') && raw.includes('signup'))
        ) return 'signup_not_allowed';

        if (
            raw.includes('popup') && (raw.includes('closed') || raw.includes('cancel'))
        ) return 'popup_closed';

        if (
            raw.includes('invalid email or password') ||
            raw.includes('invalid password') ||
            raw.includes('wrong password') ||
            (raw.includes('invalid') && raw.includes('password'))
        ) return 'wrong_password';

        if (
            raw.includes('network') ||
            raw.includes('fetch') ||
            raw.includes('failed to fetch') ||
            raw.includes('networkerror') ||
            raw.includes('timeout')
        ) return 'network';

        if (raw.includes('already has plan') || raw.includes('plan already')) return 'plan_already';

        return 'generic';
    }

    function googleLoginErrorLabel(err, kind) {
        if (
            kind === 'no_account' ||
            kind === 'signup_not_allowed' ||
            (kind === 'generic' && String(err && err.message || '').toLowerCase().includes('signup'))
        ) return MSG.no_account_google;
        if (kind === 'popup_closed') return MSG.popup_closed;
        if (kind === 'network') return MSG.network;
        return MSG.generic;
    }

    var MSG = {
        no_account_email: "Aucun compte trouvé pour cet email. Vérifiez l'adresse ou\u00a0créez un compte.",
        no_account_google: "Aucun compte associé à ce compte Google. Créez un compte d'abord puis connectez-vous.",
        use_google: 'Ce compte utilise Google. Cliquez sur\u00a0«\u00a0Se connecter avec Google\u00a0».',
        wrong_password: 'Mot de passe incorrect. Vérifiez vos identifiants ou réinitialisez votre mot de passe.',
        popup_closed: 'Connexion Google annulée. Réessayez et validez la fenêtre Google.',
        network: 'Problème réseau. Vérifiez votre connexion internet puis réessayez.',
        offline: 'Vous n\'êtes pas connecté à internet. Vérifiez votre connexion puis réessayez.',
        email_invalid: 'Adresse email invalide. Vérifiez le format (ex\u00a0: nom@exemple.com).',
        fields_required: 'Veuillez saisir votre email et votre mot de passe.',
        generic: 'Erreur de connexion. Réessayez ou contactez le support.',
        memberstack_ko: 'Service temporairement indisponible. Rechargez la page.',
        timeout: 'Session en cours de synchronisation. Réessayez la connexion.',
        rate_limit: 'Veuillez patienter quelques secondes avant de réessayer.'
    };

    /* ── Éléments DOM ───────────────────────────────────────────────── */
    var form = document.getElementById('ms-login-custom');
    var emailInp = document.getElementById('Email-5');
    var passInp = document.getElementById('Password');
    var submitBtn = document.getElementById('ms-login-submit');
    var googleBtn = document.getElementById('ms-google-login-btn') ||
        (form && form.querySelector('[data-auth-provider="google-custom"]'));

    if (!form) { log('form_not_found'); return; }
    if (!googleBtn) { log('google_btn_not_found'); }

    if (emailInp && !emailInp.hasAttribute('autocomplete')) emailInp.setAttribute('autocomplete', 'username');
    if (passInp && !passInp.hasAttribute('autocomplete')) passInp.setAttribute('autocomplete', 'current-password');

    /* ── Loading states ─────────────────────────────────────────────── */
    function setLoading(active) {
        isAuthInFlight = active;
        if (submitBtn) {
            if (!submitBtn._origLabel) submitBtn._origLabel = submitBtn.value || 'Se connecter';
            submitBtn.disabled = active;
            submitBtn.value = active
                ? (submitBtn.getAttribute('data-wait') || 'Connexion…')
                : submitBtn._origLabel;
        }
        if (googleBtn) {
            googleBtn.style.pointerEvents = active ? 'none' : '';
            googleBtn.style.opacity = active ? '0.6' : '';
            googleBtn.setAttribute('aria-disabled', active ? 'true' : 'false');
        }
    }

    function checkRateLimit() {
        if (Date.now() - lastErrorAt < 2000) {
            showInlineError(MSG.rate_limit);
            return true;
        }
        return false;
    }

    function isOffline() {
        return typeof navigator.onLine === 'boolean' && !navigator.onLine;
    }

    /* ── Toggle show/hide password ────────────────────────────────────── */
    (function setupPasswordToggle() {
        var toggleWrap = document.getElementById('transformButton') ||
            document.querySelector('[ms-code-password="transform"]');
        if (!toggleWrap || !passInp) return;

        var tabLinks = toggleWrap.querySelectorAll('.show-password, [data-w-tab]');

        function syncTabs(showClear) {
            tabLinks.forEach(function (link) {
                var tab = link.getAttribute('data-w-tab') || '';
                var isActive = showClear ? tab === 'Hide' : tab === 'Show';
                link.classList.toggle('w--current', isActive);
                link.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
        }

        toggleWrap.addEventListener('click', function (e) {
            var link = e.target.closest('[data-w-tab]');
            if (!link) return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            var tab = link.getAttribute('data-w-tab') || '';
            if (tab === 'Hide') {
                passInp.type = 'text';
                syncTabs(true);
            } else if (tab === 'Show') {
                passInp.type = 'password';
                syncTabs(false);
            }
        }, true);
    })();

    /* ── Message auth_error passé en URL ────────────────────────────── */
    (function checkUrlError() {
        var p = new URLSearchParams(window.location.search || '');
        if (p.get('auth_error') === 'member_timeout') {
            showInlineError(MSG.timeout);
            log('url_auth_error_shown');
        }
    })();

    /* ── Guard "déjà connecté" ──────────────────────────────────────── */
    (async function checkAlreadyLoggedIn() {
        try {
            var p = new URLSearchParams(window.location.search || '');
            if (p.get('logged_out') === '1') { log('skip_preflight_logged_out'); return; }

            var ms = await waitMs(10000);
            if (!ms) { log('preflight_ms_unavailable'); return; }

            var member = await getMember(ms, 5, 250);
            if (member && member.id) {
                log('already_authenticated', { memberId: member.id });
                window.location.replace('/auth/post-login');
            }
        } catch (err) {
            log('preflight_error', { error: String(err && err.message ? err.message : err) });
        }
    })();

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
            var kind = classifyError(err);
            var label = kind === 'no_account' ? MSG.no_account_email
                : kind === 'use_google' ? MSG.use_google
                    : kind === 'wrong_password' ? MSG.wrong_password
                        : kind === 'network' ? MSG.network
                            : MSG.generic;
            showInlineError(label);
            log('email_login_error', { kind: kind, error: String(err && err.message ? err.message : err) });
            setLoading(false);
        }
    });

    /* ── LOGIN GOOGLE (sync user gesture — pas de await avant provider) */
    if (googleBtn) {
        googleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (isAuthInFlight) return;

            if (isOffline()) { showInlineError(MSG.offline); return; }
            if (checkRateLimit()) return;

            hideInlineError();
            setLoading(true);

            var ms = getMemberstackForOAuth();
            if (!ms || typeof ms.loginWithProvider !== 'function') {
                showInlineError(MSG.memberstack_ko);
                log('google_login_error', { kind: 'memberstack_ko' });
                setLoading(false);
                return;
            }

            log('google_login_start');
            ms.loginWithProvider({ provider: 'google', allowSignup: false })
                .then(function () {
                    log('google_login_success');
                    window.location.replace('/auth/post-login');
                })
                .catch(function (err) {
                    lastErrorAt = Date.now();
                    var kind = classifyError(err);
                    showInlineError(googleLoginErrorLabel(err, kind));
                    log('google_login_error', { kind: kind, error: String(err && err.message ? err.message : err) });
                    setLoading(false);
                });
        });
    }

    /* ── Logout robuste ─────────────────────────────────────────────── */
    document.querySelectorAll('[data-ms-action="logout"]').forEach(function (btn) {
        if (btn._logoutBound) return;
        btn._logoutBound = true;
        btn.addEventListener('click', async function (e) {
            e.preventDefault();
            try {
                var ms = await waitMs(8000);
                if (ms && typeof ms.logout === 'function') await ms.logout();
            } catch (_) { }
            localStorage.removeItem('agilotext_mobile_auth');
            localStorage.removeItem('pendingInviteCode');
            sessionStorage.removeItem('_agilo_redirect_count');
            window.location.href = '/auth/login?logged_out=1';
        });
    });

    log('script_ready', { version: 'v7' });
})();
