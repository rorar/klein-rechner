/* Rechenkern für die Kleinanzeigen-Bezahlfunktion „Sicher bezahlen“.
   Gerechnet wird durchgehend in ganzen Cent, damit keine Fließkomma-Reste
   entstehen (0.1 + 0.2 lässt grüßen).

   Hier stehen die Formeln. Die Zahlen und Bezeichnungen, die sich ändern
   können, stehen in daten.js – wer Preise oder Gebühren pflegt, fasst nur
   jene Datei an.

   Dieses Modul hängt an keinem DOM. Es läuft damit unter node --test und
   lässt sich von außen über seine Adresse importieren. */

import {
  KLEINANZEIGEN, ZAHLWEGE as ZAHLWEGE_BESCHREIBUNG, VERSANDARTEN, STAND_DER_WERTE
} from './daten.js?v=19';

export { VERSANDARTEN, STAND_DER_WERTE };

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
export function berechne(preisCent, versandCent, paketstation) {
  const gebuehr = kleinanzeigenGebuehr(preisCent);
  return {
    weg: 'kleinanzeigen',
    preis: preisCent,
    versand: versandCent,
    gebuehr,
    gebuehrName: KLEINANZEIGEN_GEBUEHR_NAME,
    kaeuferZahlt: preisCent + versandCent + gebuehr,
    verkaeuferBehaelt: preisCent,     // die Gebühr trägt der Käufer
    schutz: true,
    schutzName: KLEINANZEIGEN_SCHUTZ_NAME,
    paketstation: paketstation && versandCent > 0
  };
}

/* ---------- Direktkauf ---------- */

/* Kleinster Betrag, von dem nach Abzug der Gebühr mindestens `ziel` übrig
   bleibt. Die geschlossene Formel ziel/(1−satz) trifft wegen der
   Cent-Rundung daneben, deshalb wird von unten herangetastet.

   Der Startwert kommt aus `gebuehrFn` selbst und nicht aus den
   PayPal-Konstanten: sonst hinge die Funktion still an einem Zahlweg,
   obwohl sie die Gebühr als Parameter bekommt. Von unten heranzutasten
   heißt zugleich, dass das Ergebnis der kleinste gültige Betrag ist. */
export function betragMitAufschlag(zielCent, gebuehrFn) {
  /* Zweimal schätzen, dann zählen: der erste Schätzwert liegt um die
     Gebühr auf die Gebühr daneben, der zweite nur noch um wenige Cent. */
  let betrag = zielCent + gebuehrFn(zielCent);
  betrag = zielCent + gebuehrFn(betrag);
  while (betrag - gebuehrFn(betrag) < zielCent) betrag++;
  return betrag;
}

/* gebuehrTraeger: 'verkaeufer' – die Gebühr geht vom Erlös ab.
                   'kaeufer'    – der Käufer überweist so viel mehr,
                                  dass der Erlös unberührt bleibt. */
export function berechneDirekt(preisCent, versandCent, zahlwegId, gebuehrTraeger = 'verkaeufer') {
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
    warnung: zahlweg.warnung || null,
    paketstation: false
  };
}

/* ---------- Schwellen ---------- */

const MAX_PREIS_CENT = 100000000;   // 1.000.000 €, weit jenseits jeder Anzeige

/* Kleinster Artikelpreis, ab dem `besser` zutrifft. Binäre Suche auf
   genau den Funktionen, die auch die Anzeige speist – eine Formel läge
   wegen der Rundung um bis zu einen Cent daneben.
   Die Suche ist zulässig, weil die Kleinanzeigen-Gebühr mit 4,5 %
   schneller wächst als jede Alternative mit höchstens 2,49 %. */
export function kleinsterPreis(besser, maxCent = MAX_PREIS_CENT) {
  if (besser(0)) return 'immer';
  if (!besser(maxCent)) return 'nie';
  let lo = 0, hi = maxCent;
  while (lo < hi) {
    const mitte = Math.floor((lo + hi) / 2);
    if (besser(mitte)) hi = mitte; else lo = mitte + 1;
  }
  return lo;
}

/* Liefert je Perspektive einen Betrag in Cent, 'immer', 'nie' oder
   'gleich'. 'gleich' gibt es nur beim Verkäufer: bei Überweisung, Freunden
   und Familie, Barzahlung und beim Käufer-Aufschlag behält er über beide
   Wege genau denselben Betrag. */
export function breakeven({ versandKleinanzeigen, versandDirekt, paketstation, zahlweg, gebuehrTraeger }) {
  const ka = p => berechne(p, versandKleinanzeigen, paketstation);
  const di = p => berechneDirekt(p, versandDirekt, zahlweg, gebuehrTraeger);

  const stichproben = [1000, 5000, 20000];
  const verkaeuferGleich = stichproben.every(p => di(p).verkaeuferBehaelt === ka(p).verkaeuferBehaelt);

  return {
    kaeuferAb: kleinsterPreis(p => di(p).kaeuferZahlt < ka(p).kaeuferZahlt),
    verkaeuferAb: verkaeuferGleich ? 'gleich' : kleinsterPreis(p => di(p).verkaeuferBehaelt > ka(p).verkaeuferBehaelt)
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
export function berechneAlles(eingabe = {}) {
  const {
    artikelpreisCent,
    versandKleinanzeigenCent = 0,
    versandDirektCent = 0,
    paketstation = false,
    vergleich = false,
    zahlweg = 'ueberweisung',
    gebuehrTraeger = 'verkaeufer'
  } = eingabe;

  const ganzzahlAbNull = w => Number.isInteger(w) && w >= 0;

  if (!ganzzahlAbNull(artikelpreisCent)) {
    return { fehler: 'artikelpreisCent muss eine ganze Zahl in Cent ab 0 sein' };
  }
  if (!ganzzahlAbNull(versandKleinanzeigenCent) || !ganzzahlAbNull(versandDirektCent)) {
    return { fehler: 'Versandkosten müssen ganze Zahlen in Cent ab 0 sein' };
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
