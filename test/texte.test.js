/* Die Textbausteine gehen an Käufer. Was hier steht, muss stimmen. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { berechne, berechneDirekt } from '../js/rechnen.js?v=21';
import { textDu, textSie, textNeutral, aufstellung } from '../js/texte.js?v=21';

const KA = berechne(4500, 299, true);
const direktBlock = text => text.split('\n').filter(z => z.includes('Käuferschutz')).at(-1);

test('der Schutzsatz folgt dem Zahlweg, nicht einer Annahme', () => {
  // PayPal Waren und Dienstleistungen schützt, die übrigen drei nicht.
  // Der Satz nennt, wessen Schutz greift – „Käuferschutz“ allein sagt nicht,
  // ob der von Kleinanzeigen oder der von PayPal gemeint ist.
  const erwartung = {
    'ueberweisung': 'Ohne Käuferschutz.',
    'paypal-wd': 'Der PayPal-Käuferschutz greift.',
    'paypal-ff': 'Ohne Käuferschutz.',
    'bar': 'Ohne Käuferschutz.'
  };
  for (const [zahlweg, anfang] of Object.entries(erwartung)) {
    const di = berechneDirekt(4500, 519, zahlweg, 'verkaeufer');
    assert.ok(direktBlock(textDu(KA, di)).startsWith(anfang), `${zahlweg}: ${direktBlock(textDu(KA, di))}`);
  }
});

test('beide Wege nennen, wessen Schutz und wessen Gebühr', () => {
  const di = berechneDirekt(4500, 519, 'paypal-wd', 'verkaeufer');
  const text = textDu(KA, di);
  assert.match(text, /Der Kleinanzeigen-Käuferschutz greift\./);
  assert.match(text, /Der PayPal-Käuferschutz greift\./);
  assert.match(text, /Servicegebühr Kleinanzeigen/);
  assert.match(text, /PayPal-Gebühr trägt der Verkäufer/);
  assert.doesNotMatch(text, /(?<![-\w])Käuferschutz greift/, 'kein unbenannter Käuferschutz');
});

test('Freunde und Familie trägt die Warnung im Text', () => {
  const di = berechneDirekt(4500, 519, 'paypal-ff', 'verkaeufer');
  assert.match(textDu(KA, di), /PayPal-Nutzungsbedingungen/);
});

test('ohne Vergleich bleibt der Text bei der Anrede', () => {
  assert.match(textDu(KA), /^Hallo,\n\n/);
  assert.match(textDu(KA), /Du zahlst damit insgesamt/);
  assert.match(textSie(KA), /Sie zahlen damit insgesamt/);
  assert.doesNotMatch(textNeutral(KA), /\bdu\b|\bDu\b|\bSie\b|\bIhr\b/);
});

test('mit Vergleich nennen alle drei Fassungen beide Wege und die Differenz', () => {
  const di = berechneDirekt(4500, 519, 'ueberweisung', 'verkaeufer');
  for (const bauen of [textDu, textSie, textNeutral]) {
    const text = bauen(KA, di);
    assert.match(text, /über „Sicher bezahlen“/);
    assert.match(text, /per Banküberweisung/);
    assert.match(text, /0,33\s?€ weniger/);
  }
  assert.doesNotMatch(textNeutral(KA, di), /\bdu\b|\bDu\b|\bSie\b/);
});

test('die Aufstellung nennt die Paketstation nur, wenn sie gilt', () => {
  assert.match(aufstellung(KA), /Zustellung an eine Paketstation/);
  assert.doesNotMatch(aufstellung(berechne(4500, 299, false)), /Paketstation/);
  assert.match(aufstellung(berechne(4500, 0, true)), /Versand: entfällt/);
});
