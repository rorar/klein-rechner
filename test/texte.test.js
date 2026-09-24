/* Die Textbausteine gehen an Käufer. Was hier steht, muss stimmen. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { berechne, berechneDirekt, fmt } from '../js/rechnen.js?v=26';
import { VERSANDARTEN } from '../js/daten.js?v=26';
import {
  textDu, textSie, textNeutral, aufstellung, schutzSatz,
  kostenPosten, ausgerichtetePosten, POSTEN_ARTEN
} from '../js/texte.js?v=26';

const art = cent => VERSANDARTEN.find(a => a.cent === cent);
const KA_ART = art(299);                 // Hermes M-Paket über Kleinanzeigen, von Shop zu Shop
const S2S = art(399);                    // Hermes Shop-to-Shop, von Shop zu Shop
const KA = berechne(7800, 299, true, KA_ART);

const direktBlock = text => text.split('\n').filter(z => z.includes('Käuferschutz')).at(-1);

test('der Kostenblock nennt Beträge zuerst und in fester Reihenfolge', () => {
  const zeilen = aufstellung(KA).split('\n');
  assert.equal(zeilen.length, 5);
  assert.match(zeilen[0], /^78,00\s?€ Artikelpreis$/);
  assert.match(zeilen[1], /^4,01\s?€ Servicegebühr Kleinanzeigen \(0,50\s?€ Pauschal \+ 4,5\s?% vom Artikelpreis\)$/);
  assert.match(zeilen[2], /^2,99\s?€ Versand \(Hermes M-Paket, von Shop zu Shop, Haftung bis 500,00\s?€\)$/);
  assert.equal(zeilen[3], '------');
  assert.match(zeilen[4], /^85,00\s?€ zusammen$/);
});

test('die Gebühr ist aufgeschlüsselt, nicht nur beziffert', () => {
  assert.match(aufstellung(KA), /0,50\s?€ Pauschal \+ 4,5\s?%/);
  const aufschlag = berechneDirekt(7800, 399, 'paypal-wd', 'kaeufer', S2S);
  assert.match(aufstellung(aufschlag), /0,35\s?€ Pauschal \+ 2,49\s?% vom Gesamtbetrag/);
});

test('die gewählte Versandart und ihre Bedingung stehen im Text', () => {
  assert.match(aufstellung(KA), /Hermes M-Paket/);
  assert.match(aufstellung(KA), /von Shop zu Shop/);

  const s2s = berechneDirekt(7800, 399, 'ueberweisung', 'verkaeufer', S2S);
  assert.match(aufstellung(s2s), /Hermes Shop-to-Shop Päckchen, von Shop zu Shop/);
});

test('Buchungsdetails des Verkäufers bleiben aus der Nachricht heraus', () => {
  // "online gebucht" steht im Namen und im hinweis, geht den Käufer aber nichts an.
  const online = berechneDirekt(7800, 519, 'ueberweisung', 'verkaeufer', art(519));
  assert.match(aufstellung(online), /Hermes Päckchen, Zustellung an die Haustür/);
  assert.doesNotMatch(aufstellung(online), /gebucht/);
});

test('ohne gewählte Versandart steht nur der Betrag', () => {
  const frei = berechne(7800, 450, false, null);
  assert.match(aufstellung(frei), /^4,50\s?€ Versand$/m);
});

test('trägt der Verkäufer die Gebühr, steht sie nicht in der Summe', () => {
  const r = berechneDirekt(7800, 399, 'paypal-wd', 'verkaeufer', S2S);
  const zeilen = aufstellung(r).split('\n');
  assert.equal(zeilen.filter(z => z.startsWith('------')).length, 1);
  assert.ok(!zeilen.slice(0, zeilen.indexOf('------')).some(z => z.includes('PayPal-Gebühr')),
    'die Gebühr darf über dem Strich nicht auftauchen');
  assert.match(aufstellung(r), /Die PayPal-Gebühr von .* trägt der Verkäufer\./);
  assert.equal(r.kaeuferZahlt, 7800 + 399);
});

test('legt der Käufer die Gebühr drauf, steht sie mit in der Summe', () => {
  const r = berechneDirekt(7800, 399, 'paypal-wd', 'kaeufer', S2S);
  const zeilen = aufstellung(r).split('\n');
  const ueberDemStrich = zeilen.slice(0, zeilen.indexOf('------'));
  assert.ok(ueberDemStrich.some(z => z.includes('PayPal-Gebühr')));
  assert.doesNotMatch(aufstellung(r), /trägt der Verkäufer/);
});

test('ohne Versand steht das ausdrücklich da', () => {
  assert.match(aufstellung(berechne(7800, 0, true, art(0))), /ohne Versand, Abholung/);
});

test('der Schutzsatz folgt dem Zahlweg, nicht einer Annahme', () => {
  const erwartung = {
    'ueberweisung': 'Ohne Käuferschutz.',
    'paypal-wd': 'Der PayPal-Käuferschutz greift.',
    'paypal-ff': 'Ohne Käuferschutz.',
    'bar': 'Ohne Käuferschutz.'
  };
  for (const [zahlweg, erwartet] of Object.entries(erwartung)) {
    assert.equal(schutzSatz(berechneDirekt(7800, 399, zahlweg, 'verkaeufer', S2S)), erwartet, zahlweg);
  }
  assert.equal(schutzSatz(KA), 'Der Kleinanzeigen-Käuferschutz greift.');
});

test('beide Wege nennen, wessen Schutz und wessen Gebühr', () => {
  const text = textDu(KA, berechneDirekt(7800, 399, 'paypal-wd', 'verkaeufer', S2S));
  assert.match(text, /Der Kleinanzeigen-Käuferschutz greift\./);
  assert.match(text, /Der PayPal-Käuferschutz greift\./);
  assert.match(text, /Servicegebühr Kleinanzeigen/);
  assert.match(text, /Die PayPal-Gebühr von/);
  assert.doesNotMatch(text, /(?<![-\w])Käuferschutz greift/, 'kein unbenannter Käuferschutz');
});

test('Freunde und Familie trägt die Warnung im Text', () => {
  assert.match(textDu(KA, berechneDirekt(7800, 399, 'paypal-ff', 'verkaeufer', S2S)), /PayPal-Nutzungsbedingungen/);
});

test('ohne Vergleich bleibt der Text bei der Anrede', () => {
  assert.match(textDu(KA), /^Hallo,\n\n/);
  assert.match(textDu(KA), /Du zahlst damit 85,00\s?€/);
  assert.match(textSie(KA), /Sie zahlen damit 85,00\s?€/);
  assert.doesNotMatch(textNeutral(KA), /\bdu\b|\bDu\b|\bSie\b|\bIhr\b/);
});

test('mit Vergleich nennen alle drei Fassungen beide Wege und die Differenz', () => {
  const di = berechneDirekt(7800, 399, 'ueberweisung', 'verkaeufer', S2S);
  for (const bauen of [textDu, textSie, textNeutral]) {
    const text = bauen(KA, di);
    assert.match(text, /über „Sicher bezahlen“/);
    assert.match(text, /per Banküberweisung/);
    assert.match(text, new RegExp(fmt(Math.abs(KA.kaeuferZahlt - di.kaeuferZahlt)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' weniger'));
  }
  assert.doesNotMatch(textNeutral(KA, di), /\bdu\b|\bDu\b|\bSie\b/);
});

/* ---------- Die Spalte muss aufgehen ---------- */

