/* Prüft den Rechenkern ohne Browser. Läuft mit `npm test`.
   Die Versionsangabe in der Import-Adresse muss zu der in js/ und
   index.html passen, sonst lädt Node ein zweites Modulexemplar. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEuroToCent, kleinanzeigenGebuehr, berechne, fmt,
  paypalGebuehr, berechneDirekt, betragMitAufschlag, breakeven, ZAHLWEGE
} from '../js/rechnen.js?v=18';

test('parseEuroToCent nimmt die Schreibweisen an, die Leute tippen', () => {
  assert.equal(parseEuroToCent('45'), 4500);
  assert.equal(parseEuroToCent('45,00'), 4500);
  assert.equal(parseEuroToCent('45.00'), 4500);
  assert.equal(parseEuroToCent('45,5'), 4550);
  assert.equal(parseEuroToCent('1.234,56'), 123456);
  assert.equal(parseEuroToCent('12 €'), 1200);
  assert.equal(parseEuroToCent('45,'), 4500, '"45," entsteht beim Tippen und ist kein Fehler');
});

test('parseEuroToCent trennt leer von ungültig', () => {
  assert.equal(parseEuroToCent(''), null);
  assert.equal(parseEuroToCent('   '), null);
  assert.ok(Number.isNaN(parseEuroToCent('abc')));
  assert.ok(Number.isNaN(parseEuroToCent('4,5,6')));
  assert.ok(Number.isNaN(parseEuroToCent('-5')));
});

test('Servicegebühr an den bekannten Stützstellen', () => {
  assert.equal(kleinanzeigenGebuehr(1000), 95, '10,00 € ergibt 0,95 €');
  assert.equal(kleinanzeigenGebuehr(1234), 106, '12,34 € ergibt 1,06 €');
  assert.equal(kleinanzeigenGebuehr(4500), 253, '45,00 € ergibt 2,53 €');
  assert.equal(kleinanzeigenGebuehr(0), 50, 'der Grundbetrag fällt auch ohne Preis an');
});

test('halbe Cent gehen nach oben', () => {
  // 4,5 % von 1,00 € sind genau 4,5 Cent
  assert.equal(kleinanzeigenGebuehr(100), 55);
});

test('berechne summiert Artikel, Versand und Gebühr', () => {
  const r = berechne(4500, 549, false);
  assert.equal(r.gebuehr, 253);
  assert.equal(r.kaeuferZahlt, 5302);
  assert.equal(r.paketstation, false);
});

test('Paketstation gilt nur, wenn überhaupt versendet wird', () => {
  assert.equal(berechne(4500, 299, true).paketstation, true);
  assert.equal(berechne(4500, 0, true).paketstation, false);
});

test('fmt schreibt deutsche Beträge', () => {
  assert.equal(fmt(5302).replace(/ /g, ' '), '53,02 €');
  assert.equal(fmt(0).replace(/ /g, ' '), '0,00 €');
});

/* ---------- Direktkauf ---------- */

test('PayPal-Gebühr an den Stützstellen aus der Recherche', () => {
  assert.equal(paypalGebuehr(5000), 160, '50,00 € ergibt 1,60 €');
  assert.equal(paypalGebuehr(10000), 284, '100,00 € ergibt 2,84 €');
});

test('PayPal rechnet auf den Gesamtbetrag, Kleinanzeigen auf den Artikel', () => {
  const direkt = berechneDirekt(4500, 519, 'paypal-wd', 'verkaeufer');
  assert.equal(direkt.gebuehr, paypalGebuehr(4500 + 519));
  assert.notEqual(direkt.gebuehr, paypalGebuehr(4500));
});

test('ohne Gebühr zahlt der Käufer Artikel plus Versand', () => {
  for (const weg of ['ueberweisung', 'paypal-ff']) {
    const r = berechneDirekt(4500, 519, weg, 'verkaeufer');
    assert.equal(r.gebuehr, 0);
    assert.equal(r.kaeuferZahlt, 5019);
    assert.equal(r.verkaeuferBehaelt, 4500);
  }
});

