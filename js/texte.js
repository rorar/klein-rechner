/* Fertige Nachrichten zum Verschicken. Kein DOM, damit sich die Texte
   ohne Browser prüfen lassen. */

import { fmt, GEBUEHR_FIX_CENT } from './rechnen.js?v=11';

export function versandText(r) {
  if (r.versand === 0) return 'entfällt';
  return r.paketstation ? `${fmt(r.versand)} (Zustellung an eine Paketstation)` : fmt(r.versand);
}

export function aufstellung(r) {
  return [
    `Artikel: ${fmt(r.preis)}`,
    `Versand: ${versandText(r)}`,
    `Servicegebühr: ${fmt(r.gebuehr)}`,
    `Gesamt: ${fmt(r.summe)}`
  ].join('\n');
}

export function gebuehrSatz(r) {
  return `Über „Sicher bezahlen“ kommt eine Servicegebühr von ${fmt(r.gebuehr)} dazu – das sind ${fmt(GEBUEHR_FIX_CENT)} plus 4,5 % vom Artikelpreis.`;
}

/* Die Aufstellung ist in allen Fassungen gleich, nur die Anrede und der
   Schlusssatz unterscheiden sich. Du- und Sie-Text stehen trotzdem
   getrennt: ein Austausch einzelner Wörter fiele an "zahlst du" /
   "zahlen Sie" auseinander. */
function rumpf(r) {
  return `Hallo,

der Artikel kostet ${fmt(r.preis)}. ${gebuehrSatz(r)}

${aufstellung(r)}
`;
}

export function textDu(r) {
  return `${rumpf(r)}
Du zahlst damit insgesamt ${fmt(r.summe)}.`;
}

export function textSie(r) {
  return `${rumpf(r)}
Sie zahlen damit insgesamt ${fmt(r.summe)}.`;
}

/* Kommt ohne "du" und ohne "Sie" aus und passt damit auch, solange die
   Anrede zwischen zwei Leuten noch nicht geklärt ist. */
export function textNeutral(r) {
  return `${rumpf(r)}
Insgesamt sind das ${fmt(r.summe)}.`;
}
