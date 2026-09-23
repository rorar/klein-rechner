/* Verdrahtung der Seite: Eingaben lesen, Ausgaben setzen, Knöpfe, Adresse.
   Alles, was hier steht, braucht ein DOM. Gerechnet wird in rechnen.js. */

import {
  VERSANDARTEN, GEBUEHR_FIX_CENT,
  fmt, parseEuroToCent, berechne
} from './rechnen.js?v=11';
import { textDu, textSie, textNeutral } from './texte.js?v=11';
import { zeichneBeleg, dateiname } from './beleg-bild.js?v=11';

const el = id => document.getElementById(id);

const preisInput = el('preis');
const versandInput = el('versand');
const paketstationFeld = el('paketstation');
const kopien = { summe: '', du: '', sie: '', neutral: '', link: '' };
let letzteRechnung = null;

const LEERTEXT = 'Trag oben einen Artikelpreis ein, dann steht hier der fertige Text.';

/* ---------- Ausgabe ---------- */

function zeigeLeer() {
  ['out-preis', 'out-versand', 'out-gebuehr', 'out-summe']
    .forEach(id => { el(id).textContent = '—'; });
  el('out-gebuehr-formel').textContent = '';
  for (const feld of ['du', 'sie', 'neutral']) {
    el('text-' + feld).textContent = LEERTEXT;
    el('text-' + feld).dataset.empty = 'true';
  }
  kopien.summe = kopien.du = kopien.sie = kopien.neutral = kopien.link = '';
  letzteRechnung = null;
  document.querySelectorAll('.copy, .neben').forEach(b => { b.disabled = true; });
}

function aktualisiere() {
  const preis = parseEuroToCent(preisInput.value);
  const versand = parseEuroToCent(versandInput.value);

  const preisKaputt = Number.isNaN(preis);
  const versandKaputt = Number.isNaN(versand);
  el('preis-fehler').hidden = !preisKaputt;
  el('versand-fehler').hidden = !versandKaputt;

  schreibeUrl(preis, versand, paketstationFeld.checked && versand > 0);

  if (preisKaputt || versandKaputt || preis === null) {
    zeigeLeer();
    return;
  }

  const r = berechne(preis, versand === null ? 0 : versand, paketstationFeld.checked);
  letzteRechnung = r;

  el('out-preis').textContent = fmt(r.preis);
  el('out-versand').textContent = r.versand > 0 ? fmt(r.versand) : '—';
  el('out-versand-note').textContent = r.paketstation ? 'Zustellung an eine Paketstation' : '';
  el('out-gebuehr').textContent = fmt(r.gebuehr);
  el('out-gebuehr-formel').textContent = `${fmt(GEBUEHR_FIX_CENT)} + 4,5 % von ${fmt(r.preis)}`;
  el('out-summe').textContent = fmt(r.kaeuferZahlt);

  kopien.summe = fmt(r.kaeuferZahlt);
  kopien.link = location.href;   // schreibeUrl lief oben, die Adresse stimmt
  kopien.du = textDu(r);
  kopien.sie = textSie(r);
  kopien.neutral = textNeutral(r);

  for (const feld of ['du', 'sie', 'neutral']) {
    el('text-' + feld).textContent = kopien[feld];
    el('text-' + feld).dataset.empty = 'false';
  }

  document.querySelectorAll('.copy, .neben').forEach(b => { b.disabled = false; });
}

/* ---------- Kopieren ---------- */

let toastTimer;

function toast(text) {
  const t = el('toast');
  t.textContent = text;
  t.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.dataset.show = 'false'; }, 1800);
}

