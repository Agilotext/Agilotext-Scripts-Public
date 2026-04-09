/* @agilotext/agilo-prompt-studio v1.02 — bundle concat-transpile */
(function () {
  "use strict";

const PLACEHOLDER_RE = /\$\{[^}]+\}/g;
const TAG_TO_FILL_RE = /"tag-to-fill"\s*:\s*"\$\{([^}]+)\}"/g;
const TAG_TO_FILL_SINGLE_RE = /"tag-to-fill"\s*:\s*'\$\{([^}]+)\}'/g;
/** Tous les placeholders `${…}` présents dans le HTML. */
function extractPlaceholdersFromHtml(html) {
    const set = new Set();
    let m;
    const re = new RegExp(PLACEHOLDER_RE.source, "g");
    while ((m = re.exec(html)) !== null) {
        set.add(m[0]);
    }
    return [...set].sort();
}
/**
 * Placeholders mentionnés dans le texte du prompt (ex. lignes tag-to-fill JSON).
 * Heuristique : patterns "tag-to-fill": "${...}"
 */
function extractTagToFillsFromPrompt(prompt) {
    const set = new Set();
    let m;
    const r1 = new RegExp(TAG_TO_FILL_RE.source, "g");
    while ((m = r1.exec(prompt)) !== null) {
        set.add(`\${${m[1]}}`);
    }
    const r2 = new RegExp(TAG_TO_FILL_SINGLE_RE.source, "g");
    while ((m = r2.exec(prompt)) !== null) {
        set.add(`\${${m[1]}}`);
    }
    return [...set].sort();
}
/** Placeholders dans le HTML mais jamais cités comme tag-to-fill dans le prompt. */
function placeholdersOnlyInHtml(html, prompt) {
    const inHtml = new Set(extractPlaceholdersFromHtml(html));
    const inPrompt = new Set(extractTagToFillsFromPrompt(prompt));
    return [...inHtml].filter((p) => !inPrompt.has(p));
}
/** Cités dans le prompt mais absents du HTML (approximatif). */
function tagToFillsMissingInHtml(html, prompt) {
    const inHtml = new Set(extractPlaceholdersFromHtml(html));
    const fromPrompt = extractTagToFillsFromPrompt(prompt);
    return fromPrompt.filter((p) => !inHtml.has(p));
}


function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
function buildCombinedExport(modelName, promptText, html) {
    const sep = "\n\n" + "=".repeat(72) + "\n\n";
    return (`Modèle : ${modelName}\n` +
        `Export Agilotext — studio prompts (sans audio)\n` +
        `Date : ${new Date().toISOString()}\n` +
        `${sep}PROMPT (texte)\n${sep}${promptText}\n` +
        `${sep}TEMPLATE HTML\n${sep}${html}\n`);
}


function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
/**
 * Extrait une liste lisible de champs depuis le HTML du template (navigateur : DOMParser).
 */
function parseFormFieldsFromHtml(html) {
    if (typeof DOMParser === "undefined")
        return [];
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [];
    const seen = new Set();
    const push = (id, label, kind) => {
        const tid = id.trim();
        if (!tid || seen.has(tid))
            return;
        seen.add(tid);
        rows.push({ id: tid, label: label.slice(0, 200) || tid, kind });
    };
    doc.querySelectorAll("label[for]").forEach((lab) => {
        const forId = lab.getAttribute("for")?.trim();
        if (!forId)
            return;
        const el = doc.getElementById(forId);
        let kind = "other";
        if (el) {
            const tag = el.tagName.toLowerCase();
            if (tag === "textarea")
                kind = "textarea";
            else if (tag === "input")
                kind = "input";
        }
        push(forId, lab.textContent?.trim() || "", kind);
    });
    doc.querySelectorAll("input[id], textarea[id]").forEach((el) => {
        const id = el.getAttribute("id")?.trim();
        if (!id || seen.has(id))
            return;
        const tag = el.tagName.toLowerCase();
        const kind = tag === "textarea" ? "textarea" : "input";
        let label = "";
        if (el instanceof HTMLInputElement && el.type === "radio") {
            const l = doc.querySelector(`label[for="${escapeAttr(id)}"]`);
            label = l?.textContent?.trim() || id;
        }
        push(id, label || id, kind);
    });
    doc.querySelectorAll(".textarea-like[id], div.remarks[id], [id].textarea-like").forEach((el) => {
        const id = el.getAttribute("id")?.trim();
        if (!id || seen.has(id))
            return;
        const prev = el.previousElementSibling;
        const label = prev?.tagName === "LABEL"
            ? prev.textContent?.trim() || ""
            : el.closest("div")?.querySelector(".question-label, .label, strong")?.textContent?.trim() || id;
        push(id, label, "other");
    });
    return rows;
}


/**
 * Extraction du texte utile depuis la réponse de getPromptModelContent.
 * Évite d'afficher tout le JSON serveur quand le corps est dans promptModelContent.
 */
function extractPromptTextFromContentResponse(res) {
    if (typeof res === "string")
        return res;
    if (res && typeof res === "object") {
        const o = res;
        const keys = [
            "promptModelContent",
            "promptContent",
            "content",
            "text",
            "result",
            "promptText",
            "prompt",
        ];
        for (const k of keys) {
            const c = o[k];
            if (typeof c === "string")
                return c;
        }
    }
    return typeof res === "object" ? JSON.stringify(res) : String(res ?? "");
}


/** Messages utilisateur pour les codes erreur API template (évite d’afficher les identifiants bruts). */
function humanizeTemplateKoMessage(errorMessage) {
    const raw = errorMessage.trim();
    if (!raw) {
        return "Le serveur n’a pas pu charger la mise en page HTML. Réessayez dans un instant ou contactez le support si cela continue.";
    }
    const norm = raw.toLowerCase().replace(/\s+/g, "_");
    if (norm.includes("error_no_template") || norm === "error_no_template_for_prompt_id") {
        return "Aucune mise en page HTML n’est associée à ce modèle pour l’instant. Vous pouvez continuer à modifier le prompt ; l’aperçu, les champs du formulaire et l’HTML seront disponibles dès qu’un template aura été ajouté (import depuis l’onglet HTML si votre compte le permet, ou via l’équipe Agilotext).";
    }
    if (norm.includes("not_found") || norm.includes("introuvable")) {
        return "Le template HTML demandé est introuvable côté serveur. Vérifiez que le modèle est bien configuré ou contactez le support Agilotext.";
    }
    if (norm.includes("forbidden") || norm.includes("unauthorized") || norm.includes("access_denied")) {
        return "Vous n’avez pas les droits nécessaires pour récupérer ce template HTML. Reconnectez-vous ou contactez votre administrateur.";
    }
    /* Code machine seul (ex. error_xyz) → phrase générique sans jargon inutile */
    if (/^error_[a-z0-9_]+$/i.test(raw.split(/\s/)[0] ?? "")) {
        return "Le serveur n’a pas pu fournir le template HTML. Réessayez plus tard ou contactez le support Agilotext en précisant le modèle concerné.";
    }
    return raw;
}
function parseJsonSafe(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
function extractPromptList(payload) {
    const candidates = [
        payload.promptModeInfoDTOList,
        payload.promptModelList,
        payload.promptModelsUserInfoDtos,
        payload.promptModelsUserInfo,
    ];
    for (const value of candidates) {
        if (Array.isArray(value))
            return value;
    }
    return [];
}
function normalizeTemplateResponse(data) {
    if (typeof data === "string")
        return data;
    if (data && typeof data === "object") {
        const o = data;
        const t = o.template ?? o.html ?? o.content ?? o.body;
        if (typeof t === "string")
            return t;
    }
    return typeof data === "object" ? JSON.stringify(data) : String(data ?? "");
}
class AgilotextPromptsClient {
    apiBase;
    getAuth;
    constructor(apiBase, getAuth) {
        this.apiBase = apiBase.replace(/\/+$/, "");
        this.getAuth = getAuth;
    }
    authBody() {
        const a = this.getAuth();
        if (!a?.username || !a?.token)
            throw new Error("Authentification Agilotext manquante (token ou email).");
        const body = new URLSearchParams();
        body.set("username", a.username);
        body.set("token", a.token);
        body.set("edition", a.edition || "ent");
        return body;
    }
    async postUrlEncoded(endpoint, params = {}) {
        const body = this.authBody();
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null)
                body.append(k, String(v));
        }
        const res = await fetch(`${this.apiBase}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const text = await res.text();
        const data = parseJsonSafe(text);
        if (!res.ok)
            throw new Error(`${endpoint}: HTTP ${res.status} ${text.slice(0, 400)}`);
        if (data && data.status === "KO") {
            const msg = data.errorMessage || JSON.stringify(data);
            throw new Error(`${endpoint}: ${msg}`);
        }
        return data ?? text;
    }
    async postMultipart(endpoint, params, fileFieldName, blob, filename, mimeType) {
        const a = this.getAuth();
        if (!a?.username || !a?.token)
            throw new Error("Authentification Agilotext manquante.");
        const form = new FormData();
        form.append("username", a.username);
        form.append("token", a.token);
        form.append("edition", a.edition || "ent");
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null)
                form.append(k, String(v));
        }
        form.append(fileFieldName, blob, filename);
        const res = await fetch(`${this.apiBase}${endpoint}`, { method: "POST", body: form });
        const text = await res.text();
        const data = parseJsonSafe(text);
        if (!res.ok)
            throw new Error(`${endpoint}: HTTP ${res.status} ${text.slice(0, 400)}`);
        if (data && data.status === "KO") {
            const msg = data.errorMessage || JSON.stringify(data);
            throw new Error(`${endpoint}: ${msg}`);
        }
        return data ?? text;
    }
    async listPrompts() {
        const info = await this.postUrlEncoded("/getPromptModelsUserInfo");
        const list = extractPromptList(info || {});
        const out = [];
        for (const p of list) {
            if (!p || typeof p !== "object")
                continue;
            const row = p;
            const name = String(row.promptModelName ?? row.promptName ?? row.name ?? "").trim();
            const id = row.promptModelId ?? row.promptId ?? row.id;
            if (id === undefined || id === null || String(id).trim() === "")
                continue;
            out.push({ promptId: String(id), name: name || `Modèle ${id}` });
        }
        return out;
    }
    async getPromptContentResponse(promptId) {
        return this.postUrlEncoded("/getPromptModelContent", { promptId });
    }
    async getPromptContent(promptId) {
        const res = await this.getPromptContentResponse(promptId);
        return extractPromptTextFromContentResponse(res);
    }
    /**
     * Ne lance pas : en cas d’échec réseau ou KO API, retourne { ok: false } pour ne pas bloquer l’affichage du prompt.
     */
    async loadTemplateHtml(promptId) {
        let body;
        try {
            body = this.authBody();
        }
        catch (e) {
            return {
                ok: false,
                kind: "api",
                message: e instanceof Error ? e.message : String(e),
            };
        }
        body.set("promptId", String(promptId));
        let res;
        try {
            res = await fetch(`${this.apiBase}/receivePromptModelTemplate`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
            });
        }
        catch (e) {
            return {
                ok: false,
                kind: "network",
                message: e instanceof Error
                    ? `Connexion impossible (${e.message}). Vérifiez votre réseau, puis cliquez sur « Réessayer ».`
                    : "Connexion au serveur Agilotext impossible. Vérifiez votre réseau, puis cliquez sur « Réessayer ».",
            };
        }
        const text = await res.text();
        if (!res.ok) {
            const kind = res.status >= 500 ? "api" : "network";
            const hint = res.status >= 500
                ? "Une erreur côté serveur empêche de charger le template. Réessayez dans quelques minutes."
                : "La requête du template n’a pas abouti. Vérifiez la session ou réessayez.";
            return {
                ok: false,
                kind,
                message: `${hint} (code ${res.status})`,
            };
        }
        const data = parseJsonSafe(text);
        if (data && data.status === "KO") {
            const raw = String(data.errorMessage ?? "").trim();
            return {
                ok: false,
                kind: "api",
                message: humanizeTemplateKoMessage(raw || "Réponse serveur inattendue pour le template HTML."),
            };
        }
        if (data && typeof data === "object") {
            const html = normalizeTemplateResponse(data);
            return { ok: true, html };
        }
        return { ok: true, html: text };
    }
    /** @deprecated Préférer loadTemplateHtml ; conservé si appelants externes. */
    async getTemplateHtml(promptId) {
        const r = await this.loadTemplateHtml(promptId);
        if (!r.ok)
            throw new Error(r.message);
        return r.html;
    }
    /** Aligné sur deploy_dimmup_cr.mjs : URL-encoded, pas multipart fichier. */
    async updatePromptText(promptId, promptContent, promptName) {
        return this.postUrlEncoded("/updatePromptModelUser", {
            promptId,
            promptContent,
            promptName,
            promptModelName: promptName,
        });
    }
    async updateTemplateFile(promptId, promptContent, promptName, html) {
        const blob = new Blob([html], { type: "text/html;charset=utf-8" });
        return this.postMultipart("/updatePromptModelFileUser", { promptId, promptContent, promptName }, "fileUpload", blob, "template.html", "text/html");
    }
    async getPromptStatus(promptId) {
        const res = await this.postUrlEncoded("/getPromptModelUserStatus", { promptId });
        const o = res || {};
        const status = String(o.promptModelStatus ?? o.status ?? "").toUpperCase();
        return { status, raw: res };
    }
    async waitPromptReady(promptId, opts) {
        const maxMs = opts?.maxMs ?? 240_000;
        const pollMs = opts?.pollMs ?? 2000;
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            const { status } = await this.getPromptStatus(promptId);
            opts?.onTick?.({ elapsedMs: Date.now() - start, status, maxMs });
            if (status === "READY" || status === "ACTIVE")
                return true;
            if (status.includes("ERROR") || status.includes("KO"))
                return false;
            await new Promise((r) => setTimeout(r, pollMs));
        }
        return false;
    }
}


function mountTextarea(parent, initial, opts) {
    const minHeight = opts?.minHeight ?? "220px";
    const ta = document.createElement("textarea");
    ta.className = "agilo-ps-native-editor";
    ta.value = initial;
    ta.spellcheck = false;
    ta.style.minHeight = minHeight;
    const onInput = opts?.onChange;
    let enterBreakHandledThisTick = false;
    const insertLineBreakAtCaret = () => {
        const start = ta.selectionStart ?? 0;
        const end = ta.selectionEnd ?? 0;
        ta.value = ta.value.slice(0, start) + "\n" + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
        onInput?.();
    };
    const onEnterKeydown = (e) => {
        if (e.key !== "Enter")
            return;
        if (e.isComposing)
            return;
        // Prise de contrôle totale : Webflow / OpenTech / extensions peuvent court-circuiter le défaut
        // (keydown ou beforeinput) ; on n’attend plus defaultPrevented ni queueMicrotask.
        e.preventDefault();
        e.stopPropagation();
        enterBreakHandledThisTick = true;
        insertLineBreakAtCaret();
        queueMicrotask(() => {
            enterBreakHandledThisTick = false;
        });
    };
    // Capture = avant les listeners bulle du textarea (ex. OpenTech UX). Enregistré en premier sur
    // l’élément tout juste créé, on reste avant les handlers ajoutés après coup sur le même nœud.
    ta.addEventListener("keydown", onEnterKeydown, true);
    // Filet si le navigateur n’applique le saut de ligne que via beforeinput (mobile / IME fin).
    ta.addEventListener("beforeinput", (e) => {
        if (e.inputType !== "insertLineBreak" && e.inputType !== "insertParagraph")
            return;
        if (e.isComposing)
            return;
        e.preventDefault();
        e.stopPropagation();
        if (enterBreakHandledThisTick)
            return;
        insertLineBreakAtCaret();
    }, true);
    if (onInput)
        ta.addEventListener("input", onInput);
    parent.append(ta);
    return {
        setValue: (v) => {
            ta.value = v;
        },
        getValue: () => ta.value,
        destroy: () => {
            if (onInput)
                ta.removeEventListener("input", onInput);
            ta.remove();
        },
    };
}
/** Éditeur texte brut (prompt) — textarea monospace ; CodeMirror optionnel en upgrade. */
function createTextEditor(parent, initial, opts) {
    return mountTextarea(parent, initial, { ...opts, minHeight: opts?.minHeight ?? "220px" });
}
/** Éditeur HTML — même composant ; coloration syntaxique possible via upgrade CodeMirror. */
function createHtmlEditor(parent, initial, _dark = true, opts) {
    void _dark;
    return mountTextarea(parent, initial, { ...opts, minHeight: opts?.minHeight ?? "400px" });
}


function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function escapeCssAttr(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function")
        return CSS.escape(value);
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function prependSaveDiskIcon(btn) {
    const wrap = document.createElement("span");
    wrap.className = "agilo-ps-btn-save-icon";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
    btn.prepend(wrap);
    btn.classList.add("agilo-ps-btn--with-icon");
}
function isLikelyAuthError(message) {
    const m = message.toLowerCase();
    return (m.includes("401") ||
        m.includes("403") ||
        m.includes("unauthorized") ||
        m.includes("forbidden") ||
        m.includes("token") ||
        m.includes("session") ||
        m.includes("authentif"));
}
class StudioApp {
    client;
    cfg;
    modal = null;
    previousActive = null;
    promptEditor = null;
    htmlEditor = null;
    promptMountEl = null;
    htmlMountEl = null;
    previewIframe = null;
    /** URL blob pour l’aperçu (évite bugs srcdoc + onglet masqué ; révoquée au changement d’onglet). */
    previewObjectUrl = null;
    listMountRef = null;
    mainColRef = null;
    errBoxRef = null;
    statusBarRef = null;
    loadGeneration = 0;
    saving = false;
    saveBtns = [];
    dirtyIndicatorEl = null;
    fieldsPanelBody = null;
    consistencyPanelBody = null;
    tabNavButtons = [];
    tabNavNames = [];
    tabTrapHandler = null;
    arrowNavHandler = null;
    previewIframeDebounce = null;
    previewEmptyNoteEl = null;
    savePromptBtnRef = null;
    saveHtmlBtnRef = null;
    saveAllBtnRef = null;
    dirtyBannerEl = null;
    activateDetailTabFn = null;
    activeDetailTab = "Prompt";
    state = null;
    constructor(getAuth, cfg) {
        const mode = cfg.studioMode === "simple" ? "simple" : "expert";
        this.cfg = {
            readOnly: cfg.readOnly !== false,
            editHtml: cfg.editHtml === true,
            showFieldList: cfg.showFieldList !== false,
            showConsistencyTab: cfg.showConsistencyTab !== false,
            showPreviewTab: cfg.showPreviewTab !== false,
            apiBase: cfg.apiBase || "https://api.agilotext.com/api/v1",
            studioMode: mode,
            ...cfg,
        };
        this.client = new AgilotextPromptsClient(this.cfg.apiBase, getAuth);
    }
    showHtmlTab() {
        return this.cfg.studioMode === "expert" || (!this.cfg.readOnly && this.cfg.editHtml);
    }
    showConsistencyEffective() {
        return this.cfg.showConsistencyTab && this.showHtmlTab();
    }
    getCurrentPromptText() {
        const s = this.state;
        if (!s)
            return "";
        return this.promptEditor?.getValue() ?? s.promptText;
    }
    getCurrentHtml() {
        const s = this.state;
        if (!s)
            return "";
        return this.htmlEditor?.getValue() ?? s.html;
    }
    isDirty() {
        const s = this.state;
        if (!s || this.cfg.readOnly)
            return false;
        if (this.getCurrentPromptText() !== s.promptText)
            return true;
        if (this.cfg.editHtml && this.getCurrentHtml() !== s.html)
            return true;
        return false;
    }
    updateDirtyIndicator() {
        if (!this.dirtyIndicatorEl)
            return;
        const d = this.isDirty();
        this.dirtyIndicatorEl.hidden = !d;
        this.dirtyIndicatorEl.textContent = d ? "Modifications non enregistrées" : "";
        this.updateDirtyBanner();
        this.updateSaveButtonsVisibility(this.activeDetailTab);
    }
    updateDirtyBanner() {
        const box = this.dirtyBannerEl;
        if (!box)
            return;
        const d = this.isDirty();
        box.hidden = !d;
    }
    updateSaveButtonsVisibility(tab) {
        this.activeDetailTab = tab;
        const sp = this.savePromptBtnRef;
        const sh = this.saveHtmlBtnRef;
        const sa = this.saveAllBtnRef;
        if (this.cfg.readOnly)
            return;
        if (!this.cfg.editHtml) {
            if (sp)
                sp.hidden = tab !== "Prompt";
            return;
        }
        if (sp)
            sp.hidden = tab !== "Prompt";
        if (sh)
            sh.hidden = tab !== "HTML";
        if (sa)
            sa.hidden = false;
    }
    registerSaveBtn(btn) {
        this.saveBtns.push(btn);
        btn.disabled = this.saving;
    }
    setSaving(busy) {
        this.saving = busy;
        for (const b of this.saveBtns) {
            b.disabled = busy;
        }
    }
    confirmDiscardIfDirty() {
        if (!this.isDirty())
            return true;
        return window.confirm("Des modifications ne sont pas enregistrées. Les abandonner ?");
    }
    refreshFieldsPanel() {
        const mount = this.fieldsPanelBody;
        const s = this.state;
        if (!mount || !s)
            return;
        mount.replaceChildren();
        const html = this.getCurrentHtml();
        const fields = parseFormFieldsFromHtml(html);
        const table = el("div", "agilo-ps-field-table");
        for (const f of fields) {
            const row = el("div", "agilo-ps-field-row");
            row.append(el("span", "agilo-ps-field-id", f.id), el("span", "agilo-ps-field-label", f.label), el("span", "agilo-ps-field-kind", f.kind));
            table.append(row);
        }
        if (fields.length === 0) {
            const msg = html.trim().length === 0
                ? "Pas de HTML : aucun champ détecté. Ajoutez un template ou ouvrez un modèle qui en contient un."
                : "Aucun champ détecté automatiquement (voir onglet HTML).";
            table.append(el("p", "agilo-ps-muted", msg));
        }
        mount.append(table);
    }
    refreshConsistencyPanel() {
        const mount = this.consistencyPanelBody;
        const s = this.state;
        if (!mount || !s)
            return;
        mount.replaceChildren();
        const html = this.getCurrentHtml();
        const promptText = this.getCurrentPromptText();
        if (!html.trim()) {
            mount.append(el("p", "agilo-ps-muted", "Sans HTML, l’analyse de cohérence des placeholders est limitée."), el("p", "agilo-ps-muted", "Ajoutez un template pour comparer placeholders et consignes du prompt."));
            return;
        }
        const onlyHtml = placeholdersOnlyInHtml(html, promptText);
        const missing = tagToFillsMissingInHtml(html, promptText);
        const allPh = extractPlaceholdersFromHtml(html);
        mount.append(el("p", "agilo-ps-muted", `${allPh.length} placeholder(s) dans le HTML (texte courant).`), el("h4", "agilo-ps-h4", "Dans le HTML mais peu ou pas cités comme tag-to-fill dans le prompt"), renderList(onlyHtml), el("h4", "agilo-ps-h4", "Cités dans le prompt (tag-to-fill) mais absents du HTML"), renderList(missing));
    }
    installModalKeyboardNav(panel) {
        const trap = (e) => {
            if (e.key !== "Tab" || !this.modal)
                return;
            const root = this.modal;
            const sel = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
            const focusables = Array.from(root.querySelectorAll(sel)).filter((node) => !node.hasAttribute("disabled") && node.tabIndex !== -1);
            if (focusables.length === 0)
                return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (e.shiftKey) {
                if (active === first || !focusables.includes(active)) {
                    e.preventDefault();
                    last.focus();
                }
            }
            else {
                if (active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        this.tabTrapHandler = trap;
        panel.addEventListener("keydown", trap);
        const arrows = (e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight")
                return;
            const target = e.target;
            if (!target.classList.contains("agilo-ps-tab"))
                return;
            const tabs = this.tabNavButtons;
            if (tabs.length === 0)
                return;
            const i = tabs.indexOf(target);
            if (i < 0)
                return;
            e.preventDefault();
            const next = e.key === "ArrowRight"
                ? tabs[(i + 1) % tabs.length]
                : tabs[(i - 1 + tabs.length) % tabs.length];
            next?.focus();
            next?.click();
        };
        this.arrowNavHandler = arrows;
        panel.addEventListener("keydown", arrows);
    }
    removeModalKeyboardNav(panel) {
        if (this.tabTrapHandler) {
            panel.removeEventListener("keydown", this.tabTrapHandler);
            this.tabTrapHandler = null;
        }
        if (this.arrowNavHandler) {
            panel.removeEventListener("keydown", this.arrowNavHandler);
            this.arrowNavHandler = null;
        }
    }
    async open(opts) {
        this.closeWithoutConfirm();
        this.modal = el("div", "agilo-ps-overlay");
        this.modal.setAttribute("role", "dialog");
        this.modal.setAttribute("aria-modal", "true");
        this.modal.setAttribute("aria-label", "Studio modèles Agilotext");
        const panel = el("div", "agilo-ps-panel");
        const accent = typeof this.cfg.themeAccent === "string" ? this.cfg.themeAccent.trim() : "";
        if (accent)
            panel.style.setProperty("--agilo-ps-accent", accent);
        const header = el("div", "agilo-ps-header");
        const headerText = el("div", "agilo-ps-header-text");
        const title = el("h2", "agilo-ps-title", "Modèles de comptes rendus");
        const hint = el("p", "agilo-ps-hint");
        hint.textContent =
            "Consulter ou exporter le contenu ne lance pas de transcription et ne consomme pas d’audio.";
        headerText.append(title, hint);
        const closeBtn = el("button", "agilo-ps-close-btn");
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "Fermer le studio");
        const closeIcon = el("span", "agilo-ps-close-btn-icon");
        closeIcon.setAttribute("aria-hidden", "true");
        closeIcon.textContent = "×";
        closeBtn.append(closeIcon);
        closeBtn.addEventListener("click", () => this.close());
        header.append(headerText, closeBtn);
        const body = el("div", "agilo-ps-body");
        const listCol = el("div", "agilo-ps-listcol");
        const listTitle = el("h3", "agilo-ps-subtitle", "Vos modèles");
        listTitle.tabIndex = -1;
        const listMount = el("div", "agilo-ps-list");
        this.listMountRef = listMount;
        const errBox = el("div", "agilo-ps-error");
        errBox.id = "agilo-ps-error-live";
        errBox.setAttribute("role", "alert");
        errBox.setAttribute("aria-live", "assertive");
        errBox.hidden = true;
        listCol.append(listTitle, errBox, listMount);
        const mainCol = el("div", "agilo-ps-main");
        this.mainColRef = mainCol;
        this.errBoxRef = errBox;
        mainCol.append(el("p", "agilo-ps-placeholder", "Sélectionnez un modèle à gauche."));
        body.append(listCol, mainCol);
        panel.append(header, body);
        this.modal.append(panel);
        document.body.appendChild(this.modal);
        document.body.classList.add("agilo-ps-scroll-lock");
        this.previousActive = document.activeElement;
        this.installModalKeyboardNav(panel);
        this.modal.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                this.close();
            }
        });
        try {
            const prompts = await this.client.listPrompts();
            listMount.replaceChildren();
            if (prompts.length === 0) {
                listMount.append(el("p", "agilo-ps-muted", "Aucun modèle trouvé."));
                return;
            }
            for (const p of prompts) {
                const row = el("button", "agilo-ps-list-item");
                row.type = "button";
                row.dataset.promptId = p.promptId;
                const name = el("span", "agilo-ps-list-item-name", p.name);
                const id = el("span", "agilo-ps-list-item-id", `id ${p.promptId}`);
                row.append(name, id);
                row.addEventListener("click", () => {
                    if (!this.confirmDiscardIfDirty())
                        return;
                    listMount.querySelectorAll(".agilo-ps-list-item").forEach((b) => {
                        b.classList.remove("agilo-ps-list-item--active");
                    });
                    row.classList.add("agilo-ps-list-item--active");
                    void this.loadPrompt(p.promptId, p.name, mainCol, errBox);
                });
                listMount.append(row);
            }
            if (opts?.selectPromptId) {
                const id = String(opts.selectPromptId);
                const target = listMount.querySelector(`[data-prompt-id="${escapeCssAttr(id)}"]`);
                if (target) {
                    target.click();
                }
                else {
                    errBox.hidden = false;
                    errBox.textContent = `Modèle id ${id} introuvable dans votre liste.`;
                }
            }
        }
        catch (e) {
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
        }
        this.focusInitialListColumn(listMount, listTitle, errBox);
    }
    focusInitialListColumn(listMount, listTitle, errBox) {
        if (!errBox.hidden && errBox.textContent?.trim()) {
            errBox.tabIndex = -1;
            errBox.focus();
            return;
        }
        const first = listMount.querySelector(".agilo-ps-list-item");
        if (first) {
            first.focus();
            return;
        }
        listTitle.focus();
    }
    async loadPrompt(promptId, promptName, mainCol, errBox) {
        this.loadGeneration += 1;
        const gen = this.loadGeneration;
        errBox.hidden = true;
        errBox.textContent = "";
        mainCol.replaceChildren(el("p", "agilo-ps-muted", "Chargement…"));
        try {
            const rawRes = await this.client.getPromptContentResponse(promptId);
            if (gen !== this.loadGeneration)
                return;
            const promptText = extractPromptTextFromContentResponse(rawRes);
            const rawPayloadJson = rawRes !== null && typeof rawRes === "object"
                ? JSON.stringify(rawRes, null, 2)
                : String(rawRes ?? "");
            const tmpl = await this.client.loadTemplateHtml(promptId);
            if (gen !== this.loadGeneration)
                return;
            let html = "";
            let templateWarning;
            if (tmpl.ok) {
                html = tmpl.html;
            }
            else {
                templateWarning = { kind: tmpl.kind, message: tmpl.message };
            }
            this.state = {
                promptId,
                promptName,
                promptText,
                html,
                rawPayloadJson,
                templateWarning,
            };
            this.teardownEditors();
            this.renderDetail(mainCol, errBox);
        }
        catch (e) {
            if (gen !== this.loadGeneration)
                return;
            mainCol.replaceChildren();
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
        }
    }
    releasePreviewObjectUrl() {
        if (this.previewObjectUrl) {
            URL.revokeObjectURL(this.previewObjectUrl);
            this.previewObjectUrl = null;
        }
    }
    /** Vide l’iframe (à la sortie de l’onglet Aperçu ou HTML vide). */
    clearPreviewIframeContent() {
        if (!this.previewIframe)
            return;
        this.releasePreviewObjectUrl();
        this.previewIframe.removeAttribute("srcdoc");
        try {
            this.previewIframe.src = "about:blank";
        }
        catch {
            /* IE / edge cases */
        }
    }
    teardownEditors() {
        if (this.previewIframeDebounce !== null) {
            clearTimeout(this.previewIframeDebounce);
            this.previewIframeDebounce = null;
        }
        this.releasePreviewObjectUrl();
        this.promptEditor?.destroy();
        this.htmlEditor?.destroy();
        this.promptEditor = null;
        this.htmlEditor = null;
        this.promptMountEl = null;
        this.htmlMountEl = null;
        this.previewIframe = null;
        this.statusBarRef = null;
        this.saveBtns = [];
        this.dirtyIndicatorEl = null;
        this.fieldsPanelBody = null;
        this.consistencyPanelBody = null;
        this.tabNavButtons = [];
        this.tabNavNames = [];
        this.savePromptBtnRef = null;
        this.saveHtmlBtnRef = null;
        this.saveAllBtnRef = null;
        this.dirtyBannerEl = null;
        this.activateDetailTabFn = null;
        this.previewEmptyNoteEl = null;
    }
    mountPromptEditor() {
        if (this.promptEditor || !this.state || this.cfg.readOnly || !this.promptMountEl)
            return;
        this.promptMountEl.replaceChildren();
        const onDirty = () => this.updateDirtyIndicator();
        this.promptEditor = createTextEditor(this.promptMountEl, this.state.promptText, {
            onChange: onDirty,
        });
    }
    mountHtmlEditor() {
        if (this.htmlEditor || !this.state || !this.cfg.editHtml || this.cfg.readOnly || !this.htmlMountEl)
            return;
        this.htmlMountEl.replaceChildren();
        const onDirty = () => {
            this.updateDirtyIndicator();
            this.schedulePreviewFromHtmlEditor();
        };
        this.htmlEditor = createHtmlEditor(this.htmlMountEl, this.state.html, true, {
            onChange: onDirty,
        });
    }
    setStatus(text, busy) {
        if (!this.statusBarRef)
            return;
        this.statusBarRef.hidden = !text && !busy;
        this.statusBarRef.textContent = text;
        this.statusBarRef.classList.toggle("agilo-ps-status--busy", busy);
    }
    updatePreviewIframe() {
        if (!this.previewIframe || !this.state)
            return;
        const h = this.getCurrentHtml().trim();
        if (this.previewEmptyNoteEl) {
            this.previewEmptyNoteEl.hidden = h.length > 0;
        }
        if (this.activeDetailTab !== "Aperçu") {
            return;
        }
        if (!h) {
            this.clearPreviewIframeContent();
            return;
        }
        const frame = this.previewIframe;
        this.releasePreviewObjectUrl();
        const blob = new Blob([h], { type: "text/html;charset=utf-8" });
        this.previewObjectUrl = URL.createObjectURL(blob);
        frame.removeAttribute("srcdoc");
        frame.src = this.previewObjectUrl;
    }
    /** Aperçu synchronisé pendant la frappe HTML (iframe déjà dans le DOM). */
    schedulePreviewFromHtmlEditor() {
        if (!this.previewIframe)
            return;
        if (this.previewIframeDebounce !== null)
            clearTimeout(this.previewIframeDebounce);
        this.previewIframeDebounce = window.setTimeout(() => {
            this.previewIframeDebounce = null;
            if (this.activeDetailTab === "Aperçu") {
                this.updatePreviewIframe();
            }
        }, 320);
    }
    renderDetail(mainCol, errBox) {
        const s = this.state;
        if (!s)
            return;
        mainCol.replaceChildren();
        this.saveBtns = [];
        this.dirtyBannerEl = null;
        this.previewEmptyNoteEl = null;
        this.savePromptBtnRef = null;
        this.saveHtmlBtnRef = null;
        this.saveAllBtnRef = null;
        const statusBar = el("div", "agilo-ps-status");
        statusBar.setAttribute("aria-live", "polite");
        statusBar.hidden = true;
        this.statusBarRef = statusBar;
        let warnBanner = null;
        if (s.templateWarning) {
            const banner = el("div", "agilo-ps-banner agilo-ps-banner--warn");
            const msg = el("p", "agilo-ps-banner-text");
            msg.textContent = s.templateWarning.message;
            const retry = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Réessayer");
            retry.type = "button";
            retry.addEventListener("click", () => {
                if (!this.confirmDiscardIfDirty())
                    return;
                if (this.mainColRef && this.errBoxRef) {
                    void this.loadPrompt(s.promptId, s.promptName, this.mainColRef, this.errBoxRef);
                }
            });
            banner.append(msg, retry);
            warnBanner = banner;
        }
        const toolbar = el("div", "agilo-ps-toolbar");
        toolbar.append(el("h3", "agilo-ps-subtitle", s.promptName));
        const dirtyInd = el("span", "agilo-ps-dirty-badge");
        dirtyInd.hidden = true;
        this.dirtyIndicatorEl = dirtyInd;
        toolbar.append(dirtyInd);
        const exportGroup = el("div", "agilo-ps-btn-group");
        const b1 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le prompt (.txt)");
        b1.type = "button";
        b1.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-prompt.txt`, this.getCurrentPromptText()));
        const b2 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le HTML (.html)");
        b2.type = "button";
        const curHtml = this.getCurrentHtml();
        const hasHtml = curHtml.trim().length > 0;
        b2.disabled = this.cfg.readOnly && !hasHtml;
        b2.title = hasHtml ? "" : "Aucun contenu HTML pour l’instant (éditez l’onglet HTML si besoin).";
        b2.addEventListener("click", () => {
            const h = this.getCurrentHtml();
            if (!h.trim())
                return;
            downloadTextFile(`${sanitizeFilename(s.promptName)}-template.html`, h, "text/html;charset=utf-8");
        });
        const b3 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger tout (.txt)");
        b3.type = "button";
        b3.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-export-complet.txt`, buildCombinedExport(s.promptName, this.getCurrentPromptText(), this.getCurrentHtml())));
        exportGroup.append(b1, b2, b3);
        toolbar.append(exportGroup);
        if (this.cfg.studioMode === "simple" &&
            (this.cfg.readOnly || !this.cfg.editHtml)) {
            const help = el("div", "agilo-ps-simple-help");
            help.append(el("p", "agilo-ps-simple-help-title", "Conseils"));
            const ul = el("ul", "agilo-ps-simple-help-list");
            const tips = [
                "Le texte ci-dessous guide l’IA : ton, structure et règles de sortie.",
                "Évitez de supprimer les consignes critiques (JSON, placeholders, etc.) sans les comprendre.",
                "Pour modifier la mise en page du document généré, utilisez le lien ci-dessous ou demandez l’activation de l’édition (expert / droits API).",
            ];
            for (const t of tips) {
                ul.append(el("li", "agilo-ps-simple-help-li", t));
            }
            help.append(ul);
            const url = this.cfg.designHelpUrl?.trim();
            if (url) {
                const a = document.createElement("a");
                a.className = "agilo-ps-btn agilo-ps-btn--primary agilo-ps-cta-design";
                a.href = url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.textContent = "Faire évoluer mon modèle";
                help.append(a);
            }
            else {
                help.append(el("p", "agilo-ps-muted agilo-ps-cta-hint", "Besoin d’un changement de design ? Contactez le support Agilotext ou définissez designHelpUrl dans la config."));
            }
            toolbar.append(help);
        }
        let saveFooter = null;
        if (!this.cfg.readOnly) {
            const saveGroup = el("div", "agilo-ps-btn-group agilo-ps-save-group");
            const savePrompt = el("button", "agilo-ps-btn agilo-ps-btn--primary button save", "Enregistrer le prompt");
            savePrompt.type = "button";
            prependSaveDiskIcon(savePrompt);
            savePrompt.addEventListener("click", () => void this.savePrompt(errBox));
            saveGroup.append(savePrompt);
            this.registerSaveBtn(savePrompt);
            this.savePromptBtnRef = savePrompt;
            if (this.cfg.editHtml) {
                const saveHtml = el("button", "agilo-ps-btn agilo-ps-btn--primary button save", "Enregistrer le HTML");
                saveHtml.type = "button";
                prependSaveDiskIcon(saveHtml);
                saveHtml.addEventListener("click", () => void this.saveHtml(errBox));
                saveGroup.append(saveHtml);
                this.registerSaveBtn(saveHtml);
                this.saveHtmlBtnRef = saveHtml;
                const saveAll = el("button", "agilo-ps-btn agilo-ps-btn--secondary button is-secondary", "Enregistrer tout");
                saveAll.type = "button";
                prependSaveDiskIcon(saveAll);
                saveAll.title = "Enregistre le prompt puis le fichier HTML (deux étapes côté serveur).";
                saveAll.addEventListener("click", () => void this.saveAll(errBox));
                saveGroup.append(saveAll);
                this.registerSaveBtn(saveAll);
                this.saveAllBtnRef = saveAll;
            }
            saveFooter = el("div", "agilo-ps-main-footer");
            saveFooter.append(saveGroup);
        }
        let dirtyBanner = null;
        if (!this.cfg.readOnly) {
            dirtyBanner = el("div", "agilo-ps-dirty-banner");
            dirtyBanner.setAttribute("role", "status");
            dirtyBanner.setAttribute("aria-live", "polite");
            dirtyBanner.hidden = true;
            const dirtyBannerText = el("p", "agilo-ps-dirty-banner-text");
            dirtyBannerText.textContent =
                "Modifications non enregistrées — pensez à enregistrer avant de fermer, ou poursuivez la navigation entre onglets.";
            const dirtyActions = el("div", "agilo-ps-dirty-banner-actions");
            const goPrompt = el("button", "agilo-ps-btn agilo-ps-btn--ghost", "Aller au prompt");
            goPrompt.type = "button";
            goPrompt.addEventListener("click", () => this.activateDetailTabFn?.("Prompt"));
            dirtyActions.append(goPrompt);
            if (this.showHtmlTab()) {
                const goHtml = el("button", "agilo-ps-btn agilo-ps-btn--ghost", "Aller au HTML");
                goHtml.type = "button";
                goHtml.addEventListener("click", () => this.activateDetailTabFn?.("HTML"));
                dirtyActions.append(goHtml);
            }
            dirtyBanner.append(dirtyBannerText, dirtyActions);
            this.dirtyBannerEl = dirtyBanner;
        }
        const tabNames = ["Prompt"];
        if (this.cfg.showPreviewTab)
            tabNames.push("Aperçu");
        if (this.cfg.showFieldList)
            tabNames.push("Champs");
        if (this.showHtmlTab()) {
            tabNames.push("HTML");
            if (this.showConsistencyEffective())
                tabNames.push("Cohérence");
        }
        const tabs = el("div", "agilo-ps-tabs");
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Contenu du modèle");
        const tabButtons = [];
        const panels = new Map();
        this.tabNavButtons = tabButtons;
        this.tabNavNames = tabNames;
        const activate = (name) => {
            this.activeDetailTab = name;
            for (const b of tabButtons) {
                const on = b.dataset.tab === name;
                b.classList.toggle("agilo-ps-tab--active", on);
                b.setAttribute("aria-selected", on ? "true" : "false");
                b.tabIndex = on ? 0 : -1;
            }
            for (const [k, p] of panels) {
                p.hidden = k !== name;
            }
            if (name !== "Aperçu") {
                this.clearPreviewIframeContent();
            }
            if (name === "Prompt")
                this.mountPromptEditor();
            if (name === "HTML")
                this.mountHtmlEditor();
            if (name === "Aperçu") {
                if (this.state && this.htmlEditor) {
                    this.state.html = this.htmlEditor.getValue();
                }
                /*
                 * 1) Ne jamais pousser le HTML dans l’iframe tant que le tabpanel est hidden (debounce HTML + srcdoc).
                 * 2) Après hidden=false, WebKit/Chromium ont besoin d’un tick de layout avant d’assigner src / blob.
                 */
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (this.activeDetailTab !== "Aperçu" || !this.previewIframe)
                            return;
                        this.updatePreviewIframe();
                    });
                });
            }
            if (name === "Champs")
                this.refreshFieldsPanel();
            if (name === "Cohérence")
                this.refreshConsistencyPanel();
            this.updateDirtyIndicator();
        };
        for (let i = 0; i < tabNames.length; i++) {
            const name = tabNames[i];
            const tb = el("button", "agilo-ps-tab");
            tb.type = "button";
            tb.dataset.tab = name;
            tb.textContent = name;
            tb.setAttribute("role", "tab");
            tb.id = `agilo-ps-tab-${i}`;
            tb.setAttribute("aria-controls", `agilo-ps-panel-${i}`);
            tb.setAttribute("aria-selected", "false");
            tb.tabIndex = i === 0 ? 0 : -1;
            tb.addEventListener("click", () => activate(name));
            tabButtons.push(tb);
            tabs.append(tb);
        }
        const content = el("div", "agilo-ps-tabpanels");
        const pPrompt = el("div", "agilo-ps-tabpanel");
        pPrompt.setAttribute("role", "tabpanel");
        const promptTabIdx = tabNames.indexOf("Prompt");
        if (promptTabIdx >= 0) {
            pPrompt.id = `agilo-ps-panel-${promptTabIdx}`;
            pPrompt.setAttribute("aria-labelledby", `agilo-ps-tab-${promptTabIdx}`);
        }
        const promptMount = el("div", "agilo-ps-editor-mount");
        this.promptMountEl = promptMount;
        if (this.cfg.readOnly) {
            const card = el("div", "agilo-ps-prompt-card");
            const meta = el("div", "agilo-ps-prompt-meta");
            meta.append(el("span", "agilo-ps-prompt-meta-item", `ID ${s.promptId}`), el("span", "agilo-ps-prompt-meta-item", s.promptName));
            const bodyPre = el("div", "agilo-ps-prompt-body");
            bodyPre.textContent = s.promptText;
            card.append(meta, bodyPre);
            if (this.cfg.studioMode === "expert" && s.rawPayloadJson) {
                const rawWrap = el("details", "agilo-ps-raw-details");
                const summ = el("summary", "agilo-ps-raw-summary", "Vue brute (JSON / support)");
                const rawPre = el("pre", "agilo-ps-pre agilo-ps-pre--raw");
                rawPre.textContent = s.rawPayloadJson;
                rawWrap.append(summ, rawPre);
                card.append(rawWrap);
            }
            promptMount.append(card);
        }
        pPrompt.append(promptMount);
        panels.set("Prompt", pPrompt);
        let panelIndex = 1;
        if (this.cfg.showPreviewTab) {
            const pPrev = el("div", "agilo-ps-tabpanel");
            pPrev.setAttribute("role", "tabpanel");
            const pi = tabNames.indexOf("Aperçu");
            if (pi >= 0) {
                pPrev.id = `agilo-ps-panel-${pi}`;
                pPrev.setAttribute("aria-labelledby", `agilo-ps-tab-${pi}`);
            }
            const emptyNote = el("div", "agilo-ps-preview-empty");
            this.previewEmptyNoteEl = emptyNote;
            if (!s.html.trim()) {
                emptyNote.append(el("p", "agilo-ps-muted", "Aucun HTML à prévisualiser pour l’instant."), el("p", "agilo-ps-muted", this.showHtmlTab()
                    ? "Ajoutez ou collez du HTML dans l’onglet HTML, ou importez un fichier — l’aperçu se mettra à jour ici."
                    : "Si vous attendez un document mis en forme, le template peut être ajouté côté Agilotext ou avec editHtml + mode adapté."));
            }
            else {
                emptyNote.hidden = true;
            }
            const wrap = el("div", "agilo-ps-preview-wrap");
            const iframe = el("iframe", "agilo-ps-preview-frame");
            iframe.title = "Aperçu du template HTML";
            iframe.setAttribute("sandbox", "allow-same-origin");
            this.previewIframe = iframe;
            wrap.append(iframe);
            pPrev.append(el("p", "agilo-ps-preview-hint", "Aperçu approximatif (styles et scripts externes peuvent différer)."), emptyNote, wrap);
            panels.set("Aperçu", pPrev);
            panelIndex++;
        }
        if (this.cfg.showFieldList) {
            const pFields = el("div", "agilo-ps-tabpanel");
            pFields.setAttribute("role", "tabpanel");
            const pi = tabNames.indexOf("Champs");
            if (pi >= 0) {
                pFields.id = `agilo-ps-panel-${pi}`;
                pFields.setAttribute("aria-labelledby", `agilo-ps-tab-${pi}`);
            }
            const tableMount = el("div", "agilo-ps-fields-dynamic");
            this.fieldsPanelBody = tableMount;
            pFields.append(tableMount);
            panels.set("Champs", pFields);
            this.refreshFieldsPanel();
            panelIndex++;
        }
        if (this.showHtmlTab()) {
            const pHtml = el("div", "agilo-ps-tabpanel");
            pHtml.setAttribute("role", "tabpanel");
            const pi = tabNames.indexOf("HTML");
            if (pi >= 0) {
                pHtml.id = `agilo-ps-panel-${pi}`;
                pHtml.setAttribute("aria-labelledby", `agilo-ps-tab-${pi}`);
            }
            const htmlToolbar = el("div", "agilo-ps-html-toolbar");
            if (!this.cfg.readOnly && this.cfg.editHtml) {
                const fileInput = el("input", "agilo-ps-file-input");
                fileInput.type = "file";
                fileInput.accept = ".html,.htm,text/html";
                fileInput.setAttribute("aria-label", "Importer un fichier HTML");
                const fileLabel = el("label", "agilo-ps-btn agilo-ps-btn--secondary");
                fileLabel.textContent = "Importer un fichier .html";
                fileLabel.append(fileInput);
                fileInput.addEventListener("change", () => {
                    const f = fileInput.files?.[0];
                    if (!f)
                        return;
                    void f.text().then((t) => {
                        if (this.state)
                            this.state.html = t;
                        if (this.htmlEditor)
                            this.htmlEditor.setValue(t);
                        this.updatePreviewIframe();
                        this.updateDirtyIndicator();
                        fileInput.value = "";
                    });
                });
                htmlToolbar.append(fileLabel);
            }
            const htmlMount = el("div", "agilo-ps-editor-mount agilo-ps-editor-mount--tall");
            this.htmlMountEl = htmlMount;
            if (!s.html.trim() && this.cfg.readOnly) {
                htmlMount.append(el("p", "agilo-ps-muted", "Pas de template HTML pour ce modèle."), el("p", "agilo-ps-muted", "Un fichier peut être ajouté via l’équipe Agilotext ou en édition avec import."));
            }
            else if (this.cfg.readOnly || !this.cfg.editHtml) {
                const htmlPre = el("pre", "agilo-ps-pre agilo-ps-pre--tall");
                htmlPre.textContent = s.html;
                htmlMount.append(htmlPre);
            }
            pHtml.append(htmlToolbar, htmlMount);
            panels.set("HTML", pHtml);
            panelIndex++;
        }
        if (this.showConsistencyEffective()) {
            const pCo = el("div", "agilo-ps-tabpanel");
            pCo.setAttribute("role", "tabpanel");
            const pi = tabNames.indexOf("Cohérence");
            if (pi >= 0) {
                pCo.id = `agilo-ps-panel-${pi}`;
                pCo.setAttribute("aria-labelledby", `agilo-ps-tab-${pi}`);
            }
            const coMount = el("div", "agilo-ps-consistency-dynamic");
            this.consistencyPanelBody = coMount;
            pCo.append(coMount);
            panels.set("Cohérence", pCo);
            this.refreshConsistencyPanel();
            panelIndex++;
        }
        void panelIndex;
        for (const p of panels.values()) {
            content.append(p);
        }
        this.activateDetailTabFn = activate;
        const scrollWrap = el("div", "agilo-ps-main-scroll");
        scrollWrap.append(statusBar);
        if (warnBanner)
            scrollWrap.append(warnBanner);
        scrollWrap.append(toolbar);
        if (dirtyBanner)
            scrollWrap.append(dirtyBanner);
        scrollWrap.append(tabs, content);
        mainCol.append(scrollWrap);
        if (saveFooter)
            mainCol.append(saveFooter);
        activate("Prompt");
    }
    close() {
        if (!this.confirmDiscardIfDirty())
            return;
        this.closeWithoutConfirm();
    }
    closeWithoutConfirm() {
        const panel = this.modal?.querySelector(".agilo-ps-panel");
        if (panel)
            this.removeModalKeyboardNav(panel);
        this.teardownEditors();
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
        document.body.classList.remove("agilo-ps-scroll-lock");
        this.previousActive?.focus?.();
        this.previousActive = null;
        this.listMountRef = null;
        this.mainColRef = null;
        this.errBoxRef = null;
    }
    async savePrompt(errBox) {
        const s = this.state;
        if (!s || this.saving)
            return;
        const text = this.getCurrentPromptText();
        this.setSaving(true);
        errBox.hidden = true;
        this.setStatus("Enregistrement en cours… Finalisation côté Agilotext peut prendre 1 à 2 minutes.", true);
        try {
            await this.client.updatePromptText(s.promptId, text, s.promptName);
            const ok = await this.client.waitPromptReady(s.promptId, {
                onTick: ({ elapsedMs, maxMs }) => {
                    const sec = Math.round(elapsedMs / 1000);
                    this.setStatus(`Mise à jour en cours… (${sec}s / ~${Math.round(maxMs / 60000)} min max). Ne fermez pas cette fenêtre.`, true);
                },
            });
            if (!ok) {
                throw new Error("Le modèle n’est pas repassé à READY. Réessayez plus tard ou contactez le support si le problème persiste.");
            }
            s.promptText = text;
            this.setStatus("Enregistrement réussi.", false);
            setTimeout(() => this.setStatus("", false), 4000);
            this.updateDirtyIndicator();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errBox.hidden = false;
            errBox.textContent = isLikelyAuthError(msg)
                ? `Session ou authentification : ${msg}. Reconnectez-vous si besoin.`
                : msg;
            this.setStatus("", false);
        }
        finally {
            this.setSaving(false);
        }
    }
    async saveHtml(errBox) {
        const s = this.state;
        if (!s || this.saving)
            return;
        const html = this.getCurrentHtml();
        const promptText = this.getCurrentPromptText();
        const onlyHtml = placeholdersOnlyInHtml(html, promptText);
        const missing = tagToFillsMissingInHtml(html, promptText);
        if (onlyHtml.length > 0 || missing.length > 0) {
            const detail = [
                onlyHtml.length ? `${onlyHtml.length} placeholder(s) dans le HTML non reflétés dans le prompt.` : "",
                missing.length ? `${missing.length} tag(s)-to-fill manquant(s) dans le HTML.` : "",
            ]
                .filter(Boolean)
                .join(" ");
            if (!window.confirm(`Incohérences détectées : ${detail}\n\nCorriger le HTML ou le prompt est recommandé. Enregistrer quand même ?`)) {
                return;
            }
        }
        if (!window.confirm("Modifier le fichier HTML peut casser les exports ou la génération. Confirmer l’enregistrement ?")) {
            return;
        }
        this.setSaving(true);
        errBox.hidden = true;
        this.setStatus("Envoi du HTML et finalisation… Patience 1–2 minutes.", true);
        try {
            await this.client.updateTemplateFile(s.promptId, promptText, s.promptName, html);
            await this.client.updatePromptText(s.promptId, promptText, s.promptName);
            const ok = await this.client.waitPromptReady(s.promptId, {
                onTick: ({ elapsedMs, maxMs }) => {
                    const sec = Math.round(elapsedMs / 1000);
                    this.setStatus(`Finalisation… (${sec}s / ~${Math.round(maxMs / 60000)} min max).`, true);
                },
            });
            if (!ok) {
                throw new Error("Le modèle n’est pas repassé à READY après mise à jour du HTML. Vérifiez le contenu ou contactez le support.");
            }
            s.html = html;
            s.promptText = promptText;
            this.updatePreviewIframe();
            this.setStatus("HTML enregistré avec succès.", false);
            setTimeout(() => this.setStatus("", false), 4000);
            this.updateDirtyIndicator();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errBox.hidden = false;
            errBox.textContent = isLikelyAuthError(msg)
                ? `Session ou authentification : ${msg}. Reconnectez-vous si besoin.`
                : msg;
            this.setStatus("", false);
        }
        finally {
            this.setSaving(false);
        }
    }
    async saveAll(errBox) {
        const s = this.state;
        if (!s || this.saving || !this.cfg.editHtml)
            return;
        if (!window.confirm("Enregistrer d’abord le prompt, puis le HTML ? Deux finalisations côté Agilotext peuvent prendre plusieurs minutes.")) {
            return;
        }
        this.setSaving(true);
        errBox.hidden = true;
        try {
            const text = this.getCurrentPromptText();
            this.setStatus("Étape 1/2 : enregistrement du prompt…", true);
            await this.client.updatePromptText(s.promptId, text, s.promptName);
            let ok = await this.client.waitPromptReady(s.promptId, {
                onTick: ({ elapsedMs, maxMs }) => {
                    const sec = Math.round(elapsedMs / 1000);
                    this.setStatus(`Prompt : finalisation… (${sec}s / ~${Math.round(maxMs / 60000)} min max).`, true);
                },
            });
            if (!ok) {
                throw new Error("Le modèle n’est pas repassé à READY après le prompt.");
            }
            s.promptText = text;
            const html = this.getCurrentHtml();
            const promptText = this.getCurrentPromptText();
            const onlyHtml = placeholdersOnlyInHtml(html, promptText);
            const missing = tagToFillsMissingInHtml(html, promptText);
            if (onlyHtml.length > 0 || missing.length > 0) {
                const detail = [
                    onlyHtml.length ? `${onlyHtml.length} incohérence(s) placeholders.` : "",
                    missing.length ? `${missing.length} tag(s) manquant(s).` : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                if (!window.confirm(`Incohérences : ${detail}\n\nContinuer l’enregistrement du HTML ?`)) {
                    this.setStatus("Prompt enregistré. HTML non envoyé.", false);
                    this.setSaving(false);
                    this.updateDirtyIndicator();
                    return;
                }
            }
            if (!window.confirm("Étape 2/2 : envoyer le fichier HTML ? Cela peut affecter la génération.")) {
                this.setStatus("Prompt enregistré. HTML non envoyé.", false);
                this.setSaving(false);
                this.updateDirtyIndicator();
                return;
            }
            this.setStatus("Étape 2/2 : envoi du HTML…", true);
            await this.client.updateTemplateFile(s.promptId, promptText, s.promptName, html);
            await this.client.updatePromptText(s.promptId, promptText, s.promptName);
            ok = await this.client.waitPromptReady(s.promptId, {
                onTick: ({ elapsedMs, maxMs }) => {
                    const sec = Math.round(elapsedMs / 1000);
                    this.setStatus(`HTML : finalisation… (${sec}s / ~${Math.round(maxMs / 60000)} min max).`, true);
                },
            });
            if (!ok) {
                throw new Error("Le modèle n’est pas repassé à READY après le HTML.");
            }
            s.html = html;
            s.promptText = promptText;
            this.updatePreviewIframe();
            this.setStatus("Prompt et HTML enregistrés.", false);
            setTimeout(() => this.setStatus("", false), 4000);
            this.updateDirtyIndicator();
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            errBox.hidden = false;
            errBox.textContent = isLikelyAuthError(msg)
                ? `Session ou authentification : ${msg}. Reconnectez-vous si besoin.`
                : msg;
            this.setStatus("", false);
        }
        finally {
            this.setSaving(false);
        }
    }
}
function sanitizeFilename(name) {
    return name.replace(/[^\w\-.]+/g, "_").slice(0, 80) || "modele";
}
function renderList(items) {
    if (items.length === 0)
        return el("p", "agilo-ps-muted", "— Aucun —");
    const ul = el("ul", "agilo-ps-bullets");
    for (const x of items.slice(0, 200)) {
        ul.append(el("li", "agilo-ps-li", x));
    }
    if (items.length > 200) {
        ul.append(el("li", "agilo-ps-li", `… et ${items.length - 200} de plus`));
    }
    return ul;
}


function mergeConfig(overrides) {
    const w = window.__AGILO_PROMPT_STUDIO__ || {};
    return { ...w, ...overrides };
}
/**
 * Sans champ `[name="edition"]`, l’API peut refuser le token (error_invalid_token) si l’édition
 * ne correspond pas au compte (ex. Pro sur /app/premium/ avec défaut "ent").
 */
function inferEditionFromLocation() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/premium"))
        return "pro";
    if (path.includes("/business"))
        return "ent";
    return "ent";
}
/** Aligné sur le script d’en-tête qui appelle getToken — évite pro/free vs défaut ent. */
function editionFromHeadGlobals() {
    const a = typeof window.agilotextEdition === "string" ? window.agilotextEdition.trim() : "";
    const b = typeof window.__AGILOTEXT_EDITION__ === "string"
        ? window.__AGILOTEXT_EDITION__.trim()
        : "";
    return a || b;
}
function defaultGetAuth() {
    const token = typeof window.globalToken === "string" ? window.globalToken.trim() : "";
    const emailInput = document.querySelector('[name="memberEmail"]');
    const email = emailInput?.value?.trim() || "";
    if (!token || !email)
        return null;
    const cfg = window.__AGILO_PROMPT_STUDIO__ || {};
    const fromInput = document.querySelector('[name="edition"]')?.value?.trim();
    const fromConfig = typeof cfg.defaultEdition === "string" ? cfg.defaultEdition.trim() : "";
    const fromHead = editionFromHeadGlobals();
    const edition = fromInput || fromConfig || fromHead || inferEditionFromLocation();
    return { username: email, token, edition };
}
function buildGetAuth(cfg) {
    return () => {
        if (cfg.getAuth) {
            const r = cfg.getAuth();
            if (r && typeof r.then === "function") {
                console.warn("[AgiloPromptStudio] getAuth ne peut pas retourner une Promise ; fournissez un jeton synchrone.");
                return null;
            }
            return r;
        }
        return defaultGetAuth();
    };
}
function init(overrides) {
    const cfg = mergeConfig(overrides);
    if (cfg.enabled === false)
        return;
    const mountSelector = cfg.mountSelector || "#agilo-prompt-studio-anchor";
    const mount = document.querySelector(mountSelector);
    if (!mount) {
        console.warn("[AgiloPromptStudio] Conteneur introuvable :", mountSelector);
        return;
    }
    const getAuthFn = buildGetAuth(cfg);
    const label = cfg.launchLabel || "Consulter / exporter les modèles (sans audio)";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "agilo-ps-launch-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => {
        if (!getAuthFn()?.token) {
            alert("Session Agilotext indisponible : reconnectez-vous ou attendez le chargement du compte.");
            return;
        }
        const app = new StudioApp(getAuthFn, cfg);
        void app.open();
    });
    mount.replaceChildren(btn);
}
/**
 * Ouvre la modale et sélectionne le modèle dont l’id correspond à `promptId`
 * (ex. depuis une ligne de tableau Webflow avec le même id).
 */
function openModalAndSelect(promptId, overrides) {
    const cfg = mergeConfig(overrides);
    if (cfg.enabled === false)
        return;
    const getAuthFn = buildGetAuth(cfg);
    if (!getAuthFn()?.token) {
        alert("Session Agilotext indisponible : reconnectez-vous ou attendez le chargement du compte.");
        return;
    }
    const app = new StudioApp(getAuthFn, cfg);
    void app.open({ selectPromptId: String(promptId) });
}


  var _agilo = {
    init: init,
    mergeConfig: mergeConfig,
    defaultGetAuth: defaultGetAuth,
    openModalAndSelect: openModalAndSelect,
  };
  if (typeof globalThis !== "undefined") globalThis.AgiloPromptStudio = _agilo;
  if (typeof window !== "undefined") window.AgiloPromptStudio = _agilo;
})();
