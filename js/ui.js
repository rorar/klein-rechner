/* Verdrahtung der Seite: Eingaben lesen, Ausgaben setzen, Knöpfe, Adresse.
   Alles, was hier steht, braucht ein DOM. Gerechnet wird in rechnen.js. */

import {
  KLEINANZEIGEN_FORMEL, zahlwegFormel, ZAHLWEGE, findeZahlweg, versandartenFuer,
  fmt, parseEuroToCent, berechne, berechneDirekt, breakeven, berechneAlles,
  kleinsterPreis, paypalGebuehr, betragMitAufschlag
} from './rechnen.js?v=19';
import { textDu, textSie, textNeutral } from './texte.js?v=19';
import { zeichneBeleg, dateiname } from './beleg-bild.js?v=19';

const el = id => document.getElementById(id);

const preisInput = el('preis');
const versandInput = el('versand');
const direktversandInput = el('direktversand');
const paketstationFeld = el('paketstation');
const vergleichFeld = el('vergleich');
const sheet = document.querySelector('.sheet');

const kopien = { summe: '', dsumme: '', du: '', sie: '', neutral: '', link: '', json: '' };
let letzteRechnung = null;      // Kleinanzeigen-Weg, für das Bild
let letzteDirekt = null;
let letzterBreakeven = null;

const LEERTEXT = 'Trag oben einen Artikelpreis ein, dann steht hier der fertige Text.';

const zahlwegAktuell = () =>
  document.querySelector('input[name="zahlweg"]:checked')?.value || ZAHLWEGE[0].id;

const traegerAktuell = () =>
  document.querySelector('input[name="traeger"]:checked')?.value || 'verkaeufer';

/* ---------- Zahlweg-Auswahl ---------- */

function bauZahlwege() {
  const ziel = el('zahlweg-liste');
  ZAHLWEGE.forEach((z, i) => {
    const label = document.createElement('label');
    label.innerHTML = '<input type="radio" name="zahlweg"><span class="zw-name"></span>';
    const radio = label.querySelector('input');
    radio.value = z.id;
    radio.checked = i === 0;
    label.querySelector('.zw-name').textContent = z.name;
    radio.addEventListener('change', aktualisiere);
    ziel.appendChild(label);
  });

  document.querySelectorAll('input[name="traeger"]')
    .forEach(r => r.addEventListener('change', aktualisiere));
}

/* ---------- Anzeige ---------- */

function zeigeLeer() {
  ['out-preis', 'out-versand', 'out-gebuehr', 'out-summe', 'out-behaelt',
   'd-preis', 'd-versand', 'd-gebuehr', 'd-summe', 'd-behaelt']
    .forEach(id => { el(id).textContent = '—'; });
  el('out-gebuehr-formel').textContent = '';
  el('d-gebuehr-formel').textContent = '';
  /* Die Versandnotiz blieb bisher stehen, wenn der Preis geleert wurde –
     dann hing „Zustellung an eine Paketstation“ an einem leeren Beleg. */
  el('out-versand-note').textContent = '';
  el('d-versand-note').textContent = '';
  /* Dasselbe für die JSON-Ansicht: zeigeJsonAnsicht() läuft nur am Ende von
     aktualisiere(), auf diesem Weg also nie. Unter ?format=json stand sonst
     die alte Ausgabe neben einem geleerten Beleg. */
  el('json-text').textContent = '';

  for (const feld of ['du', 'sie', 'neutral']) {
    el('text-' + feld).textContent = LEERTEXT;
    el('text-' + feld).dataset.empty = 'true';
  }

  el('breakeven').hidden = true;
  for (const k of Object.keys(kopien)) kopien[k] = '';
  letzteRechnung = null;
  letzteDirekt = null;
  letzterBreakeven = null;
  document.querySelectorAll('.copy, .neben').forEach(b => { b.disabled = true; });
}

function zeigeKleinanzeigen(r) {
  el('out-preis').textContent = fmt(r.preis);
  el('out-versand').textContent = r.versand > 0 ? fmt(r.versand) : '—';
  el('out-versand-note').textContent = r.paketstation ? 'Zustellung an eine Paketstation' : '';
  el('out-gebuehr-label').textContent = r.gebuehrName;
  el('out-gebuehr').textContent = fmt(r.gebuehr);
  el('out-gebuehr-formel').textContent = `${KLEINANZEIGEN_FORMEL} von ${fmt(r.preis)}`;
  el('out-summe').textContent = fmt(r.kaeuferZahlt);
  el('out-behaelt').textContent = fmt(r.verkaeuferBehaelt);
  el('out-schutz').textContent = `Der ${r.schutzName} greift.`;
}

