/* Rechner für die Kleinanzeigen-Bezahlfunktion „Sicher bezahlen“.
   Gerechnet wird durchgehend in ganzen Cent, damit keine Fließkomma-Reste
   entstehen (0.1 + 0.2 lässt grüßen). */

const GEBUEHR_FIX_CENT = 50;   // 0,50 € Grundbetrag
const GEBUEHR_PROMILLE = 45;   // 4,5 % = 45/1000 des Artikelpreises

/* Richtwerte, Stand September 2026. Alle Werte sind überschreibbar –
   das Feld bleibt ein normales Eingabefeld.
   Die 2,99 € laufen über Hermes und stehen so in Anzeigen mit
   Kleinanzeigen-Versand ("Versand ab 2,99 €"); die Preise pro Paketgröße
   zeigt erst der Kaufvorgang. */
const VERSANDARTEN = [
  { name: 'Abholung, kein Versand', cent: 0 },
  { name: 'Hermes über Kleinanzeigen, kleinste Größe', cent: 299 },
  { name: 'DHL Päckchen S', cent: 419 },
  { name: 'Hermes Päckchen', cent: 489 },
  { name: 'Hermes Paket S', cent: 549 },
  { name: 'DHL Paket bis 2 kg', cent: 619 }
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = cent => euro.format(cent / 100);

/* ---------- Eingabe lesen ---------- */

/* Nimmt „45“, „45,00“, „45.00“, „1.234,56“ und „12 €“ entgegen.
   Rückgabe: Cent als Ganzzahl, null bei leer, NaN bei Unsinn. */
function parseEuroToCent(roh) {
  let s = String(roh).replace(/[€\s ]/g, '');
  if (s === '') return null;

  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');          // 1.234 ist deutsch gemeint
  }

  if (s.endsWith('.')) s = s.slice(0, -1);   // "45," beim Tippen
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;

  const cent = Math.round(Number(s) * 100);
  return Number.isFinite(cent) ? cent : NaN;
}

function berechne(preisCent, versandCent) {
  const gebuehr = GEBUEHR_FIX_CENT + Math.round((preisCent * GEBUEHR_PROMILLE) / 1000);
  return {
    preis: preisCent,
    versand: versandCent,
    gebuehr,
    summe: preisCent + versandCent + gebuehr
  };
}

/* ---------- Texte ---------- */

/* Die Aufstellung ist in beiden Formen gleich, nur die Anrede und der
   Schlusssatz unterscheiden sich. Du- und Sie-Text stehen trotzdem
   getrennt: ein Austausch einzelner Wörter fiele an "zahlst du" /
   "zahlen Sie" auseinander. */
function aufstellung(r) {
  return [
    `Artikel: ${fmt(r.preis)}`,
    `Versand: ${r.versand > 0 ? fmt(r.versand) : 'entfällt'}`,
    `Servicegebühr: ${fmt(r.gebuehr)}`,
    `Gesamt: ${fmt(r.summe)}`
  ].join('\n');
}

function gebuehrSatz(r) {
  return `Über „Sicher bezahlen“ kommt eine Servicegebühr von ${fmt(r.gebuehr)} dazu \u2013 das sind ${fmt(GEBUEHR_FIX_CENT)} plus 4,5\u00a0% vom Artikelpreis.`;
}

function textDu(r) {
  return `Hallo,

der Artikel kostet ${fmt(r.preis)}. ${gebuehrSatz(r)}

${aufstellung(r)}

Du zahlst damit insgesamt ${fmt(r.summe)}.`;
}

function textSie(r) {
  return `Hallo,

der Artikel kostet ${fmt(r.preis)}. ${gebuehrSatz(r)}

${aufstellung(r)}

Sie zahlen damit insgesamt ${fmt(r.summe)}.`;
}

/* ---------- Ausgabe ---------- */

const el = id => document.getElementById(id);

const preisInput = el('preis');
const versandInput = el('versand');
const kopien = { summe: '', du: '', sie: '' };
let letzteRechnung = null;

const LEERTEXT = 'Trag oben einen Artikelpreis ein, dann steht hier der fertige Text.';

function zeigeLeer() {
  ['out-preis', 'out-versand', 'out-gebuehr', 'out-summe']
    .forEach(id => { el(id).textContent = '—'; });
  el('out-gebuehr-formel').textContent = '';
  for (const feld of ['du', 'sie']) {
    el('text-' + feld).textContent = LEERTEXT;
    el('text-' + feld).dataset.empty = 'true';
  }
  kopien.summe = kopien.du = kopien.sie = '';
  letzteRechnung = null;
  document.querySelectorAll('.copy, .bild').forEach(b => { b.disabled = true; });
}

