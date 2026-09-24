/* Rechenkern für die Kleinanzeigen-Bezahlfunktion „Sicher bezahlen“.
   Gerechnet wird durchgehend in ganzen Cent, damit keine Fließkomma-Reste
   entstehen (0.1 + 0.2 lässt grüßen).

   Hier stehen die Formeln. Die Zahlen und Bezeichnungen, die sich ändern
   können, stehen in daten.js – wer Preise oder Gebühren pflegt, fasst nur
   jene Datei an.

   Dieses Modul hängt an keinem DOM. Es läuft damit unter node --test und
   lässt sich von außen über seine Adresse importieren. */

import {
  KLEINANZEIGEN, ZAHLWEGE as ZAHLWEGE_BESCHREIBUNG, VERSANDARTEN, STAND_DER_WERTE,
  sendungBeschreibung, haftungSatz
} from './daten.js?v=24';

export { VERSANDARTEN, STAND_DER_WERTE, sendungBeschreibung, haftungSatz };

export const KLEINANZEIGEN_GEBUEHR_NAME = KLEINANZEIGEN.gebuehrName;
export const KLEINANZEIGEN_SCHUTZ_NAME = KLEINANZEIGEN.schutzName;
export const GEBUEHR_FIX_CENT = KLEINANZEIGEN.gebuehr.festCent;

/* Aus einem Deskriptor in daten.js wird hier eine Funktion. Der Anteil
   steht in Zehntausendsteln, halbe Cent gehen nach oben. `null` heißt
   gebührenfrei. */
export function gebuehrAus(deskriptor) {
  if (!deskriptor) return () => 0;
  return betragCent => deskriptor.festCent + Math.round((betragCent * deskriptor.basispunkte) / 10000);
}

/* Die Zahlwege kommen als Beschreibung aus daten.js, die Gebührenfunktion
   entsteht erst hier. Ein neuer Zahlweg ist damit eine reine Datenänderung. */
export const ZAHLWEGE = ZAHLWEGE_BESCHREIBUNG.map(z => ({ ...z, gebuehr: gebuehrAus(z.gebuehr) }));

export const findeZahlweg = id => ZAHLWEGE.find(z => z.id === id) || ZAHLWEGE[0];

/* Die Auswahlliste je Feld: der Kleinanzeigen-Versand taucht nur im
   Kleinanzeigen-Feld auf, die Preise der Dienstleister nur im Direktfeld. */
export const versandartenFuer = quelle =>
  VERSANDARTEN.filter(a => a.quelle === quelle || a.quelle === 'beide');

/* Anders als Kleinanzeigen bemisst PayPal die Gebühr am gesamten
   überwiesenen Betrag, also einschließlich Versand. Einzeln herausgereicht
   für Aufrufer von außen und für die Tests. */
export const paypalGebuehr = gebuehrAus(
  ZAHLWEGE_BESCHREIBUNG.find(z => z.id === 'paypal-wd').gebuehr
);

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const prozent = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const fmt = cent => euro.format(cent / 100);

/* Schreibt einen Gebühren-Deskriptor als Formel aus, damit die Sätze
   nirgends noch einmal als Text stehen. */
export function gebuehrFormel(deskriptor) {
  if (!deskriptor) return 'keine Gebühr';
  return `${fmt(deskriptor.festCent)} + ${prozent.format(deskriptor.basispunkte / 100)}\u00a0%`;
}

export const KLEINANZEIGEN_FORMEL = gebuehrFormel(KLEINANZEIGEN.gebuehr);

/* Ausführlicher, für die Nachricht an den Käufer: dort soll erkennbar
   sein, woraus die Gebühr besteht und worauf der Anteil sich bezieht.
   Die Grundlage steht immer dabei, nicht nur beim Gesamtbetrag: sonst
   stand im Vergleich links „4,5 %“ ohne Bezug neben rechts
   „2,49 % vom Gesamtbetrag“, als wäre das dieselbe Größe. */
export function gebuehrAufschluesselung(deskriptor) {
  if (!deskriptor) return null;
  const bezug = deskriptor.grundlage === 'gesamtbetrag' ? 'vom Gesamtbetrag' : 'vom Artikelpreis';
  return `${fmt(deskriptor.festCent)} Pauschal + ${prozent.format(deskriptor.basispunkte / 100)}\u00a0% ${bezug}`;
}

export const KLEINANZEIGEN_AUFSCHLUESSELUNG = gebuehrAufschluesselung(KLEINANZEIGEN.gebuehr);

