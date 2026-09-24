/* Fertige Nachrichten zum Verschicken. Kein DOM, damit sich die Texte
   ohne Browser prüfen lassen. */

import { fmt, KLEINANZEIGEN_FORMEL } from './rechnen.js?v=19';

export function versandText(r) {
  if (r.versand === 0) return 'entfällt';
  return r.paketstation ? `${fmt(r.versand)} (Zustellung an eine Paketstation)` : fmt(r.versand);
}

export function aufstellung(r) {
  return [
    `Artikel: ${fmt(r.preis)}`,
    `Versand: ${versandText(r)}`,
    `${r.gebuehrName}: ${fmt(r.gebuehr)}`,
    `Gesamt: ${fmt(r.kaeuferZahlt)}`
  ].join('\n');
}

export function gebuehrSatz(r) {
  return `Über „Sicher bezahlen“ kommt eine Servicegebühr von ${fmt(r.gebuehr)} dazu – das sind ${KLEINANZEIGEN_FORMEL} vom Artikelpreis.`;
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

/* ---------- Vergleich beider Wege ---------- */

function block(titel, zeilen, schutzsatz) {
  return `${titel}\n${zeilen.join(', ')}\n${schutzsatz}`;
}

function schutzsatzDirekt(di) {
  /* Nicht jeder Direktweg ist ungeschützt: PayPal Waren und Dienstleistungen
     trägt `schutz: true`. Beleg und Bild lesen dasselbe Feld, der Text tat
     es bisher nicht und behauptete auch dort „Ohne Käuferschutz“. */
  const satz = di.schutz ? `Der ${di.schutzName} greift.` : 'Ohne Käuferschutz.';
  if (di.warnung) return `${satz} ${di.warnung}`;
  return satz;
}

function vergleichRumpf(ka, di) {
  const kaBlock = block(
    'über „Sicher bezahlen“',
    [
      `Versand ${versandText(ka)}`,
      `${ka.gebuehrName} ${fmt(ka.gebuehr)}`,
      `zusammen ${fmt(ka.kaeuferZahlt)}`
    ],
    `Der ${ka.schutzName} greift.`
  );

  const diZeilen = [di.versand > 0 ? `Versand ${fmt(di.versand)}` : 'ohne Versand'];
  if (di.gebuehr > 0 && di.gebuehrTraeger === 'kaeufer') {
    diZeilen.push(`${di.gebuehrName} ${fmt(di.gebuehr)} obendrauf`);
  } else if (di.gebuehr > 0) {
    diZeilen.push(`${di.gebuehrName} trägt der Verkäufer`);
  } else {
    diZeilen.push('keine Gebühr');
  }
  diZeilen.push(`zusammen ${fmt(di.kaeuferZahlt)}`);

  const diBlock = block(`per ${di.zahlwegName}`, diZeilen, schutzsatzDirekt(di));

  return `Hallo,

für den Artikel zu ${fmt(ka.preis)} gibt es zwei Wege:

${kaBlock}

${diBlock}
`;
}

/* Der Schlusssatz nennt die Differenz und lässt die Wahl offen. */
function differenzSatz(ka, di, form) {
  const d = Math.abs(ka.kaeuferZahlt - di.kaeuferZahlt);
  if (d === 0) return 'Beide Wege kosten gleich viel.';

  const direktBilliger = di.kaeuferZahlt < ka.kaeuferZahlt;
  const weg = direktBilliger ? `per ${di.zahlwegName}` : 'über „Sicher bezahlen“';

  if (form === 'du') return `${weg[0].toUpperCase()}${weg.slice(1)} zahlst du ${fmt(d)} weniger.`;
  if (form === 'sie') return `${weg[0].toUpperCase()}${weg.slice(1)} zahlen Sie ${fmt(d)} weniger.`;
  return `${weg[0].toUpperCase()}${weg.slice(1)} sind es ${fmt(d)} weniger.`;
}

function baue(ka, di, form, schluss) {
  if (!di) return `${rumpf(ka)}\n${schluss}`;
  return `${vergleichRumpf(ka, di)}\n${differenzSatz(ka, di, form)}`;
}

export function textDu(ka, di) {
  return baue(ka, di, 'du', `Du zahlst damit insgesamt ${fmt(ka.kaeuferZahlt)}.`);
}

export function textSie(ka, di) {
  return baue(ka, di, 'sie', `Sie zahlen damit insgesamt ${fmt(ka.kaeuferZahlt)}.`);
}

/* Kommt ohne "du" und ohne "Sie" aus und passt damit auch, solange die
   Anrede zwischen zwei Leuten noch nicht geklärt ist. */
export function textNeutral(ka, di) {
  return baue(ka, di, 'neutral', `Insgesamt sind das ${fmt(ka.kaeuferZahlt)}.`);
}
