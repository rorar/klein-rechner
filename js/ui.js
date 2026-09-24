/* Verdrahtung der Seite: Eingaben lesen, Ausgaben setzen, Knöpfe, Adresse.
   Alles, was hier steht, braucht ein DOM. Gerechnet wird in rechnen.js. */

import {
  KLEINANZEIGEN_FORMEL, KLEINANZEIGEN_GEBUEHR_NAME, ZAHLWEGE, findeZahlweg, versandartenFuer, imRahmen,
  kleinanzeigenGebuehr, STAND_DER_WERTE, sendungBeschreibung,
  fmt, parseEuroToCent, berechne, berechneDirekt, breakeven, berechneAlles,
  kleinsterPreis, paypalGebuehr, betragMitAufschlag
} from './rechnen.js?v=25';
import {
  textDu, textSie, textNeutral, breakevenSaetze, kostenPosten
} from './texte.js?v=25';
import { zeichneBeleg, dateiname } from './beleg-bild.js?v=25';

/* Steht ganz oben, vor jedem Zugriff aufs Dokument: auf einer fremden
   Seite gäbe es die Knöpfe nicht, das Modul bräche beim Laden ab, und die
   Schnittstelle wäre nie gesetzt worden - ausgerechnet für den Fall, für
   den sie gedacht ist. */
/* Für Einbindung per Skript-Tag, wenn jemand keine Module nutzen kann. */
window.kleinRechner = {
  berechneAlles, berechne, berechneDirekt, breakeven, kleinsterPreis,
  paypalGebuehr, betragMitAufschlag, parseEuroToCent, fmt,
  ZAHLWEGE, versandartenFuer
};

const el = id => document.getElementById(id);

/* Das Modul dient zwei Zwecken: es verdrahtet diese Seite, und es reicht
   window.kleinRechner an fremde Seiten weiter. Fehlt das Markup, ist nur
   der zweite gemeint – dann wird nichts verdrahtet, statt beim ersten
   fehlenden Knopf abzubrechen. */
const aufDerEigenenSeite = Boolean(document.getElementById('preis'));

const preisInput = el('preis');
const versandInput = el('versand');
const direktversandInput = el('direktversand');
const paketstationFeld = el('paketstation');
const vergleichFeld = el('vergleich');
const sheet = document.querySelector('.sheet');

const kopien = { summe: '', dsumme: '', du: '', sie: '', neutral: '', link: '', json: '' };
/* Der Name der Versandart und ihre Zustellbedingung gehören in die
   Nachricht an den Käufer; ein Betrag allein sagt beides nicht. Die Art
   wird bei jeder Rechnung aus dem Betrag abgeleitet statt als Zustand
   mitgeschleppt: eine gemerkte Auswahl klebte sonst an einem Betrag, der
   von Hand geändert wurde und gar nicht mehr zu ihr passt. */
const artZu = (quelle, cent) =>
  cent === null || Number.isNaN(cent) ? null : (versandartenFuer(quelle).find(a => a.cent === cent) || null);

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

/* Das Gerüst einer Belegzeile. Die Zeilen stehen nicht fest im Markup,
   weil kostenPosten() entscheidet, welche es gibt. */
function zeilenGeruest() {
  const zeile = document.createElement('div');
  zeile.className = 'row';
  zeile.innerHTML = '<span class="row-label"></span>'
    + '<span class="row-dots" aria-hidden="true"></span>'
    + '<span class="row-amount"></span><span class="row-note"></span>';
  return zeile;
}

/* Eine Zeile befüllen. `ersatz` steht für einen fehlenden Betrag: im
   gefüllten Beleg leer („ohne Versand, Abholung“ braucht keine Zahl), im
   leeren ein Gedankenstrich. */
function fuelleZeile(zeileEl, z, ersatz) {
  const betragText = z.betrag === null ? ersatz : fmt(z.betrag);
  zeileEl.dataset.art = z.art;
  /* Ohne Betrag liefe die Punktlinie ins Leere. */
  zeileEl.classList.toggle('row-ohne-betrag', betragText === '');
  zeileEl.querySelector('.row-label').textContent = z.label;
  zeileEl.querySelector('.row-amount').textContent = betragText;
  zeileEl.querySelector('.row-note').textContent = z.notiz || '';
}