function zeigeDirekt(d) {
  const zahlweg = findeZahlweg(d.zahlweg);

  el('d-preis').textContent = fmt(d.preis);
  el('d-versand').textContent = d.versand > 0 ? fmt(d.versand) : '—';
  el('d-versand-note').textContent = zahlweg.ohneVersand ? 'Abholung, kein Versand' : '';
  el('d-gebuehr-label').textContent = d.gebuehrName;
  el('d-gebuehr').textContent = d.gebuehr > 0 ? fmt(d.gebuehr) : '—';
  el('d-gebuehr-formel').textContent = d.gebuehr > 0
    ? `${zahlwegFormel(d.zahlweg)} vom Gesamtbetrag, getragen ${d.gebuehrTraeger === 'kaeufer' ? 'vom Käufer' : 'vom Verkäufer'}`
    : '';
  el('d-summe').textContent = fmt(d.kaeuferZahlt);
  el('d-behaelt').textContent = fmt(d.verkaeuferBehaelt);

  const schutz = el('d-schutz');
  schutz.textContent = d.schutz ? `Der ${d.schutzName} greift.` : 'Ohne Käuferschutz.';
  schutz.classList.toggle('schutz-ja', d.schutz);

  const warnung = el('zahlweg-warnung');
  warnung.textContent = d.warnung || '';
  warnung.hidden = !d.warnung;

  el('traeger-feld').hidden = !zahlweg.traeger;
  el('direktversand-feld').hidden = zahlweg.ohneVersand;
}

/* ---------- Breakeven ---------- */

/* Die Skala reicht so weit, dass Schwelle und aktueller Preis beide mit
   Luft darauf liegen. Unter 50 € wird sie nicht kürzer, sonst springt
   sie bei kleinen Beträgen unruhig hin und her. */
function skalaEnde(schwelleCent, preisCent) {
  const kandidaten = [5000, Math.round(preisCent * 1.35)];
  if (typeof schwelleCent === 'number') kandidaten.push(Math.round(schwelleCent * 2));
  return Math.max(...kandidaten);
}

function zeigeBreakeven(b, ka, di) {
  const abschnitt = el('breakeven');
  abschnitt.hidden = false;

  const schwelle = b.kaeuferAb;
  const ende = skalaEnde(schwelle, ka.preis);
  const anteil = c => Math.max(0, Math.min(100, (c / ende) * 100));

  const links = el('skala-links');
  const marke = el('skala-marke');
  const schwelleLabel = el('skala-schwelle');

  if (typeof schwelle === 'number') {
    links.style.flexBasis = anteil(schwelle) + '%';
    schwelleLabel.textContent = fmt(schwelle);
    schwelleLabel.style.left = anteil(schwelle) + '%';
    schwelleLabel.hidden = false;
  } else {
    // 'immer' heißt: direkt ist auf der ganzen Länge günstiger
    links.style.flexBasis = schwelle === 'immer' ? '0%' : '100%';
    schwelleLabel.hidden = true;
  }

  const markePos = anteil(ka.preis);
  marke.hidden = false;
  marke.style.left = markePos + '%';
  /* Nahe den Enden hinge die mittig gesetzte Beschriftung heraus. */
  marke.dataset.seite = markePos < 12 ? 'links' : (markePos > 88 ? 'rechts' : 'mitte');
  el('skala-marke-wert').textContent = fmt(ka.preis);
  el('skala-bis').textContent = fmt(ende);

  const kaeufer = el('befund-kaeufer');
  if (typeof schwelle === 'number') {
    kaeufer.innerHTML = `Für den Käufer dreht es sich bei <b>${fmt(schwelle)}</b>: darunter ist „Sicher bezahlen“ günstiger, darüber der Direktkauf.`;
  } else if (schwelle === 'immer') {
    kaeufer.textContent = 'Für den Käufer ist der Direktkauf bei jedem Preis günstiger.';
  } else {
    kaeufer.textContent = 'Für den Käufer ist „Sicher bezahlen“ bei jedem Preis günstiger.';
  }

  const verkaeufer = el('befund-verkaeufer');
  if (b.verkaeuferAb === 'gleich') {
    verkaeufer.innerHTML = `Für dich als Verkäufer macht es keinen Unterschied – du behältst über beide Wege <b>${fmt(ka.verkaeuferBehaelt)}</b>.`;
  } else if (b.verkaeuferAb === 'nie') {
    verkaeufer.innerHTML = `Für dich als Verkäufer ist „Sicher bezahlen“ immer besser: dort zahlt der Käufer die Gebühr, hier gingen <b>${fmt(di.gebuehr)}</b> von deinem Erlös ab.`;
  } else {
    verkaeufer.innerHTML = `Für dich als Verkäufer ab <b>${fmt(b.verkaeuferAb)}</b>.`;
  }

  const hinweis = el('befund-hinweis');
  const bar = findeZahlweg(di.zahlweg).ohneVersand;
  hinweis.hidden = !bar;
  if (bar) hinweis.textContent = 'Abholung ohne Versand lässt sich mit einem Versandkauf nicht unmittelbar vergleichen – der Käufer muss dafür vorbeikommen.';
}

