/* Prüft den Rechenkern ohne Browser. Läuft mit `npm test`.
   Die Versionsangabe in der Import-Adresse muss zu der in js/ und
   index.html passen, sonst lädt Node ein zweites Modulexemplar. */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseEuroToCent, kleinanzeigenGebuehr, berechne, fmt,
  paypalGebuehr, berechneDirekt, betragMitAufschlag, breakeven, ZAHLWEGE,
  berechneAlles, MAX_PREIS_CENT, imRahmen, versandartenFuer,
  versandartZu, haftungSatz, sendungBeschreibung
} from '../js/rechnen.js?v=29';

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

/* ---------- Schwelle gegen vollständige Abtastung ---------- */

/* Der Grund für diesen Test: die Bedingung ist im Feinen nicht monoton.
   Reine Bisektion meldete bei 2,99 gegen 3,99 € Versand 49,67 € statt der
   richtigen 49,45 € – und der einzige vorher festgehaltene Wert war
   ausgerechnet eine Kombination, bei der sie zufällig traf. */
function direktBilliger(p, vKa, vDirekt, zahlweg, traeger) {
  return berechneDirekt(p, vDirekt, zahlweg, traeger).kaeuferZahlt
       < berechne(p, vKa, false).kaeuferZahlt;
}

test('die Schwelle ist wirklich die erste Stelle, nicht nur eine', () => {
  const paare = [[299, 399], [299, 519], [100, 200], [0, 300], [0, 990], [299, 679], [50, 419]];
  for (const [vKa, vDirekt] of paare) {
    for (const [zahlweg, traeger] of [['ueberweisung', 'verkaeufer'], ['paypal-wd', 'verkaeufer'], ['paypal-wd', 'kaeufer']]) {
      const lage = { versandKleinanzeigen: vKa, versandDirekt: vDirekt, paketstation: false, zahlweg, gebuehrTraeger: traeger };
      const gesucht = breakeven(lage).kaeuferAb;
      const wo = `${vKa}/${vDirekt} ${zahlweg}/${traeger}`;
      if (typeof gesucht !== 'number') continue;

      assert.ok(direktBilliger(gesucht, vKa, vDirekt, zahlweg, traeger), `${wo}: gemeldete Stelle trifft nicht zu`);
      /* Und darunter gibt es keine frühere – lückenlos abgetastet. */
      for (let p = 0; p < gesucht; p++) {
        assert.ok(!direktBilliger(p, vKa, vDirekt, zahlweg, traeger),
          `${wo}: ${p} ist schon billiger, gemeldet wurde aber erst ${gesucht}`);
      }
    }
  }
});

test('der Aufschlag bleibt auch bei sehr großen Beträgen beherrschbar', () => {
  /* Hochzählen lief hier über hundert Millionen Runden und oberhalb von
     2^53 gar nicht mehr weiter. */
  for (const ziel of [1, 100, MAX_PREIS_CENT, 1e13]) {
    const betrag = betragMitAufschlag(ziel, paypalGebuehr);
    assert.ok(betrag - paypalGebuehr(betrag) >= ziel, `zu wenig bei ${ziel}`);
    assert.ok(betrag - 1 - paypalGebuehr(betrag - 1) < ziel, `nicht der kleinste bei ${ziel}`);
  }
});

/* ---------- berechneAlles, die veröffentlichte Schnittstelle ---------- */

test('berechneAlles wirft nie, auch nicht bei Unsinn', () => {
  for (const eingabe of [null, undefined, 'quatsch', 42, [], { artikelpreisCent: 'viel' },
                         { artikelpreisCent: -1 }, { artikelpreisCent: 1.5 },
                         { artikelpreisCent: MAX_PREIS_CENT + 1 },
                         { artikelpreisCent: 4500, versandKleinanzeigenCent: -1 }]) {
    const e = berechneAlles(eingabe);
    assert.ok(e.fehler, `kein Fehlerobjekt für ${JSON.stringify(eingabe)}`);
  }
});

