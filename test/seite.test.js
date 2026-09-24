/* Prüft den Kopf der ausgelieferten Seiten: Adressangaben für Suchmaschinen
   und soziale Netze sind leicht zu vergessen, wenn sie einmal stehen, und
   fallen niemandem auf, wenn sie falsch werden. Ohne Browser, reiner Text. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  fmt, kleinanzeigenGebuehr, KLEINANZEIGEN_AUFSCHLUESSELUNG
} from '../js/rechnen.js?v=29';
import { KLEINANZEIGEN } from '../js/daten.js?v=29';

const BASIS = 'https://rorar.github.io/klein-rechner/';

const lies = (datei) => readFileSync(new URL('../' + datei, import.meta.url), 'utf8');

const index = lies('index.html');
const datenschutz = lies('datenschutz.html');

const alle = (text, muster) => [...text.matchAll(muster)].map((t) => t[1]);

const attribut = (text, name, wert) =>
  alle(text, new RegExp(`<meta\\s+${name}="${wert}"\\s+content="([^"]*)"`, 'g'));

const seiten = [
  ['index.html', index, BASIS],
  ['datenschutz.html', datenschutz, BASIS + 'datenschutz.html']
];

for (const [name, text, adresse] of seiten) {
  test(`${name} nennt genau eine kanonische Adresse`, () => {
    const gefunden = alle(text, /<link rel="canonical" href="([^"]*)">/g);
    assert.deepEqual(gefunden, [adresse]);
  });

  test(`${name} nennt dieselbe Adresse bei og:url`, () => {
    assert.deepEqual(attribut(text, 'property', 'og:url'), [adresse]);
  });

  test(`${name} trägt einen Titel und eine Beschreibung`, () => {
    const titel = text.match(/<title>([^<]+)<\/title>/)[1];
    const [beschreibung] = attribut(text, 'name', 'description');
    /* Der Name steht hinten. Suchmaschinen kürzen den Titel bei rund
       60 Zeichen, und gesucht wird nach der Sache, nicht nach dem Namen –
       abgeschnitten werden soll deshalb der Name, nicht das Stichwort. */
    assert.ok(titel.endsWith('– Klein-Rechner'), titel);
    assert.ok(titel.length <= 70, `Titel zu lang: ${titel.length} Zeichen`);
    /* Google zeigt etwa 155 Zeichen der Beschreibung. */
    assert.ok(beschreibung.length >= 70 && beschreibung.length <= 170,
      `Beschreibung ${beschreibung.length} Zeichen`);
  });

  test(`${name} nennt keine Gebührensätze in Titel und Beschreibung`, () => {
    /* Sätze und Beträge stehen in js/daten.js. Eine zweite Fassung im
       Seitenkopf würde still veralten, weil sie niemand mitzieht.
       Geprüft werden nur die Textfelder – die Adresse des Sinnbilds
       enthält Prozentzeichen aus der URL-Kodierung. */
    const felder = [
      text.match(/<title>([^<]+)<\/title>/)[1],
      ...attribut(text, 'name', 'description'),
      ...attribut(text, 'property', 'og:title'),
      ...attribut(text, 'property', 'og:description'),
      ...attribut(text, 'property', 'og:image:alt')
    ];
    for (const feld of felder) {
      assert.equal(/\d+,\d{2}\s*€|\d+(,\d+)?\s*%/.test(feld), false, feld);
    }
  });
}

test('index.html stellt das Stichwort an den Anfang des Titels', () => {
  /* „kleinanzeigen gebührenrechner“ ist die Wortfolge, die Leute wirklich
     eintippen – abgelesen an der Vervollständigung der Suche, nicht geraten. */
  const titel = index.match(/<title>([^<]+)<\/title>/)[1];
  assert.ok(titel.startsWith('Kleinanzeigen-Gebührenrechner'), titel);
});

test('index.html trägt gültige strukturierte Angaben', () => {
  const roh = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const daten = JSON.parse(roh);
  assert.equal(daten['@type'], 'WebApplication');
  assert.equal(daten.name, 'Klein-Rechner');
  assert.equal(daten.url, BASIS);
  assert.equal(daten.inLanguage, 'de');
  assert.equal(daten.isAccessibleForFree, true);
  /* Keine Person als Anbieter: Name und Anschrift gehören nicht auf die Seite. */
  assert.equal('author' in daten, false);
  assert.equal('publisher' in daten, false);
  /* Keine Bewertungen, die es nicht gibt. */
  assert.equal('aggregateRating' in daten, false);
});

test('og:image verweist auf die vorhandene Datei in ihrer wahren Größe', () => {
  const [adresse] = attribut(index, 'property', 'og:image');
  const [breite] = attribut(index, 'property', 'og:image:width');
  const [hoehe] = attribut(index, 'property', 'og:image:height');
  assert.ok(adresse.startsWith(BASIS + 'og.png'), adresse);

  const png = readFileSync(new URL('../og.png', import.meta.url));
  /* PNG-Signatur, dann der IHDR-Block: Breite und Höhe stehen ab Byte 16
     als 32-Bit-Zahlen mit dem höchstwertigen Byte zuerst. */
  assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG');
  assert.equal(png.readUInt32BE(16), Number(breite));
  assert.equal(png.readUInt32BE(20), Number(hoehe));
  /* Unter 1200 × 630 zeigen Netze statt des großen Bildes eine kleine Kachel. */
  assert.ok(png.readUInt32BE(16) >= 1200 && png.readUInt32BE(20) >= 630);
});

