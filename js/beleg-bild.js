/* Der Beleg wird von Hand auf ein Canvas gezeichnet. Das sind wenige
   Zeilen je Spalte – dafür lohnt keine Bibliothek, die das DOM nachbaut. */

import { fmt, KLEINANZEIGEN_FORMEL, zahlwegFormel, findeZahlweg } from './rechnen.js?v=18';

const REPO = 'github.com/rorar/klein-rechner';
const SEITE = 'rorar.github.io/klein-rechner';

const PAPIER = '#fbfbf7';
const LINIE = '#c6cdc1';
const TINTE = '#14201a';
const GRAU = '#5d6a60';
const POL_KA = '#1b7f51';
const POL_DIREKT = '#7b3b86';

/* GitHub-Wortmarke als Pfad, 16 Einheiten im Quadrat (Octicon mark-github).
   Als Pfad statt als Bild, damit das Canvas ohne zweite Datei auskommt. */
const GITHUB_PFAD = new Path2D('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z');

async function schriftenBereit() {
  /* Canvas fällt still auf eine Systemschrift zurück, wenn der Webfont
     noch nicht geladen ist. Jede benutzte Größe einzeln anfordern.
     allSettled statt all: eine einzelne Schrift, die nicht lädt, soll das
     Bild nicht verhindern – sie fällt dann eben zurück, genau wie oben
     beschrieben. */
  await Promise.allSettled([
    document.fonts.load('500 44px Newsreader'),
    document.fonts.load('400 19px Newsreader'),
    document.fonts.load('400 16px "IBM Plex Sans"'),
    document.fonts.load('500 16px "IBM Plex Sans"')
  ]);
}

/* Zeichnet eine Spalte und liefert die Höhe zurück, die sie gebraucht hat. */
function zeichneSpalte(g, { x, breite, titel, farbe, r, gebuehrLabel, gebuehrNotiz, fussnote, notizPlatz }) {
  const rechts = x + breite;

  const zeile = (y, label, betrag) => {
    g.fillStyle = TINTE;
    g.font = '400 16px "IBM Plex Sans", sans-serif';
    g.fillText(label, x, y);
    const lb = g.measureText(label).width;

    g.font = '400 18px Newsreader, Georgia, serif';
    const bb = g.measureText(betrag).width;
    g.fillText(betrag, rechts - bb, y);

    g.fillStyle = LINIE;
    for (let px = x + lb + 8; px < rechts - bb - 8; px += 5) {
      g.fillRect(px, y - 5, 1.5, 1.5);
    }
  };

  const notiz = (y, text) => {
    g.fillStyle = GRAU;
    g.font = '400 13px "IBM Plex Sans", sans-serif';
    g.fillText(text, x, y);
  };

  let y = 0;

  g.fillStyle = farbe;
  g.font = '500 17px "IBM Plex Sans", sans-serif';
  g.fillText(titel, x, y);
  y += 34;

  zeile(y, 'Artikelpreis', fmt(r.preis));
  y += 36;

  zeile(y, 'Versand', r.versand > 0 ? fmt(r.versand) : 'entfällt');
  /* Der Platz für die Notiz wird in beiden Spalten reserviert, auch wenn
     nur eine sie braucht. Sonst stünden die Summen auf verschiedener Höhe. */
  if (notizPlatz) {
    y += 19;
    if (r.paketstation) notiz(y, 'Zustellung an eine Paketstation');
  }
  y += 36;

  zeile(y, gebuehrLabel, r.gebuehr > 0 ? fmt(r.gebuehr) : '—');
  y += 20;
  notiz(y, gebuehrNotiz);
  y += 28;

  g.fillStyle = TINTE;
  g.fillRect(x, y, breite, 2);
  y += 40;

  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText('Käufer zahlt', x, y);
  g.fillStyle = farbe;
  g.font = '500 34px Newsreader, Georgia, serif';
  const summe = fmt(r.kaeuferZahlt);
  g.fillText(summe, rechts - g.measureText(summe).width, y + 4);
  y += 40;

  g.fillStyle = GRAU;
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText('Verkäufer behält', x, y);
  g.fillStyle = TINTE;
  g.font = '500 17px Newsreader, Georgia, serif';
  const behaelt = fmt(r.verkaeuferBehaelt);
  g.fillText(behaelt, rechts - g.measureText(behaelt).width, y);
  y += 26;

  g.fillStyle = r.schutz ? POL_KA : GRAU;
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText(r.schutz ? `✓ Der ${r.schutzName} greift.` : '○ Ohne Käuferschutz.', x, y);
  y += fussnote ? 22 : 0;

  if (fussnote) {
    g.fillStyle = GRAU;
    g.font = '400 13px "IBM Plex Sans", sans-serif';
    g.fillText(fussnote, x, y);
  }

  return y;
}

function befundZeilen(b, ka, di) {
  const zeilen = [];
  if (typeof b.kaeuferAb === 'number') {
    zeilen.push(`Für den Käufer dreht es sich bei ${fmt(b.kaeuferAb)}: darunter ist „Sicher bezahlen“ günstiger, darüber der Direktkauf.`);
  } else if (b.kaeuferAb === 'immer') {
    zeilen.push('Für den Käufer ist der Direktkauf bei jedem Preis günstiger.');
  } else {
    zeilen.push('Für den Käufer ist „Sicher bezahlen“ bei jedem Preis günstiger.');
  }

  if (b.verkaeuferAb === 'gleich') {
    zeilen.push(`Für den Verkäufer macht es keinen Unterschied: über beide Wege bleiben ${fmt(ka.verkaeuferBehaelt)}.`);
  } else if (b.verkaeuferAb === 'nie') {
    zeilen.push(`Für den Verkäufer ist „Sicher bezahlen“ immer besser: dort zahlt der Käufer die Gebühr, hier gingen ${fmt(di.gebuehr)} vom Erlös ab.`);
  } else {
    zeilen.push(`Für den Verkäufer ab ${fmt(b.verkaeuferAb)}.`);
  }
  return zeilen;
}