/* ---------- Hauptschleife ---------- */

function aktualisiere() {
  const preis = parseEuroToCent(preisInput.value);
  const versand = parseEuroToCent(versandInput.value);
  const direktversand = parseEuroToCent(direktversandInput.value);
  const vergleich = vergleichFeld.checked;

  const preisKaputt = Number.isNaN(preis);
  const versandKaputt = Number.isNaN(versand);
  /* Nur im Vergleich zählt das Direktfeld. Sonst sperrte ein Tippfehler
     darin die ganze Anzeige, während die dazugehörige Fehlermeldung im
     ausgeblendeten Feld steckt und niemand den Grund zu sehen bekäme. */
  const direktKaputt = vergleich && Number.isNaN(direktversand);
  el('preis-fehler').hidden = !preisKaputt;
  el('versand-fehler').hidden = !versandKaputt;
  el('direktversand-fehler').hidden = !direktKaputt;

  sheet.dataset.vergleich = vergleich ? 'an' : 'aus';
  el('beleg-direkt').hidden = !vergleich;
  el('direktversand-feld').hidden = !vergleich;
  document.querySelectorAll('#beleg-titel [data-solo]').forEach(s => { s.hidden = vergleich; });
  document.querySelectorAll('#beleg-titel [data-vergleich]').forEach(s => { s.hidden = !vergleich; });

  schreibeUrl({
    preis, versand, direktversand,
    paketstation: paketstationFeld.checked && versand > 0,
    vergleich
  });

  if (preisKaputt || versandKaputt || direktKaputt || preis === null) {
    zeigeLeer();
    return;
  }

  const ka = berechne(preis, versand === null ? 0 : versand, paketstationFeld.checked);
  letzteRechnung = ka;
  zeigeKleinanzeigen(ka);

  let di = null;
  if (vergleich) {
    di = berechneDirekt(preis, direktversand === null ? 0 : direktversand,
                        zahlwegAktuell(), traegerAktuell());
    letzteDirekt = di;
    letzterBreakeven = breakeven({
      versandKleinanzeigen: ka.versand,
      versandDirekt: di.versand,
      paketstation: paketstationFeld.checked,
      zahlweg: di.zahlweg,
      gebuehrTraeger: traegerAktuell()
    });
    zeigeDirekt(di);
    zeigeBreakeven(letzterBreakeven, ka, di);
  } else {
    letzteDirekt = null;
    letzterBreakeven = null;
    el('breakeven').hidden = true;
  }

  kopien.summe = fmt(ka.kaeuferZahlt);
  kopien.dsumme = di ? fmt(di.kaeuferZahlt) : '';
  kopien.link = location.href;   // schreibeUrl lief oben, die Adresse stimmt
  kopien.du = textDu(ka, di);
  kopien.sie = textSie(ka, di);
  kopien.neutral = textNeutral(ka, di);
  kopien.json = JSON.stringify(aktuellesErgebnis(), null, 2);

  for (const feld of ['du', 'sie', 'neutral']) {
    el('text-' + feld).textContent = kopien[feld];
    el('text-' + feld).dataset.empty = 'false';
  }

  document.querySelectorAll('.copy, .neben').forEach(b => { b.disabled = false; });
  zeigeJsonAnsicht();
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

/* Dieselbe Mechanik trägt beide Felder. Ein <datalist> täte es nicht:
   Chrome filtert die Liste, sobald das Feld einen Wert hat, und man
   kommt an die übrigen Einträge nicht mehr heran. */
function bauCombo({ feld, listeId, arten, nachWahl }) {
  const wrap = feld.closest('.combo');
  const liste = el(listeId);
  const toggle = wrap.querySelector('.combo-toggle');
  let aktiv = -1;

  arten.forEach((art, i) => {
    const li = document.createElement('li');
    li.id = `${listeId}-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.innerHTML = '<span class="opt-name"></span><span class="opt-hinweis"></span><span class="opt-value"></span>';
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
      feld.setAttribute('aria-activedescendant', optionen[i].id);
      optionen[i].scrollIntoView({ block: 'nearest' });
    } else {
      feld.removeAttribute('aria-activedescendant');
    }
  }

  function oeffne() {
    liste.hidden = false;
    wrap.dataset.open = 'true';
    feld.setAttribute('aria-expanded', 'true');
  }

  function schliesse() {
    liste.hidden = true;
    wrap.dataset.open = 'false';
    feld.setAttribute('aria-expanded', 'false');
    markiere(-1);
  }

  function waehle(i) {
    feld.value = (arten[i].cent / 100).toFixed(2).replace('.', ',');
    schliesse();
    nachWahl?.(arten[i]);
    aktualisiere();
  }

  toggle.addEventListener('mousedown', ev => {
    ev.preventDefault();
    if (liste.hidden) { oeffne(); feld.focus(); } else { schliesse(); }
  });

  feld.addEventListener('keydown', ev => {
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
    } else if (ev.key === 'Escape' || ev.key === 'Tab') {
      schliesse();
    }
  });

  feld.addEventListener('blur', schliesse);
  feld.addEventListener('input', () => { if (!liste.hidden) markiere(-1); });
}

/* ---------- Bild speichern und teilen ---------- */

el('bild-knopf').addEventListener('click', async () => {
  /* Der Stand wird festgehalten, bevor gewartet wird: tippt jemand während
     des Zeichnens weiter, zeigten Bild und Dateiname sonst zwei
     verschiedene Rechnungen – und beim Leeren des Feldes wäre
     letzteRechnung hier null. */
  const ka = letzteRechnung;
  const di = letzteDirekt;
  const b = letzterBreakeven;
  if (!ka) return;

  let url = null;
  try {
    const blob = await zeichneBeleg(ka, di, b);
    url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname(ka);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Bild gespeichert');
  } catch {
    /* Ohne diesen Fang bliebe eine abgewiesene Zusage unbeachtet liegen
       und der Knopf täte stumm gar nichts. */
    toast('Bild speichern hat nicht geklappt');
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
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

/* Bild teilen gibt es nur, wenn der Browser Dateien weiterreichen kann.
   Die Probe entsteht erst innerhalb der Prüfung: ein Browser ohne
   File-Konstruktor hätte sonst schon beim Laden des Moduls aufgegeben und
   die ganze Seite wäre tot. Eine leere Datei taugt nicht als Probe, manche
   Browser weisen sie ab. */
const teilenKnopf = el('teilen-knopf');

const kannDateienTeilen = () => {
  if (!navigator.canShare || typeof File !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array([0])], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

if (kannDateienTeilen()) {
  teilenKnopf.hidden = false;
  teilenKnopf.addEventListener('click', async () => {
    /* Wie beim Speichern: erst den Stand festhalten, dann warten. */
    const ka = letzteRechnung;
    const di = letzteDirekt;
    const b = letzterBreakeven;
    if (!ka) return;
    try {
      /* Das Zeichnen steht mit im try, sonst bliebe sein Fehlschlag
         unbeachtet liegen. */
      const blob = await zeichneBeleg(ka, di, b);
      const datei = new File([blob], dateiname(ka), { type: 'image/png' });
      await navigator.share({
        files: [datei],
        title: 'Sicher bezahlen – Aufstellung',
        text: `Käufer zahlt ${fmt(ka.kaeuferZahlt)}.`
      });
    } catch (e) {
      if (e.name !== 'AbortError') toast('Teilen hat nicht geklappt');
    }
  });
}

/* ---------- Anbindung von außen ---------- */

function aktuellesErgebnis() {
  return berechneAlles({
    artikelpreisCent: letzteRechnung?.preis ?? 0,
    versandKleinanzeigenCent: letzteRechnung?.versand ?? 0,
    versandDirektCent: letzteDirekt?.versand ?? 0,
    paketstation: Boolean(letzteRechnung?.paketstation),
    vergleich: vergleichFeld.checked,
    zahlweg: zahlwegAktuell(),
    gebuehrTraeger: traegerAktuell()
  });
}

function zeigeJsonAnsicht() {
  const an = new URLSearchParams(location.search).get('format') === 'json';
  el('json-ansicht').hidden = !an;
  if (an) el('json-text').textContent = kopien.json;
}

/* Für Einbindung per Skript-Tag, wenn jemand keine Module nutzen kann. */
window.kleinRechner = {
  berechneAlles, berechne, berechneDirekt, breakeven, kleinsterPreis,
  paypalGebuehr, betragMitAufschlag, parseEuroToCent, fmt,
  ZAHLWEGE, versandartenFuer
};

/* Für eingebettete Seiten. Die Antwort geht an den fragenden Ursprung
   zurück, nicht an '*': sonst liest jedes andere eingebettete Fenster mit. */
window.addEventListener('message', ev => {
  if (ev.data?.typ !== 'klein-rechner:rechne') return;
  /* Eine einbettende Seite ohne echten Ursprung – aus file:// oder einem
     sandbox-iframe – meldet sich als "null". Dorthin zu antworten wirft,
     und an '*' zu antworten würde jedes andere eingebettete Fenster
     mitlesen lassen. Also gar nicht. */
  if (!ev.origin || ev.origin === 'null') return;
  const ergebnis = berechneAlles(ev.data.eingabe);
  ev.source?.postMessage({ typ: 'klein-rechner:ergebnis', ergebnis }, ev.origin);
});

/* ---------- Adresse als Zustand ---------- */

function leseUrl() {
  const p = new URLSearchParams(location.search);
  const setzeFeld = (name, feld) => {
    const wert = p.get(name);
    if (wert !== null) feld.value = wert;
  };
  setzeFeld('preis', preisInput);
  setzeFeld('versand', versandInput);
  setzeFeld('direktversand', direktversandInput);
  paketstationFeld.checked = p.get('paketstation') === '1';
  vergleichFeld.checked = p.get('vergleich') === '1';

  const zahlweg = findeZahlweg(p.get('zahlweg'));   // unbekannt fällt auf den ersten zurück
  const radio = document.querySelector(`input[name="zahlweg"][value="${zahlweg.id}"]`);
  if (radio) radio.checked = true;

  const traegerRadio = document.querySelector('input[name="traeger"][value="kaeufer"]');
  if (p.get('traeger') === 'kaeufer' && traegerRadio) traegerRadio.checked = true;
}

/* Punkt statt Komma, damit die Adresse ohne %2C lesbar bleibt.
   Die Eingabe versteht beides. */
function schreibeUrl({ preis, versand, direktversand, paketstation, vergleich }) {
  const p = new URLSearchParams(location.search);
  const setze = (name, cent) => {
    if (cent === null || Number.isNaN(cent)) p.delete(name);
    else p.set(name, (cent / 100).toFixed(2));
  };
  setze('preis', preis);
  setze('versand', versand);

  if (paketstation) p.set('paketstation', '1'); else p.delete('paketstation');

  if (vergleich) {
    p.set('vergleich', '1');
    setze('direktversand', direktversand);
    p.set('zahlweg', zahlwegAktuell());
    if (findeZahlweg(zahlwegAktuell()).traeger) p.set('traeger', traegerAktuell());
    else p.delete('traeger');
  } else {
    ['vergleich', 'direktversand', 'zahlweg', 'traeger'].forEach(n => p.delete(n));
  }

  const s = p.toString();
  history.replaceState(null, '', s ? '?' + s : location.pathname);
}

/* ---------- Start ---------- */

preisInput.addEventListener('input', aktualisiere);
versandInput.addEventListener('input', aktualisiere);
direktversandInput.addEventListener('input', aktualisiere);
paketstationFeld.addEventListener('change', aktualisiere);
vergleichFeld.addEventListener('change', aktualisiere);

bauZahlwege();
bauCombo({
  feld: versandInput,
  listeId: 'versand-liste',
  arten: versandartenFuer('kleinanzeigen'),
  nachWahl: art => { paketstationFeld.checked = art.paketstation === true; }
});
bauCombo({
  feld: direktversandInput,
  listeId: 'direktversand-liste',
  arten: versandartenFuer('direkt')
});

zeigeLeer();
leseUrl();
aktualisiere();
