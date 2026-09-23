/* Prüft den Rechenkern ohne Browser. Läuft mit `node --test test/`.
   Die Versionsangabe in der Import-Adresse muss zu der in js/ und
   index.html passen, sonst lädt Node ein zweites Modulexemplar. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEuroToCent, kleinanzeigenGebuehr, berechne, fmt
} from '../js/rechnen.js?v=11';

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
  assert.equal(r.summe, 5302);
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
