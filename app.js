/* Giulia Shop – pannello negozi.
   Tutto passa dalla funzione giulia-shop: si entra con il link d'invito, che diventa una sessione
   del pannello (valida 30 giorni). Il browser non legge mai il database direttamente. */
"use strict";

const FUNZIONE = "https://mghimjgrcfqcpsizfcui.supabase.co/functions/v1/giulia-shop";
const CHIAVE_SESSIONE = "giulia-shop-sessione";

// La sessione resta nel browser; se la memoria del browser non è disponibile vale solo finché la pagina è aperta.
const memoria = {
  _m: {},
  get(k) { try { return localStorage.getItem(k); } catch { return this._m[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { this._m[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete this._m[k]; } },
};

/* ---------------- stato ---------------- */
const S = {
  utente: null,        // { email, admin, negozi }
  negozi: [],
  negozio: null,
  vista: "oggi",
  filtroRichieste: "aperte",
  filtroCanale: "tutti",
  cercaClienti: "",
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- utilità ---------------- */
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const TZ = "Europe/Rome";
const fData = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, day: "numeric", month: "short" });
const fDataLunga = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fOra = new Intl.DateTimeFormat("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fMese = new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", month: "long", year: "numeric" });

function giornoRoma(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

function quando(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min} min fa`;
  if (giornoRoma(d) === giornoRoma(new Date())) return fOra.format(d);
  const ieri = new Date(Date.now() - 86400000);
  if (giornoRoma(d) === giornoRoma(ieri)) return "ieri " + fOra.format(d);
  return fData.format(d);
}

function attesa(iso) {
  const ore = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (ore < 1) return "da meno di un'ora";
  if (ore < 24) return `da ${Math.floor(ore)} ${Math.floor(ore) === 1 ? "ora" : "ore"}`;
  const g = Math.floor(ore / 24);
  return `da ${g} ${g === 1 ? "giorno" : "giorni"}`;
}

function durata(sec) {
  if (sec == null) return "";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}:${String(s).padStart(2, "0")} min` : `${s} s`;
}

const codiceRichiesta = (id) => "R-" + String(id).replace(/-/g, "").slice(0, 6).toUpperCase();

const TIPI = {
  reso: "Reso", cambio: "Cambio", rimborso: "Rimborso", problema_ordine: "Problema ordine",
  info_prodotto: "Info prodotto", richiamata: "Da richiamare", altro: "Altro",
};
const STATI = { aperta: "Aperta", in_lavorazione: "In lavorazione", chiusa: "Chiusa" };
const CANALI = { telefono: "Telefono", whatsapp: "WhatsApp", sito: "Chat sito", prova: "Prova" };
const ARGOMENTI_INFO = [
  ["spedizioni", "Spedizioni", "Costi, tempi, corrieri, paesi serviti."],
  ["resi", "Resi, cambi e rimborsi", "Giorni per il reso, condizioni, chi paga, tempi del rimborso."],
  ["pagamenti", "Pagamenti", "Metodi accettati, rate, contrassegno, fattura."],
  ["taglie", "Taglie", "Tabella taglie e consigli sulla calzata."],
  ["contatti", "Contatti", "Come raggiungervi, negozio fisico, social."],
  ["orari", "Orari", "Quando rispondono gli operatori."],
  ["tempi_risposta", "Tempi di risposta", "Cosa promette Giulia quando registra una richiesta. Esempio: entro 24 ore lavorative."],
];

const ICONE = {
  telefono: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>',
  sito: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

function etichettaCanale(c) {
  if (!c) return "";
  return `<span class="etichetta spenta">${ICONE[c] ?? ""}${esc(CANALI[c] ?? c)}</span>`;
}

function etichettaStato(s) {
  const cls = s === "aperta" ? "" : s === "in_lavorazione" ? "tratteggio" : "spenta";
  return `<span class="etichetta ${cls}">${esc(STATI[s] ?? s)}</span>`;
}

const ERRORI = {
  link_non_valido: "Il link non è valido. Controlla di averlo aperto per intero.",
  link_scaduto: "Il link è scaduto o è già stato usato troppe volte. Chiedine uno nuovo.",
  non_autorizzato: "La sessione è scaduta. Riapri il link d'invito.",
  negozio_non_trovato: "Negozio non trovato o non accessibile.",
  credenziali_incomplete: "Mancano dei dati: controlla i campi.",
  credenziali_mancanti: "Il negozio non è ancora collegato.",
  piattaforma_non_ancora_attiva: "Questa piattaforma sarà disponibile a breve.",
  email_non_valida: "L'email non è valida.",
  vietato: "Non hai i permessi per questa operazione.",
  non_puoi_disattivare_te_stesso: "Non puoi disattivare il tuo stesso accesso.",
  conversazione_non_trovata: "Conversazione non trovata.",
  conversazione_non_valida: "Questa è una conversazione di prova: la trascrizione non è disponibile.",
};
ERRORI.rete = "Connessione assente. Controlla la rete e riprova.";
ERRORI.credenziali_shopify_non_valide = "Shopify ha rifiutato le chiavi: ricontrolla indirizzo, Client ID e Client secret.";
ERRORI.permessi_insufficienti = "L'app Shopify non ha i permessi di lettura su prodotti, ordini e clienti.";
const testoErrore = (e) => ERRORI[e?.message] ?? "Qualcosa non ha funzionato. Riprova tra poco.";

let avvisoTimer;
function avviso(msg) {
  const el = $("#avviso");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(avvisoTimer);
  avvisoTimer = setTimeout(() => (el.hidden = true), 3200);
}

async function copia(testo, input) {
  try {
    await navigator.clipboard.writeText(testo);
    avviso("Copiato");
  } catch {
    if (input) { input.focus(); input.select(); }
    avviso("Seleziona e copia il testo");
  }
}

/* ---------------- chiamate alla funzione ---------------- */
async function api(azione, dati = {}) {
  const headers = { "content-type": "application/json" };
  const sessione = memoria.get(CHIAVE_SESSIONE);
  if (sessione) headers["x-sessione"] = sessione;
  let r;
  try {
    r = await fetch(FUNZIONE, { method: "POST", headers, body: JSON.stringify({ azione, ...dati }) });
  } catch {
    throw new Error("rete");
  }
  let j = {};
  try { j = await r.json(); } catch { /* risposta vuota */ }
  if (r.status === 401) {
    memoria.del(CHIAVE_SESSIONE);
    if (azione !== "entra") mostraAccesso("Sessione scaduta", "Riapri il link d'invito per entrare di nuovo.");
  }
  if (!r.ok || j.errore) throw new Error(j.errore || "http_" + r.status);
  return j;
}

/* ---------------- accesso ---------------- */
function mostraAccesso(titolo, testo) {
  $("#schermo-app").hidden = true;
  $("#schermo-accesso").hidden = false;
  if (titolo) $("#accesso-titolo").textContent = titolo;
  if (testo) $("#accesso-testo").textContent = testo;
}

async function avvio() {
  const m = location.hash.match(/invito=([0-9a-f]{48})/);
  if (m) {
    history.replaceState(null, "", location.pathname + location.search);
    mostraAccesso("Accesso in corso…", "Un attimo, stiamo aprendo il tuo pannello.");
    try {
      const vecchia = memoria.get(CHIAVE_SESSIONE);
      if (vecchia) { await api("esci").catch(() => {}); memoria.del(CHIAVE_SESSIONE); }
      const r = await api("entra", { invito: m[1] });
      memoria.set(CHIAVE_SESSIONE, r.sessione);
    } catch (e) {
      mostraAccesso("Non è stato possibile entrare", testoErrore(e));
      return;
    }
  }
  if (!memoria.get(CHIAVE_SESSIONE)) { mostraAccesso(); return; }
  try {
    S.utente = await api("chi_sono");
  } catch (e) {
    if (e.message !== "non_autorizzato") mostraAccesso("Non è stato possibile entrare", testoErrore(e));
    else mostraAccesso("Accesso non attivo", "Il tuo accesso non è attivo o la sessione è scaduta. Riapri il link d'invito.");
    return;
  }
  caricaNegozi();
  $("#schermo-accesso").hidden = true;
  $("#schermo-app").hidden = false;
  vai(location.hash.replace("#", "") || "oggi");
}

function caricaNegozi() {
  S.negozi = S.utente.negozi ?? [];
  const scelto = memoria.get("giulia-shop-negozio");
  S.negozio = S.negozi.find((n) => n.id === scelto) ?? S.negozi[0] ?? null;
  const sel = $("#negozio");
  sel.innerHTML = S.negozi.map((n) => `<option value="${n.id}">${esc(n.nome)}</option>`).join("");
  if (S.negozio) sel.value = S.negozio.id;
  $("#scegli-negozio").hidden = S.negozi.length < 2;
}


/* ---------------- navigazione ---------------- */
const VISTE = { oggi: vistaOggi, richieste: vistaRichieste, conversazioni: vistaConversazioni, clienti: vistaClienti, negozio: vistaNegozio };

function vai(vista) {
  if (!VISTE[vista]) vista = "oggi";
  S.vista = vista;
  $$(".nav button").forEach((b) => b.setAttribute("aria-current", b.dataset.vista === vista ? "page" : "false"));
  if (location.hash !== "#" + vista) history.replaceState(null, "", "#" + vista);
  disegna();
}

async function disegna() {
  const c = $("#contenuto");
  if (!S.negozio) {
    c.innerHTML = `<div class="vuoto-stato">Nessun negozio collegato al tuo accesso.</div>`;
    return;
  }
  const vista = S.vista;
  c.innerHTML = `<p class="carico">Caricamento…</p>`;
  try {
    const html = await VISTE[vista]();
    if (S.vista !== vista) return;
    c.innerHTML = html;
    collega[vista]?.(c);
  } catch (e) {
    console.error(e);
    if (e.message === "non_autorizzato") return;
    c.innerHTML = `<div class="vuoto-stato">${esc(testoErrore(e))}</div>`;
  }
  aggiornaBollino();
}

async function aggiornaBollino() {
  if (!S.negozio) return;
  let count = 0;
  try { count = (await api("conta", { negozio_id: S.negozio.id })).da_gestire; } catch { return; }
  const b = $("#bollino-richieste");
  b.hidden = !count;
  b.textContent = count > 99 ? "99+" : String(count ?? "");
}

const collega = {};

/* ---------------- liste comuni ---------------- */
function voceRichiesta(r) {
  const nome = [r.nome, r.cognome].filter(Boolean).join(" ") || r.telefono || r.email || "Cliente";
  const urg = r.priorita === "urgente" ? `<span class="etichetta piena">Urgente</span>` : "";
  const fascia = r.tipo === "richiamata" && r.fascia_oraria ? `<span>Richiamare: ${esc(r.fascia_oraria)}</span>` : "";
  return `<li class="voce"><button type="button" data-richiesta="${r.id}">
    <span class="prima">${esc(nome)}</span><span class="quando">${esc(quando(r.creata_il))}</span>
    <span class="seconda">${esc(r.messaggio)}</span>
    <span class="meta">${urg}<span class="etichetta">${esc(TIPI[r.tipo] ?? r.tipo)}</span>${r.stato !== "aperta" ? etichettaStato(r.stato) : ""}${etichettaCanale(r.canale)}
      ${r.numero_ordine ? `<span class="mono">#${esc(r.numero_ordine)}</span>` : ""}${fascia}</span>
  </button></li>`;
}

function voceConversazione(c) {
  const titolo = c.titolo || (c.argomenti?.length ? c.argomenti.map((a) => a[0].toUpperCase() + a.slice(1)).join(", ") : "Conversazione");
  return `<li class="voce"><button type="button" data-conversazione="${esc(c.conversazione_id)}">
    <span class="prima">${esc(titolo)}</span><span class="quando">${esc(quando(c.iniziata_il))}</span>
    ${c.riassunto ? `<span class="seconda">${esc(c.riassunto)}</span>` : ""}
    <span class="meta">${etichettaCanale(c.canale)}${c.telefono ? `<span class="mono">${esc(c.telefono)}</span>` : ""}
      ${c.durata_sec ? `<span>${esc(durata(c.durata_sec))}</span>` : ""}${c.operazioni ? `<span>${c.operazioni} ${c.operazioni === 1 ? "operazione" : "operazioni"}</span>` : ""}</span>
  </button></li>`;
}

function collegaVoci(el) {
  $$("[data-richiesta]", el).forEach((b) => b.addEventListener("click", () => apriRichiesta(b.dataset.richiesta)));
  $$("[data-conversazione]", el).forEach((b) => b.addEventListener("click", () => apriConversazione(b.dataset.conversazione)));
  $$("[data-cliente]", el).forEach((b) => b.addEventListener("click", () => apriCliente(b.dataset.cliente)));
}

/* ---------------- Oggi (agenda) ---------------- */
async function vistaOggi() {
  const n = S.negozio;
  const d = await api("oggi", { negozio_id: n.id });
  const aperte = d.aperte, ultime = d.ultime;

  const peso = (r) => (r.priorita === "urgente" ? 0 : r.tipo === "richiamata" ? 1 : 2);
  const daFare = [...aperte].sort((a, b) => peso(a) - peso(b) || new Date(a.creata_il) - new Date(b.creata_il));
  const urgenti = aperte.filter((r) => r.priorita === "urgente").length;
  const richiamate = aperte.filter((r) => r.tipo === "richiamata").length;
  const oggi = fDataLunga.format(new Date());

  return `
    <div class="titolo-vista"><div><h1>${esc(oggi[0].toUpperCase() + oggi.slice(1))}</h1>
      <div class="sotto">${esc(n.nome)} · ${esc(n.nome_assistente || "Giulia")} è attiva</div></div></div>
    <div class="numeri">
      <div><b>${aperte.length}</b><span>Richieste da gestire</span></div>
      <div><b>${urgenti}</b><span>Urgenti</span></div>
      <div><b>${d.conversazioni_oggi}</b><span>Conversazioni oggi</span></div>
      <div><b>${d.conversazioni_30}</b><span>Ultimi 30 giorni</span></div>
    </div>
    <h2>Da fare${richiamate ? ` <span class="muto mono">· ${richiamate} da richiamare</span>` : ""}</h2>
    ${daFare.length ? `<ul class="lista">${daFare.slice(0, 30).map(voceRichiesta).join("")}</ul>`
      : `<div class="vuoto-stato">Nessuna richiesta in sospeso. Quando Giulia registra un reso, un cambio o una richiamata, la trovi qui.</div>`}
    <h2>Ultime conversazioni</h2>
    ${ultime.length ? `<ul class="lista">${ultime.map(voceConversazione).join("")}</ul>`
      : `<div class="vuoto-stato">Ancora nessuna conversazione.</div>`}`;
}
collega.oggi = collegaVoci;

/* ---------------- Richieste ---------------- */
async function vistaRichieste() {
  const righe = (await api("richieste", { negozio_id: S.negozio.id, filtro: S.filtroRichieste })).richieste;
  const chip = (id, label) => `<button type="button" class="chip" data-filtro="${id}" aria-pressed="${S.filtroRichieste === id}">${label}</button>`;
  return `
    <div class="titolo-vista"><div><h1>Richieste</h1><div class="sotto">Resi, cambi, rimborsi e richiamate registrati da Giulia</div></div></div>
    <div class="filtri" role="group" aria-label="Filtro">
      ${chip("aperte", "Da gestire")}${chip("urgenti", "Urgenti")}${chip("richiamate", "Da richiamare")}${chip("chiuse", "Chiuse")}${chip("tutte", "Tutte")}
    </div>
    ${righe.length ? `<ul class="lista">${righe.map(voceRichiesta).join("")}</ul>` : `<div class="vuoto-stato">Nessuna richiesta in questo elenco.</div>`}`;
}
collega.richieste = (el) => {
  $$("[data-filtro]", el).forEach((b) => b.addEventListener("click", () => { S.filtroRichieste = b.dataset.filtro; disegna(); }));
  collegaVoci(el);
};

async function apriRichiesta(id) {
  const r = (await api("richiesta", { id }).catch(() => null))?.richiesta;
  if (!r) return avviso("Richiesta non trovata");
  const nome = [r.nome, r.cognome].filter(Boolean).join(" ") || "Cliente";
  const riga = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : "");
  const contatto = (v, tipo) => v ? `<span class="mono">${esc(v)}</span> <button class="btn vuoto piccolo" type="button" data-copia="${esc(v)}" aria-label="Copia ${tipo}">${ICONE.copia}</button>` : "";
  apriFoglio(`
    <h3>${esc(nome)}</h3>
    <div class="meta riga-btn" style="margin-bottom:12px">
      ${r.priorita === "urgente" ? `<span class="etichetta piena">Urgente</span>` : ""}
      <span class="etichetta">${esc(TIPI[r.tipo] ?? r.tipo)}</span>${etichettaStato(r.stato)}${etichettaCanale(r.canale)}
    </div>
    <dl class="dati">
      ${riga("Codice", `<span class="mono">${codiceRichiesta(r.id)}</span>`)}
      ${riga("Ricevuta", esc(fDataLunga.format(new Date(r.creata_il)) + ", " + fOra.format(new Date(r.creata_il))) + ` <span class="muto">(${esc(attesa(r.creata_il))})</span>`)}
      ${riga("Telefono", contatto(r.telefono, "telefono"))}
      ${riga("Email", contatto(r.email, "email"))}
      ${riga("Ordine", r.numero_ordine ? `<span class="mono">#${esc(r.numero_ordine)}</span>` : "")}
      ${riga("Richiamare", esc(r.fascia_oraria))}
      ${r.chiusa_il ? riga("Chiusa il", esc(fData.format(new Date(r.chiusa_il)) + ", " + fOra.format(new Date(r.chiusa_il)))) : ""}
    </dl>
    <h2>Messaggio</h2>
    <p style="white-space:pre-wrap;margin:0">${esc(r.messaggio)}</p>
    <h2>Note interne</h2>
    <div class="campo">
      <label for="note">Visibili solo a chi usa il pannello</label>
      <textarea id="note" maxlength="4000">${esc(r.note_interne ?? "")}</textarea>
    </div>
    <div class="riga-btn" style="margin-top:14px">
      ${r.stato === "aperta" ? `<button class="btn" type="button" data-stato="in_lavorazione">Prendi in carico</button>` : ""}
      ${r.stato !== "chiusa" ? `<button class="btn ${r.stato === "aperta" ? "vuoto" : ""}" type="button" data-stato="chiusa">Segna come risolta</button>`
        : `<button class="btn vuoto" type="button" data-stato="aperta">Riapri</button>`}
      <button class="btn vuoto" type="button" data-salva-note>Salva note</button>
      <button class="btn vuoto" type="button" data-priorita>${r.priorita === "urgente" ? "Togli urgenza" : "Segna urgente"}</button>
    </div>
    ${r.conversazione_id?.startsWith("conv_") ? `<div style="margin-top:18px"><button class="btn vuoto" type="button" data-vedi-conv="${esc(r.conversazione_id)}">Leggi la conversazione</button></div>` : ""}
  `, (f) => {
    $$("[data-copia]", f).forEach((b) => b.addEventListener("click", () => copia(b.dataset.copia)));
    const salva = async (campi, msg) => {
      try {
        await api("aggiorna_richiesta", { id: r.id, ...campi });
        avviso(msg);
        chiudiFoglio();
        disegna();
      } catch (e) { avviso(testoErrore(e)); }
    };
    $$("[data-stato]", f).forEach((b) => b.addEventListener("click", () => {
      const stato = b.dataset.stato;
      salva({ stato, note_interne: $("#note", f).value.trim() },
        stato === "chiusa" ? "Richiesta risolta" : stato === "aperta" ? "Richiesta riaperta" : "Presa in carico");
    }));
    $("[data-salva-note]", f).addEventListener("click", () => salva({ note_interne: $("#note", f).value.trim() }, "Note salvate"));
    $("[data-priorita]", f).addEventListener("click", () => salva({ priorita: r.priorita === "urgente" ? "normale" : "urgente" }, "Priorità aggiornata"));
    $("[data-vedi-conv]", f)?.addEventListener("click", (e) => apriConversazione(e.currentTarget.dataset.vediConv));
  });
}

/* ---------------- Conversazioni ---------------- */
async function vistaConversazioni() {
  const righe = (await api("conversazioni", { negozio_id: S.negozio.id, canale: S.filtroCanale })).conversazioni;
  const chip = (id, label) => `<button type="button" class="chip" data-canale="${id}" aria-pressed="${S.filtroCanale === id}">${label}</button>`;
  return `
    <div class="titolo-vista"><div><h1>Conversazioni</h1><div class="sotto">Chat, WhatsApp e telefonate gestite da Giulia</div></div>
      <button class="btn vuoto piccolo" type="button" id="importa">Controlla nuove</button></div>
    <div class="filtri" role="group" aria-label="Canale">
      ${chip("tutti", "Tutte")}${chip("telefono", "Telefono")}${chip("whatsapp", "WhatsApp")}${chip("sito", "Chat sito")}
    </div>
    ${righe.length ? `<ul class="lista">${righe.map(voceConversazione).join("")}</ul>` : `<div class="vuoto-stato">Nessuna conversazione in questo elenco.</div>`}`;
}
collega.conversazioni = (el) => {
  $$("[data-canale]", el).forEach((b) => b.addEventListener("click", () => { S.filtroCanale = b.dataset.canale; disegna(); }));
  $("#importa", el).addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await api("aggiorna_conversazioni", { negozio_id: S.negozio.id }); avviso("Elenco aggiornato"); disegna(); }
    catch (err) { avviso(testoErrore(err)); e.currentTarget.disabled = false; }
  });
  collegaVoci(el);
};

async function apriConversazione(convId) {
  apriFoglio(`<h3>Conversazione</h3><p class="carico">Caricamento della trascrizione…</p>`);
  let riga = null, t = null, errore = null;
  try {
    const d = await api("conversazione", { negozio_id: S.negozio.id, conversazione_id: convId });
    riga = d.riga; t = d.trascrizione ?? null;
    if (d.errore_trascrizione) errore = ERRORI[d.errore_trascrizione] ?? "La trascrizione non è disponibile in questo momento.";
  } catch (e) { errore = testoErrore(e); }
  const canale = t?.canale ?? riga?.canale;
  const inizio = t?.inizio ?? riga?.iniziata_il;
  const titolo = t?.titolo ?? riga?.titolo ?? "Conversazione";
  const bolle = (t?.messaggi ?? []).map((m) => {
    const az = m.azioni?.length ? `<div class="azione">${esc(m.azioni.map(nomeAzione).join(" · "))}</div>` : "";
    return (m.testo ? `<div class="bolla ${m.ruolo}">${esc(m.testo)}</div>` : "") + az;
  }).join("");
  if (!$("#foglio")) return;
  $("#foglio-corpo").innerHTML = `
    <h3>${esc(titolo)}</h3>
    <div class="meta riga-btn" style="margin-bottom:10px">${etichettaCanale(canale)}
      ${inizio ? `<span class="muto">${esc(fData.format(new Date(inizio)) + ", " + fOra.format(new Date(inizio)))}</span>` : ""}
      ${(t?.durata_sec ?? riga?.durata_sec) ? `<span class="muto">${esc(durata(t?.durata_sec ?? riga?.durata_sec))}</span>` : ""}
      ${riga?.telefono ? `<span class="mono">${esc(riga.telefono)}</span>` : ""}</div>
    ${(t?.riassunto ?? riga?.riassunto) ? `<div class="riquadro"><b>In breve</b><span>${esc(t?.riassunto ?? riga?.riassunto)}</span></div>` : ""}
    ${errore ? `<div class="vuoto-stato" style="margin-top:12px">${esc(errore)}</div>` : `<div class="chat">${bolle || '<p class="muto">Nessun messaggio.</p>'}</div>`}
    <p class="muto mono" style="font-size:11.5px;margin-top:18px;overflow-wrap:anywhere">${esc(convId)}</p>`;
}

const AZIONI = {
  cerca_prodotto: "ha cercato nel catalogo", dettaglio_prodotto: "ha aperto la scheda prodotto", stato_ordine: "ha controllato l'ordine",
  info_negozio: "ha letto le informazioni del negozio", registra_richiesta: "ha registrato una richiesta", cerca_cliente: "ha riconosciuto il cliente",
  end_call: "ha chiuso la conversazione",
};
const nomeAzione = (a) => AZIONI[a] ?? a;

/* ---------------- Clienti ---------------- */
async function vistaClienti() {
  const t = S.cercaClienti.trim();
  const righe = (await api("clienti", { negozio_id: S.negozio.id, cerca: t })).clienti;
  return `
    <div class="titolo-vista"><div><h1>Clienti</h1><div class="sotto">Chi ha lasciato i suoi dati a Giulia</div></div></div>
    <div class="campo" style="margin-bottom:12px"><label class="sr" for="cerca">Cerca</label>
      <input id="cerca" type="search" placeholder="Cerca per nome, telefono o email" value="${esc(S.cercaClienti)}" autocomplete="off"></div>
    ${righe.length ? `<ul class="lista">${righe.map((c) => `<li class="voce"><button type="button" data-cliente="${c.id}">
        <span class="prima">${esc([c.nome, c.cognome].filter(Boolean).join(" ") || c.telefono || c.email || "Cliente")}</span>
        <span class="quando">${esc(quando(c.ultimo_contatto))}</span>
        <span class="meta">${c.telefono ? `<span class="mono">${esc(c.telefono)}</span>` : ""}${c.email ? `<span>${esc(c.email)}</span>` : ""}
          <span>${c.contatti ?? 1} ${(c.contatti ?? 1) === 1 ? "contatto" : "contatti"}</span>${etichettaCanale(c.canale_ultimo)}</span>
      </button></li>`).join("")}</ul>` : `<div class="vuoto-stato">${t ? "Nessun cliente trovato." : "Ancora nessun cliente."}</div>`}`;
}
collega.clienti = (el) => {
  const input = $("#cerca", el);
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      S.cercaClienti = input.value;
      const pos = input.selectionStart;
      await disegna();
      const nuovo = $("#cerca");
      if (nuovo) { nuovo.focus(); nuovo.setSelectionRange(pos, pos); }
    }, 300);
  });
  collegaVoci(el);
};

async function apriCliente(id) {
  const d = await api("cliente", { id }).catch(() => null);
  if (!d) return avviso("Cliente non trovato");
  const { cliente: c, richieste, conversazioni: conv } = d;
  apriFoglio(`
    <h3>${esc([c.nome, c.cognome].filter(Boolean).join(" ") || "Cliente")}</h3>
    <p class="muto" style="margin:0 0 12px">Cliente dal ${esc(fData.format(new Date(c.primo_contatto)))} · ${c.contatti ?? 1} ${(c.contatti ?? 1) === 1 ? "contatto" : "contatti"}</p>
    <form id="form-cliente" class="riquadro">
      <div class="campo"><label for="c-nome">Nome</label><input id="c-nome" maxlength="80" value="${esc(c.nome ?? "")}"></div>
      <div class="campo"><label for="c-cognome">Cognome</label><input id="c-cognome" maxlength="80" value="${esc(c.cognome ?? "")}"></div>
      <div class="campo"><label>Telefono</label><input value="${esc(c.telefono ?? "")}" readonly class="mono"></div>
      <div class="campo"><label for="c-email">Email</label><input id="c-email" type="email" maxlength="160" value="${esc(c.email ?? "")}"></div>
      <div class="campo"><label for="c-note">Note</label><textarea id="c-note" maxlength="4000">${esc(c.note ?? "")}</textarea></div>
      <div class="riga-btn"><button class="btn" type="submit">Salva</button></div>
    </form>
    <h2>Richieste</h2>
    ${richieste.length ? `<ul class="lista">${richieste.map(voceRichiesta).join("")}</ul>` : `<p class="muto">Nessuna richiesta.</p>`}
    <h2>Conversazioni</h2>
    ${conv.length ? `<ul class="lista">${conv.map(voceConversazione).join("")}</ul>` : `<p class="muto">Nessuna conversazione collegata.</p>`}
  `, (f) => {
    collegaVoci(f);
    $("#form-cliente", f).addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = (s) => $(s, f).value.trim() || null;
      try {
        await api("aggiorna_cliente", { id: c.id, nome: v("#c-nome"), cognome: v("#c-cognome"), email: v("#c-email"), note: v("#c-note") });
        avviso("Cliente aggiornato");
        if (S.vista === "clienti") disegna();
      } catch (err) { avviso(testoErrore(err)); }
    });
  });
}

/* ---------------- Negozio ---------------- */
async function vistaNegozio() {
  const d = await api("negozio", { negozio_id: S.negozio.id });
  Object.assign(S.negozio, d.negozio);
  const n = S.negozio;
  const g = d.gestibile;
  const { consumi, ordini_prova: ordini, accessi, credenziali: cred } = d;
  const info = n.info ?? {};
  const piattaforma = { shopify: "Shopify", woocommerce: "WooCommerce", prestashop: "PrestaShop" }[n.piattaforma] ?? n.piattaforma;
  const tipoCred = { storefront: "catalogo pubblico (Storefront)", admin: "app Shopify con chiavi", admin_token: "token Admin", woocommerce: "chiavi REST", prestashop: "chiave Webservice" };

  return `
    <div class="titolo-vista"><div><h1>${esc(n.nome)}</h1><div class="sotto">${esc(piattaforma)} · ${n.stato === "prova" ? "in prova" : esc(n.stato)}</div></div>
      ${n.url_negozio ? `<a class="btn vuoto piccolo" href="${esc(n.url_negozio)}" target="_blank" rel="noopener">Apri il sito</a>` : ""}</div>

    <h2>Catalogo</h2>
    <div class="riquadro">
      <dl class="dati">
        <dt>Prodotti</dt><dd class="mono">${n.catalogo_prodotti ?? 0}</dd>
        <dt>Aggiornato</dt><dd>${n.catalogo_aggiornato_il ? esc(quando(n.catalogo_aggiornato_il)) : "mai"}</dd>
        ${n.catalogo_esito && n.catalogo_esito !== "ok" ? `<dt>Ultimo esito</dt><dd>${esc(n.catalogo_esito)}</dd>` : ""}
      </dl>
      <p class="muto" style="margin:0;font-size:13px">Giulia legge prodotti, prezzi e disponibilità dal negozio. Si aggiorna da sola ogni 6 ore.</p>
      <div class="riga-btn"><button class="btn vuoto piccolo" type="button" id="sincronizza">Aggiorna adesso</button></div>
    </div>

    <h2>Cosa sa Giulia del negozio</h2>
    <form id="form-info" class="riquadro">
      <div class="campo"><label for="i-nome">Nome dell'assistente</label><input id="i-nome" maxlength="40" value="${esc(n.nome_assistente ?? "Giulia")}"></div>
      ${ARGOMENTI_INFO.map(([k, label, aiuto]) => `<div class="campo"><label for="i-${k}">${label}</label>
        <textarea id="i-${k}" data-info="${k}" maxlength="3000" ${k === "tempi_risposta" ? 'style="min-height:56px"' : ""}>${esc(info[k] ?? "")}</textarea>
        <span class="aiuto">${aiuto}</span></div>`).join("")}
      <div class="riga-btn"><button class="btn" type="submit">Salva le informazioni</button></div>
    </form>

    ${n.modalita_ordini === "prova" ? `
    <h2>Ordini di prova</h2>
    <p class="muto" style="margin:0 0 8px;font-size:13px">Il negozio è in modalità prova: Giulia risponde sugli ordini con questi dati finti. Usali per provarla.</p>
    <div class="tabella-scorri"><table>
      <thead><tr><th>Ordine</th><th>Email</th><th>Telefono</th><th>Stato</th></tr></thead>
      <tbody>${ordini.map((o) => `<tr><td class="mono">${esc(String(o.numero).startsWith("#") ? o.numero : "#" + o.numero)}</td><td>${esc(o.email ?? "")}</td><td class="mono">${esc(o.telefono ?? "")}</td>
        <td>${esc(o.annullato ? "annullato" : o.stato_evasione ?? "")}${o.corriere ? " · " + esc(o.corriere) : ""}</td></tr>`).join("")}</tbody>
    </table></div>` : ""}

    <h2>Consumi</h2>
    ${consumi.length ? `<div class="tabella-scorri"><table>
      <thead><tr><th>Mese</th><th class="num">Conversazioni</th><th class="num">Telefono</th><th class="num">WhatsApp</th><th class="num">Sito</th><th class="num">Min. voce</th></tr></thead>
      <tbody>${consumi.map((c) => `<tr><td>${esc(fMese.format(new Date(c.mese + "T00:00:00Z")))}</td><td class="num">${c.conversazioni}</td><td class="num">${c.chiamate}</td>
        <td class="num">${c.whatsapp}</td><td class="num">${c.sito}</td><td class="num">${Math.round((c.secondi_voce ?? 0) / 60)}</td></tr>`).join("")}</tbody>
    </table></div>` : `<div class="vuoto-stato">Ancora nessun consumo registrato.</div>`}

    ${g ? `
    <h2>Collegamento a ${esc(piattaforma)}</h2>
    <div class="riquadro">
      <p style="margin:0">${cred?.configurate ? `Collegato con ${esc(tipoCred[cred.tipo] ?? cred.tipo)}${cred.aggiornate_il ? `, aggiornato ${esc(quando(cred.aggiornate_il))}` : ""}.` : "Non ancora collegato."}</p>
      ${cred?.configurate ? `<div class="riga-btn"><button class="btn vuoto piccolo" type="button" id="prova-conn">Prova il collegamento</button></div>` : ""}
      ${formCredenziali(n)}
    </div>

    <h2>Accessi al pannello</h2>
    <div class="riquadro">
      ${accessi.length ? `<ul class="lista">${accessi.map((a) => `<li class="prodotto" style="grid-template-columns:1fr auto">
          <span class="nome">${esc(a.nome || a.email)}<small>${esc(a.email)} · ${a.attivo ? (a.ultimo_accesso ? "entrato " + esc(quando(a.ultimo_accesso)) : "non ancora entrato") : "disattivato"}</small></span>
          <span class="riga-btn">${a.attivo ? `<button class="btn vuoto piccolo" type="button" data-link="${a.id}">Nuovo link</button>
            ${a.sei_tu ? "" : `<button class="btn vuoto piccolo" type="button" data-disattiva="${a.id}">Disattiva</button>`}` : ""}</span>
        </li>`).join("")}</ul>` : `<p class="muto" style="margin:0">Nessun accesso per questo negozio.</p>`}
      <form id="form-accesso" style="display:grid;gap:10px;margin-top:6px">
        <div class="campo"><label for="a-email">Email della persona da invitare</label><input id="a-email" type="email" required maxlength="160" placeholder="nome@negozio.it"></div>
        <div class="campo"><label for="a-nome">Nome (facoltativo)</label><input id="a-nome" maxlength="80"></div>
        <div class="riga-btn"><button class="btn" type="submit">Crea link d'invito</button></div>
      </form>
      <div id="link-creato"></div>
    </div>` : ""}

    <h2>Il tuo accesso</h2>
    <div class="riquadro">
      <p style="margin:0">Sei entrato come <b>${esc(S.utente.email)}</b>.</p>
      <div class="riga-btn"><button class="btn vuoto piccolo" type="button" id="esci">Esci</button></div>
    </div>`;
}

function formCredenziali(n) {
  if (n.piattaforma !== "shopify") {
    return `<p class="muto" style="margin:0;font-size:13px">Il collegamento a ${esc(n.piattaforma)} sarà disponibile a breve.</p>`;
  }
  return `
    <details>
      <summary class="btn vuoto piccolo" style="list-style:none;width:max-content">Collega o aggiorna le chiavi</summary>
      <form id="form-cred" style="display:grid;gap:10px;margin-top:12px" autocomplete="off">
        <p class="muto" style="margin:0;font-size:13px">Nel pannello Shopify del negozio: Impostazioni → App → Sviluppa app → crea un'app con accesso in lettura a prodotti, ordini e clienti. Copia qui le chiavi: restano cifrate e non vengono mai mostrate.</p>
        <div class="campo"><label for="k-dominio">Indirizzo del negozio Shopify</label><input id="k-dominio" required placeholder="nomenegozio.myshopify.com" spellcheck="false"></div>
        <div class="campo"><label for="k-id">Client ID</label><input id="k-id" required spellcheck="false" class="mono"></div>
        <div class="campo"><label for="k-secret">Client secret</label><input id="k-secret" type="password" required spellcheck="false" class="mono"></div>
        <div class="riga-btn"><button class="btn" type="submit">Verifica e salva</button></div>
      </form>
    </details>`;
}

collega.negozio = (el) => {
  const n = S.negozio;
  // I testi per Giulia crescono con il contenuto, senza scorrere dentro il riquadro.
  const cresci = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
  $$("[data-info]", el).forEach((t) => { cresci(t); t.addEventListener("input", () => cresci(t)); });
  $("#sincronizza", el).addEventListener("click", async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = "Aggiornamento…";
    try { const r = await api("sincronizza", { negozio_id: n.id }); avviso(`Catalogo aggiornato: ${r.prodotti ?? "ok"} prodotti`); disegna(); }
    catch (err) { avviso(testoErrore(err)); b.disabled = false; b.textContent = "Aggiorna adesso"; }
  });

  $("#form-info", el).addEventListener("submit", async (e) => {
    e.preventDefault();
    const info = { ...(n.info ?? {}) };
    $$("[data-info]", el).forEach((t) => {
      const v = t.value.trim();
      if (v) info[t.dataset.info] = v; else delete info[t.dataset.info];
    });
    const nome = $("#i-nome", el).value.trim() || "Giulia";
    try {
      await api("salva_info", { negozio_id: n.id, info, nome_assistente: nome });
      n.info = info; n.nome_assistente = nome;
      avviso("Informazioni salvate: Giulia le usa da subito");
    } catch (err) { avviso(testoErrore(err)); }
  });

  $("#prova-conn", el)?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { const r = await api("prova_connessione", { negozio_id: n.id }); avviso(r.ok ? `Collegamento attivo${r.nome ? ": " + r.nome : ""}` : testoErrore(new Error(r.errore))); }
    catch (err) { avviso(testoErrore(err)); }
    e.currentTarget.disabled = false;
  });

  $("#form-cred", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("button[type=submit]", e.currentTarget); b.disabled = true; b.textContent = "Verifica in corso…";
    try {
      const r = await api("salva_credenziali", { negozio_id: n.id, dati: { tipo: "admin", dominio: $("#k-dominio").value, client_id: $("#k-id").value, client_secret: $("#k-secret").value } });
      avviso(`Collegato${r.negozio ? " a " + r.negozio : ""}`);
      disegna();
    } catch (err) {
      avviso(ERRORI[err.message] ? testoErrore(err) : /^(shopify|piattaforma)/.test(err.message) ? "Non riesco a collegarmi al negozio: controlla l'indirizzo." : testoErrore(err));
      b.disabled = false; b.textContent = "Verifica e salva";
    }
  });

  const mostraLink = (invito, email) => {
    const url = location.origin + location.pathname + "#invito=" + invito;
    $("#link-creato", el).innerHTML = `<div class="riquadro" style="margin-top:12px">
      <b>Link per ${esc(email)}</b>
      <div class="link-copia"><input readonly value="${esc(url)}" aria-label="Link d'invito"><button class="btn piccolo" type="button">Copia</button></div>
      <span class="aiuto muto" style="font-size:12.5px">Mandalo tu via WhatsApp o email. Vale 7 giorni e si può aprire fino a 5 volte.</span></div>`;
    const inp = $("#link-creato input", el);
    $("#link-creato button", el).addEventListener("click", () => copia(url, inp));
  };

  $("#form-accesso", el)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#a-email", el).value.trim();
    try {
      const r = await api("crea_accesso", { ruolo: "negozio", negozio_id: n.id, email, nome: $("#a-nome", el).value.trim() });
      await disegna();
      mostraLink(r.invito, email);
    } catch (err) { avviso(testoErrore(err)); }
  });
  $$("[data-link]", el).forEach((b) => b.addEventListener("click", async () => {
    try { const r = await api("link_accesso", { accesso_id: b.dataset.link }); mostraLink(r.invito, b.closest("li").querySelector("small").textContent.split(" · ")[0]); }
    catch (err) { avviso(testoErrore(err)); }
  }));
  $$("[data-disattiva]", el).forEach((b) => b.addEventListener("click", async () => {
    if (b.dataset.conferma !== "1") { b.dataset.conferma = "1"; b.textContent = "Confermi?"; return; }
    try { await api("disattiva_accesso", { accesso_id: b.dataset.disattiva }); avviso("Accesso disattivato"); disegna(); }
    catch (err) { avviso(testoErrore(err)); }
  }));

  $("#esci", el).addEventListener("click", async () => {
    await api("esci").catch(() => {});
    memoria.del(CHIAVE_SESSIONE);
    mostraAccesso("Sei uscito", "Per rientrare apri di nuovo il link d'invito.");
  });
};

/* ---------------- foglio di dettaglio ---------------- */
let ultimoFocus = null;
function apriFoglio(html, dopo) {
  ultimoFocus = document.activeElement;
  $("#strato-foglio").innerHTML = `<div class="foglio-sfondo" data-chiudi></div>
    <section class="foglio" id="foglio" role="dialog" aria-modal="true" tabindex="-1">
      <div class="maniglia"></div>
      <button class="icona-btn chiudi" type="button" data-chiudi aria-label="Chiudi">${ICONE.chiudi}</button>
      <div id="foglio-corpo">${html}</div>
    </section>`;
  const f = $("#foglio");
  $$("[data-chiudi]").forEach((b) => b.addEventListener("click", chiudiFoglio));
  document.body.style.overflow = "hidden";
  f.focus();
  dopo?.(f);
}
function chiudiFoglio() {
  $("#strato-foglio").innerHTML = "";
  document.body.style.overflow = "";
  ultimoFocus?.focus?.();
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#foglio")) chiudiFoglio(); });

/* ---------------- eventi globali ---------------- */
$$(".nav button").forEach((b) => b.addEventListener("click", () => vai(b.dataset.vista)));
$("#aggiorna").addEventListener("click", () => disegna());
$("#negozio").addEventListener("change", (e) => {
  S.negozio = S.negozi.find((n) => n.id === e.target.value) ?? S.negozio;
  memoria.set("giulia-shop-negozio", S.negozio.id);
  disegna();
});
window.addEventListener("hashchange", () => {
  const h = location.hash.replace("#", "");
  if (h.startsWith("invito=")) { location.reload(); return; }
  if (VISTE[h] && h !== S.vista) vai(h);
});
// Aggiorna da solo ogni 2 minuti quando la pagina è visibile (nuove richieste da Giulia).
setInterval(() => { if (document.visibilityState === "visible" && !$("#foglio") && S.negozio && !$("#schermo-app").hidden && S.vista !== "negozio") disegna(); }, 120000);

avvio();