export async function zeichneBeleg(ka, di = null, b = null) {
  await schriftenBereit();

  const vergleich = Boolean(di);
  const S = 2;                     // doppelte Auflösung, sonst franst Text aus
  const RAND = 48;
  const SPALT = 48;
  const B = vergleich ? 1000 : 760;
  const inhalt = B - 2 * RAND;
  const spaltenBreite = vergleich ? (inhalt - SPALT) / 2 : inhalt;

  /* Erst rechnen, dann malen: die Leinwand muss ihre Höhe kennen, bevor
     der Kontext existiert. Gemessen wird deshalb auf einem Wegwerf-Canvas. */
  const befund = vergleich ? befundZeilen(b, ka, di) : [];
  const notizPlatz = ka.paketstation || Boolean(di?.paketstation);

  const spalten = [
    {
      x: 0, breite: spaltenBreite, notizPlatz,
      titel: 'über „Sicher bezahlen“',
      farbe: vergleich ? POL_KA : '#2c6a4f',
      r: ka,
      gebuehrLabel: ka.gebuehrName,
      gebuehrNotiz: `${KLEINANZEIGEN_FORMEL} von ${fmt(ka.preis)}`
    }
  ];

  if (vergleich) {
    const zahlweg = findeZahlweg(di.zahlweg);
    spalten.push({
      x: spaltenBreite + SPALT, breite: spaltenBreite, notizPlatz,
      titel: `direkt, ${zahlweg.name}`,
      farbe: POL_DIREKT,
      r: di,
      gebuehrLabel: di.gebuehrName,
      gebuehrNotiz: di.gebuehr > 0
        ? `${zahlwegFormel(di.zahlweg)}, getragen ${di.gebuehrTraeger === 'kaeufer' ? 'vom Käufer' : 'vom Verkäufer'}`
        : 'keine Gebühr',
      fussnote: di.warnung ? 'Verstößt bei Verkäufen gegen die PayPal-Bedingungen.' : null
    });
  }

  /* Die Leinwand muss ihre Höhe kennen, bevor der Kontext existiert.
     Also erst auf einem Wegwerf-Canvas messen, dann auf dem echten malen. */
  const mass = document.createElement('canvas').getContext('2d');
  const spaltenHoehe = Math.max(...spalten.map(s => zeichneSpalte(mass, s)));
  const H = 170 + spaltenHoehe + 40 + (vergleich ? befund.length * 22 + 12 : 0) + 130;

  const c = document.createElement('canvas');
  c.width = B * S;
  c.height = H * S;
  const g = c.getContext('2d');
  g.scale(S, S);

  g.fillStyle = PAPIER;
  g.fillRect(0, 0, B, H);
  g.strokeStyle = LINIE;
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, B - 1, H - 1);

  g.fillStyle = TINTE;
  g.font = '500 32px Newsreader, Georgia, serif';
  g.fillText(vergleich ? 'Zwei Wege im Vergleich' : '„Sicher bezahlen“ – Aufstellung', RAND, 92);

  g.fillStyle = GRAU;
  g.font = '400 15px "IBM Plex Sans", sans-serif';
  g.fillText(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), RAND, 120);

  g.save();
  g.translate(RAND, 170);
  for (const spalte of spalten) zeichneSpalte(g, spalte);
  g.restore();

  let y = 170 + spaltenHoehe + 40;

  if (vergleich) {
    g.fillStyle = TINTE;
    g.font = '400 14px "IBM Plex Sans", sans-serif';
    for (const zeile of befund) {
      g.fillText(zeile, RAND, y);
      y += 22;
    }
    y += 12;
  }

  g.fillStyle = GRAU;
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText(`Servicegebühr laut Kleinanzeigen: ${KLEINANZEIGEN_FORMEL} vom Artikelpreis.`, RAND, y);
  g.fillText('Halbe Cent gehen nach oben. Alle Angaben ohne Gewähr.', RAND, y + 22);
  y += 52;

  g.fillStyle = '#2c6a4f';
  g.save();
  g.translate(RAND, y);
  g.fill(GITHUB_PFAD);
  g.restore();

  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText(REPO, RAND + 24, y + 13);

  g.font = '400 15px "IBM Plex Sans", sans-serif';
  const label = 'Selbst rechnen: ';
  const labelBreite = g.measureText(label).width;   // messen, solange 400 gilt
  g.fillStyle = GRAU;
  g.fillText(label, RAND, y + 43);

  g.fillStyle = '#2c6a4f';
  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText(SEITE, RAND + labelBreite, y + 43);

  /* toBlob reicht bei einem Fehlschlag null durch. Ohne diese Prüfung liefe
     das null bis in URL.createObjectURL und stürbe erst dort. */
  return new Promise((res, rej) => {
    c.toBlob(blob => blob ? res(blob) : rej(new Error('Das Bild ließ sich nicht erzeugen.')), 'image/png');
  });
}

export function dateiname(r) {
  return `sicher-bezahlen-${(r.kaeuferZahlt / 100).toFixed(2).replace('.', '-')}-euro.png`;
}