test('berechneAlles liefert die dokumentierte Form', () => {
  const ohne = berechneAlles({ artikelpreisCent: 4500, versandKleinanzeigenCent: 299 });
  assert.deepEqual(Object.keys(ohne), ['fassung', 'waehrung', 'stand', 'eingabe', 'kleinanzeigen', 'hinweis']);
  assert.equal(ohne.fassung, 1);
  assert.equal(ohne.waehrung, 'EUR');
  assert.equal(ohne.kleinanzeigen.kaeuferZahltCent, 5052);

  const mit = berechneAlles({
    artikelpreisCent: 4500, versandKleinanzeigenCent: 299, versandDirektCent: 519,
    paketstation: true, vergleich: true, zahlweg: 'ueberweisung'
  });
  assert.ok(mit.direkt && mit.breakeven, 'direkt und breakeven fehlen im Vergleich');
  assert.equal(mit.guenstigerFuerKaeufer, 'direkt');
  assert.equal(mit.differenzKaeuferCent, 33);
  assert.equal(mit.breakeven.kaeuferAbCent, 3789);

  /* Alle Beträge ganzzahlig, und das Ganze übersteht eine Runde JSON. */
  const wieder = JSON.parse(JSON.stringify(mit));
  assert.deepEqual(wieder, mit);
  for (const posten of [wieder.kleinanzeigen, wieder.direkt]) {
    for (const [feld, wert] of Object.entries(posten)) {
      if (feld.endsWith('Cent')) assert.ok(Number.isInteger(wert), `${feld} nicht ganzzahlig`);
    }
  }
});

test('unbekannter Zahlweg fällt auf den Standard zurück statt zu scheitern', () => {
  const e = berechneAlles({ artikelpreisCent: 4500, versandDirektCent: 519, vergleich: true, zahlweg: 'gibtesnicht' });
  assert.equal(e.direkt.zahlweg, ZAHLWEGE[0].id);
});

test('die Obergrenze gilt für jede Eingabe, nicht nur für die Schnittstelle', () => {
  assert.equal(imRahmen(0), true);
  assert.equal(imRahmen(MAX_PREIS_CENT), true);
  assert.equal(imRahmen(MAX_PREIS_CENT + 1), false);
  assert.equal(imRahmen(1e19), false);
  assert.equal(imRahmen(-1), false);
  assert.equal(imRahmen(1.5), false);
  assert.equal(imRahmen(NaN), false);
});

test('betragMitAufschlag verweigert Beträge jenseits der sicheren Ganzzahlen', () => {
  /* Dort ergibt mitte + 1 wieder mitte, auch die Bisektion käme nicht zum
     Ende. Vorher hing die Seite an einem Link mit großem Preis. */
  assert.throws(() => betragMitAufschlag(1e19, paypalGebuehr), RangeError);
  assert.throws(() => betragMitAufschlag(-1, paypalGebuehr), RangeError);
  assert.doesNotThrow(() => betragMitAufschlag(Number.MAX_SAFE_INTEGER - 1, paypalGebuehr));
});

/* Die Hermes-Aktion läuft am 31.12.2026 aus. Danach muss der reguläre
   Preis gelten, ohne dass jemand die Daten anfasst. Verglichen wird als
   Zeichenkette: `new Date('2026-12-31')` ist Mitternacht UTC und liefe in
   Berlin einen Tag zu früh ab. */
test('nach dem Aktionsende gilt wieder der reguläre Preis', () => {
  const paeckchen = heute => versandartenFuer('kleinanzeigen', heute)
    .find(a => a.name === 'Hermes Päckchen');

  assert.equal(paeckchen('2026-09-24').cent, 99);
  assert.equal(paeckchen('2026-12-31').cent, 99, 'der letzte Tag zählt noch');
  assert.equal(paeckchen('2027-01-01').cent, 399);
});

test('der Aktionshinweis verschwindet mit der Aktion', () => {
  const vorher = versandartenFuer('kleinanzeigen', '2026-12-31');
  const nachher = versandartenFuer('kleinanzeigen', '2027-01-01');
  assert.match(vorher.find(a => a.name === 'Hermes S-Paket').hinweis, /Aktionspreis/);
  assert.equal(nachher.find(a => a.name === 'Hermes S-Paket').hinweis, null);
});

test('die Liste bleibt nach Preis sortiert, auch nach dem Aktionsende', () => {
  for (const heute of ['2026-09-24', '2027-01-01']) {
    const cents = versandartenFuer('kleinanzeigen', heute).map(a => a.cent);
    assert.deepEqual(cents, [...cents].sort((a, b) => a - b), heute);
  }
});