function aktualisiere() {
  const preis = parseEuroToCent(preisInput.value);
  const versand = parseEuroToCent(versandInput.value);

  const preisKaputt = Number.isNaN(preis);
  const versandKaputt = Number.isNaN(versand);
  el('preis-fehler').hidden = !preisKaputt;
  el('versand-fehler').hidden = !versandKaputt;

  schreibeUrl(preis, versand);

  if (preisKaputt || versandKaputt || preis === null) {
    zeigeLeer();
    return;
  }

  const r = berechne(preis, versand === null ? 0 : versand);
  letzteRechnung = r;

  el('out-preis').textContent = fmt(r.preis);
  el('out-versand').textContent = r.versand > 0 ? fmt(r.versand) : '—';
  el('out-gebuehr').textContent = fmt(r.gebuehr);
  el('out-gebuehr-formel').textContent = `${fmt(GEBUEHR_FIX_CENT)} + 4,5\u00a0% von ${fmt(r.preis)}`;
  el('out-summe').textContent = fmt(r.summe);

  kopien.summe = fmt(r.summe);
  kopien.du = textDu(r);
  kopien.sie = textSie(r);

  el('text-du').textContent = kopien.du;
  el('text-sie').textContent = kopien.sie;
  el('text-du').dataset.empty = 'false';
  el('text-sie').dataset.empty = 'false';

  document.querySelectorAll('.copy, .bild').forEach(b => { b.disabled = false; });
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
    li.innerHTML = `<span class="opt-name"></span><span class="opt-value"></span>`;
    li.querySelector('.opt-name').textContent = art.name;
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

/* ---------- Beleg als Bild ---------- */

const REPO = 'github.com/rorar/klein-rechner';

/* Der Beleg wird von Hand auf ein Canvas gezeichnet. Das sind vier Zeilen
   plus Summe – dafür lohnt keine Bibliothek, die das DOM nachbaut. */
async function zeichneBeleg(r) {
  await Promise.all([
    document.fonts.load('500 44px Newsreader'),
    document.fonts.load('400 19px Newsreader'),
    document.fonts.load('400 16px "IBM Plex Sans"'),
    document.fonts.load('500 16px "IBM Plex Sans"')
  ]);

  const S = 2;                     // doppelte Auflösung, sonst franst Text aus
  const B = 760, H = 520, RAND = 48;
  const c = document.createElement('canvas');
  c.width = B * S;
  c.height = H * S;
  const g = c.getContext('2d');
  g.scale(S, S);

  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, B, H);
  g.strokeStyle = '#c6cdc1';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, B - 1, H - 1);

  g.fillStyle = '#14201a';
  g.font = '500 32px Newsreader, Georgia, serif';
  g.fillText('„Sicher bezahlen“ – Aufstellung', RAND, 92);

  g.fillStyle = '#5d6a60';
  g.font = '400 15px "IBM Plex Sans", sans-serif';
  g.fillText(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), RAND, 120);

  const zeile = (y, label, betrag) => {
    g.fillStyle = '#14201a';
    g.font = '400 17px "IBM Plex Sans", sans-serif';
    g.fillText(label, RAND, y);
    const lb = g.measureText(label).width;

    g.font = '400 19px Newsreader, Georgia, serif';
    const bb = g.measureText(betrag).width;
    g.fillText(betrag, B - RAND - bb, y);

    g.fillStyle = '#c6cdc1';
    for (let x = RAND + lb + 8; x < B - RAND - bb - 8; x += 5) {
      g.fillRect(x, y - 5, 1.5, 1.5);
    }
  };

  zeile(180, 'Artikelpreis', fmt(r.preis));
  zeile(218, 'Versand', r.versand > 0 ? fmt(r.versand) : 'entfällt');
  zeile(256, 'Servicegebühr', fmt(r.gebuehr));

  g.fillStyle = '#5d6a60';
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText(`${fmt(GEBUEHR_FIX_CENT)} + 4,5\u00a0% von ${fmt(r.preis)}`, RAND, 278);

  g.fillStyle = '#14201a';
  g.fillRect(RAND, 306, B - 2 * RAND, 2);

  g.font = '500 18px "IBM Plex Sans", sans-serif';
  g.fillText('Käufer zahlt', RAND, 362);

  g.fillStyle = '#2c6a4f';
  g.font = '500 46px Newsreader, Georgia, serif';
  const summe = fmt(r.summe);
  g.fillText(summe, B - RAND - g.measureText(summe).width, 366);

  g.fillStyle = '#5d6a60';
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText('Servicegebühr laut Kleinanzeigen: 0,50\u00a0€ plus 4,5\u00a0% vom Artikelpreis.', RAND, 424);
  g.fillText('Halbe Cent gehen nach oben. Alle Angaben ohne Gewähr.', RAND, 446);

  g.fillStyle = '#2c6a4f';
  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText(REPO, RAND, 480);

  return new Promise(res => c.toBlob(res, 'image/png'));
}

function dateiname(r) {
  return `sicher-bezahlen-${(r.summe / 100).toFixed(2).replace('.', '-')}-euro.png`;
}

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

/* Teilen gibt es nur, wenn der Browser Dateien weiterreichen kann –
   auf dem Desktop ist das selten, auf dem Handy die Regel. */
const teilenKnopf = el('teilen-knopf');

if (navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })) {
  teilenKnopf.hidden = false;
  teilenKnopf.addEventListener('click', async () => {
    if (!letzteRechnung) return;
    const blob = await zeichneBeleg(letzteRechnung);
    const datei = new File([blob], dateiname(letzteRechnung), { type: 'image/png' });
    try {
      await navigator.share({
        files: [datei],
        title: 'Sicher bezahlen – Aufstellung',
        text: `Käufer zahlt ${fmt(letzteRechnung.summe)}.`
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
}

/* Punkt statt Komma, damit die Adresse ohne %2C lesbar bleibt.
   Die Eingabe versteht beides. */
function schreibeUrl(preisCent, versandCent) {
  const p = new URLSearchParams(location.search);
  const setze = (name, cent) => {
    if (cent === null || Number.isNaN(cent)) p.delete(name);
    else p.set(name, (cent / 100).toFixed(2));
  };
  setze('preis', preisCent);
  setze('versand', versandCent);
  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

/* ---------- Start ---------- */

preisInput.addEventListener('input', aktualisiere);
versandInput.addEventListener('input', aktualisiere);
bauCombo();
zeigeLeer();
leseUrl();
aktualisiere();