/* Der Grund für diesen Test: das Bild stellte die PayPal-Gebühr über den
   Strich, obwohl der Verkäufer sie trägt. 78,00 + 3,99 + 2,39 stand dort
   über „Käufer zahlt 81,99 €“ - eine Spalte, die sich nicht nachrechnen
   ließ. Nachricht und Bild lesen jetzt dieselben Posten, und die müssen
   zur Summe passen. */
test('die Posten über dem Strich ergeben genau die Summe', () => {
  const faelle = [
    berechne(7800, 299, true, KA_ART),
    berechne(7800, 0, true, art(0)),
    berechne(7800, 450, false, null)
  ];
  for (const zahlweg of ['ueberweisung', 'paypal-wd', 'paypal-ff', 'bar']) {
    for (const traeger of ['verkaeufer', 'kaeufer']) {
      faelle.push(berechneDirekt(7800, 399, zahlweg, traeger, S2S));
    }
  }

  for (const r of faelle) {
    const { zeilen, summe } = kostenPosten(r);
    const addiert = zeilen.reduce((s, z) => s + (z.betrag ?? 0), 0);
    assert.equal(addiert, summe.betrag,
      `${r.weg}/${r.zahlweg ?? '-'}/${r.gebuehrTraeger ?? '-'}: ${addiert} statt ${summe.betrag}`);
    assert.equal(summe.betrag, r.kaeuferZahlt, 'die Summe muss der Rechnung entsprechen');
  }
});

