/* Alle Zahlen und Bezeichnungen, die sich ändern können, an einer Stelle.
   Wer Preise oder Gebühren pflegt, fasst nur diese Datei an.

   Bewusst ein Modul und keine .json:
   - Eine Gebühr ist hier ein Deskriptor, kein fester Wert. Als JSON ginge
     das noch, als Funktion nicht mehr – und eine halb in JSON, halb im
     Code liegende Gebühr wäre schlechter als beides.
   - Eine .json müsste abgerufen werden. Das kostet auf einer statischen
     Seite einen zweiten Umlauf vor der ersten Rechnung und bringt einen
     neuen Fehlerfall mit.
   - JSON kennt keine Kommentare. Die Herkunft der Preise stünde dann
     nirgends.

   Die Rechenformeln stehen in rechnen.js und bleiben davon unberührt. */

export const STAND_DER_WERTE = '2026-09-23';

/* ---------- Gebühren ---------- */

/* Ein Gebühren-Deskriptor:
     festCent    Grundbetrag je Zahlung
     basispunkte Anteil in Zehntausendsteln – 450 sind 4,5 %
     grundlage   'artikelpreis' oder 'gesamtbetrag' (also mit Versand)
   `null` heißt: keine Gebühr. */

export const KLEINANZEIGEN = {
  gebuehrName: 'Servicegebühr Kleinanzeigen',
  schutzName: 'Kleinanzeigen-Käuferschutz',
  gebuehr: { festCent: 50, basispunkte: 450, grundlage: 'artikelpreis' },
  quelle: 'https://hilfe.kleinanzeigen.de/hc/de/articles/17211553583388-Was-ist-Sicher-bezahlen-wie-funktioniert-der-K%C3%A4uferschutz'
};

/* Die Reihenfolge bestimmt die Reihenfolge der Auswahl auf der Seite.
   Der erste Eintrag ist die Vorauswahl. */
export const ZAHLWEGE = [
  {
    id: 'ueberweisung',
    name: 'Banküberweisung',
    gebuehrName: 'Gebühr',
    gebuehr: null,
    schutz: false
  },
  {
    id: 'paypal-wd',
    name: 'PayPal Waren und Dienstleistungen',
    gebuehrName: 'PayPal-Gebühr',
    schutzName: 'PayPal-Käuferschutz',
    /* 2,49 % + 0,35 €, bemessen am gesamten überwiesenen Betrag –
       anders als bei Kleinanzeigen also einschließlich Versand. */
    gebuehr: { festCent: 35, basispunkte: 249, grundlage: 'gesamtbetrag' },
    schutz: true,
    traeger: true,            // nur hier gibt es etwas zu verteilen
    quelle: 'https://www.paypal.com/de/digital-wallet/paypal-consumer-fees'
  },
  {
    id: 'paypal-ff',
    name: 'PayPal Freunde und Familie',
    gebuehrName: 'PayPal-Gebühr',
    gebuehr: null,
    schutz: false,
    warnung: 'Für Verkäufe verstößt das gegen die PayPal-Nutzungsbedingungen und kann zur Kontosperrung führen.'
  },
  {
    id: 'bar',
    name: 'Barzahlung bei Abholung',
    gebuehrName: 'Gebühr',
    gebuehr: null,
    schutz: false,
    ohneVersand: true
  }
];

/* ---------- Versandkosten ---------- */

/* quelle: 'kleinanzeigen' erscheint nur im Kleinanzeigen-Feld,
           'direkt' nur im Feld für den selbst gebuchten Versand,
           'beide' in beiden.

   Hermes-Preise laut Preisliste gültig ab 02.03.2026
   (https://www.myhermes.de/content/pdf/preise-ab-02032026.pdf),
   DHL laut Onlinefrankierung
   (https://www.dhl.de/de/privatkunden/pakete-versenden.html).
   Online gebucht ist durchweg billiger als im Shop.

   Die 2,99 € laufen über Hermes und stehen so in Anzeigen mit
   Kleinanzeigen-Versand; die Preise pro Paketgröße zeigt erst der
   Kaufvorgang. */
export const VERSANDARTEN = [
  { name: 'Abholung, kein Versand', cent: 0, quelle: 'beide' },

  { name: 'Hermes über Kleinanzeigen, kleinste Größe', cent: 299, quelle: 'kleinanzeigen',
    hinweis: 'Aktionspreis nur bei Zustellung an eine Paketstation', paketstation: true },

  { name: 'Hermes Shop-to-Shop Päckchen', cent: 399, quelle: 'direkt',
    hinweis: 'nur online, von Shop zu Shop' },
  { name: 'DHL Päckchen S', cent: 419, quelle: 'direkt', hinweis: 'nur online' },
  { name: 'Hermes Shop-to-Shop Paket S', cent: 489, quelle: 'direkt',
    hinweis: 'nur online, von Shop zu Shop' },
  { name: 'Hermes Päckchen, online', cent: 519, quelle: 'direkt', hinweis: 'an die Haustür' },
  { name: 'Hermes Päckchen, im Shop gebucht', cent: 525, quelle: 'direkt', hinweis: 'an die Haustür' },
  { name: 'Hermes Paket S, online', cent: 579, quelle: 'direkt', hinweis: 'an die Haustür' },
  { name: 'Hermes Paket M an PaketShop', cent: 590, quelle: 'direkt', hinweis: 'nur online' },
  { name: 'DHL Paket bis 2 kg', cent: 619, quelle: 'direkt', hinweis: 'nur online' },
  { name: 'Hermes Paket S, im Shop gebucht', cent: 679, quelle: 'direkt', hinweis: 'an die Haustür' },
  { name: 'Hermes Paket L an PaketShop', cent: 990, quelle: 'direkt', hinweis: 'nur online' }
];