/* Der Abschnitt „Wie hoch ist die Gebühr“ steht als Text im HTML, damit ihn
   auch liest, wer kein JavaScript ausführt. Damit gibt es die Zahlen zweimal:
   einmal in js/daten.js und einmal als Satz. Diese Tests rechnen den Satz
   gegen die Daten nach – laufen beide auseinander, schlägt der Test an. */
/* fmt setzt zwischen Betrag und Währungszeichen ein geschütztes Leerzeichen.
   Im Quelltext der Seite steht ein gewöhnliches; beides meint dasselbe. */
const glatt = (t) => t.replace(/ /g, ' ');

/* Nur der Abschnitt selbst, nicht die ganze Seite: die Quelle steht auch in
   der Fußzeile, und ein Test, der bei gelöschtem Abschnitt grün bleibt,
   prüft nichts. */
const abschnitt = (() => {
  const anfang = index.indexOf('<section class="panel prosa erklaerung"');
  assert.notEqual(anfang, -1, 'Abschnitt „Wie hoch ist die Gebühr“ fehlt');
  return glatt(index.slice(anfang, index.indexOf('</section>', anfang)));
})();

test('der erklärende Abschnitt nennt die Sätze aus den Daten', () => {
  const satz = glatt(KLEINANZEIGEN_AUFSCHLUESSELUNG);
  assert.ok(abschnitt.includes(satz), `erwartet im Text: ${satz}`);
});

test('das Beispiel im Abschnitt ist nachgerechnet', () => {
  for (const preisCent of [4500, 9900]) {
    const gebuehr = kleinanzeigenGebuehr(preisCent);
    for (const betrag of [preisCent, gebuehr, preisCent + gebuehr]) {
      assert.ok(abschnitt.includes(glatt(fmt(betrag))),
        `fehlt im Beispiel: ${glatt(fmt(betrag))}`);
    }
  }
});

test('der Abschnitt verweist auf die Quelle der Gebühr', () => {
  assert.ok(abschnitt.includes(KLEINANZEIGEN.quelle), KLEINANZEIGEN.quelle);
});

test('der Abschnitt behauptet nichts über fremde Gebühren', () => {
  /* Der Direktkauf hat je nach Zahlweg eigene Gebühren – siehe ZAHLWEGE in
     js/daten.js. Ein Satz, der hier einzelne Zahlwege als gebührenfrei
     aufzählt, widerspräche dem Vergleich und führte zu PayPal Freunde und
     Familie, wovor die Seite an anderer Stelle warnt. */
  assert.equal(/PayPal|Überweisung|Barzahlung/.test(abschnitt), false, abschnitt);
});

test('beide Skalenköpfe tragen eine Anstreichung, keine davon vorgelesen', () => {
  const koepfe = index.slice(index.indexOf('<div class="skala-koepfe"'),
    index.indexOf('</div>', index.indexOf('<div class="skala-koepfe"')));
  const svgs = [...koepfe.matchAll(/<svg class="kringel"[^>]*>/g)].map((t) => t[0]);
  assert.equal(svgs.length, 2, koepfe);
  for (const svg of svgs) {
    /* Welche Seite gilt, sagt der Befund unter der Skala als Satz. Die
       Anstreichung wiederholt ihn nur für das Auge. */
    assert.ok(svg.includes('aria-hidden="true"'), svg);
    /* Die Beschriftung bricht schmal auf zwei Zeilen um; der Kringel folgt
       dem Kasten, der Strich darf dabei nicht mitverzerren. */
    assert.ok(svg.includes('preserveAspectRatio="none"'), svg);
  }
  assert.equal((koepfe.match(/vector-effect="non-scaling-stroke"/g) || []).length, 2);
  /* Der Ausgangszustand streicht nichts an: ohne Vergleich gibt es keine
     günstigere Seite, und der Abschnitt steht ohnehin auf hidden. */
  assert.ok(koepfe.includes('data-guenstiger="keins"'), koepfe);
});

test('der Fließtext-Abschnitt bleibt vom Spaltenraster ausgenommen', () => {
  /* Im Vergleichsmodus macht eine Regel aus dem Eingabefeld-Panel ein
     dreispaltiges Raster. Der erklärende Abschnitt heißt auch `panel` und
     erbte sie: Überschrift und zugehöriger Absatz standen in verschiedenen
     Spalten. Beide Hälften der Kopplung werden hier festgehalten. */
  const css = lies('styles.css');
  assert.ok(css.includes('.sheet[data-vergleich="an"] > .panel:not(.prosa)'),
    'Ausnahme im Spaltenraster fehlt');
  assert.ok(index.includes('<section class="panel prosa erklaerung"'),
    'Abschnitt trägt die Klasse nicht mehr, über die er ausgenommen wird');
});

test('die Versionsangabe ist in allen Adressen dieselbe', () => {
  const fassungen = new Set([
    ...alle(index, /\?v=(\d+)/g),
    ...alle(datenschutz, /\?v=(\d+)/g),
    ...alle(lies('js/ui.js'), /\?v=(\d+)/g)
  ]);
  assert.equal(fassungen.size, 1, [...fassungen].join(', '));
});
