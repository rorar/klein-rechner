/* Fertige Nachrichten zum Verschicken. Kein DOM, damit sich die Texte
   ohne Browser prüfen lassen. */

import { fmt } from './rechnen.js?v=24';
import { PAKETSTATION_ZUSTELLUNG } from './daten.js?v=24';

const TRENNER = '------';

/* Was in Klammern hinter dem Versand steht: die gewählte Versandart und
   die Bedingung, die den Käufer betrifft. Wie der Verkäufer den Schein
   bucht, steht bewusst nicht dabei – das ist in daten.js das Feld
   `hinweis` und geht den Empfänger nichts an. */
function versandZusatz(r) {
  /* Wer den Versandbetrag von Hand eintippt, wählt keine Versandart – dann
     bleibt `versandZustellung` leer, obwohl der Paketstations-Schalter an
     ist. Die Seite las den Schalter, das Bild nicht; die Bedingung fehlte
     dort also genau dann, wenn sie am wenigsten offensichtlich war. */
  const zustellung = r.versandZustellung || (r.paketstation ? PAKETSTATION_ZUSTELLUNG : null);
  /* Die Haftungsgrenze steht dabei, weil sie den Käufer betrifft: sie sagt
     ihm, bis wohin er im Verlustfall abgesichert ist. Maß und Gewicht
     bleiben draußen – die gehen den an, der das Paket packt. */
  const teile = [r.versandName, zustellung, r.versandHaftung].filter(Boolean);
  return teile.length ? teile.join(', ') : null;
}

/* Betrag zuerst, dann wofür. Wer eine Aufstellung überfliegt, sucht die
   Zahlen, nicht die Wörter. */
const posten = (betragCent, beschreibung) => `${fmt(betragCent)} ${beschreibung}`;

/* Die Gebühr gehört nur in die Summe, wenn der Käufer sie auch zahlt.
   Trägt der Verkäufer sie, steht sie als Satz unter dem Strich. */
const kaeuferTraegtGebuehr = r =>
  r.gebuehr > 0 && (r.weg === 'kleinanzeigen' || r.gebuehrTraeger === 'kaeufer');

/* Die Aufstellung als Struktur, nicht als Text. Nachricht und Bild
   zeichnen dieselben Posten - zweimal dieselbe Logik zu schreiben hat in
   diesem Projekt schon einmal dazu geführt, dass eine der beiden Fassungen
   etwas anderes behauptet hat. */
export function kostenPosten(r) {
  const zeilen = [{ art: 'preis', label: 'Artikelpreis', betrag: r.preis }];

  if (kaeuferTraegtGebuehr(r)) {
    zeilen.push({ art: 'gebuehr', label: r.gebuehrName, betrag: r.gebuehr, notiz: r.gebuehrAufschluesselung });
  }

  if (r.versand > 0) {
    zeilen.push({ art: 'versand', label: 'Versand', betrag: r.versand, notiz: versandZusatz(r) });
  } else {
    zeilen.push({ art: 'versand', label: 'ohne Versand, Abholung', betrag: null });
  }

  const fussnoten = [];
  if (r.gebuehr > 0 && !kaeuferTraegtGebuehr(r)) {
    fussnoten.push(`Die ${r.gebuehrName} von ${fmt(r.gebuehr)} (${r.gebuehrAufschluesselung}) trägt der Verkäufer.`);
  }

  return { zeilen, summe: { label: 'zusammen', betrag: r.kaeuferZahlt }, fussnoten };
}

/* Die feste Reihenfolge der Posten. Nach ihr richtet das Bild seine
   Spalten aus; kostenPosten() hält sich beim Bauen an dieselbe Folge. */
export const POSTEN_ARTEN = ['preis', 'gebuehr', 'versand'];

/* Bringt mehrere Aufstellungen auf gemeinsame Zeilen: jede Art bekommt in
   jeder Spalte dieselbe Zeile, und wo eine Art fehlt, steht null.

   Ohne das richteten sich die Spalten nach der Position aus. Fehlte links
   die Gebühr, rutschte der Versand eine Zeile hoch und stand neben der
   Servicegebühr der anderen Spalte – zwei verschiedene Dinge auf einer
   Höhe. Arten, die in keiner Spalte vorkommen, fallen ganz weg. */
export function ausgerichtetePosten(aufstellungen) {
  const arten = POSTEN_ARTEN.filter(
    art => aufstellungen.some(a => a.zeilen.some(z => z.art === art)));
  return {
    arten,
    spalten: aufstellungen.map(a => arten.map(art => a.zeilen.find(z => z.art === art) || null))
  };
}

export function aufstellung(r) {
  const { zeilen, summe, fussnoten } = kostenPosten(r);
  const text = zeilen.map(z =>
    z.betrag === null ? z.label : posten(z.betrag, z.notiz ? `${z.label} (${z.notiz})` : z.label));
  return [...text, TRENNER, posten(summe.betrag, summe.label), ...fussnoten].join('\n');
}

