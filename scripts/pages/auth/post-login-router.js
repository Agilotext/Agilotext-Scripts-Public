/* ===================================================== */
/* AGILOTEXT - POST LOGIN ROUTER v8.3 (/auth/post-login) */
/* Transcription (Free/Pro/Business) prime sur Agiloshield */
/* v8: sièges business via joinedTeams (sans garde ownedTeams===0) */
/* v8.1: legacy pln_anonymisation → /tools/agiloshield/premium/dashboard */
/* v8.2: pln_cse-* (pas pln_pack-cse) → dashboard business */
/* v8.3: price IDs CSE89 / CSE89Y → dashboard business */
/* v8.4: POST /auth/refresh si jeton Free encore en cache après élévation CSE/Business */
/* ===================================================== */
/* Déploiement Webflow : coller ce script sur la page /auth/post-login */
/* Collage live : seulement après OK Florian. Fichier repo ≠ page Webflow. */

(function (root) {
  "use strict";

  const VERSION = "v8.4";
  const API_BASE = "https://api.agilotext.com/api/v1";
  const FREE_PLAN_ID = "pln_free-njg10umr";
  const AGILOSHIELD_CLASSIC_PRICE_ID = "prc_classic-mensuel-3u5vr0uq5";
  const CSE_PRICE_IDS = new Set([
    "prc_cse89y-jl40a31",
    "prc_cse89-8230aqy"
  ]);
  const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING", "GRACE"]);

  function normalizeStatus(status) {
    return String(status || "").toUpperCase();
  }

  function getConnections(member) {
    return Array.isArray(member?.planConnections) ? member.planConnections : [];
  }

  function getPlans(member) {
    return Array.isArray(member?.plans) ? member.plans : [];
  }

  function isFreeLikePlan(plan) {
    const id = String(plan?.planId || plan?.plan?.id || plan?.id || "").toLowerCase();
    const name = String(plan?.planName || plan?.name || "").toLowerCase();
    const type = String(plan?.type || "").toUpperCase();
    return id.startsWith("pln_free") || name.includes("free") || type === "FREE";
  }

  function isPlanObjectActive(plan) {
    const status = normalizeStatus(plan?.status);
    if (status) return ACTIVE_STATUSES.has(status);
    if (typeof plan?.active === "boolean") return plan.active;
    return false;
  }

  function getPlanId(plan) {
    return String(plan?.planId || plan?.plan?.id || plan?.id || "");
  }

  function getPriceId(plan) {
    const payment = plan?.payment || {};
    return String(payment.priceId || plan?.priceId || "");
  }

  function getPlanLabel(plan) {
    const payment = plan?.payment || {};
    return [
      plan?.planId,
      plan?.planName,
      plan?.name,
      plan?.priceName,
      payment?.priceName,
      payment?.priceId
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function hasPlanPrefix(member, prefix) {
    const connections = getConnections(member);

    if (connections.length > 0) {
      return connections.some((p) => {
        const status = normalizeStatus(p?.status);
        const id = getPlanId(p);
        return ACTIVE_STATUSES.has(status) && id.startsWith(prefix);
      });
    }

    return getPlans(member).some((p) => {
      const id = getPlanId(p);
      return isPlanObjectActive(p) && id.startsWith(prefix);
    });
  }

  function hasAgiloshieldClassic(member) {
    function matches(plan) {
      const planId = getPlanId(plan);
      const priceId = getPriceId(plan);
      const label = getPlanLabel(plan);
      return planId.indexOf("pln_agiloshield") === 0 ||
        planId.indexOf("pln_agiloshield-classic") === 0 ||
        priceId === AGILOSHIELD_CLASSIC_PRICE_ID ||
        label.indexOf("agiloshield") !== -1 ||
        label.indexOf("classic mensuel") !== -1;
    }

    const connections = getConnections(member);
    if (connections.length > 0) {
      return connections.some((p) => ACTIVE_STATUSES.has(normalizeStatus(p?.status)) && matches(p));
    }
    return getPlans(member).some((p) => isPlanObjectActive(p) && matches(p));
  }

  function hasCsePlan(member) {
    if (hasPlanPrefix(member, "pln_cse-")) return true;

    function matchesPrice(plan) {
      return CSE_PRICE_IDS.has(getPriceId(plan));
    }

    const connections = getConnections(member);
    if (connections.length > 0) {
      return connections.some((p) => ACTIVE_STATUSES.has(normalizeStatus(p?.status)) && matchesPrice(p));
    }
    return getPlans(member).some((p) => isPlanObjectActive(p) && matchesPrice(p));
  }

  function hasFreePlan(member) {
    if (hasPlanPrefix(member, "pln_free")) return true;

    const connections = getConnections(member);

    if (connections.length > 0) {
      return connections.some((p) => {
        const status = normalizeStatus(p?.status);
        const name = String(p?.planName || p?.plan?.name || "").toLowerCase();
        return ACTIVE_STATUSES.has(status) && name.includes("free");
      });
    }

    return getPlans(member).some((p) => {
      const name = String(p?.name || "").toLowerCase();
      return (isPlanObjectActive(p) && name.includes("free")) || isFreeLikePlan(p);
    });
  }

  /**
   * Signaux équipe Memberstack.
   * isSeat : membre d'au moins une équipe rejointe (siège business).
   * Ne pas exiger ownedTeams.length === 0 : un siège peut posséder une ancienne équipe annulée.
   */
  function getTeamSignals(member) {
    const teams = member?.teams ?? { belongsToTeam: false, ownedTeams: [], joinedTeams: [] };
    const belongsToTeam = Boolean(teams.belongsToTeam);
    const ownedTeams = Array.isArray(teams.ownedTeams) ? teams.ownedTeams : [];
    const joinedTeams = Array.isArray(teams.joinedTeams) ? teams.joinedTeams : [];

    const hasTeamMembership = belongsToTeam && (ownedTeams.length > 0 || joinedTeams.length > 0);
    const isOwner = belongsToTeam && ownedTeams.length > 0;
    const isSeat = belongsToTeam && joinedTeams.length > 0;

    return { hasTeamMembership, isOwner, isSeat, joinedTeams, ownedTeams };
  }

  function getEditionSignals(member) {
    const team = getTeamSignals(member);
    const hasLegacyAnon = hasPlanPrefix(member, "pln_anonymisation");
    const hasAgiloshield = hasAgiloshieldClassic(member);
    const hasBusiness = hasPlanPrefix(member, "pln_business");
    const hasCse = hasCsePlan(member);
    const hasPro = hasPlanPrefix(member, "pln_pro");
    const hasFree = hasFreePlan(member);
    const hasTranscription = hasBusiness || hasCse || hasPro || hasFree || team.hasTeamMembership;
    return {
      hasLegacyAnon,
      hasAgiloshield,
      hasBusiness,
      hasCse,
      hasPro,
      hasFree,
      hasTranscription,
      isOwner: team.isOwner,
      isSeat: team.isSeat,
      hasTeamMembership: team.hasTeamMembership
    };
  }

  function resolveRoute(signals, onboardingDone) {
    if (!onboardingDone) {
      return { targetRoute: "/auth/setup", decisionReason: "onboarding_incomplete" };
    }
    if (signals.hasBusiness || signals.hasCse || signals.isSeat) {
      var cseReason = "active_cse_plan";
      var reason = "team_seat_membership";
      if (signals.hasBusiness) reason = "active_business_plan";
      else if (signals.hasCse) reason = cseReason;
      return {
        targetRoute: "/app/business/dashboard",
        decisionReason: reason
      };
    }
    if (signals.hasPro) {
      return { targetRoute: "/app/premium/dashboard", decisionReason: "active_pro_plan" };
    }
    if (signals.hasFree) {
      return { targetRoute: "/app/free/dashboard", decisionReason: "active_free_plan" };
    }
    if (signals.hasLegacyAnon) {
      return {
        targetRoute: "/tools/agiloshield/premium/dashboard",
        decisionReason: "active_legacy_anonymisation_plan"
      };
    }
    if (signals.hasAgiloshield) {
      return {
        targetRoute: "/tools/agiloshield/premium/dashboard",
        decisionReason: "active_agiloshield_classic_only"
      };
    }
    return { targetRoute: "/app/free/dashboard", decisionReason: "fallback_free" };
  }

  var api = {
    VERSION: VERSION,
    resolveRoute: resolveRoute,
    getEditionSignals: getEditionSignals,
    getTeamSignals: getTeamSignals,
    hasPlanPrefix: hasPlanPrefix,
    hasFreePlan: hasFreePlan,
    hasCsePlan: hasCsePlan,
    hasAgiloshieldClassic: hasAgiloshieldClassic
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.AgiloPostLoginRouter = api;

  if (typeof document === "undefined") return;

  document.addEventListener("DOMContentLoaded", async () => {
    if (!/^\/auth\/post-login\/?$/.test(window.location.pathname || "")) return;
    if (window.__agiloPostLoginScriptInit) return;
    window.__agiloPostLoginScriptInit = true;

    const flowId = "postlogin_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

    const log = (event, payload = {}) => {
      console.info("[AGILO_POST_LOGIN]", {
        flow_id: flowId,
        version: VERSION,
        page: window.location.pathname,
        event,
        ...payload
      });
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function refreshAgilotextSession(email, fromEdition, sessionToken) {
      if (!email || !sessionToken) return null;
      try {
        const r = await fetch(API_BASE + "/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          cache: "no-store",
          credentials: "omit",
          body: JSON.stringify({
            email: email,
            sessionToken: sessionToken,
            edition: fromEdition || "free"
          })
        });
        const data = await r.json();
        if (!r.ok || String(data.status || "").toUpperCase() !== "OK") {
          log("auth_refresh_http", { http: r.status, status: data.status || "" });
          return null;
        }
        log("auth_refresh_ok", {
          memberEdition: (data.member && data.member.edition) || data.edition || ""
        });
        return data;
      } catch (err) {
        log("auth_refresh_error", { error: String((err && err.message) || err) });
        return null;
      }
    }

    function persistRefreshedSession(email, data) {
      const member = data.member || {};
      const specEd = String(member.edition || data.edition || "business").toLowerCase();
      const tokenEd = (specEd === "business" || specEd === "enterprise" || specEd === "ent") ? "ent" : specEd;
      const token = data.sessionToken || data.token || "";
      if (!token) {
        log("auth_refresh_no_new_token");
        return;
      }
      const keyEmail = String(email || "").toLowerCase();
      try {
        localStorage.setItem("agilo:edition", specEd === "ent" ? "business" : specEd);
        localStorage.setItem("agilo:token:" + tokenEd + ":" + keyEmail, token);
        window.globalToken = token;
      } catch (_) { /* ignore */ }
    }

    async function waitForMemberstack(timeoutMs = 12000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (window.$memberstackDom) return window.$memberstackDom;
        await sleep(120);
      }
      return null;
    }

    function teamsDataUsable(member) {
      const teams = member?.teams;
      if (!teams || typeof teams !== "object") return false;
      if (Array.isArray(teams.joinedTeams) || Array.isArray(teams.ownedTeams)) return true;
      if (typeof teams.belongsToTeam === "boolean") return true;
      return false;
    }

    async function verifyAccessViaBackend(email) {
      const normalized = String(email || "").trim();
      if (!normalized) return null;

      try {
        const url = `${API_BASE}/member-access?username=${encodeURIComponent(normalized)}`;
        const r = await fetch(url, { cache: "no-store", credentials: "omit" });
        if (!r.ok) {
          log("backend_member_access_http", { status: r.status });
          return null;
        }
        const data = await r.json();
        if (!data || typeof data !== "object") return null;

        const hasBusiness = Boolean(data.hasBusiness);
        const isSeat = Boolean(data.isSeat);
        const edition = String(data.edition || "").toLowerCase();

        log("backend_member_access_ok", { hasBusiness, isSeat, edition });
        return { hasBusiness, isSeat, edition };
      } catch (err) {
        log("backend_member_access_error", { error: String(err?.message || err) });
        return null;
      }
    }

    async function mergeBackendTeamSignals(member, signals) {
      const email = (member?.auth && member.auth.email) || member?.email || "";
      if (teamsDataUsable(member)) return signals;

      log("teams_missing_or_empty", { memberId: member?.id, email });
      const backend = await verifyAccessViaBackend(email);
      if (!backend) return signals;

      return {
        ...signals,
        hasBusiness: signals.hasBusiness || backend.hasBusiness,
        isSeat: signals.isSeat || backend.isSeat,
        hasTeamMembership: signals.hasTeamMembership || backend.isSeat || backend.hasBusiness,
        hasTranscription:
          signals.hasTranscription ||
          backend.hasBusiness ||
          backend.isSeat ||
          signals.hasPro ||
          signals.hasFree
      };
    }

    function hasEnoughDataToRedirect(member) {
      const connections = getConnections(member);
      const plans = getPlans(member);

      const hasActiveConnection = connections.some((p) => ACTIVE_STATUSES.has(normalizeStatus(p?.status)));
      if (hasActiveConnection) return true;

      if (connections.length === 0 && plans.some((p) => isPlanObjectActive(p) || isFreeLikePlan(p))) return true;

      const loginRedirect = String(member?.loginRedirect || "");
      if (loginRedirect.startsWith("/app/free/")) return true;

      const onboardingRaw = String(member?.customFields?.["onboarding-done"] || "").toLowerCase();
      if (onboardingRaw && !["1", "true", "skipped"].includes(onboardingRaw)) return true;

      const teamSignals = getTeamSignals(member);
      if (teamSignals.hasTeamMembership) return true;

      return false;
    }

    async function fetchMemberStable(ms, maxMs = 7000) {
      let lastMember = null;
      let attempts = 0;
      const started = Date.now();

      while (Date.now() - started < maxMs) {
        attempts += 1;
        try {
          const { data: member } = await ms.getCurrentMember({ useCache: false });
          if (!member) {
            const elapsed = Date.now() - started;
            const delayMs = elapsed < 1200 ? 150 : elapsed < 3500 ? 260 : 420;
            await sleep(delayMs);
            continue;
          }

          lastMember = member;
          if (hasEnoughDataToRedirect(member)) return member;
        } catch (err) {
          log("get_current_member_error", { attempt: attempts, error: String(err?.message || err) });
        }

        const elapsed = Date.now() - started;
        const delayMs = elapsed < 1200 ? 150 : elapsed < 3500 ? 260 : 420;
        await sleep(delayMs);
      }

      log("member_stabilization_timeout", {
        attempts,
        waitedMs: Date.now() - started,
        hasLastMember: Boolean(lastMember)
      });

      return lastMember;
    }

    function summarizePlanConnections(member) {
      return getConnections(member).map((p) => ({
        planId: getPlanId(p),
        status: normalizeStatus(p?.status),
        active: typeof p?.active === "boolean" ? p.active : null
      }));
    }

    const ms = await waitForMemberstack();
    if (!ms) {
      log("memberstack_unavailable");
      window.location.replace("/auth/login?auth_error=member_timeout");
      return;
    }

    let member = await fetchMemberStable(ms);
    if (!member) {
      log("member_not_found_after_retries");
      window.location.replace("/auth/login?auth_error=member_timeout");
      return;
    }

    let signals = getEditionSignals(member);
    signals = await mergeBackendTeamSignals(member, signals);

    let anyPlan = signals.hasTranscription || signals.hasLegacyAnon || signals.hasAgiloshield;

    if (!anyPlan) {
      log("no_plan_detected", { freePlanId: FREE_PLAN_ID });
      try {
        const precCheck = await ms.getCurrentMember({ useCache: false });
        const pc = precCheck && precCheck.data;
        if (pc) {
          signals = getEditionSignals(pc);
          signals = await mergeBackendTeamSignals(pc, signals);
          anyPlan = signals.hasTranscription || signals.hasLegacyAnon || signals.hasAgiloshield;
          if (anyPlan) member = pc;
        }
      } catch (_) { /* ignore */ }

      if (!anyPlan) {
        try {
          await ms.addPlan({ planId: FREE_PLAN_ID });
          log("auto_assign_free_success");
          await sleep(700);
          const refreshed = await ms.getCurrentMember({ useCache: false });
          if (refreshed && refreshed.data) {
            member = refreshed.data;
            signals = getEditionSignals(member);
            signals = await mergeBackendTeamSignals(member, signals);
            log("member_refreshed_after_assign", { hasFree: signals.hasFree });
          } else {
            signals.hasFree = true;
            log("member_refresh_failed_after_assign");
          }
        } catch (err) {
          const errMsg = String(err?.message || err).toLowerCase();
          if (errMsg.includes("already") || errMsg.includes("existing")) {
            log("auto_assign_already_exists");
            signals.hasFree = true;
          } else {
            log("auto_assign_free_error", { error: errMsg });
            signals.hasFree = true;
          }
        }
      }
    }

    const onboardingDone = Boolean(member.customFields) && (
      member.customFields["onboarding-done"] === "1" ||
      member.customFields["onboarding-done"] === "true" ||
      member.customFields["onboarding-done"] === "skipped"
    );

    log("plan_signals", {
      memberId: member.id,
      email: (member.auth && member.auth.email) || "",
      hasBusiness: signals.hasBusiness,
      hasCse: signals.hasCse,
      hasPro: signals.hasPro,
      hasFree: signals.hasFree,
      hasLegacyAnon: signals.hasLegacyAnon,
      hasAgiloshield: signals.hasAgiloshield,
      hasTranscription: signals.hasTranscription,
      isSeat: signals.isSeat,
      isOwner: signals.isOwner,
      planConnections: summarizePlanConnections(member)
    });

    let edition = "free";
    if (signals.hasBusiness || signals.hasCse || signals.isSeat) edition = "business";
    else if (signals.hasPro) edition = "pro";
    else if (signals.hasFree) edition = "free";
    else if (signals.hasLegacyAnon) edition = "anonymisation";

    const mobileAuthData = localStorage.getItem("agilotext_mobile_auth");
    if (mobileAuthData) {
      try {
        const { source, returnUrl } = JSON.parse(mobileAuthData);
        if (source === "mobile") {
          localStorage.removeItem("agilotext_mobile_auth");

          const callbackUrl = new URL(returnUrl || "agilotext://auth/callback");
          callbackUrl.searchParams.set("email", member.auth?.email || "");
          callbackUrl.searchParams.set("memberId", member.id || "");
          callbackUrl.searchParams.set("edition", edition);
          callbackUrl.searchParams.set("verified", member.verified ? "true" : "false");

          const features = {
            anonymisation: signals.hasLegacyAnon || signals.hasAgiloshield,
            exports: signals.hasPro || signals.hasBusiness || signals.hasCse || signals.isSeat,
            isSeat: signals.isSeat,
            isOwner: signals.isOwner
          };
          callbackUrl.searchParams.set("features", JSON.stringify(features));

          if (member.stripeCustomerId) {
            callbackUrl.searchParams.set("stripeId", member.stripeCustomerId);
          }

          log("route_decision", {
            memberId: member.id,
            email: member.auth?.email || "",
            targetRoute: callbackUrl.toString(),
            decisionReason: "mobile_callback",
            hasAgiloshield: signals.hasAgiloshield,
            hasLegacyAnon: signals.hasLegacyAnon,
            hasTranscription: signals.hasTranscription,
            planConnections: summarizePlanConnections(member)
          });

          window.location.href = callbackUrl.toString();
          return;
        }
      } catch (e) {
        log("mobile_auth_parse_error", { error: String(e?.message || e) });
        localStorage.removeItem("agilotext_mobile_auth");
      }
    }

    // Invite équipe en attente (ex. : OAuth Google depuis la page join-team).
    // Le membre est arrivé via son loginRedirect au lieu de /auth/post-login ;
    // on le renvoie vers join-team (déjà connecté) pour que Memberstack applique l'invite.
    const pendingInviteCode = localStorage.getItem("pendingInviteCode");
    if (pendingInviteCode && !signals.isSeat && !signals.hasTeamMembership) {
      localStorage.removeItem("pendingInviteCode");
      log("pending_invite_redirect", { pendingInviteCode });
      window.location.replace(
        "/auth/join-team?inviteToken=" + encodeURIComponent(pendingInviteCode) + "&_from=pl"
      );
      return;
    }
    if (pendingInviteCode) {
      localStorage.removeItem("pendingInviteCode");
    }

    try {
      await ms.updateMember({ loginRedirect: "/auth/post-login" });
    } catch (_) { /* non critique, Memberstack DOM peut ne pas exposer loginRedirect */ }

    const route = resolveRoute(signals, onboardingDone);

    if (edition === "business") {
      const email = (member.auth && member.auth.email) || member.email || "";
      const keyEmail = String(email || "").toLowerCase();
      let oldToken = "";
      try {
        oldToken = localStorage.getItem("agilo:token:free:" + keyEmail) || "";
        if (!oldToken) oldToken = localStorage.getItem("agilo:token:ent:" + keyEmail) || "";
        if (!oldToken && window.globalToken) oldToken = String(window.globalToken);
      } catch (_) { /* ignore */ }
      if (oldToken) {
        const refreshed = await refreshAgilotextSession(email, "free", oldToken);
        if (refreshed) persistRefreshedSession(email, refreshed);
        else log("auth_refresh_failed_or_empty");
      } else {
        log("auth_refresh_no_cached_token");
      }
    }

    log("route_decision", {
      memberId: member.id,
      email: member.auth?.email || "",
      targetRoute: route.targetRoute,
      decisionReason: route.decisionReason,
      planConnections: summarizePlanConnections(member),
      hasBusiness: signals.hasBusiness,
      hasCse: signals.hasCse,
      hasPro: signals.hasPro,
      hasFree: signals.hasFree,
      hasLegacyAnon: signals.hasLegacyAnon,
      hasAgiloshield: signals.hasAgiloshield,
      hasTranscription: signals.hasTranscription,
      hasTeamMembership: signals.hasTeamMembership,
      isOwner: signals.isOwner,
      isSeat: signals.isSeat
    });

    window.location.replace(route.targetRoute);
  });
})(typeof window !== "undefined" ? window : globalThis);