test('Barzahlung setzt den Versand auf null', () => {
  const r = berechneDirekt(4500, 519, 'bar');
  assert.equal(r.versand, 0);
  assert.equal(r.kaeuferZahlt, 4500);
});

test('trägt der Verkäufer die Gebühr, sinkt sein Erlös', () => {
  const r = berechneDirekt(4500, 519, 'paypal-wd', 'verkaeufer');
  assert.equal(r.kaeuferZahlt, 5019, 'der Käufer merkt nichts davon');
  assert.equal(r.verkaeuferBehaelt, 4500 - r.gebuehr);
});

test('legt der Käufer die Gebühr drauf, bleibt der Erlös unberührt', () => {
  const r = berechneDirekt(4500, 519, 'paypal-wd', 'kaeufer');
  assert.equal(r.verkaeuferBehaelt, 4500);
  assert.ok(r.kaeuferZahlt > 5019);
});

test('der Aufschlag trifft über den ganzen Bereich genau', () => {
  // Der eigentliche Beweis: nach Abzug der Gebühr kommt exakt das Ziel an,
  // und es gibt keinen kleineren Betrag, der das auch schafft.
  for (let ziel = 100; ziel <= 50000; ziel++) {
    const betrag = betragMitAufschlag(ziel, paypalGebuehr);
    assert.ok(betrag - paypalGebuehr(betrag) >= ziel, `zu wenig bei ${ziel}`);
    assert.ok(betrag - 1 - paypalGebuehr(betrag - 1) < ziel, `nicht der kleinste bei ${ziel}`);
  }
});

/* ---------- Schwellen ---------- */

const LAGE = { versandKleinanzeigen: 299, versandDirekt: 519, paketstation: true };

test('Schwelle für den Käufer, Überweisung', () => {
  const b = breakeven({ ...LAGE, zahlweg: 'ueberweisung', gebuehrTraeger: 'verkaeufer' });
  assert.equal(b.kaeuferAb, 3789, 'ab 37,89 € zahlt der Käufer direkt weniger');
});

test('Schwelle für den Käufer, PayPal mit Aufschlag', () => {
  const b = breakeven({ ...LAGE, zahlweg: 'paypal-wd', gebuehrTraeger: 'kaeufer' });
  assert.equal(b.kaeuferAb, 11278, 'ab 112,78 € zahlt der Käufer direkt weniger');
});

test('Barzahlung ist für den Käufer immer günstiger', () => {
  const b = breakeven({ ...LAGE, zahlweg: 'bar', gebuehrTraeger: 'verkaeufer' });
  assert.equal(b.kaeuferAb, 'immer');
});

test('für den Verkäufer gibt es keine Schwelle', () => {
  const faelle = [
    ['ueberweisung', 'verkaeufer', 'gleich'],
    ['paypal-ff', 'verkaeufer', 'gleich'],
    ['bar', 'verkaeufer', 'gleich'],
    ['paypal-wd', 'kaeufer', 'gleich'],
    ['paypal-wd', 'verkaeufer', 'nie']
  ];
  for (const [zahlweg, gebuehrTraeger, erwartet] of faelle) {
    assert.equal(breakeven({ ...LAGE, zahlweg, gebuehrTraeger }).verkaeuferAb, erwartet,
      `${zahlweg} / ${gebuehrTraeger}`);
  }
});

test('Kleinanzeigen bringt dem Verkäufer nie weniger als der Direktweg', () => {
  for (const zahlweg of ZAHLWEGE.map(z => z.id)) {
    for (const gebuehrTraeger of ['verkaeufer', 'kaeufer']) {
      for (let preis = 0; preis <= 100000; preis += 137) {
        const ka = berechne(preis, 299, true);
        const di = berechneDirekt(preis, 519, zahlweg, gebuehrTraeger);
        assert.ok(ka.verkaeuferBehaelt >= di.verkaeuferBehaelt,
          `${zahlweg}/${gebuehrTraeger} bei ${preis}: ${ka.verkaeuferBehaelt} < ${di.verkaeuferBehaelt}`);
      }
    }
  }
});
