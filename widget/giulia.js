/* Giulia Shop – chat e voce per i negozi online.
   Installazione: <script src=".../widget/giulia.js" data-agente="agent_…" data-negozio="Nome" defer></script>
   Opzioni (attributi dello script): data-nome (nome dell'assistente), data-colore (colore principale),
   data-idee (domande di esempio separate da |), data-voce="no" (solo chat), data-posizione="sinistra". */
(function () {
  "use strict";
  if (window.__giuliaShop) return;
  window.__giuliaShop = true;

  var SDK = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.27.0/dist/lib.iife.js";
  var INATTIVITA_MS = 5 * 60 * 1000;

  var script = document.currentScript || document.querySelector("script[data-agente][src*='giulia']");
  if (!script) return;
  var cfg = {
    agente: script.getAttribute("data-agente") || "",
    negozio: script.getAttribute("data-negozio") || "",
    nome: script.getAttribute("data-nome") || "Giulia",
    colore: script.getAttribute("data-colore") || "#111111",
    voce: script.getAttribute("data-voce") !== "no",
    sinistra: script.getAttribute("data-posizione") === "sinistra",
    idee: (script.getAttribute("data-idee") || "Cerco scarpe da corsa sotto i 100 dollari|Dov'è il mio ordine?|Come funzionano i resi?").split("|").filter(Boolean).slice(0, 4),
  };
  if (!/^agent_[A-Za-z0-9]+$/.test(cfg.agente)) return;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(cfg.colore)) cfg.colore = "#111111";
  var hex = cfg.colore.length === 4 ? "#" + cfg.colore.slice(1).split("").map(function (c) { return c + c; }).join("") : cfg.colore;
  var lum = (function () {
    var v = [1, 3, 5].map(function (i) { var x = parseInt(hex.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  })();

  /* ---------- stile ---------- */
  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box}",
    ".w{--c:" + cfg.colore + ";--ct:#fff;--carta:#fff;--testo:#111;--muto:#6b6b6b;--linea:#e6e6e6;--sup:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.45;color:var(--testo);-webkit-font-smoothing:antialiased}",
    "@media (prefers-color-scheme:dark){.w{--carta:#151515;--testo:#f2f2f2;--muto:#a0a0a0;--linea:#2c2c2c;--sup:#202020}.w.cupo{--c:#f2f2f2;--ct:#111}}",
    ".lancia{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));" + (cfg.sinistra ? "left:calc(20px + env(safe-area-inset-left,0px))" : "right:calc(20px + env(safe-area-inset-right,0px))") + ";z-index:2147483000;display:flex;align-items:center;gap:10px;height:56px;padding:0 20px 0 16px;border:0;border-radius:28px;background:var(--c);color:var(--ct);font-family:inherit;font-weight:600;font-size:15px;line-height:1;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.22);transition:transform .15s ease}",
    ".lancia:hover{transform:translateY(-1px)}",
    ".lancia:focus-visible,.pannello button:focus-visible,.pannello textarea:focus-visible{outline:2px solid var(--c);outline-offset:2px}",
    ".lancia svg{width:24px;height:24px}",
    ".aperto .lancia{display:none}",
    ".pannello{position:fixed;bottom:calc(20px + env(safe-area-inset-bottom,0px));" + (cfg.sinistra ? "left:20px" : "right:20px") + ";z-index:2147483001;width:min(390px,calc(100vw - 40px));height:min(640px,calc(100vh - 40px));display:none;flex-direction:column;background:var(--carta);border:1px solid var(--linea);border-radius:18px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.28)}",
    ".aperto .pannello{display:flex}",
    "@media (max-width:520px){.pannello{inset:0;width:auto;height:auto;border-radius:0;border:0;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}",
    ".testa{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-bottom:1px solid var(--linea)}",
    ".avatar{width:38px;height:38px;border-radius:50%;background:var(--c);color:var(--ct);display:grid;place-items:center;font-weight:700;font-size:16px;flex:none}",
    ".chi{flex:1;min-width:0}",
    ".chi b{display:block;font-size:15px}",
    ".chi span{display:block;font-size:12.5px;color:var(--muto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".tondo{width:38px;height:38px;border-radius:50%;border:1px solid var(--linea);background:transparent;color:var(--testo);display:grid;place-items:center;cursor:pointer;flex:none}",
    ".tondo svg{width:18px;height:18px}",
    ".tondo.attivo{background:#d93636;border-color:#d93636;color:#fff}",
    ".corpo{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}",
    ".msg{max-width:86%;padding:10px 13px;border-radius:16px;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".msg.ai{align-self:flex-start;background:var(--sup);border-bottom-left-radius:5px}",
    ".msg.tu{align-self:flex-end;background:var(--c);color:var(--ct);border-bottom-right-radius:5px}",
    ".msg a{color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px}",
    ".nota{align-self:center;text-align:center;font-size:12.5px;color:var(--muto);max-width:92%}",
    ".scrive{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:var(--sup);border-radius:16px}",
    ".scrive i{width:6px;height:6px;border-radius:50%;background:var(--muto);animation:p 1s infinite ease-in-out}",
    ".scrive i:nth-child(2){animation-delay:.15s}.scrive i:nth-child(3){animation-delay:.3s}",
    "@keyframes p{0%,80%,100%{opacity:.3}40%{opacity:1}}",
    ".idee{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px}",
    ".idee button{border:1px solid var(--linea);background:var(--carta);color:var(--testo);border-radius:999px;padding:7px 12px;font:inherit;font-size:13.5px;cursor:pointer;text-align:left}",
    ".idee button:hover{border-color:var(--c)}",
    ".voce{display:none;align-items:center;gap:10px;margin:0 16px 10px;padding:10px 12px;border-radius:12px;background:var(--sup);font-size:13.5px}",
    ".voce.on{display:flex}",
    ".onda{width:12px;height:12px;border-radius:50%;background:#d93636;flex:none;transition:transform .1s linear}",
    ".piede{display:flex;align-items:flex-end;gap:8px;padding:10px 12px 12px;border-top:1px solid var(--linea)}",
    "textarea{flex:1;resize:none;border:1px solid var(--linea);border-radius:14px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.35;max-height:120px;min-height:44px;background:var(--carta);color:var(--testo)}",
    ".invia{width:44px;height:44px;border-radius:50%;border:0;background:var(--c);color:var(--ct);display:grid;place-items:center;cursor:pointer;flex:none}",
    ".invia[disabled]{opacity:.4;cursor:default}",
    ".invia svg{width:20px;height:20px}",
    ".privacy{padding:0 16px 10px;font-size:11.5px;color:var(--muto)}",
    "@media (prefers-reduced-motion:reduce){.lancia,.onda{transition:none}.scrive i{animation:none}}",
  ].join("");

  var IC = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1"/></svg>',
    invia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  /* ---------- SDK ElevenLabs ---------- */
  var caricamento = null;
  function sdk() {
    if (window.ElevenLabsClient) return Promise.resolve(window.ElevenLabsClient);
    if (caricamento) return caricamento;
    caricamento = new Promise(function (ok, ko) {
      var s = document.createElement("script");
      s.src = SDK; s.async = true;
      s.onload = function () { window.ElevenLabsClient ? ok(window.ElevenLabsClient) : ko(new Error("sdk")); };
      s.onerror = function () { caricamento = null; ko(new Error("sdk")); };
      document.head.appendChild(s);
    });
    return caricamento;
  }

  /* ---------- interfaccia ---------- */
  var host = document.createElement("div");
  host.setAttribute("data-giulia-shop", "");
  var root = host.attachShadow({ mode: "open" });
  var iniziale = (cfg.nome.trim()[0] || "G").toUpperCase();
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  root.innerHTML =
    "<style>" + CSS + "</style>" +
    '<div class="w' + (lum < 0.05 ? " cupo" : "") + '"' + (lum > 0.5 ? ' style="--ct:#111"' : "") + '>' +
    '<button class="lancia" type="button" aria-label="Apri la chat con ' + esc(cfg.nome) + '">' + IC.chat + "<span>Chiedi a " + esc(cfg.nome) + "</span></button>" +
    '<section class="pannello" role="dialog" aria-label="Chat con ' + esc(cfg.nome) + '">' +
    '<header class="testa"><div class="avatar" aria-hidden="true">' + esc(iniziale) + '</div>' +
    '<div class="chi"><b>' + esc(cfg.nome) + "</b><span>Assistente virtuale" + (cfg.negozio ? " di " + esc(cfg.negozio) : "") + "</span></div>" +
    (cfg.voce ? '<button class="tondo voce-btn" type="button" aria-label="Parla a voce">' + IC.tel + "</button>" : "") +
    '<button class="tondo chiudi" type="button" aria-label="Chiudi la chat">' + IC.chiudi + "</button></header>" +
    '<div class="corpo" aria-live="polite"></div>' +
    '<div class="voce" role="status"><span class="onda"></span><span class="voce-stato">Collegamento…</span></div>' +
    '<div class="idee"></div>' +
    '<p class="privacy">Parli con un\'assistente virtuale. La conversazione viene registrata per dare assistenza. Non scrivere dati di pagamento.</p>' +
    '<form class="piede"><textarea rows="1" maxlength="1000" placeholder="Scrivi un messaggio" aria-label="Messaggio"></textarea>' +
    '<button class="invia" type="submit" aria-label="Invia" disabled>' + IC.invia + "</button></form>" +
    "</section></div>";
  (document.body || document.documentElement).appendChild(host);

  var $ = function (q) { return root.querySelector(q); };
  var w = $(".w"), corpo = $(".corpo"), idee = $(".idee"), area = $("textarea"), invia = $(".invia"),
    voceBox = $(".voce"), voceStato = $(".voce-stato"), onda = $(".onda"), voceBtn = $(".voce-btn");

  var chat = null, avvioChat = null, voce = null, attesa = null, timerInattivo = null, raf = 0;

  function scorri() { corpo.scrollTop = corpo.scrollHeight; }

  // Testo con link cliccabili (solo http/https), senza HTML.
  function riempi(el, testo) {
    var re = /(https?:\/\/[^\s<>"')\]]+)/g, ultimo = 0, m;
    while ((m = re.exec(testo))) {
      if (m.index > ultimo) el.appendChild(document.createTextNode(testo.slice(ultimo, m.index)));
      var url = m[1].replace(/[.,;:!?]+$/, "");
      var a = document.createElement("a");
      a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60);
      el.appendChild(a);
      ultimo = m.index + url.length;
    }
    if (ultimo < testo.length) el.appendChild(document.createTextNode(testo.slice(ultimo)));
  }

  function aggiungi(chi, testo) {
    if (!testo) return;
    togliAttesa();
    var d = document.createElement("div");
    d.className = "msg " + chi;
    riempi(d, String(testo).replace(/\*\*(.+?)\*\*/g, "$1"));
    corpo.appendChild(d);
    scorri();
  }
  function nota(testo) {
    var p = document.createElement("p"); p.className = "nota"; p.textContent = testo; corpo.appendChild(p); scorri();
  }
  function mostraAttesa() {
    if (attesa) return;
    attesa = document.createElement("div"); attesa.className = "scrive"; attesa.setAttribute("aria-label", cfg.nome + " sta scrivendo");
    attesa.innerHTML = "<i></i><i></i><i></i>";
    corpo.appendChild(attesa); scorri();
  }
  function togliAttesa() { if (attesa) { attesa.remove(); attesa = null; } }

  function mostraIdee() {
    idee.innerHTML = "";
    cfg.idee.forEach(function (t) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = t;
      b.addEventListener("click", function () { manda(t); });
      idee.appendChild(b);
    });
  }

  function rinnovaInattivita() {
    clearTimeout(timerInattivo);
    timerInattivo = setTimeout(function () {
      if (chat) { chiudiChat(); nota("Conversazione chiusa per inattività. Scrivi per ricominciare."); }
    }, INATTIVITA_MS);
  }

  function chiudiChat() {
    var c = chat; chat = null; avvioChat = null; togliAttesa();
    if (c) { try { c.endSession(); } catch (e) { /* già chiusa */ } }
  }

  function avviaChat() {
    if (chat) return Promise.resolve(chat);
    if (avvioChat) return avvioChat;
    mostraAttesa();
    avvioChat = sdk().then(function (S) {
      return S.Conversation.startSession({
        agentId: cfg.agente,
        textOnly: true,
        connectionType: "websocket",
        onMessage: function (p) {
          if (!p || !p.message) return;
          aggiungi(p.source === "ai" || p.role === "agent" ? "ai" : "tu", p.message);
          rinnovaInattivita();
        },
        onDisconnect: function () { if (chat) { chat = null; avvioChat = null; togliAttesa(); } },
        onError: function () { togliAttesa(); },
      });
    }).then(function (c) { chat = c; rinnovaInattivita(); return c; })
      .catch(function (e) {
        avvioChat = null; togliAttesa();
        nota(cfg.nome + " non è raggiungibile in questo momento. Riprova tra poco.");
        throw e;
      });
    return avvioChat;
  }

  function manda(testo) {
    testo = String(testo || "").trim();
    if (!testo) return;
    if (voce) { nota("Stai parlando a voce: termina la chiamata per scrivere."); return; }
    idee.innerHTML = "";
    aggiungi("tu", testo);
    area.value = ""; invia.disabled = true; area.style.height = "";
    var nuova = !chat;
    avviaChat().then(function (c) {
      // Alla prima apertura aspetta il saluto di Giulia prima di mandare il messaggio.
      setTimeout(function () { mostraAttesa(); try { c.sendUserMessage(testo); } catch (e) { togliAttesa(); } rinnovaInattivita(); }, nuova ? 600 : 0);
    }).catch(function () { /* già segnalato */ });
  }

  /* ---------- voce ---------- */
  function anima() {
    if (!voce) return;
    var v = 0;
    try { v = Math.max(voce.getOutputVolume ? voce.getOutputVolume() : 0, voce.getInputVolume ? voce.getInputVolume() * 0.7 : 0); } catch (e) { /* niente */ }
    onda.style.transform = "scale(" + (1 + Math.min(v, 1) * 1.2).toFixed(2) + ")";
    raf = requestAnimationFrame(anima);
  }
  function fineVoce(msg) {
    cancelAnimationFrame(raf);
    var v = voce; voce = null;
    voceBox.classList.remove("on");
    if (voceBtn) { voceBtn.classList.remove("attivo"); voceBtn.setAttribute("aria-label", "Parla a voce"); }
    area.disabled = false;
    if (v) { try { v.endSession(); } catch (e) { /* già chiusa */ } }
    if (msg) nota(msg);
  }
  function avviaVoce() {
    chiudiChat();
    idee.innerHTML = "";
    voceBox.classList.add("on"); voceStato.textContent = "Collegamento…";
    voceBtn.classList.add("attivo"); voceBtn.setAttribute("aria-label", "Termina la chiamata");
    area.disabled = true;
    var avvio = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); })
      : Promise.reject(new Error("microfono"));
    avvio.then(sdk, function () { throw new Error("microfono"); }).then(function (S) {
      return S.Conversation.startSession({
        agentId: cfg.agente,
        connectionType: "webrtc",
        onConnect: function () { voceStato.textContent = cfg.nome + " ti ascolta"; raf = requestAnimationFrame(anima); },
        onModeChange: function (p) { if (voce) voceStato.textContent = p && p.mode === "speaking" ? cfg.nome + " sta parlando" : cfg.nome + " ti ascolta"; },
        onMessage: function (p) { if (p && p.message) aggiungi(p.source === "ai" || p.role === "agent" ? "ai" : "tu", p.message); },
        onDisconnect: function () { if (voce) fineVoce("Chiamata terminata."); },
        onError: function () { /* gestito alla chiusura */ },
      });
    }).then(function (v) { voce = v; }).catch(function (e) {
      fineVoce(e && e.message === "microfono"
        ? "Per parlare a voce serve il permesso del microfono."
        : cfg.nome + " non è raggiungibile a voce in questo momento. Puoi scrivere qui.");
    });
  }

  /* ---------- eventi ---------- */
  var primaVolta = true;
  $(".lancia").addEventListener("click", function () {
    w.classList.add("aperto");
    if (primaVolta) { primaVolta = false; mostraIdee(); avviaChat().catch(function () {}); }
    setTimeout(function () { area.focus(); }, 50);
  });
  $(".lancia").addEventListener("pointerenter", function () { sdk().catch(function () {}); }, { once: true });
  $(".chiudi").addEventListener("click", function () { w.classList.remove("aperto"); if (voce) fineVoce("Chiamata terminata."); });
  if (voceBtn) voceBtn.addEventListener("click", function () { if (voce || voceBox.classList.contains("on")) fineVoce("Chiamata terminata."); else avviaVoce(); });
  area.addEventListener("input", function () {
    invia.disabled = !area.value.trim();
    area.style.height = "auto"; area.style.height = Math.min(area.scrollHeight, 120) + "px";
  });
  area.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); manda(area.value); }
  });
  $(".piede").addEventListener("submit", function (e) { e.preventDefault(); manda(area.value); });
  root.addEventListener("keydown", function (e) { if (e.key === "Escape" && w.classList.contains("aperto")) $(".chiudi").click(); });
  window.addEventListener("pagehide", function () { chiudiChat(); if (voce) fineVoce(); });
})();
