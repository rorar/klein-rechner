/* Die Textbausteine gehen an Käufer. Was hier steht, muss stimmen. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { berechne, berechneDirekt, fmt } from '../js/rechnen.js?v=23';
import { VERSANDARTEN } from '../js/daten.js?v=23';
import { textDu, textSie, textNeutral, aufstellung, schutzSatz } from '../js/texte.js?v=23';

const art = cent => VERSANDARTEN.find(a => a.cent === cent);
const KA_ART = art(299);                 // Hermes über Kleinanzeigen, Paketstation
const S2S = art(399);                    // Hermes Shop-to-Shop, von Shop zu Shop
const KA = berechne(7800, 299, true, KA_ART);

const direktBlock = text => text.split('\n').filter(z => z.includes('Käuferschutz')).at(-1);

test('der Kostenblock nennt Beträge zuerst und in fester Reihenfolge', () => {
  const zeilen = aufstellung(KA).split('\n');
  assert.equal(zeilen.length, 5);
  assert.match(zeilen[0], /^78,00\s?€ Angebotspreis$/);
  assert.match(zeilen[1], /^4,01\s?€ Servicegebühr Kleinanzeigen \(0,50\s?€ Pauschal \+ 4,5\s?%\)$/);
  assert.match(zeilen[2], /^2,99\s?€ Versand \(Hermes über Kleinanzeigen, Zustellung an eine Paketstation\)$/);
  assert.equal(zeilen[3], '------');
  assert.match(zeilen[4], /^85,00\s?€ zusammen$/);
});

test('die Gebühr ist aufgeschlüsselt, nicht nur beziffert', () => {
  assert.match(aufstellung(KA), /0,50\s?€ Pauschal \+ 4,5\s?%/);
  const aufschlag = berechneDirekt(7800, 399, 'paypal-wd', 'kaeufer', S2S);
  assert.match(aufstellung(aufschlag), /0,35\s?€ Pauschal \+ 2,49\s?% vom Gesamtbetrag/);
});

test('die gewählte Versandart und ihre Bedingung stehen im Text', () => {
  assert.match(aufstellung(KA), /Hermes über Kleinanzeigen/);
  assert.match(aufstellung(KA), /Zustellung an eine Paketstation/);

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
import { kostenPosten } from '../js/texte.js?v=23';

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
