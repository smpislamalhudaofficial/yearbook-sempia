(() => {
  "use strict";
  const CHANNEL = "YEARBOOK_SEMPIA_POST_V1";
  const config = window.YEARBOOK_CONFIG || {};
  const pending = new Map();

  function isGoogleResponseOrigin(origin) {
    try {
      const url = new URL(origin);
      return url.protocol === "https:" && (
        url.hostname === "script.google.com" ||
        url.hostname === "googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com")
      );
    } catch (_) { return false; }
  }
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  function cleanup(request) {
    if (request && request.iframe && request.iframe.parentNode) request.iframe.parentNode.removeChild(request.iframe);
    if (request && request.form && request.form.parentNode) request.form.parentNode.removeChild(request.form);
  }

  window.addEventListener("message", (event) => {
    if (!isGoogleResponseOrigin(event.origin)) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || typeof message.nonce !== "string") return;
    const request = pending.get(message.nonce);
    if (!request) return;
    window.clearTimeout(request.timeout);
    pending.delete(message.nonce);
    cleanup(request);
    if (message.ok) request.resolve(message.data);
    else request.reject(new Error(message.error || "Permintaan gagal."));
  });

  function endpoint() {
    const url = String(config.GAS_WEB_APP_URL || "").trim();
    if (!url || url.indexOf("PASTE_YOUR_APPS_SCRIPT") >= 0 || !/^https:\/\/script\.google\.com\/macros\/s\//.test(url)) {
      throw new Error("Backend belum dikonfigurasi. Isi GAS_WEB_APP_URL di assets/js/config.js.");
    }
    return url;
  }
  function hiddenInput(name, value) {
    const input = document.createElement("input");
    input.type = "hidden"; input.name = name; input.value = value;
    return input;
  }

  window.YearbookAPI = {
    call(action, payload = {}) {
      let url;
      try { url = endpoint(); } catch (error) { return Promise.reject(error); }
      const nonce = makeId();
      return new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        const form = document.createElement("form");
        const targetName = "yb_post_" + nonce;
        iframe.name = targetName;
        iframe.title = "YEARBOOK request response";
        iframe.className = "bridge-frame";
        iframe.setAttribute("aria-hidden", "true");
        iframe.tabIndex = -1;
        form.method = "POST";
        form.action = url;
        form.target = targetName;
        form.enctype = "application/x-www-form-urlencoded";
        form.acceptCharset = "UTF-8";
        form.append(
          hiddenInput("action", String(action)),
          hiddenInput("nonce", nonce),
          hiddenInput("payload", JSON.stringify(payload || {}))
        );
        const timeout = window.setTimeout(() => {
          const request = pending.get(nonce);
          if (!request) return;
          pending.delete(nonce); cleanup(request);
          reject(new Error("Backend belum merespons. Periksa URL deployment, FRONTEND_ORIGIN, izin Web App, lalu coba lagi."));
        }, 90000);
        pending.set(nonce, { resolve, reject, timeout, iframe, form });
        document.body.append(iframe, form);
        try { form.submit(); }
        catch (error) {
          window.clearTimeout(timeout); pending.delete(nonce); cleanup({ iframe, form });
          reject(new Error("Permintaan tidak dapat dikirim. Periksa koneksi dan konfigurasi backend."));
        }
      });
    }
  };
})();
