/**
 * Tableau « modèles de comptes rendus » (page Mon compte / prompts).
 * Branche 1.06 — détection d’édition : [name="edition"] → globaux tête de page → URL (/premium/ → pro, /business/ → ent).
 * @version 1.06.1
 */
(function () {
  "use strict";

  function editionFromHeadGlobals() {
    const a = typeof window.agilotextEdition === "string" ? window.agilotextEdition.trim() : "";
    const b =
      typeof window.__AGILOTEXT_EDITION__ === "string"
        ? window.__AGILOTEXT_EDITION__.trim()
        : "";
    return a || b;
  }

  function inferEditionFromLocation() {
    const path = (window.location.pathname || "").toLowerCase();
    if (path.includes("/premium")) return "pro";
    if (path.includes("/business")) return "ent";
    return "ent";
  }

  /** Aligné sur agilo-prompt-studio.js / embeds profil Webflow */
  function resolveAgilotextEdition() {
    const fromInput = document.querySelector('[name="edition"]')?.value?.trim();
    if (fromInput) return fromInput.toLowerCase();
    const fromHead = editionFromHeadGlobals();
    if (fromHead) return fromHead.toLowerCase();
    return inferEditionFromLocation();
  }

  /** --- VARIABLES GLOBALES (script page) --- */
  let currentPromptIdToDelete = null;
  let currentSort = { column: "cr", direction: "desc" };

  function parseDateSecure(input) {
    if (!input) return null;
    if (typeof input === "number") return new Date(input);
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateFr(input) {
    const d = parseDateSecure(input);
    if (!d) return "-";
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getTimestamp(input) {
    const d = parseDateSecure(input);
    return d ? d.getTime() : 0;
  }

  function mainScriptExecution(token) {
    const userEmail = document.querySelector('[name="memberEmail"]')?.value;
    if (!userEmail) return;
    const edition = resolveAgilotextEdition();
    fetch(
      "https://api.agilotext.com/api/v1/getPromptModelsUserInfo?username=" +
        encodeURIComponent(userEmail) +
        "&token=" +
        encodeURIComponent(token) +
        "&edition=" +
        encodeURIComponent(edition),
      { method: "GET" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "OK") {
          const prompts = (data.promptModeInfoDTOList || []).filter((pm) => pm.promptModelId > 100);
          populateTableInitial(prompts);
        } else {
          console.error(data.errorMessage);
        }
      })
      .catch((err) => console.error("getPromptModelsUserInfo", err));
  }

  function populateTableInitial(prompts) {
    const container = document.getElementById("prompt-table-body");
    const wrapper = document.getElementById("wrapper-tableau");
    const template = document.getElementById("prompt-row-template");
    if (!container || !wrapper) return;

    if (prompts.length === 0) {
      wrapper.style.display = "none";
      return;
    }
    wrapper.style.display = "flex";
    container.innerHTML = "";

    prompts.forEach((pm) => {
      const clone = document.importNode(template.content, true);
      const row = clone.querySelector(".wrapper-content_item-row");

      row.setAttribute("data-prompt-id", pm.promptModelId);

      const tsCr = getTimestamp(pm.dtCreation);
      const tsMod = getTimestamp(pm.dtUpdate || pm.dtCreation);

      row.setAttribute("data-ts-cr", tsCr);
      row.setAttribute("data-ts-mod", tsMod);

      const nameEl = row.querySelector(".model-name-span");
      if (nameEl) nameEl.textContent = pm.promptModelName || "(Sans nom)";
      const dateCrEl = row.querySelector(".model-date");
      if (dateCrEl) dateCrEl.textContent = formatDateFr(pm.dtCreation);
      let dateModEl = row.querySelector(".model-date-mod");
      if (!dateModEl) {
        const allDates = row.querySelectorAll(".model-date");
        if (allDates.length > 1) dateModEl = allDates[1];
      }
      if (dateModEl) {
        dateModEl.textContent = formatDateFr(pm.dtUpdate || pm.dtCreation);
      }

      const btnRename = row.querySelector(".rename-btn");
      if (btnRename) btnRename.addEventListener("click", () => handleRenamePrompt(pm.promptModelId));
      const btnEdit = row.querySelector(".view-edit-btn");
      if (btnEdit) btnEdit.addEventListener("click", () => openEditPopup(pm.promptModelId));
      container.appendChild(clone);
    });
    sortDOM("cr", "desc");
  }

  function setupSortListenersDOM() {
    const titles = document.querySelectorAll(".custom-element.titles, .custom-element.titles.horizontal");

    titles.forEach((div) => {
      const txt = div.textContent.toLowerCase();
      if (txt.includes("création") || txt.includes("creation")) {
        div.style.cursor = "pointer";
        div.title = "Trier par date";
        const newDiv = div.cloneNode(true);
        div.parentNode.replaceChild(newDiv, div);
        newDiv.addEventListener("click", () => handleSortClick("cr"));
      }
      if (txt.includes("modification") || txt.includes("dernière")) {
        div.style.cursor = "pointer";
        div.title = "Trier par date";
        const newDiv = div.cloneNode(true);
        div.parentNode.replaceChild(newDiv, div);
        newDiv.addEventListener("click", () => handleSortClick("mod"));
      }
    });
  }

  function handleSortClick(type) {
    if (currentSort.column === type) {
      currentSort.direction = currentSort.direction === "desc" ? "asc" : "desc";
    } else {
      currentSort.column = type;
      currentSort.direction = "desc";
    }
    sortDOM(currentSort.column, currentSort.direction);
  }

  function sortDOM(columnKey, direction) {
    const container = document.getElementById("prompt-table-body");
    if (!container) return;
    const rows = Array.from(container.querySelectorAll(".wrapper-content_item-row"));
    rows.sort((a, b) => {
      const attr = columnKey === "cr" ? "data-ts-cr" : "data-ts-mod";
      const ValA = parseInt(a.getAttribute(attr) || "0", 10);
      const ValB = parseInt(b.getAttribute(attr) || "0", 10);
      return direction === "asc" ? ValA - ValB : ValB - ValA;
    });
    rows.forEach((row) => container.appendChild(row));
    console.log("Tableau retrié par DOM : " + columnKey + " / " + direction);
  }

  function handleRenamePrompt(pid) {
    const newName = prompt("Nouveau nom ?");
    if (!newName) return;
    const userEmail = document.querySelector('[name="memberEmail"]').value;
    const edition = resolveAgilotextEdition();
    fetch("https://api.agilotext.com/api/v1/renamePromptModel", {
      method: "POST",
      body: new URLSearchParams({
        username: userEmail,
        token: globalToken,
        edition: edition,
        promptId: pid,
        promptName: newName,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "OK") {
          const row = document.querySelector('.wrapper-content_item-row[data-prompt-id="' + pid + '"]');
          if (row) {
            const nameEl = row.querySelector(".model-name-span");
            if (nameEl) nameEl.textContent = newName;
            updateRowTimestamp(row);
          }
        } else {
          console.error("renamePromptModel", d);
        }
      })
      .catch((e) => console.error("renamePromptModel", e));
  }

  function updateRowTimestamp(row) {
    const nowTs = Date.now();
    row.setAttribute("data-ts-mod", nowTs);

    let modEl = row.querySelector(".model-date-mod");
    if (!modEl) {
      const allDates = row.querySelectorAll(".model-date");
      if (allDates.length > 1) modEl = allDates[1];
    }
    if (modEl) {
      modEl.textContent = formatDateFr(nowTs);
      modEl.style.color = "#174a96";
      setTimeout(function () {
        modEl.style.color = "";
      }, 2000);
    }
  }

  function openEditPopup(promptId) {
    const popup = document.getElementById("popup-prompt");
    const userEmail = document.querySelector('[name="memberEmail"]')?.value;
    if (!popup) return;
    const edition = resolveAgilotextEdition();
    popup.setAttribute("data-current-prompt-id", promptId);
    popup.style.display = "flex";
    const overlay = popup.querySelector("#overlay-prompt");
    if (overlay) overlay.style.display = "block";
    fetch(
      "https://api.agilotext.com/api/v1/getPromptModelContent?username=" +
        encodeURIComponent(userEmail) +
        "&token=" +
        encodeURIComponent(globalToken) +
        "&edition=" +
        encodeURIComponent(edition) +
        "&promptId=" +
        encodeURIComponent(promptId)
    )
      .then((r) => r.json())
      .then((d) => {
        const txt = popup.querySelector("#Content-prompt");
        if (txt) txt.value = d.status !== "KO" ? d.promptModelContent || "" : "";

        const editBtn = document.getElementById("popup-edit-btn");
        if (editBtn) {
          const n = editBtn.cloneNode(true);
          editBtn.parentNode.replaceChild(n, editBtn);
          n.addEventListener("click", function (e) {
            e.preventDefault();
            if (overlay) overlay.style.display = "none";
          });
        }
      })
      .catch((e) => console.error("getPromptModelContent", e));
  }

  function deletePrompt(pid) {
    const userEmail = document.querySelector('[name="memberEmail"]').value;
    const edition = resolveAgilotextEdition();
    fetch("https://api.agilotext.com/api/v1/deletePromptModel", {
      method: "POST",
      body: new URLSearchParams({
        username: userEmail,
        token: globalToken,
        edition: edition,
        promptId: pid,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "OK") {
          const row = document.querySelector('.wrapper-content_item-row[data-prompt-id="' + pid + '"]');
          if (row) row.remove();
        } else {
          console.error("deletePromptModel", d);
          window.alert(
            "Erreur suppression : " + (d.errorMessage || d.message || "réponse inattendue")
          );
        }
      })
      .catch(function (e) {
        console.error("deletePromptModel", e);
        window.alert("Erreur réseau lors de la suppression.");
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const tmr = setInterval(function () {
      if (typeof globalToken !== "undefined" && globalToken) {
        clearInterval(tmr);
        console.log("Token OK (V6 Default Sort)");
        mainScriptExecution(globalToken);
        setTimeout(setupSortListenersDOM, 1000);
      }
    }, 300);
  });

  window.addEventListener("load", function () {
    const saveBtn = document.getElementById("popup-save-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const popup = document.getElementById("popup-prompt");
        const pid = popup.getAttribute("data-current-prompt-id");
        const txt = popup.querySelector("#Content-prompt").value;
        const userEmail = document.querySelector('[name="memberEmail"]').value;
        const edition = resolveAgilotextEdition();
        const row = document.querySelector('.wrapper-content_item-row[data-prompt-id="' + pid + '"]');
        const pName = row ? row.querySelector(".model-name-span").textContent : "Modele";
        fetch("https://api.agilotext.com/api/v1/updatePromptModelUser", {
          method: "POST",
          body: new URLSearchParams({
            username: userEmail,
            token: globalToken,
            edition: edition,
            promptId: pid,
            promptName: pName,
            promptContent: txt,
          }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.status === "OK") {
              popup.style.display = "none";
              if (row) updateRowTimestamp(row);
            } else {
              window.alert(d.errorMessage || "Erreur enregistrement");
            }
          })
          .catch(function (err) {
            console.error("updatePromptModelUser", err);
            window.alert("Erreur réseau lors de l'enregistrement.");
          });
      });
    }
    const pPrompt = document.getElementById("popup-prompt");
    if (pPrompt) {
      pPrompt.addEventListener("click", function (e) {
        if (e.target.classList.contains("close_background") || e.target.closest(".close-icon")) pPrompt.style.display = "none";
      });
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest(".delete-job-button_to-confirm")) {
        const row = e.target.closest(".wrapper-content_item-row");
        if (row) {
          currentPromptIdToDelete = row.getAttribute("data-prompt-id");
          const pd = document.getElementById("popup-delete");
          if (pd) pd.style.display = "flex";
        }
      }
    });
    const pd = document.getElementById("popup-delete");
    if (pd) {
      const close = function () {
        pd.style.display = "none";
        currentPromptIdToDelete = null;
      };
      const confirm = pd.querySelector(".delete-job-button_confirmed");
      if (confirm)
        confirm.onclick = function () {
          if (currentPromptIdToDelete) deletePrompt(currentPromptIdToDelete);
          close();
        };
      const cancel = pd.querySelector(".button.cancel");
      if (cancel) cancel.onclick = close;
      const icon = pd.querySelector(".close-icon");
      if (icon) icon.onclick = close;
    }
  });
})();
