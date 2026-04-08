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
                    ? e.message
                    : "Connexion impossible. Vérifiez le réseau et réessayez.",
            };
        }
        const text = await res.text();
        if (!res.ok) {
            return {
                ok: false,
                kind: res.status >= 500 ? "api" : "network",
                message: `Modèle HTML : erreur ${res.status}. ${text.slice(0, 200)}`,
            };
        }
        const data = parseJsonSafe(text);
        if (data && data.status === "KO") {
            return {
                ok: false,
                kind: "api",
                message: String(data.errorMessage || "Réponse serveur KO pour le template."),
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


function mountTextarea(parent, initial, minHeight) {
    const ta = document.createElement("textarea");
    ta.className = "agilo-ps-native-editor";
    ta.value = initial;
    ta.spellcheck = false;
    ta.style.minHeight = minHeight;
    parent.append(ta);
    return {
        setValue: (v) => {
            ta.value = v;
        },
        getValue: () => ta.value,
        destroy: () => {
            ta.remove();
        },
    };
}
/** Éditeur texte brut (prompt) — textarea monospace ; CodeMirror optionnel en upgrade. */
function createTextEditor(parent, initial) {
    return mountTextarea(parent, initial, "220px");
}
/** Éditeur HTML — même composant ; coloration syntaxique possible via upgrade CodeMirror. */
function createHtmlEditor(parent, initial, _dark = true) {
    void _dark;
    return mountTextarea(parent, initial, "400px");
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
    listMountRef = null;
    mainColRef = null;
    errBoxRef = null;
    statusBarRef = null;
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
    async open(opts) {
        this.close();
        this.modal = el("div", "agilo-ps-overlay");
        this.modal.setAttribute("role", "dialog");
        this.modal.setAttribute("aria-modal", "true");
        this.modal.setAttribute("aria-label", "Studio modèles Agilotext");
        const panel = el("div", "agilo-ps-panel");
        const header = el("div", "agilo-ps-header");
        const title = el("h2", "agilo-ps-title", "Modèles de comptes rendus");
        const hint = el("p", "agilo-ps-hint");
        hint.textContent =
            "Consulter ou exporter le contenu ne lance pas de transcription et ne consomme pas d’audio.";
        const closeBtn = el("button", "agilo-ps-btn agilo-ps-btn--ghost", "Fermer");
        closeBtn.type = "button";
        closeBtn.addEventListener("click", () => this.close());
        header.append(title, hint, closeBtn);
        const body = el("div", "agilo-ps-body");
        const listCol = el("div", "agilo-ps-listcol");
        const listTitle = el("h3", "agilo-ps-subtitle", "Vos modèles");
        const listMount = el("div", "agilo-ps-list");
        this.listMountRef = listMount;
        const errBox = el("div", "agilo-ps-error");
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
        closeBtn.focus();
        this.modal.addEventListener("keydown", (e) => {
            if (e.key === "Escape")
                this.close();
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
    }
    async loadPrompt(promptId, promptName, mainCol, errBox) {
        errBox.hidden = true;
        errBox.textContent = "";
        mainCol.replaceChildren(el("p", "agilo-ps-muted", "Chargement…"));
        try {
            const rawRes = await this.client.getPromptContentResponse(promptId);
            const promptText = extractPromptTextFromContentResponse(rawRes);
            const rawPayloadJson = rawRes !== null && typeof rawRes === "object"
                ? JSON.stringify(rawRes, null, 2)
                : String(rawRes ?? "");
            const tmpl = await this.client.loadTemplateHtml(promptId);
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
            mainCol.replaceChildren();
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
        }
    }
    teardownEditors() {
        this.promptEditor?.destroy();
        this.htmlEditor?.destroy();
        this.promptEditor = null;
        this.htmlEditor = null;
        this.promptMountEl = null;
        this.htmlMountEl = null;
        this.previewIframe = null;
        this.statusBarRef = null;
    }
    mountPromptEditor() {
        if (this.promptEditor || !this.state || this.cfg.readOnly || !this.promptMountEl)
            return;
        this.promptMountEl.replaceChildren();
        this.promptEditor = createTextEditor(this.promptMountEl, this.state.promptText);
    }
    mountHtmlEditor() {
        if (this.htmlEditor || !this.state || !this.cfg.editHtml || this.cfg.readOnly || !this.htmlMountEl)
            return;
        this.htmlMountEl.replaceChildren();
        this.htmlEditor = createHtmlEditor(this.htmlMountEl, this.state.html, true);
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
        const h = this.state.html.trim();
        if (!h) {
            this.previewIframe.removeAttribute("srcdoc");
            this.previewIframe.srcdoc = "";
            return;
        }
        this.previewIframe.srcdoc = h;
    }
    renderDetail(mainCol, errBox) {
        const s = this.state;
        if (!s)
            return;
        mainCol.replaceChildren();
        const statusBar = el("div", "agilo-ps-status");
        statusBar.setAttribute("aria-live", "polite");
        statusBar.hidden = true;
        this.statusBarRef = statusBar;
        mainCol.append(statusBar);
        if (s.templateWarning) {
            const banner = el("div", "agilo-ps-banner agilo-ps-banner--warn");
            const msg = el("p", "agilo-ps-banner-text");
            const prefix = s.templateWarning.kind === "network"
                ? "Template HTML indisponible (réseau). "
                : "Template HTML indisponible. ";
            msg.textContent = prefix + s.templateWarning.message;
            const retry = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Réessayer");
            retry.type = "button";
            retry.addEventListener("click", () => {
                if (this.mainColRef && this.errBoxRef) {
                    void this.loadPrompt(s.promptId, s.promptName, this.mainColRef, this.errBoxRef);
                }
            });
            banner.append(msg, retry);
            mainCol.append(banner);
        }
        const toolbar = el("div", "agilo-ps-toolbar");
        toolbar.append(el("h3", "agilo-ps-subtitle", s.promptName));
        const exportGroup = el("div", "agilo-ps-btn-group");
        const b1 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le prompt (.txt)");
        b1.type = "button";
        b1.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-prompt.txt`, s.promptText));
        const b2 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le HTML (.html)");
        b2.type = "button";
        const hasHtml = s.html.trim().length > 0;
        b2.disabled = !hasHtml;
        b2.title = hasHtml ? "" : "Aucun fichier HTML pour ce modèle";
        b2.addEventListener("click", () => {
            if (!s.html.trim())
                return;
            downloadTextFile(`${sanitizeFilename(s.promptName)}-template.html`, s.html, "text/html;charset=utf-8");
        });
        const b3 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger tout (.txt)");
        b3.type = "button";
        b3.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-export-complet.txt`, buildCombinedExport(s.promptName, s.promptText, s.html)));
        exportGroup.append(b1, b2, b3);
        toolbar.append(exportGroup);
        if (this.cfg.studioMode === "simple") {
            const help = el("div", "agilo-ps-simple-help");
            help.append(el("p", "agilo-ps-simple-help-title", "Conseils"));
            const ul = el("ul", "agilo-ps-simple-help-list");
            for (const t of [
                "Le texte ci-dessous guide l’IA : ton, structure et règles de sortie.",
                "Évitez de supprimer les consignes critiques (JSON, placeholders, etc.) sans les comprendre.",
                "Pour modifier la mise en page du document généré, utilisez le lien « Faire évoluer mon modèle » ou passez en mode expert.",
            ]) {
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
        if (!this.cfg.readOnly) {
            const saveGroup = el("div", "agilo-ps-btn-group");
            const savePrompt = el("button", "agilo-ps-btn agilo-ps-btn--primary", "Enregistrer le prompt");
            savePrompt.type = "button";
            savePrompt.addEventListener("click", () => void this.savePrompt(errBox, savePrompt));
            saveGroup.append(savePrompt);
            if (this.cfg.studioMode === "expert" && this.cfg.editHtml) {
                const saveHtml = el("button", "agilo-ps-btn agilo-ps-btn--primary", "Enregistrer le HTML");
                saveHtml.type = "button";
                saveHtml.addEventListener("click", () => void this.saveHtml(errBox, saveHtml));
                saveGroup.append(saveHtml);
            }
            toolbar.append(saveGroup);
        }
        const tabNames = ["Prompt"];
        if (this.cfg.showPreviewTab)
            tabNames.push("Aperçu");
        if (this.cfg.showFieldList)
            tabNames.push("Champs");
        if (this.cfg.studioMode === "expert") {
            tabNames.push("HTML");
            if (this.cfg.showConsistencyTab)
                tabNames.push("Cohérence");
        }
        const tabs = el("div", "agilo-ps-tabs");
        const tabButtons = [];
        const panels = new Map();
        const activate = (name) => {
            for (const b of tabButtons) {
                const on = b.dataset.tab === name;
                b.classList.toggle("agilo-ps-tab--active", on);
                b.setAttribute("aria-selected", on ? "true" : "false");
            }
            for (const [k, p] of panels) {
                p.hidden = k !== name;
            }
            if (name === "Prompt")
                this.mountPromptEditor();
            if (name === "HTML")
                this.mountHtmlEditor();
            if (name === "Aperçu")
                this.updatePreviewIframe();
        };
        for (const name of tabNames) {
            const tb = el("button", "agilo-ps-tab");
            tb.type = "button";
            tb.dataset.tab = name;
            tb.textContent = name;
            tb.setAttribute("role", "tab");
            tb.addEventListener("click", () => activate(name));
            tabButtons.push(tb);
            tabs.append(tb);
        }
        const content = el("div", "agilo-ps-tabpanels");
        const pPrompt = el("div", "agilo-ps-tabpanel");
        pPrompt.setAttribute("role", "tabpanel");
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
        if (this.cfg.showPreviewTab) {
            const pPrev = el("div", "agilo-ps-tabpanel");
            pPrev.setAttribute("role", "tabpanel");
            if (!s.html.trim()) {
                pPrev.append(el("p", "agilo-ps-muted", "Aucun HTML à prévisualiser pour ce modèle."), el("p", "agilo-ps-muted", "Si vous attendez un document mis en forme, le template peut être ajouté côté Agilotext ou en mode expert."));
            }
            else {
                const wrap = el("div", "agilo-ps-preview-wrap");
                const iframe = el("iframe", "agilo-ps-preview-frame");
                iframe.title = "Aperçu du template HTML";
                iframe.setAttribute("sandbox", "");
                this.previewIframe = iframe;
                wrap.append(iframe);
                pPrev.append(el("p", "agilo-ps-preview-hint", "Aperçu approximatif (styles et scripts externes peuvent différer)."), wrap);
            }
            panels.set("Aperçu", pPrev);
        }
        if (this.cfg.showFieldList) {
            const pFields = el("div", "agilo-ps-tabpanel");
            pFields.setAttribute("role", "tabpanel");
            const fields = parseFormFieldsFromHtml(s.html);
            const table = el("div", "agilo-ps-field-table");
            for (const f of fields) {
                const row = el("div", "agilo-ps-field-row");
                row.append(el("span", "agilo-ps-field-id", f.id), el("span", "agilo-ps-field-label", f.label), el("span", "agilo-ps-field-kind", f.kind));
                table.append(row);
            }
            if (fields.length === 0) {
                const msg = s.html.trim().length === 0
                    ? "Pas de HTML : aucun champ détecté. Ajoutez un template ou ouvrez un modèle qui en contient un."
                    : "Aucun champ détecté automatiquement (voir onglet HTML en mode expert).";
                table.append(el("p", "agilo-ps-muted", msg));
            }
            pFields.append(table);
            panels.set("Champs", pFields);
        }
        if (this.cfg.studioMode === "expert") {
            const pHtml = el("div", "agilo-ps-tabpanel");
            pHtml.setAttribute("role", "tabpanel");
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
                        fileInput.value = "";
                    });
                });
                htmlToolbar.append(fileLabel);
            }
            const htmlMount = el("div", "agilo-ps-editor-mount agilo-ps-editor-mount--tall");
            this.htmlMountEl = htmlMount;
            if (!s.html.trim() && this.cfg.readOnly) {
                htmlMount.append(el("p", "agilo-ps-muted", "Pas de template HTML pour ce modèle."), el("p", "agilo-ps-muted", "Un fichier peut être ajouté via l’équipe Agilotext ou en édition expert avec import."));
            }
            else if (this.cfg.readOnly || !this.cfg.editHtml) {
                const htmlPre = el("pre", "agilo-ps-pre agilo-ps-pre--tall");
                htmlPre.textContent = s.html;
                htmlMount.append(htmlPre);
            }
            pHtml.append(htmlToolbar, htmlMount);
            panels.set("HTML", pHtml);
        }
        if (this.cfg.studioMode === "expert" && this.cfg.showConsistencyTab) {
            const pCo = el("div", "agilo-ps-tabpanel");
            pCo.setAttribute("role", "tabpanel");
            if (!s.html.trim()) {
                pCo.append(el("p", "agilo-ps-muted", "Sans HTML, l’analyse de cohérence des placeholders est limitée."), el("p", "agilo-ps-muted", "Ajoutez un template pour comparer placeholders et consignes du prompt."));
            }
            else {
                const onlyHtml = placeholdersOnlyInHtml(s.html, s.promptText);
                const missing = tagToFillsMissingInHtml(s.html, s.promptText);
                const allPh = extractPlaceholdersFromHtml(s.html);
                pCo.append(el("p", "agilo-ps-muted", `${allPh.length} placeholder(s) dans le HTML.`), el("h4", "agilo-ps-h4", "Dans le HTML mais peu ou pas cités comme tag-to-fill dans le prompt"), renderList(onlyHtml), el("h4", "agilo-ps-h4", "Cités dans le prompt (tag-to-fill) mais absents du HTML"), renderList(missing));
            }
            panels.set("Cohérence", pCo);
        }
        for (const p of panels.values()) {
            content.append(p);
        }
        mainCol.append(toolbar, tabs, content);
        activate("Prompt");
    }
    close() {
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
    async savePrompt(errBox, btn) {
        const s = this.state;
        if (!s)
            return;
        const text = this.promptEditor?.getValue() ?? s.promptText;
        btn.disabled = true;
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
        }
        catch (e) {
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
            this.setStatus("", false);
        }
        finally {
            btn.disabled = false;
        }
    }
    async saveHtml(errBox, btn) {
        const s = this.state;
        if (!s)
            return;
        const html = this.htmlEditor?.getValue() ?? s.html;
        const onlyHtml = placeholdersOnlyInHtml(html, s.promptText);
        const missing = tagToFillsMissingInHtml(html, s.promptText);
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
        btn.disabled = true;
        errBox.hidden = true;
        this.setStatus("Envoi du HTML et finalisation… Patience 1–2 minutes.", true);
        try {
            await this.client.updateTemplateFile(s.promptId, s.promptText, s.promptName, html);
            await this.client.updatePromptText(s.promptId, s.promptText, s.promptName);
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
            this.updatePreviewIframe();
            this.setStatus("HTML enregistré avec succès.", false);
            setTimeout(() => this.setStatus("", false), 4000);
        }
        catch (e) {
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
            this.setStatus("", false);
        }
        finally {
            btn.disabled = false;
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
function defaultGetAuth() {
    const token = typeof window.globalToken === "string" ? window.globalToken.trim() : "";
    const emailInput = document.querySelector('[name="memberEmail"]');
    const email = emailInput?.value?.trim() || "";
    if (!token || !email)
        return null;
    const edition = document.querySelector('[name="edition"]')?.value || "ent";
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