/* Bestehende Zeilen werden weiterverwendet und nur neu beschriftet. Ein
   Neuaufbau bei jedem Tastendruck ließe den Screenreader den ganzen Block
   noch einmal vorlesen. */
function zeichneZeilen(behaelter, zeilen, ersatz) {
  while (behaelter.children.length > zeilen.length) behaelter.lastElementChild.remove();
  while (behaelter.children.length < zeilen.length) behaelter.appendChild(zeilenGeruest());
  zeilen.forEach((z, i) => fuelleZeile(behaelter.children[i], z, ersatz));
}

/* Der leere Beleg zeigt dieselben drei Zeilen wie der gefüllte, nur ohne
   Beträge. Bliebe die Gestalt der letzten Rechnung stehen, stünde dort
   etwa „ohne Versand, Abholung“ an einem Beleg ohne Zahlen. */
const leereZeilen = gebuehrName => [
  { art: 'preis', label: 'Artikelpreis', betrag: null },
  { art: 'gebuehr', label: gebuehrName, betrag: null },
  { art: 'versand', label: 'Versand', betrag: null }
];

function zeigeLeer() {
  zeichneZeilen(el('rows'), leereZeilen(KLEINANZEIGEN_GEBUEHR_NAME), '—');
  zeichneZeilen(el('d-rows'), leereZeilen(findeZahlweg(zahlwegAktuell()).gebuehrName), '—');
  /* Auch die Fußnote: sonst stünde am leeren Beleg noch, wer die Gebühr
     der letzten Rechnung getragen hat. */
  el('fussnoten').textContent = '';
  el('d-fussnoten').textContent = '';
  ['out-summe', 'out-behaelt', 'd-summe', 'd-behaelt']
    .forEach(id => { el(id).textContent = '—'; });
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

/* Beide Belege aus kostenPosten(), derselben Quelle wie Nachricht und
   Bild.

   Vorher setzte die Seite jedes Feld für sich. Die Gebührenzeile stand
   dabei immer über dem Strich, auch wenn der Verkäufer sie trug: 78,00 +
   3,99 + 2,39 über „Käufer zahlt 81,99 €“. Wer die Posten aus derselben
   Aufstellung nimmt wie die Summe, kann das nicht mehr treffen. */
function zeigeBelege(ka, di) {
  zeigeBeleg('rows', 'fussnoten', 'out', kostenPosten(ka), ka);
  el('out-schutz').textContent = `Der ${ka.schutzName} greift.`;

  if (di) zeigeBeleg('d-rows', 'd-fussnoten', 'd', kostenPosten(di), di);
}

/* Anders als im Bild stehen die Belege hier nicht auf gleicher Höhe: über
   den Zeilen des Direktkaufs stehen Zahlweg und Gebührenträger. Eine
   Platzhalterzeile für eine fehlende Gebühr richtete also nichts aus und
   risse nur ein Loch in die Aufstellung. */
function zeigeBeleg(zeilenId, fussnotenId, praefix, posten, r) {
  zeichneZeilen(el(zeilenId), posten.zeilen, '');
  el(fussnotenId).textContent = posten.fussnoten.join(' ');
  el(`${praefix}-summe`).textContent = fmt(posten.summe.betrag);
  el(`${praefix}-behaelt`).textContent = fmt(r.verkaeuferBehaelt);
}

/* Beiwerk, das allein vom Zahlweg abhängt. Lief früher nur mit, wenn eine
   Rechnung zustande kam - eine geleerte Eingabe ließ dann die Warnung zu
   Freunden und Familie unter einer Banküberweisung stehen. */
function zeigeZahlwegBeiwerk() {
  const zahlweg = findeZahlweg(zahlwegAktuell());
  const warnung = el('zahlweg-warnung');
  warnung.textContent = zahlweg.warnung || '';
  warnung.hidden = !zahlweg.warnung;
  el('traeger-feld').hidden = !zahlweg.traeger;
  el('direktversand-feld').hidden = !vergleichFeld.checked || zahlweg.ohneVersand;
  const schutz = el('d-schutz');
  schutz.textContent = zahlweg.schutz ? `Der ${zahlweg.schutzName} greift.` : 'Ohne Käuferschutz.';
  schutz.classList.toggle('schutz-ja', Boolean(zahlweg.schutz));
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

  const saetze = breakevenSaetze(b, ka, di, { persoenlich: true });
  el('befund-kaeufer').textContent = saetze.kaeufer;
  el('befund-verkaeufer').textContent = saetze.verkaeufer;

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

  /* Nicht nur NaN: auch ein Betrag jenseits der Obergrenze ist unbrauchbar.
     Über die Adresse kam sonst ein Preis herein, an dem die Rechnung
     hängenblieb. */
  const unbrauchbar = w => Number.isNaN(w) || (w !== null && !imRahmen(w));
  const preisKaputt = unbrauchbar(preis);
  const versandKaputt = unbrauchbar(versand);
  /* Nur im Vergleich zählt das Direktfeld. Sonst sperrte ein Tippfehler
     darin die ganze Anzeige, während die dazugehörige Fehlermeldung im
     ausgeblendeten Feld steckt und niemand den Grund zu sehen bekäme. */
  /* Nur wenn der Zahlweg das Feld überhaupt heranzieht. Bei Barzahlung
     wirft berechneDirekt den Wert ohnehin weg; ein Tippfehler darin hätte
     sonst die gesamte Anzeige gesperrt, mitsamt der Kleinanzeigen-Seite,
     und die Begründung steckte im ausgeblendeten Feld. */
  const direktZaehlt = vergleich && !findeZahlweg(zahlwegAktuell()).ohneVersand;
  const direktKaputt = direktZaehlt && unbrauchbar(direktversand);
  el('preis-fehler').hidden = !preisKaputt;
  el('versand-fehler').hidden = !versandKaputt;
  el('direktversand-fehler').hidden = !direktKaputt;

  sheet.dataset.vergleich = vergleich ? 'an' : 'aus';
  el('beleg-direkt').hidden = !vergleich;
  zeigeZahlwegBeiwerk();
  document.querySelectorAll('#beleg-titel [data-solo]').forEach(s => { s.hidden = vergleich; });
  document.querySelectorAll('#beleg-titel [data-vergleich]').forEach(s => { s.hidden = !vergleich; });

  const adresse = baueUrl({
    preis, versand, direktversand,
    paketstation: paketstationFeld.checked && versand > 0,
    vergleich
  });

  if (preisKaputt || versandKaputt || direktKaputt || preis === null) {
    zeigeLeer();
    schreibeUrl(adresse);
    return;
  }

  const ka = berechne(preis, versand === null ? 0 : versand, paketstationFeld.checked,
                      artZu('kleinanzeigen', versand));
  letzteRechnung = ka;

  let di = null;
  if (vergleich) {
    di = berechneDirekt(preis, direktversand === null ? 0 : direktversand,
                        zahlwegAktuell(), traegerAktuell(), artZu('direkt', direktversand));
    letzteDirekt = di;
    letzterBreakeven = breakeven({
      versandKleinanzeigen: ka.versand,
      versandDirekt: di.versand,
      paketstation: paketstationFeld.checked,
      zahlweg: di.zahlweg,
      gebuehrTraeger: traegerAktuell()
    });
  } else {
    letzteDirekt = null;
    letzterBreakeven = null;
    el('breakeven').hidden = true;
  }

  zeigeBelege(ka, di);
  if (di) zeigeBreakeven(letzterBreakeven, ka, di);

  kopien.summe = fmt(ka.kaeuferZahlt);
  kopien.dsumme = di ? fmt(di.kaeuferZahlt) : '';
  /* Aus der selbst gebauten Adresse, nicht aus location.href: schlägt
     replaceState fehl oder wird es gedrosselt, stimmt location.href nicht
     mehr und der geteilte Link trüge einen falschen Preis. */
  kopien.link = new URL(adresse, location.href).href;
  kopien.du = textDu(ka, di);
  kopien.sie = textSie(ka, di);
  kopien.neutral = textNeutral(ka, di);
  /* Erst auf Verlangen: das Ergebnis noch einmal zu berechnen und zu
     serialisieren kostete bei jedem Tastendruck zwei weitere
     Schwellensuchen, obwohl es meist niemand liest. */
  kopien.json = '';

  for (const feld of ['du', 'sie', 'neutral']) {
    el('text-' + feld).textContent = kopien[feld];
    el('text-' + feld).dataset.empty = 'false';
  }

  document.querySelectorAll('.copy, .neben').forEach(b => { b.disabled = false; });
  zeigeJsonAnsicht();
  schreibeUrl(adresse);
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

if (aufDerEigenenSeite) document.querySelectorAll('.copy').forEach(btn => {
  btn.dataset.label = btn.textContent;   // einmalig, nicht beim Klick lesen
  let zurueck;

  btn.addEventListener('click', async () => {
    if (btn.dataset.copy === 'json') kopien.json = jsonText();
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
    li.innerHTML = '<span class="opt-name"></span><span class="opt-value"></span>'
      + '<span class="opt-sendung"></span><span class="opt-hinweis"></span>';
    li.querySelector('.opt-name').textContent = art.name;
    /* Größe, Maß, Gewicht und Haftung stehen über dem Hinweis: sie
       beschreiben die Sendung, der Hinweis betrifft die Buchung. */
    li.querySelector('.opt-sendung').textContent = sendungBeschreibung(art);
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

if (aufDerEigenenSeite) el('bild-knopf').addEventListener('click', async () => {
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
    /* Nicht sofort: a.click() reiht den Download nur ein. Wird die Adresse
       im selben Durchlauf freigegeben, bricht er auf manchen Browsern
       still ab und die Datei bleibt leer. */
    if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
});

/* Einen Link kann fast jedes Handy weiterreichen, Dateien deutlich seltener.
   Deshalb werden beide Knöpfe getrennt geprüft. */
const linkTeilenKnopf = el('link-teilen-knopf');

if (aufDerEigenenSeite && navigator.share) {
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

if (aufDerEigenenSeite && kannDateienTeilen()) {
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

const jsonText = () => letzteRechnung ? JSON.stringify(aktuellesErgebnis(), null, 2) : '';

function zeigeJsonAnsicht() {
  const an = new URLSearchParams(location.search).get('format') === 'json';
  el('json-ansicht').hidden = !an;
  if (an) el('json-text').textContent = jsonText();
}

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

/* ---------- Eingaben beim Verlassen aufräumen ---------- */

/* „78“ wird zu „78,00“, „78,3“ zu „78,30“. Erst beim Verlassen, nicht
   beim Tippen: sonst schöbe die Ergänzung den Eingabezeiger weg. */
function fuelleNachkommastellen(feld) {
  const cent = parseEuroToCent(feld.value);
  if (cent === null || Number.isNaN(cent) || !imRahmen(cent)) return;
  const sauber = (cent / 100).toFixed(2).replace('.', ',');
  if (feld.value !== sauber) {
    feld.value = sauber;
    aktualisiere();
  }
}

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
function baueUrl({ preis, versand, direktversand, paketstation, vergleich }) {
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
  return s ? location.pathname + '?' + s : location.pathname;
}

/* Getrennt vom Bauen: replaceState kann werfen – in einem sandbox-iframe
   ohne allow-same-origin bei jedem Tastendruck. Vorher stand der Aufruf
   als erste Anweisung der Aktualisierung und hätte dann die gesamte
   Neuberechnung abgebrochen. */
function schreibeUrl(adresse) {
  try {
    history.replaceState(null, '', adresse);
    return true;
  } catch {
    return false;
  }
}

/* Die Sätze und der Stand stehen in daten.js. Stünden sie zusätzlich als
   Text im Markup, druckte die Seite nach einer Änderung die eine Formel
   und rechnete direkt darunter mit der anderen. */
function fuelleDatenTexte() {
  el('formel-satz').textContent = KLEINANZEIGEN_FORMEL;
  el('stand-der-werte').textContent =
    new Date(STAND_DER_WERTE).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  el('rundungs-beispiel').textContent =
    `Halbe Cent gehen nach oben: der Anteil an 1,00\u00a0€ wird aufgerundet, die Gebühr beträgt damit ${fmt(kleinanzeigenGebuehr(100))}.`;
}

/* ---------- Start ---------- */

if (aufDerEigenenSeite) {
  for (const feld of [preisInput, versandInput, direktversandInput]) {
    feld.addEventListener('input', aktualisiere);
    feld.addEventListener('blur', () => fuelleNachkommastellen(feld));
  }
  paketstationFeld.addEventListener('change', aktualisiere);
  vergleichFeld.addEventListener('change', aktualisiere);

  fuelleDatenTexte();
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
}
