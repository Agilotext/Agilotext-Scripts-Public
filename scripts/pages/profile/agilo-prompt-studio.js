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
    async getPromptContent(promptId) {
        const res = await this.postUrlEncoded("/getPromptModelContent", { promptId });
        if (typeof res === "string")
            return res;
        if (res && typeof res === "object") {
            const o = res;
            const c = o.promptContent ?? o.content ?? o.text ?? o.result;
            if (typeof c === "string")
                return c;
        }
        return typeof res === "object" ? JSON.stringify(res) : String(res ?? "");
    }
    async getTemplateHtml(promptId) {
        const a = this.getAuth();
        if (!a?.username || !a?.token)
            throw new Error("Authentification Agilotext manquante.");
        const body = this.authBody();
        body.set("promptId", promptId);
        const res = await fetch(`${this.apiBase}/receivePromptModelTemplate`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const text = await res.text();
        if (!res.ok)
            throw new Error(`receivePromptModelTemplate: HTTP ${res.status} ${text.slice(0, 400)}`);
        const data = parseJsonSafe(text);
        if (data && data.status === "KO") {
            throw new Error(String(data.errorMessage || "receivePromptModelTemplate KO"));
        }
        if (data && typeof data === "object" && data.status === "OK") {
            return normalizeTemplateResponse(data);
        }
        if (data && typeof data === "object") {
            return normalizeTemplateResponse(data);
        }
        return text;
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
class StudioApp {
    client;
    cfg;
    modal = null;
    previousActive = null;
    promptEditor = null;
    htmlEditor = null;
    promptMountEl = null;
    htmlMountEl = null;
    state = null;
    constructor(getAuth, cfg) {
        this.cfg = {
            readOnly: cfg.readOnly !== false,
            editHtml: cfg.editHtml === true,
            showFieldList: cfg.showFieldList !== false,
            showConsistencyTab: cfg.showConsistencyTab !== false,
            apiBase: cfg.apiBase || "https://api.agilotext.com/api/v1",
            ...cfg,
        };
        this.client = new AgilotextPromptsClient(this.cfg.apiBase, getAuth);
    }
    async open() {
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
        const errBox = el("div", "agilo-ps-error");
        errBox.hidden = true;
        listCol.append(listTitle, errBox, listMount);
        const mainCol = el("div", "agilo-ps-main");
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
                const name = el("span", "agilo-ps-list-item-name", p.name);
                const id = el("span", "agilo-ps-list-item-id", `id ${p.promptId}`);
                row.append(name, id);
                row.addEventListener("click", () => {
                    void this.loadPrompt(p.promptId, p.name, mainCol, errBox);
                });
                listMount.append(row);
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
            const [promptText, html] = await Promise.all([
                this.client.getPromptContent(promptId),
                this.client.getTemplateHtml(promptId),
            ]);
            this.state = { promptId, promptName, promptText, html };
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
    renderDetail(mainCol, errBox) {
        const s = this.state;
        if (!s)
            return;
        mainCol.replaceChildren();
        const toolbar = el("div", "agilo-ps-toolbar");
        toolbar.append(el("h3", "agilo-ps-subtitle", s.promptName));
        const exportGroup = el("div", "agilo-ps-btn-group");
        const b1 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le prompt (.txt)");
        b1.type = "button";
        b1.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-prompt.txt`, s.promptText));
        const b2 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger le HTML (.html)");
        b2.type = "button";
        b2.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-template.html`, s.html, "text/html;charset=utf-8"));
        const b3 = el("button", "agilo-ps-btn agilo-ps-btn--secondary", "Télécharger tout (.txt)");
        b3.type = "button";
        b3.addEventListener("click", () => downloadTextFile(`${sanitizeFilename(s.promptName)}-export-complet.txt`, buildCombinedExport(s.promptName, s.promptText, s.html)));
        exportGroup.append(b1, b2, b3);
        toolbar.append(exportGroup);
        if (!this.cfg.readOnly) {
            const saveGroup = el("div", "agilo-ps-btn-group");
            const savePrompt = el("button", "agilo-ps-btn agilo-ps-btn--primary", "Enregistrer le prompt");
            savePrompt.type = "button";
            savePrompt.addEventListener("click", () => void this.savePrompt(errBox, savePrompt));
            saveGroup.append(savePrompt);
            if (this.cfg.editHtml) {
                const saveHtml = el("button", "agilo-ps-btn agilo-ps-btn--primary", "Enregistrer le HTML");
                saveHtml.type = "button";
                saveHtml.addEventListener("click", () => void this.saveHtml(errBox, saveHtml));
                saveGroup.append(saveHtml);
            }
            toolbar.append(saveGroup);
        }
        const tabNames = ["Prompt", ...(this.cfg.showFieldList ? ["Champs"] : []), "HTML"];
        if (this.cfg.showConsistencyTab)
            tabNames.push("Cohérence");
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
            const promptPre = el("pre", "agilo-ps-pre");
            promptPre.textContent = s.promptText;
            promptMount.append(promptPre);
        }
        pPrompt.append(promptMount);
        panels.set("Prompt", pPrompt);
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
                table.append(el("p", "agilo-ps-muted", "Aucun champ détecté automatiquement (voir onglet HTML)."));
            }
            pFields.append(table);
            panels.set("Champs", pFields);
        }
        const pHtml = el("div", "agilo-ps-tabpanel");
        pHtml.setAttribute("role", "tabpanel");
        const htmlMount = el("div", "agilo-ps-editor-mount agilo-ps-editor-mount--tall");
        this.htmlMountEl = htmlMount;
        if (this.cfg.readOnly || !this.cfg.editHtml) {
            const htmlPre = el("pre", "agilo-ps-pre agilo-ps-pre--tall");
            htmlPre.textContent = s.html;
            htmlMount.append(htmlPre);
        }
        pHtml.append(htmlMount);
        panels.set("HTML", pHtml);
        if (this.cfg.showConsistencyTab) {
            const pCo = el("div", "agilo-ps-tabpanel");
            pCo.setAttribute("role", "tabpanel");
            const onlyHtml = placeholdersOnlyInHtml(s.html, s.promptText);
            const missing = tagToFillsMissingInHtml(s.html, s.promptText);
            const allPh = extractPlaceholdersFromHtml(s.html);
            pCo.append(el("p", "agilo-ps-muted", `${allPh.length} placeholder(s) dans le HTML.`), el("h4", "agilo-ps-h4", "Dans le HTML mais peu ou pas cités comme tag-to-fill dans le prompt"), renderList(onlyHtml), el("h4", "agilo-ps-h4", "Cités dans le prompt (tag-to-fill) mais absents du HTML"), renderList(missing));
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
    }
    async savePrompt(errBox, btn) {
        const s = this.state;
        if (!s)
            return;
        const text = this.promptEditor?.getValue() ?? s.promptText;
        btn.disabled = true;
        errBox.hidden = true;
        try {
            await this.client.updatePromptText(s.promptId, text, s.promptName);
            const ok = await this.client.waitPromptReady(s.promptId);
            if (!ok)
                throw new Error("Le modèle n’est pas repassé à READY (vérifiez le statut ou réessayez).");
            s.promptText = text;
        }
        catch (e) {
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
        }
        finally {
            btn.disabled = false;
        }
    }
    async saveHtml(errBox, btn) {
        const s = this.state;
        if (!s)
            return;
        if (!window.confirm("Modifier le fichier HTML peut casser les exports ou la génération. Confirmer l’enregistrement ?")) {
            return;
        }
        const html = this.htmlEditor?.getValue() ?? s.html;
        btn.disabled = true;
        errBox.hidden = true;
        try {
            await this.client.updateTemplateFile(s.promptId, s.promptText, s.promptName, html);
            await this.client.updatePromptText(s.promptId, s.promptText, s.promptName);
            const ok = await this.client.waitPromptReady(s.promptId);
            if (!ok)
                throw new Error("Le modèle n’est pas repassé à READY après mise à jour du HTML.");
            s.html = html;
        }
        catch (e) {
            errBox.hidden = false;
            errBox.textContent = e instanceof Error ? e.message : String(e);
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
    const getAuthFn = () => {
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


  var _agilo = { init: init, mergeConfig: mergeConfig, defaultGetAuth: defaultGetAuth };
  if (typeof globalThis !== "undefined") globalThis.AgiloPromptStudio = _agilo;
  if (typeof window !== "undefined") window.AgiloPromptStudio = _agilo;
})();