test('Pakete ohne Aktion behalten ihren Preis', () => {
  const dhl = heute => versandartenFuer('kleinanzeigen', heute)
    .find(a => a.name === 'DHL Paket 10 kg');
  assert.equal(dhl('2026-09-24').cent, 1049);
  assert.equal(dhl('2030-01-01').cent, 1049);
});

/* ---------- Versandarten als Beschreibung der Sendung ---------- */

test('jede Versandart außer der Abholung beschreibt ihre Sendung', () => {
  for (const quelle of ['kleinanzeigen', 'direkt']) {
    for (const art of versandartenFuer(quelle)) {
      if (art.cent === 0) continue;             // Abholung, es gibt keine Sendung
      const wo = `${quelle}: ${art.name}`;
      assert.ok(['klein', 'mittel', 'gross'].includes(art.groesse), wo);
      assert.ok(art.mass && art.gewicht, wo);
      assert.equal(typeof art.haftungCent, 'number', wo);
      assert.ok(art.haftungCent >= 0, wo);
      assert.ok(art.zustellung, wo);
    }
  }
});

test('die Beschreibung nennt alle vier Angaben in fester Reihenfolge', () => {
  const art = versandartenFuer('direkt').find(a => a.name === 'DHL Paket bis 5 kg');
  /* fmt setzt zwischen Betrag und Währungszeichen ein geschütztes
     Leerzeichen. Der erwartete Satz wird deshalb aus fmt gebaut, nicht
     abgetippt. */
  assert.equal(sendungBeschreibung(art),
    `mittel · höchstens 120 × 60 × 60 cm · bis 5 kg · Haftung bis ${fmt(50000)}`);
});

test('ohne Haftung wird gesagt, unbekannte Haftung nicht behauptet', () => {
  /* DHL schließt für Päckchen Haftung und Sendungsverfolgung aus. Das ist
     eine Angabe und gehört in die Nachricht; „Haftung bis 0,00 €" wäre
     dagegen eine Aussage, die so nirgends steht. */
  assert.equal(haftungSatz({ haftungCent: 0 }), 'ohne Haftung');
  assert.equal(haftungSatz({ haftungCent: 50000 }), `Haftung bis ${fmt(50000)}`);
  assert.equal(haftungSatz({}), null);
  const paeckchen = versandartenFuer('direkt').find(a => a.name === 'DHL Päckchen S');
  assert.equal(haftungSatz(paeckchen), 'ohne Haftung');
});

test('ein Betrag, den zwei Arten teilen, benennt keine von beiden', () => {
  /* DHL Päckchen M und das Hermes Päckchen an die Haustür kosten beide
     5,19 €, haften aber verschieden. Der Adressparameter trägt nur den
     Betrag – welche Sendung gemeint ist, weiß er nicht. */
  const doppelt = versandartenFuer('direkt').filter(a => a.cent === 519);
  assert.equal(doppelt.length, 2, 'Voraussetzung des Tests');
  assert.notEqual(doppelt[0].haftungCent, doppelt[1].haftungCent);
  assert.equal(versandartZu('direkt', 519), null);
});

test('ein eindeutiger Betrag benennt seine Art', () => {
  assert.equal(versandartZu('direkt', 769).name, 'DHL Paket bis 5 kg');
  assert.equal(versandartZu('kleinanzeigen', 99).name, 'Hermes Päckchen');
  assert.equal(versandartZu('direkt', 12345), null, 'ein Betrag ohne Art');
  assert.equal(versandartZu('direkt', null), null);
});

test('die Rechnung verschweigt Namen und Haftung bei mehrdeutigem Betrag', () => {
  const art = versandartZu('direkt', 519);
  const r = berechneDirekt(4500, 519, 'paypal-wd', 'kaeufer', art);
  assert.equal(r.versandName, null);
  assert.equal(r.versandHaftung, null);
  assert.equal(r.versandZustellung, null);
  assert.equal(r.kaeuferZahlt, 5183, 'der Betrag selbst zählt weiter mit');
});

test('die Kleinanzeigen-Beträge bleiben eindeutig, auch nach dem Aktionsende', () => {
  for (const heute of ['2026-09-24', '2027-01-01']) {
    const cents = versandartenFuer('kleinanzeigen', heute).map(a => a.cent);
    assert.equal(new Set(cents).size, cents.length, heute);
  }
});