test('jeder Posten hat entweder einen Betrag oder keinen, nie undefined', () => {
  const { zeilen } = kostenPosten(berechne(7800, 0, false, art(0)));
  for (const z of zeilen) {
    assert.ok(z.betrag === null || Number.isInteger(z.betrag), `${z.label}: ${z.betrag}`);
    assert.ok(typeof z.label === 'string' && z.label.length > 0);
  }
});

/* Der Grund: im Vergleichsbild richteten sich die Zeilen nach ihrer
   Position aus. Fehlte einer Spalte die Gebühr, stand ihr Versand neben
   der Servicegebühr der anderen - zwei verschiedene Dinge auf einer
   Höhe. */
test('ausgerichtetePosten stellt gleiche Arten auf dieselbe Zeile', () => {
  const ka = kostenPosten(berechne(7800, 299, true, KA_ART));
  const ohneGebuehr = kostenPosten(berechneDirekt(7800, 399, 'ueberweisung', 'verkaeufer', S2S));
  const { arten, spalten } = ausgerichtetePosten([ka, ohneGebuehr]);

  assert.deepEqual(arten, POSTEN_ARTEN);
  assert.equal(spalten[0].length, spalten[1].length);
  assert.equal(spalten[1][arten.indexOf('gebuehr')], null, 'die Banküberweisung hat keine Gebühr');
  for (const spalte of spalten) {
    spalte.forEach((z, i) => {
      if (z) assert.equal(z.art, arten[i], `${z.label} steht in der Zeile für ${arten[i]}`);
    });
  }
});

test('Arten, die keine Spalte kennt, fallen ganz weg', () => {
  /* Zwei Wege ohne Gebühr: dann braucht auch keine Spalte eine Zeile
     dafür. Eine leere Zeile in beiden Spalten wäre nur ein Loch. */
  const a = kostenPosten(berechneDirekt(7800, 399, 'ueberweisung', 'verkaeufer', S2S));
  const b = kostenPosten(berechneDirekt(7800, 0, 'bar', 'verkaeufer', art(0)));
  const { arten } = ausgerichtetePosten([a, b]);
  assert.deepEqual(arten, ['preis', 'versand']);
});

/* Der Grund: wer den Versandbetrag von Hand eintippt, trifft keine
   Versandart. Die Bedingung des Aktionspreises stand dann nur auf der
   Seite, nicht in Nachricht und Bild. */
test('der Aktionsschalter steht auch ohne gewählte Versandart dabei', () => {
  const vonHand = berechne(7800, 450, true, null);
  assert.match(aufstellung(vonHand), /Versand \(von Shop zu Shop\)/);

  const ohneSchalter = berechne(7800, 450, false, null);
  assert.doesNotMatch(aufstellung(ohneSchalter), /Shop zu Shop/);
});

/* Den Käufer geht von der Sendung nur die Haftung etwas an. Maß und
   Gewicht sind die Sorge dessen, der das Paket packt. */
test('die Nachricht nennt die Haftung, nicht Maß und Gewicht', () => {
  const text = aufstellung(KA);
  assert.match(text, /Haftung bis 500,00\s?€/);
  assert.doesNotMatch(text, /80 cm|25 kg|mittel/);
});

/* Der Grund: im Bild stand links „4,5 %“ ohne Bezug neben rechts
   „2,49 % vom Gesamtbetrag“, als wäre das dieselbe Größe. */
test('jede Gebühr nennt ihre Grundlage', () => {
  const ka = kostenPosten(berechne(7800, 299, true, KA_ART));
  assert.match(ka.zeilen.find(z => z.art === 'gebuehr').notiz, /vom Artikelpreis$/);

  const pp = kostenPosten(berechneDirekt(7800, 399, 'paypal-wd', 'kaeufer', S2S));
  assert.match(pp.zeilen.find(z => z.art === 'gebuehr').notiz, /vom Gesamtbetrag$/);
});
