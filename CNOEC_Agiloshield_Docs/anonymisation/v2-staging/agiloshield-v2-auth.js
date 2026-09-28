/* Agilotext user session adapter for staging. No Python HMAC or service credential. */
(function () {
  'use strict';
  const TOKEN_URL = 'https://api.agilotext.com/api/v1/getToken';
  const edition = 'ent'; // This embed is only for /app/business/dashboard/anonymiser.
  let cached = null;
  async function currentEmail() {
    const ms = window.$memberstackDom;
    if (ms && typeof ms.getCurrentMember === 'function') {
      const member = await ms.getCurrentMember({cache:'reload'});
      const email = member?.data?.auth?.email || member?.data?.email;
      if (email) return String(email).trim().toLowerCase();
    }
    // Existing Memberstack v1 page writes this field; Java still validates its own user token.
    const field = document.querySelector('[name="memberEmail"]');
    const email = String(field?.value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Session Agilotext introuvable');
    return email;
  }
  async function getUserToken(email) {
    if (cached?.email === email && Date.now() - cached.at < 10*60*1000) return cached.token;
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),20000);
    try {
      const url = TOKEN_URL+'?username='+encodeURIComponent(email)+'&edition='+edition;
      const response = await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});
      if (!response.ok) throw new Error('Session Agilotext indisponible');
      const body=await response.json();
      if(body.status!=='OK' || typeof body.token!=='string' || !body.token)
        throw new Error('Token utilisateur Agilotext indisponible');
      cached={email,token:body.token,at:Date.now()};
      return body.token;
    } finally {clearTimeout(timer);}
  }
  window.agiloshieldV2UserHeaders = async function () {
    const email=await currentEmail();
    return {'X-Agilotext-Username':email,'X-Agilotext-Token':await getUserToken(email),
      'X-Agilotext-Edition':edition};
  };
  window.agiloshieldV2ClearUserToken = function () { cached=null; };
})();
