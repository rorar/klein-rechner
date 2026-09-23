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

export function berechne(preisCent, versandCent, paketstation) {
  const gebuehr = kleinanzeigenGebuehr(preisCent);
  return {
    preis: preisCent,
    versand: versandCent,
    gebuehr,
    summe: preisCent + versandCent + gebuehr,
    paketstation: paketstation && versandCent > 0
  };
}
