/* Rechenkern für die Kleinanzeigen-Bezahlfunktion „Sicher bezahlen“.
   Gerechnet wird durchgehend in ganzen Cent, damit keine Fließkomma-Reste
   entstehen (0.1 + 0.2 lässt grüßen).

   Dieses Modul hängt an keinem DOM. Es läuft damit unter node --test und
   lässt sich von außen über seine Adresse importieren. */

export const GEBUEHR_FIX_CENT = 50;   // 0,50 € Grundbetrag
export const GEBUEHR_PROMILLE = 45;   // 4,5 % = 45/1000 des Artikelpreises

/* Richtwerte, Stand September 2026. Alle Werte sind überschreibbar –
   das Feld bleibt ein normales Eingabefeld.
   Die 2,99 € laufen über Hermes und stehen so in Anzeigen mit
   Kleinanzeigen-Versand ("Versand ab 2,99 €"); die Preise pro Paketgröße
   zeigt erst der Kaufvorgang. */
export const VERSANDARTEN = [
  { name: 'Abholung, kein Versand', cent: 0 },
  { name: 'Hermes über Kleinanzeigen, kleinste Größe', cent: 299,
    hinweis: 'Aktionspreis nur bei Zustellung an eine Paketstation', paketstation: true },
  { name: 'DHL Päckchen S', cent: 419 },
  { name: 'Hermes Päckchen', cent: 489 },
  { name: 'Hermes Paket S', cent: 549 },
  { name: 'DHL Paket bis 2 kg', cent: 619 }
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const fmt = cent => euro.format(cent / 100);

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
export function kleinanzeigenGebuehr(preisCent) {
  return GEBUEHR_FIX_CENT + Math.round((preisCent * GEBUEHR_PROMILLE) / 1000);
}

/* Alle Rechnungen liefern dieselbe Form, damit Beleg, Text und Bild einen
   Weg wie den anderen behandeln können. */
export function berechne(preisCent, versandCent, paketstation) {
  const gebuehr = kleinanzeigenGebuehr(preisCent);
  return {
    weg: 'kleinanzeigen',
    preis: preisCent,
    versand: versandCent,
    gebuehr,
    kaeuferZahlt: preisCent + versandCent + gebuehr,
    verkaeuferBehaelt: preisCent,     // die Gebühr trägt der Käufer
    schutz: true,
    paketstation: paketstation && versandCent > 0
  };
}

/* ---------- Direktkauf ---------- */

export const PAYPAL_FIX_CENT = 35;      // 0,35 € je Zahlung
export const PAYPAL_BASISPUNKTE = 249;  // 2,49 % = 249/10000

/* Anders als Kleinanzeigen bemisst PayPal die Gebühr am gesamten
   überwiesenen Betrag, also einschließlich Versand. */
export function paypalGebuehr(betragCent) {
  return PAYPAL_FIX_CENT + Math.round((betragCent * PAYPAL_BASISPUNKTE) / 10000);
}

export const ZAHLWEGE = [
  {
    id: 'ueberweisung',
    name: 'Banküberweisung',
    gebuehr: () => 0,
    schutz: false
  },
  {
    id: 'paypal-wd',
    name: 'PayPal Waren und Dienstleistungen',
    gebuehr: paypalGebuehr,
    schutz: true,
    traeger: true            // nur hier gibt es etwas zu verteilen
  },
  {
    id: 'paypal-ff',
    name: 'PayPal Freunde und Familie',
    gebuehr: () => 0,
    schutz: false,
    warnung: 'Für Verkäufe verstößt das gegen die PayPal-Nutzungsbedingungen und kann zur Kontosperrung führen.'
  },
  {
    id: 'bar',
    name: 'Barzahlung bei Abholung',
    gebuehr: () => 0,
    schutz: false,
    ohneVersand: true
  }
];

export const findeZahlweg = id => ZAHLWEGE.find(z => z.id === id) || ZAHLWEGE[0];

/* Kleinster Betrag, von dem nach Abzug der Gebühr mindestens `ziel` übrig
   bleibt. Die geschlossene Formel ziel/(1−satz) trifft wegen der
   Cent-Rundung daneben, deshalb wird von unten herangetastet. Der Abstand
   beträgt höchstens wenige Cent, weil der Betrag schneller wächst als die
   Gebühr darauf. */
export function betragMitAufschlag(zielCent, gebuehrFn) {
  let betrag = Math.ceil((zielCent + PAYPAL_FIX_CENT) / (1 - PAYPAL_BASISPUNKTE / 10000));
  while (betrag - gebuehrFn(betrag) < zielCent) betrag++;
  while (betrag > zielCent && betrag - 1 - gebuehrFn(betrag - 1) >= zielCent) betrag--;
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
    kaeuferZahlt,
    verkaeuferBehaelt,
    schutz: zahlweg.schutz,
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
