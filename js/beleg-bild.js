/* Der Beleg wird von Hand auf ein Canvas gezeichnet. Das sind wenige
   Zeilen je Spalte – dafür lohnt keine Bibliothek, die das DOM nachbaut. */

import { fmt, KLEINANZEIGEN_AUFSCHLUESSELUNG } from './rechnen.js?v=28';
import { ausgerichtetePosten, breakevenSaetze, kostenPosten, schutzSatz } from './texte.js?v=28';

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

/* Zeichnet eine Spalte und liefert die Höhe zurück, die sie gebraucht hat.
   Welche Posten das sind, entscheidet kostenPosten aus texte.js - dieselbe
   Quelle wie für die Nachricht. Vorher hatte das Bild eine eigene
   Reihenfolge, nannte die Versandart nicht und stellte die Gebühr des
   Verkäufers über den Strich: die Spalte ging nicht auf. */
function zeichneSpalte(g, { x, breite, titel, farbe, r, posten, zeilen, zeilenPlatz }) {
  const rechts = x + breite;

  const zeile = (y, label, betrag) => {
    g.fillStyle = TINTE;
    g.font = '400 16px "IBM Plex Sans", sans-serif';
    g.fillText(label, x, y);
    const lb = g.measureText(label).width;

    if (betrag === null) return;

    g.font = '400 18px Newsreader, Georgia, serif';
    const bb = g.measureText(betrag).width;
    g.fillText(betrag, rechts - bb, y);

    g.fillStyle = LINIE;
    for (let px = x + lb + 8; px < rechts - bb - 8; px += 5) {
      g.fillRect(px, y - 5, 1.5, 1.5);
    }
  };

  /* Gibt die Grundlinie der letzten gezeichneten Zeile zurück. Ohne Text
     ist das die Ausgangshöhe: vorher kam y - 17 heraus, und der nächste
     Aufrufer hätte darüber weitergeschrieben. */
  const notiz = (y, text) => {
    const stuecke = umbrich(g, text, breite);
    if (!stuecke.length) return y;

    g.fillStyle = GRAU;
    g.font = '400 13px "IBM Plex Sans", sans-serif';
    stuecke.forEach((stueck, i) => { g.fillText(stueck, x, y + i * 17); });
    return y + (stuecke.length - 1) * 17;
  };

  const { summe, fussnoten } = posten;

  let y = 0;

  if (titel) {
    g.fillStyle = farbe;
    g.font = '500 17px "IBM Plex Sans", sans-serif';
    g.fillText(titel, x, y);
    y += 34;
  }

  /* Alle Spalten bekommen dieselben Zeilen in derselben Reihenfolge und
     gleich viel Platz für Notizen. Wo eine Spalte eine Art nicht kennt,
     bleibt die Zeile leer, statt die folgenden hochrutschen zu lassen. */
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (z) zeile(y, z.label, z.betrag === null ? null : fmt(z.betrag));
    if (zeilenPlatz[i] > 0) {
      if (z?.notiz) notiz(y + 19, z.notiz);
      y += 19 * zeilenPlatz[i];
    }
    y += 34;
  }

  g.fillStyle = TINTE;
  g.fillRect(x, y - 12, breite, 2);
  y += 28;

  g.font = '500 15px "IBM Plex Sans", sans-serif';
  g.fillText('Käufer zahlt', x, y);
  g.fillStyle = farbe;
  g.font = '500 34px Newsreader, Georgia, serif';
  const betrag = fmt(summe.betrag);
  g.fillText(betrag, rechts - g.measureText(betrag).width, y + 4);
  y += 40;

  g.fillStyle = GRAU;
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText('Verkäufer behält', x, y);
  g.fillStyle = TINTE;
  g.font = '500 17px Newsreader, Georgia, serif';
  const behaelt = fmt(r.verkaeuferBehaelt);
  g.fillText(behaelt, rechts - g.measureText(behaelt).width, y);
  y += 26;

  for (const satz of fussnoten) {
    y = notiz(y, satz) + 21;
  }

  g.fillStyle = r.schutz ? POL_KA : GRAU;
  g.font = '400 14px "IBM Plex Sans", sans-serif';
  g.fillText(`${r.schutz ? '✓' : '○'} ${schutzSatz(r)}`, x, y);

  if (r.warnung) {
    y = notiz(y + 21, r.warnung);
  }

  return y;
}

/* Canvas bricht nicht von selbst um. */
function umbrich(g, text, maxBreite) {
  const woerter = String(text).split(' ');
  const zeilen = [];
  let aktuell = '';
  for (const wort of woerter) {
    const versuch = aktuell ? `${aktuell} ${wort}` : wort;
    if (g.measureText(versuch).width > maxBreite && aktuell) {
      zeilen.push(aktuell);
      aktuell = wort;
    } else {
      aktuell = versuch;
    }
  }
  if (aktuell) zeilen.push(aktuell);
  return zeilen;
}

function befundZeilen(b, ka, di) {
  const s = breakevenSaetze(b, ka, di);
  return [s.kaeufer, s.verkaeufer];
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

  const rechnungen = vergleich ? [ka, di] : [ka];
  /* Einmal rechnen und durchreichen: zeichneSpalte läuft zweimal, erst zum
     Messen, dann zum Malen. Rechnete es dabei jedes Mal neu, könnten
     gemessene und gemalte Höhe auseinanderlaufen. */
  const postenJeSpalte = rechnungen.map(kostenPosten);
  const { spalten: zeilenJeSpalte } = ausgerichtetePosten(postenJeSpalte);

  /* Wie viele Notizzeilen jede Posten-Zeile braucht, über alle Spalten
     hinweg. Dieselbe Höhe für alle, sonst stünden die Summen versetzt. */
  const mass = document.createElement('canvas').getContext('2d');
  mass.font = '400 13px "IBM Plex Sans", sans-serif';
  const zeilenPlatz = zeilenJeSpalte[0].map((_, i) => Math.max(0, ...zeilenJeSpalte.map(
    zeilen => zeilen[i]?.notiz ? umbrich(mass, zeilen[i].notiz, spaltenBreite).length : 0)));

  const spalten = rechnungen.map((r, i) => ({
    x: i === 0 ? 0 : spaltenBreite + SPALT,
    breite: spaltenBreite,
    zeilen: zeilenJeSpalte[i],
    zeilenPlatz,
    /* Ohne Vergleich wiederholte die Spaltenüberschrift nur den Titel. */
    titel: i === 0 ? (vergleich ? 'über „Sicher bezahlen“' : null) : `direkt, ${di.zahlwegName}`,
    farbe: i === 0 ? (vergleich ? POL_KA : '#2c6a4f') : POL_DIREKT,
    posten: postenJeSpalte[i],
    r
  }));

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
  g.fillText(`Servicegebühr laut Kleinanzeigen: ${KLEINANZEIGEN_AUFSCHLUESSELUNG}.`, RAND, y);
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