async function kopiere(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* Rückfallebene für Browser ohne Clipboard-API oder ohne HTTPS. */
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

document.querySelectorAll('.copy').forEach(btn => {
  btn.dataset.label = btn.textContent;   // einmalig, nicht beim Klick lesen
  let zurueck;

  btn.addEventListener('click', async () => {
    const text = kopien[btn.dataset.copy];
    if (!text) return;

    if (await kopiere(text)) {
      btn.textContent = 'Kopiert';
      btn.dataset.done = 'true';
      toast('In die Zwischenablage kopiert');
      clearTimeout(zurueck);
      zurueck = setTimeout(() => {
        btn.textContent = btn.dataset.label;
        btn.dataset.done = 'false';
      }, 1600);
    } else {
      toast('Kopieren hat nicht geklappt – bitte von Hand markieren');
    }
  });
});

/* ---------- Combobox für die Versandart ---------- */

function bauCombo() {
  const wrap = document.querySelector('[data-combo]');
  const liste = el('versand-liste');
  const toggle = wrap.querySelector('.combo-toggle');
  let aktiv = -1;

  VERSANDARTEN.forEach((art, i) => {
    const li = document.createElement('li');
    li.id = 'versandart-' + i;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.innerHTML = `<span class="opt-name"></span><span class="opt-hinweis"></span><span class="opt-value"></span>`;
    li.querySelector('.opt-name').textContent = art.name;
    li.querySelector('.opt-hinweis').textContent = art.hinweis || '';
    li.querySelector('.opt-value').textContent = fmt(art.cent);
    li.addEventListener('mousedown', ev => {
      ev.preventDefault();          // Fokus bleibt im Eingabefeld
      waehle(i);
    });
    liste.appendChild(li);
  });

  const optionen = [...liste.children];

  function markiere(i) {
    optionen.forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    aktiv = i;
    if (i >= 0) {
      versandInput.setAttribute('aria-activedescendant', optionen[i].id);
      optionen[i].scrollIntoView({ block: 'nearest' });
    } else {
      versandInput.removeAttribute('aria-activedescendant');
    }
  }

  function oeffne() {
    liste.hidden = false;
    wrap.dataset.open = 'true';
    versandInput.setAttribute('aria-expanded', 'true');
  }

  function schliesse() {
    liste.hidden = true;
    wrap.dataset.open = 'false';
    versandInput.setAttribute('aria-expanded', 'false');
    markiere(-1);
  }

  function waehle(i) {
    versandInput.value = (VERSANDARTEN[i].cent / 100).toFixed(2).replace('.', ',');
    paketstationFeld.checked = VERSANDARTEN[i].paketstation === true;
    schliesse();
    aktualisiere();
  }

  toggle.addEventListener('mousedown', ev => {
    ev.preventDefault();
    if (liste.hidden) { oeffne(); versandInput.focus(); } else { schliesse(); }
  });

  versandInput.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (liste.hidden) oeffne();
      markiere(aktiv + 1 >= optionen.length ? 0 : aktiv + 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (liste.hidden) oeffne();
      markiere(aktiv <= 0 ? optionen.length - 1 : aktiv - 1);
    } else if (ev.key === 'Enter' && !liste.hidden && aktiv >= 0) {
      ev.preventDefault();
      waehle(aktiv);
    } else if (ev.key === 'Escape') {
      schliesse();
    } else if (ev.key === 'Tab') {
      schliesse();
    }
  });

  versandInput.addEventListener('blur', schliesse);
  versandInput.addEventListener('input', () => { if (!liste.hidden) markiere(-1); });
}

/* ---------- Bild speichern und teilen ---------- */

el('bild-knopf').addEventListener('click', async () => {
  if (!letzteRechnung) return;
  const blob = await zeichneBeleg(letzteRechnung);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname(letzteRechnung);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Bild gespeichert');
});

/* Einen Link kann fast jedes Handy weiterreichen, Dateien deutlich seltener.
   Deshalb werden beide Knöpfe getrennt geprüft. */
const linkTeilenKnopf = el('link-teilen-knopf');

if (navigator.share) {
  linkTeilenKnopf.hidden = false;
  linkTeilenKnopf.addEventListener('click', async () => {
    if (!kopien.link) return;
    try {
      await navigator.share({
        title: 'Sicher bezahlen – Aufstellung',
        text: `Käufer zahlt ${kopien.summe}.`,
        url: kopien.link
      });
    } catch (e) {
      if (e.name !== 'AbortError') toast('Teilen hat nicht geklappt');
    }
  });
}

/* Bild teilen gibt es nur, wenn der Browser Dateien weiterreichen kann. */
const teilenKnopf = el('teilen-knopf');

const probe = new File([new Uint8Array([0])], 'probe.png', { type: 'image/png' });

if (navigator.canShare && navigator.canShare({ files: [probe] })) {
  teilenKnopf.hidden = false;
  teilenKnopf.addEventListener('click', async () => {
    if (!letzteRechnung) return;
    const blob = await zeichneBeleg(letzteRechnung);
    const datei = new File([blob], dateiname(letzteRechnung), { type: 'image/png' });
    try {
      await navigator.share({
        files: [datei],
        title: 'Sicher bezahlen – Aufstellung',
        text: `Käufer zahlt ${fmt(letzteRechnung.kaeuferZahlt)}.`
      });
    } catch (e) {
      if (e.name !== 'AbortError') toast('Teilen hat nicht geklappt');
    }
  });
}

/* ---------- Adresse als Zustand ---------- */

function leseUrl() {
  const p = new URLSearchParams(location.search);
  const preis = p.get('preis');
  const versand = p.get('versand');
  if (preis !== null) preisInput.value = preis;
  if (versand !== null) versandInput.value = versand;
  paketstationFeld.checked = p.get('paketstation') === '1';
}

/* Punkt statt Komma, damit die Adresse ohne %2C lesbar bleibt.
   Die Eingabe versteht beides. */
function schreibeUrl(preisCent, versandCent, paketstation) {
  const p = new URLSearchParams(location.search);
  const setze = (name, cent) => {
    if (cent === null || Number.isNaN(cent)) p.delete(name);
    else p.set(name, (cent / 100).toFixed(2));
  };
  setze('preis', preisCent);
  setze('versand', versandCent);
  if (paketstation) p.set('paketstation', '1');
  else p.delete('paketstation');
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

/* ---------- Start ---------- */

preisInput.addEventListener('input', aktualisiere);
versandInput.addEventListener('input', aktualisiere);
paketstationFeld.addEventListener('change', aktualisiere);
bauCombo();
zeigeLeer();
leseUrl();
aktualisiere();