export function schutzSatz(r) {
  return r.schutz ? `Der ${r.schutzName} greift.` : 'Ohne Käuferschutz.';
}

function warnungSatz(r) {
  return r.warnung ? `\n${r.warnung}` : '';
}

/* ---------- Die drei Fassungen ---------- */

/* Die Aufstellung ist in allen Fassungen gleich, nur die Anrede und der
   Schlusssatz unterscheiden sich. Du- und Sie-Text stehen trotzdem
   getrennt: ein Austausch einzelner Wörter fiele an "zahlst du" /
   "zahlen Sie" auseinander. */
function einzeln(ka, schluss) {
  return `Hallo,

${aufstellung(ka)}

${schluss} ${schutzSatz(ka)}`;
}

function block(titel, r) {
  return `${titel}\n${aufstellung(r)}\n${schutzSatz(r)}${warnungSatz(r)}`;
}

function vergleich(ka, di, schluss) {
  return `Hallo,

für den Artikel zu ${fmt(ka.preis)} gibt es zwei Wege:

${block('über „Sicher bezahlen“', ka)}

${block(`per ${di.zahlwegName}`, di)}

${schluss}`;
}

/* Der Schlusssatz nennt die Differenz und lässt die Wahl offen. */
function differenzSatz(ka, di, form) {
  const d = Math.abs(ka.kaeuferZahlt - di.kaeuferZahlt);
  if (d === 0) return 'Beide Wege kosten gleich viel.';

  const weg = di.kaeuferZahlt < ka.kaeuferZahlt ? `per ${di.zahlwegName}` : 'über „Sicher bezahlen“';
  const gross = `${weg[0].toUpperCase()}${weg.slice(1)}`;

  if (form === 'du') return `${gross} zahlst du ${fmt(d)} weniger.`;
  if (form === 'sie') return `${gross} zahlen Sie ${fmt(d)} weniger.`;
  return `${gross} sind es ${fmt(d)} weniger.`;
}

const baue = (ka, di, form, schluss) =>
  di ? vergleich(ka, di, differenzSatz(ka, di, form)) : einzeln(ka, schluss);

export function textDu(ka, di) {
  return baue(ka, di, 'du', `Du zahlst damit ${fmt(ka.kaeuferZahlt)} über „Sicher bezahlen“.`);
}

export function textSie(ka, di) {
  return baue(ka, di, 'sie', `Sie zahlen damit ${fmt(ka.kaeuferZahlt)} über „Sicher bezahlen“.`);
}

/* Kommt ohne "du" und ohne "Sie" aus und passt damit auch, solange die
   Anrede zwischen zwei Leuten noch nicht geklärt ist. */
export function textNeutral(ka, di) {
  return baue(ka, di, 'neutral', `Insgesamt sind das ${fmt(ka.kaeuferZahlt)} über „Sicher bezahlen“.`);
}

/* ---------- Befunde zum Breakeven ---------- */

/* Standen doppelt in ui.js und beleg-bild.js, in zwei Schreibweisen, und
   beide Fassungen vergaßen, dass kleinsterPreis auch 'immer' liefern kann –
   fmt('immer') ergibt „NaN €“. Hier einmal, damit sie prüfbar sind. */
export function breakevenSaetze(b, ka, di, { persoenlich = false } = {}) {
  const verkaeufer = persoenlich ? 'Für dich als Verkäufer' : 'Für den Verkäufer';

  let kaeufer;
  if (typeof b.kaeuferAb === 'number') {
    kaeufer = `Für den Käufer dreht es sich bei ${fmt(b.kaeuferAb)}: darunter ist „Sicher bezahlen“ günstiger, darüber der Direktkauf.`;
  } else if (b.kaeuferAb === 'immer') {
    kaeufer = 'Für den Käufer ist der Direktkauf bei jedem Preis günstiger.';
  } else {
    kaeufer = 'Für den Käufer ist „Sicher bezahlen“ bei jedem Preis günstiger.';
  }

  let verkaeuferSatz;
  if (b.verkaeuferAb === 'gleich') {
    verkaeuferSatz = persoenlich
      ? `${verkaeufer} macht es keinen Unterschied – du behältst über beide Wege ${fmt(ka.verkaeuferBehaelt)}.`
      : `${verkaeufer} macht es keinen Unterschied: über beide Wege bleiben ${fmt(ka.verkaeuferBehaelt)}.`;
  } else if (b.verkaeuferAb === 'nie') {
    verkaeuferSatz = `${verkaeufer} ist „Sicher bezahlen“ immer besser: dort zahlt der Käufer die Gebühr, hier gingen ${fmt(di.gebuehr)} ${persoenlich ? 'von deinem Erlös' : 'vom Erlös'} ab.`;
  } else if (b.verkaeuferAb === 'immer') {
    verkaeuferSatz = `${verkaeufer} ist der Direktkauf bei jedem Preis besser.`;
  } else {
    verkaeuferSatz = `${verkaeufer} ab ${fmt(b.verkaeuferAb)}.`;
  }

  return { kaeufer, verkaeufer: verkaeuferSatz };
}
