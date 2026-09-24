/* Fertige Nachrichten zum Verschicken. Kein DOM, damit sich die Texte
   ohne Browser prüfen lassen. */

import { fmt } from './rechnen.js?v=22';

const TRENNER = '------';

/* Was in Klammern hinter dem Versand steht: die gewählte Versandart und
   die Bedingung, die den Käufer betrifft. Wie der Verkäufer den Schein
   bucht, steht bewusst nicht dabei – das ist in daten.js das Feld
   `hinweis` und geht den Empfänger nichts an. */
function versandZusatz(r) {
  const teile = [r.versandName, r.versandZustellung].filter(Boolean);
  return teile.length ? ` (${teile.join(', ')})` : '';
}

/* Betrag zuerst, dann wofür. Wer eine Aufstellung überfliegt, sucht die
   Zahlen, nicht die Wörter. */
const posten = (betragCent, beschreibung) => `${fmt(betragCent)} ${beschreibung}`;

/* Die Gebühr gehört nur in die Summe, wenn der Käufer sie auch zahlt.
   Trägt der Verkäufer sie, steht sie als Satz unter dem Strich. */
const kaeuferTraegtGebuehr = r =>
  r.gebuehr > 0 && (r.weg === 'kleinanzeigen' || r.gebuehrTraeger === 'kaeufer');

export function aufstellung(r) {
  const zeilen = [posten(r.preis, 'Angebotspreis')];

  if (kaeuferTraegtGebuehr(r)) {
    zeilen.push(posten(r.gebuehr, `${r.gebuehrName} (${r.gebuehrAufschluesselung})`));
  }

  if (r.versand > 0) {
    zeilen.push(posten(r.versand, `Versand${versandZusatz(r)}`));
  } else {
    zeilen.push('ohne Versand, Abholung');
  }

  zeilen.push(TRENNER);
  zeilen.push(posten(r.kaeuferZahlt, 'zusammen'));

  if (r.gebuehr > 0 && !kaeuferTraegtGebuehr(r)) {
    zeilen.push(`Die ${r.gebuehrName} von ${fmt(r.gebuehr)} (${r.gebuehrAufschluesselung}) trägt der Verkäufer.`);
  }

  return zeilen.join('\n');
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
