/* Der Beleg wird von Hand auf ein Canvas gezeichnet. Das sind vier Zeilen
   plus Summe – dafür lohnt keine Bibliothek, die das DOM nachbaut. */

import { fmt, GEBUEHR_FIX_CENT } from './rechnen.js?v=11';

const REPO = 'github.com/rorar/klein-rechner';
const SEITE = 'rorar.github.io/klein-rechner';

/* GitHub-Wortmarke als Pfad, 16 Einheiten im Quadrat (Octicon mark-github).
   Als Pfad statt als Bild, damit das Canvas ohne zweite Datei auskommt. */
const GITHUB_PFAD = new Path2D('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z');

export async function zeichneBeleg(r) {
  await Promise.all([
    document.fonts.load('500 44px Newsreader'),
    document.fonts.load('400 19px Newsreader'),
    document.fonts.load('400 16px "IBM Plex Sans"'),
    document.fonts.load('500 16px "IBM Plex Sans"')
  ]);

  const S = 2;                     // doppelte Auflösung, sonst franst Text aus
  const B = 760, RAND = 48;
  const H = r.paketstation ? 586 : 566;   // die Paketstation-Zeile braucht Platz
  const c = document.createElement('canvas');
  c.width = B * S;
  c.height = H * S;
  const g = c.getContext('2d');
  g.scale(S, S);

  g.fillStyle = '#fbfbf7';
  g.fillRect(0, 0, B, H);
  g.strokeStyle = '#c6cdc1';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, B - 1, H - 1);

  g.fillStyle = '#14201a';
  g.font = '500 32px Newsreader, Georgia, serif';
  g.fillText('„Sicher bezahlen“ – Aufstellung', RAND, 92);

  g.fillStyle = '#5d6a60';
  g.font = '400 15px "IBM Plex Sans", sans-serif';
  g.fillText(new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), RAND, 120);

  const zeile = (y, label, betrag) => {
    g.fillStyle = '#14201a';
    g.font = '400 17px "IBM Plex Sans", sans-serif';
    g.fillText(label, RAND, y);
    const lb = g.measureText(label).width;

    g.font = '400 19px Newsreader, Georgia, serif';
    const bb = g.measureText(betrag).width;
    g.fillText(betrag, B - RAND - bb, y);

    g.fillStyle = '#c6cdc1';
    for (let x = RAND + lb + 8; x < B - RAND - bb - 8; x += 5) {
      g.fillRect(x, y - 5, 1.5, 1.5);
    }
  };

  const notiz = (yy, text) => {
    g.fillStyle = '#5d6a60';
    g.font = '400 14px "IBM Plex Sans", sans-serif';
    g.fillText(text, RAND, yy);
  };

  /* Laufende Höhe statt fester Werte: die Paketstation-Zeile schiebt alles
     darunter nach unten. */
  let y = 180;

  zeile(y, 'Artikelpreis', fmt(r.preis));
  y += 38;

  zeile(y, 'Versand', r.versand > 0 ? fmt(r.versand) : 'entfällt');
  if (r.paketstation) {
    y += 20;
    notiz(y, 'Zustellung an eine Paketstation');
  }
  y += 38;

  zeile(y, 'Servicegebühr', fmt(r.gebuehr));
  y += 22;
  notiz(y, `${fmt(GEBUEHR_FIX_CENT)} + 4,5 % von ${fmt(r.preis)}`);
  y += 28;

  g.fillStyle = '#14201a';
  g.fillRect(RAND, y, B - 2 * RAND, 2);
  y += 56;

  g.font = '500 18px "IBM Plex Sans", sans-serif';
  g.fillText('Käufer zahlt', RAND, y);

  g.fillStyle = '#2c6a4f';
  g.font = '500 46px Newsreader, Georgia, serif';
  const summe = fmt(r.summe);
  g.fillText(summe, B - RAND - g.measureText(summe).width, y + 4);
  y += 62;

  g.fillStyle = '#5d6a60';
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText('Servicegebühr laut Kleinanzeigen: 0,50 € plus 4,5 % vom Artikelpreis.', RAND, y);
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
  g.fillStyle = '#5d6a60';
  g.fillText(label, RAND, y + 43);

  g.fillStyle = '#2c6a4f';
  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText(SEITE, RAND + labelBreite, y + 43);

  return new Promise(res => c.toBlob(res, 'image/png'));
}

export function dateiname(r) {
  return `sicher-bezahlen-${(r.summe / 100).toFixed(2).replace('.', '-')}-euro.png`;
}