export const zahlwegAufschluesselung = id =>
  gebuehrAufschluesselung(ZAHLWEGE_BESCHREIBUNG.find(z => z.id === id)?.gebuehr);

export const zahlwegFormel = id =>
  gebuehrFormel(ZAHLWEGE_BESCHREIBUNG.find(z => z.id === id)?.gebuehr);

/* Nimmt „45“, „45,00“, „45.00“, „1.234,56“ und „12 €“ entgegen.
   Rückgabe: Cent als Ganzzahl, null bei leer, NaN bei Unsinn. */
export function parseEuroToCent(roh) {
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

/* Die Servicegebühr bemisst sich am Artikelpreis, nicht am Gesamtbetrag. */
export const kleinanzeigenGebuehr = gebuehrAus(KLEINANZEIGEN.gebuehr);

/* Alle Rechnungen liefern dieselbe Form, damit Beleg, Text und Bild einen
   Weg wie den anderen behandeln können. */
export function berechne(preisCent, versandCent, paketstation, versandart = null) {
  const gebuehr = kleinanzeigenGebuehr(preisCent);
  return {
    weg: 'kleinanzeigen',
    preis: preisCent,
    versand: versandCent,
    gebuehr,
    gebuehrName: KLEINANZEIGEN_GEBUEHR_NAME,
    gebuehrAufschluesselung: KLEINANZEIGEN_AUFSCHLUESSELUNG,
    kaeuferZahlt: preisCent + versandCent + gebuehr,
    verkaeuferBehaelt: preisCent,     // die Gebühr trägt der Käufer
    schutz: true,
    schutzName: KLEINANZEIGEN_SCHUTZ_NAME,
    paketstation: paketstation && versandCent > 0,
    versandName: versandart ? (versandart.kurz || versandart.name) : null,
    versandZustellung: versandart?.zustellung || null,
    /* Von allem, was die Sendung beschreibt, geht den Käufer nur die
       Haftungsgrenze etwas an: Maß und Gewicht sind die Sorge dessen, der
       das Paket packt. */
    versandHaftung: versandart ? haftungSatz(versandart) : null
  };
}

/* ---------- Direktkauf ---------- */

/* Kleinster Betrag, von dem nach Abzug der Gebühr mindestens `ziel` übrig
   bleibt. Die geschlossene Formel ziel/(1−satz) trifft wegen der
   Cent-Rundung daneben.

   Gesucht wird per Bisektion, nicht durch Hochzählen: `betrag − gebuehr`
   wächst mit jedem Cent um 1 minus 0 oder 1, ist also nie fallend, und
   damit ist die Bedingung monoton. Hochzählen lief bei großen Beträgen
   über hundert Millionen Runden und oberhalb von 2^53 überhaupt nicht
   mehr weiter, weil betrag + 1 dort denselben Wert ergibt. */
export function betragMitAufschlag(zielCent, gebuehrFn) {
  /* Oberhalb von 2^53 liegen ganze Zahlen nicht mehr lückenlos: mitte + 1
     ergibt dort wieder mitte, und auch die Bisektion käme nicht zum Ende.
     Solche Beträge sind kein Anwendungsfall, aber sie waren über die
     Adresse erreichbar. */
  if (!Number.isSafeInteger(zielCent) || zielCent < 0) {
    throw new RangeError('zielCent muss eine sichere ganze Zahl ab 0 sein');
  }

  const reicht = betrag => betrag - gebuehrFn(betrag) >= zielCent;

  let lo = zielCent;
  let hi = zielCent + gebuehrFn(zielCent) * 2 + 1000;
  while (!reicht(hi)) hi *= 2;      // greift nur bei sehr großen Sätzen

  while (lo < hi) {
    const mitte = Math.floor((lo + hi) / 2);
    if (reicht(mitte)) hi = mitte; else lo = mitte + 1;
  }
  return lo;
}

/* gebuehrTraeger: 'verkaeufer' – die Gebühr geht vom Erlös ab.
                   'kaeufer'    – der Käufer überweist so viel mehr,
                                  dass der Erlös unberührt bleibt. */
export function berechneDirekt(preisCent, versandCent, zahlwegId, gebuehrTraeger = 'verkaeufer', versandart = null) {
  const zahlweg = findeZahlweg(zahlwegId);
  const versand = zahlweg.ohneVersand ? 0 : versandCent;
  const ziel = preisCent + versand;

  let kaeuferZahlt = ziel;
  let gebuehr = zahlweg.gebuehr(ziel);
  let verkaeuferBehaelt = preisCent;

  if (gebuehr > 0) {
    if (gebuehrTraeger === 'kaeufer') {
      kaeuferZahlt = betragMitAufschlag(ziel, zahlweg.gebuehr);
      gebuehr = zahlweg.gebuehr(kaeuferZahlt);
      verkaeuferBehaelt = kaeuferZahlt - gebuehr - versand;
    } else {
      verkaeuferBehaelt = kaeuferZahlt - gebuehr - versand;
    }
  }

  return {
    weg: 'direkt',
    zahlweg: zahlweg.id,
    zahlwegName: zahlweg.name,
    gebuehrTraeger: zahlweg.traeger ? gebuehrTraeger : null,
    preis: preisCent,
    versand,
    gebuehr,
    gebuehrName: zahlweg.gebuehrName,
    kaeuferZahlt,
    verkaeuferBehaelt,
    schutz: zahlweg.schutz,
    schutzName: zahlweg.schutzName || null,
    gebuehrAufschluesselung: gebuehrAufschluesselung(
      ZAHLWEGE_BESCHREIBUNG.find(z => z.id === zahlweg.id)?.gebuehr),
    warnung: zahlweg.warnung || null,
    paketstation: false,
    versandName: zahlweg.ohneVersand || !versandart ? null : (versandart.kurz || versandart.name),
    versandZustellung: zahlweg.ohneVersand ? null : (versandart?.zustellung || null),
    versandHaftung: zahlweg.ohneVersand || !versandart ? null : haftungSatz(versandart)
  };
}

/* ---------- Schwellen ---------- */

export const MAX_PREIS_CENT = 100000000;   // 1.000.000 €, weit jenseits jeder Anzeige

/* Die Grenze gilt für jede Eingabe, nicht nur für die JSON-Schnittstelle.
   Darüber liefen Suche und Aufschlag über Beträge, bei denen ganze Zahlen
   nicht mehr lückenlos darstellbar sind - die Seite stand beim Laden. */
export const imRahmen = cent =>
  Number.isInteger(cent) && cent >= 0 && cent <= MAX_PREIS_CENT;

/* Wie weit unter dem Fund der Bisektion noch nach einer früheren Stelle
   gesucht wird. Die Cent-Rundung in beiden Gebührenmodellen lässt den
   Unterschied mehrfach das Vorzeichen wechseln – gemessen über ein Band
   von gut zwanzig Cent. 50 € Fenster sind reichlich und kosten nur eine
   Schleife über wenige tausend Werte. */
const FEINFENSTER_CENT = 5000;

/* Kleinster Artikelpreis, ab dem `besser` zutrifft.

   Die Bedingung ist im Groben monoton – die Kleinanzeigen-Gebühr wächst
   mit 4,5 % schneller als jede Alternative mit höchstens 2,49 % –, im
   Feinen aber nicht: die Rundung auf ganze Cent lässt sie um den
   Wendepunkt herum mehrfach kippen. Reine Bisektion griff deshalb daneben
   und meldete zum Beispiel 49,67 € statt der richtigen 49,45 €.
   Die Bisektion findet jetzt nur die Gegend, die Feinsuche die Stelle. */
export function kleinsterPreis(besser, maxCent = MAX_PREIS_CENT) {
  if (besser(0)) return 'immer';
  if (!besser(maxCent)) return 'nie';

  let lo = 0, hi = maxCent;
  while (lo < hi) {
    const mitte = Math.floor((lo + hi) / 2);
    if (besser(mitte)) hi = mitte; else lo = mitte + 1;
  }

  const von = Math.max(0, lo - FEINFENSTER_CENT);
  for (let p = von; p < lo; p++) {
    if (besser(p)) return p;
  }
  return lo;
}

/* Liefert je Perspektive einen Betrag in Cent, 'immer', 'nie' oder
   'gleich'. */
export function breakeven({ versandKleinanzeigen, versandDirekt, paketstation, zahlweg, gebuehrTraeger }) {
  const ka = p => berechne(p, versandKleinanzeigen, paketstation);
  const di = p => berechneDirekt(p, versandDirekt, zahlweg, gebuehrTraeger);

  /* Die Verkäufersicht braucht keine Suche, sie folgt aus dem Zahlweg:
     über Kleinanzeigen behält er immer den Artikelpreis, direkt ebenso –
     außer die Gebühr geht von seinem Erlös ab. Dann ist Kleinanzeigen bei
     jedem Preis besser, nie erst ab einem. Vorher wurde das aus drei fest
     verdrahteten Stichproben geraten. */
  const gewaehlt = findeZahlweg(zahlweg);
  const traegtVerkaeufer = Boolean(gewaehlt.gebuehr(1)) && gewaehlt.traeger && gebuehrTraeger !== 'kaeufer';

  return {
    kaeuferAb: kleinsterPreis(p => di(p).kaeuferZahlt < ka(p).kaeuferZahlt),
    verkaeuferAb: traegtVerkaeufer ? 'nie' : 'gleich'
  };
}

/* ---------- Ergebnis als schlichtes Objekt ---------- */

export const FASSUNG = 1;

const HINWEIS = 'Richtwerte ohne Gewähr. Kein Angebot der Kleinanzeigen GmbH.';

const alsPosten = r => ({
  artikelCent: r.preis,
  versandCent: r.versand,
  gebuehrCent: r.gebuehr,
  kaeuferZahltCent: r.kaeuferZahlt,
  verkaeuferBehaeltCent: r.verkaeuferBehaelt,
  kaeuferschutz: r.schutz
});

/* Einstieg für alles, was von außen kommt: Adresse, postMessage, fremder
   Code. Liefert bei Unsinn ein Fehlerobjekt statt einer Ausnahme, damit
   ein Aufrufer nichts abfangen muss. */
export function berechneAlles(roheEingabe) {
  /* `= {}` deckt nur undefined ab. null, Zahlen und Zeichenketten kamen
     bis in die Zerlegung und warfen dort – entgegen der Zusage in diesem
     Kommentar und im README. */
  const eingabe = (roheEingabe && typeof roheEingabe === 'object') ? roheEingabe : {};
  const {
    artikelpreisCent,
    versandKleinanzeigenCent = 0,
    versandDirektCent = 0,
    paketstation = false,
    vergleich = false,
    zahlweg = 'ueberweisung',
    gebuehrTraeger = 'verkaeufer'
  } = eingabe;

    if (!imRahmen(artikelpreisCent)) {
    return { fehler: `artikelpreisCent muss eine ganze Zahl in Cent zwischen 0 und ${MAX_PREIS_CENT} sein` };
  }
  if (!imRahmen(versandKleinanzeigenCent) || !imRahmen(versandDirektCent)) {
    return { fehler: `Versandkosten müssen ganze Zahlen in Cent zwischen 0 und ${MAX_PREIS_CENT} sein` };
  }

  const ka = berechne(artikelpreisCent, versandKleinanzeigenCent, paketstation);

  const ergebnis = {
    fassung: FASSUNG,
    waehrung: 'EUR',
    stand: STAND_DER_WERTE,
    eingabe: {
      artikelpreisCent,
      versandKleinanzeigenCent,
      paketstation: ka.paketstation,
      vergleich: Boolean(vergleich)
    },
    kleinanzeigen: alsPosten(ka),
    hinweis: HINWEIS
  };

  if (!vergleich) return ergebnis;

  const gewaehlt = findeZahlweg(zahlweg);
  const traeger = gewaehlt.traeger && gebuehrTraeger === 'kaeufer' ? 'kaeufer' : 'verkaeufer';
  const di = berechneDirekt(artikelpreisCent, versandDirektCent, gewaehlt.id, traeger);

  ergebnis.eingabe.versandDirektCent = di.versand;
  ergebnis.eingabe.zahlweg = gewaehlt.id;
  ergebnis.eingabe.gebuehrTraeger = di.gebuehrTraeger;

  ergebnis.direkt = { zahlweg: gewaehlt.id, ...alsPosten(di) };

  const b = breakeven({
    versandKleinanzeigen: versandKleinanzeigenCent,
    versandDirekt: versandDirektCent,
    paketstation,
    zahlweg: gewaehlt.id,
    gebuehrTraeger: traeger
  });
  ergebnis.breakeven = { kaeuferAbCent: b.kaeuferAb, verkaeufer: b.verkaeuferAb };

  const differenz = ka.kaeuferZahlt - di.kaeuferZahlt;
  ergebnis.guenstigerFuerKaeufer = differenz === 0 ? 'gleich' : (differenz > 0 ? 'direkt' : 'kleinanzeigen');
  ergebnis.differenzKaeuferCent = Math.abs(differenz);

  return ergebnis;
}
