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

export const STAND_DER_WERTE = '2026-09-24';

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

/* Der Zusatz, den der Aktionsschalter bedeutet. Steht hier, weil ihn auch
   texte.js braucht: wer den Versandbetrag von Hand eintippt, wählt keine
   Versandart, der Schalter gilt aber trotzdem.

   Die Bezeichner heißen weiter `paketstation` – im Datenfeld wie im
   Adressparameter `?paketstation=1`. Der Name ist generisch gemeint und
   bleibt, damit geteilte Links weiter gelten; was er bedeutet, steht in
   diesem Text, und das ist seit der Hermes-Aktion Shop-to-Shop. */
export const PAKETSTATION_ZUSTELLUNG = 'von Shop zu Shop';

/* Zwei verschiedene Leser, zwei Felder:

     name        steht in der Auswahlliste und darf unterscheiden, wie
                 der Schein gebucht wird - der Preis hängt daran.
     kurz        steht in der Nachricht an den Käufer, wo die Buchungsart
                 nichts zu suchen hat. Fehlt sie, wird `name` genommen.
     hinweis     geht den Verkäufer an und steht in der Auswahlliste
                 ("nur online buchbar").
     zustellung  geht den Käufer an und wandert in die Nachricht an ihn
                 ("von Shop zu Shop"). Wie der Verkäufer den Schein bucht,
                 interessiert den Käufer nicht.

   Größe, Maß, Gewicht und Haftung beschreiben die Sendung, nicht den
   Preis. Sie entscheiden nichts, sie helfen beim Auswählen:

     groesse     'klein', 'mittel' oder 'gross' - die Gruppen, in die
                 Kleinanzeigen die Optionen im Versanddialog einteilt. Für
                 den selbst gebuchten Versand steht die Einteilung in
                 keiner Quelle; dort ist sie nach denselben Maßen gebildet,
                 nach denen der Dialog dieselben Pakete einordnet.
     mass        Wortlaut aus dem Dialog. Hermes misst längste plus
                 kürzeste Seite, DHL misst Länge × Breite × Höhe; ein
                 gemeinsames Zahlenfeld gäbe es für beide nicht.
     gewicht     Höchstgewicht.
     haftungCent Bis wohin der Dienstleister bei Verlust haftet. Null heißt
                 ausdrücklich ohne Haftung – das steht so bei den
                 DHL-Päckchen. Fehlt das Feld, ist nichts bekannt, und
                 dann wird auch nichts behauptet.

   Preise:

     cent         was heute zu zahlen ist.
     regulaerCent der reguläre Preis. Ohne Aktion ist er gleich `cent`.
     aktionBis    Tag, an dem die Aktion endet. Fehlt er, gibt es keine.

   quelle: 'kleinanzeigen' erscheint nur im Kleinanzeigen-Feld,
           'direkt' nur im Feld für den selbst gebuchten Versand,
           'beide' in beiden.

   Die Kleinanzeigen-Optionen stehen so im Versanddialog der App
   (abgelesen am 24.09.2026). Die ermäßigten Hermes-Preise laufen über die
   Aktion unter https://themen.kleinanzeigen.de/reduzierter-hermes-versand/;
   deren Teilnahmebedingungen nennen als Bedingung die Bezahlfunktion in
   Verbindung mit Hermes Shop-to-Shop, nicht die Paketstation.

   Achtung, die beiden Quellen widersprechen sich beim M-Paket. Der Dialog
   in der App zeigt „ab 2,99 €“ neben einem durchgestrichenen „5,90 €“ –
   nachgesehen am 25.09.2026 –, die Teilnahmebedingungen nennen 2,49 €.
   Hier steht der Wert aus der App, weil er das ist, was der Verkäufer beim
   Einstellen sieht; der Hinweis unter dem Schalter sagt deshalb, dass die
   Beträge aus dem Dialog stammen. Was das „ab“ des Dialogs einschließt,
   steht nirgends, also behauptet die Seite darüber nichts.

   Hermes-Preise für den selbst gebuchten Versand laut Preis- und
   Serviceübersicht gültig ab 02.03.2026
   (https://www.myhermes.de/content/pdf/preise-ab-02032026.pdf), abgelesen
   am 24.09.2026. Hermes staffelt nach Zustellart: an einen PaketShop oder
   eine Paketstation ist es billiger als an die Haustür, und dort ist der
   online erstellte Paketschein billiger als der im PaketShop erstellte.
   Gewicht überall bis 25 kg, Haftung 500 € je Paket und 50 € je Päckchen.

   DHL-Preise laut https://shop.deutschepost.de/dhl-paketpreise, abgelesen
   am 24.09.2026, Spalten „Filiale/Versandmarke“ und „Online Frankierung“.
   Für Päckchen schließt die dortige Fußnote 2 Haftung und
   Sendungsverfolgung aus; das Paket haftet bis 500 €.

   Nicht aufgenommen, weil sie hier nichts zu vergleichen haben: DHL
   Pluspäckchen (nur über die Filiale), Hermes XL, XXL, Reisegepäck und die
   Abholpreise, dazu alles Internationale. */
export const VERSANDARTEN = [
  { name: 'Abholung, kein Versand', cent: 0, regulaerCent: 0, quelle: 'beide' },

  /* ----- über Kleinanzeigen gebucht ----- */

  { groesse: 'klein', name: 'Hermes Päckchen', cent: 99, regulaerCent: 399,
    aktionBis: '2026-12-31', quelle: 'kleinanzeigen',
    mass: 'längste und kürzeste Seite zusammen höchstens 37 cm', gewicht: 'bis 25 kg',
    haftungCent: 5000,
    hinweis: 'Aktionspreis, nur über „Sicher bezahlen“ und Hermes Shop-to-Shop',
    zustellung: PAKETSTATION_ZUSTELLUNG, paketstation: true },

  { groesse: 'klein', name: 'Hermes S-Paket', cent: 199, regulaerCent: 489,
    aktionBis: '2026-12-31', quelle: 'kleinanzeigen',
    mass: 'längste und kürzeste Seite zusammen höchstens 50 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'Aktionspreis, nur über „Sicher bezahlen“ und Hermes Shop-to-Shop',
    zustellung: PAKETSTATION_ZUSTELLUNG, paketstation: true },

  { groesse: 'mittel', name: 'Hermes M-Paket', cent: 299, regulaerCent: 590,
    aktionBis: '2026-12-31', quelle: 'kleinanzeigen',
    mass: 'längste und kürzeste Seite zusammen höchstens 80 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'Aktionspreis, nur über „Sicher bezahlen“ und Hermes Shop-to-Shop',
    zustellung: PAKETSTATION_ZUSTELLUNG, paketstation: true },

  { groesse: 'klein', name: 'DHL Paket 2 kg', cent: 619, regulaerCent: 619,
    quelle: 'kleinanzeigen',
    mass: 'höchstens 60 × 30 × 15 cm', gewicht: 'bis 2 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'mittel', name: 'DHL Paket 5 kg', cent: 769, regulaerCent: 769,
    quelle: 'kleinanzeigen',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 5 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'Hermes L-Paket', cent: 990, regulaerCent: 990,
    quelle: 'kleinanzeigen',
    mass: 'längste und kürzeste Seite zusammen höchstens 120 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    zustellung: 'von Shop zu Shop' },

  { groesse: 'gross', name: 'DHL Paket 10 kg', cent: 1049, regulaerCent: 1049,
    quelle: 'kleinanzeigen',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 10 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'DHL Paket 20 kg', cent: 1899, regulaerCent: 1899,
    quelle: 'kleinanzeigen',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 20 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'DHL Paket 31,5 kg', cent: 2399, regulaerCent: 2399,
    quelle: 'kleinanzeigen',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 31,5 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  /* ----- selbst beim Dienstleister gebucht ----- */

  /* Hermes, Zustellung an einen PaketShop oder eine Paketstation. */
  { groesse: 'klein', name: 'Hermes Shop-to-Shop Päckchen', cent: 399, regulaerCent: 399,
    quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 37 cm', gewicht: 'bis 25 kg',
    haftungCent: 5000,
    hinweis: 'nur online buchbar', zustellung: 'von Shop zu Shop' },

  { groesse: 'klein', name: 'Hermes Shop-to-Shop Paket S', cent: 489, regulaerCent: 489,
    quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 50 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'nur online buchbar', zustellung: 'von Shop zu Shop' },

  { groesse: 'mittel', name: 'Hermes Paket M', cent: 590, regulaerCent: 590,
    quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 80 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'nur online buchbar', zustellung: 'Zustellung an einen PaketShop' },

  { groesse: 'gross', name: 'Hermes Paket L', cent: 990, regulaerCent: 990,
    quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 120 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'nur online buchbar', zustellung: 'Zustellung an einen PaketShop' },

  /* Hermes, Zustellung an die Haustür. Der online erstellte Paketschein
     ist billiger als der im PaketShop erstellte. */
  { groesse: 'klein', name: 'Hermes Päckchen, online gebucht', kurz: 'Hermes Päckchen',
    cent: 519, regulaerCent: 519, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 37 cm', gewicht: 'bis 25 kg',
    haftungCent: 5000,
    hinweis: 'online gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'klein', name: 'Hermes Päckchen, im Shop gebucht', kurz: 'Hermes Päckchen',
    cent: 525, regulaerCent: 525, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 37 cm', gewicht: 'bis 25 kg',
    haftungCent: 5000,
    hinweis: 'im PaketShop gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'klein', name: 'Hermes Paket S, online gebucht', kurz: 'Hermes Paket S',
    cent: 579, regulaerCent: 579, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 50 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'online gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'klein', name: 'Hermes Paket S, im Shop gebucht', kurz: 'Hermes Paket S',
    cent: 679, regulaerCent: 679, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 50 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'im PaketShop gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'mittel', name: 'Hermes Paket M, online gebucht', kurz: 'Hermes Paket M',
    cent: 699, regulaerCent: 699, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 80 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'online gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'mittel', name: 'Hermes Paket M, im Shop gebucht', kurz: 'Hermes Paket M',
    cent: 795, regulaerCent: 795, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 80 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'im PaketShop gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'Hermes Paket L, online gebucht', kurz: 'Hermes Paket L',
    cent: 1099, regulaerCent: 1099, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 120 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'online gebucht', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'Hermes Paket L, im Shop gebucht', kurz: 'Hermes Paket L',
    cent: 1195, regulaerCent: 1195, quelle: 'direkt',
    mass: 'längste und kürzeste Seite zusammen höchstens 120 cm', gewicht: 'bis 25 kg',
    haftungCent: 50000,
    hinweis: 'im PaketShop gebucht', zustellung: 'Zustellung an die Haustür' },

  /* DHL. Für Päckchen sind Haftung und Sendungsverfolgung ausgeschlossen,
     deshalb haftungCent: 0 – das ist eine Angabe, kein fehlender Wert. */
  { groesse: 'klein', name: 'DHL Päckchen S', cent: 419, regulaerCent: 419,
    quelle: 'direkt',
    mass: 'höchstens 35 × 25 × 10 cm', gewicht: 'bis 2 kg', haftungCent: 0,
    hinweis: 'ohne Sendungsverfolgung', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'klein', name: 'DHL Päckchen M', cent: 519, regulaerCent: 519,
    quelle: 'direkt',
    mass: 'höchstens 60 × 30 × 15 cm', gewicht: 'bis 2 kg', haftungCent: 0,
    hinweis: 'ohne Sendungsverfolgung', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'klein', name: 'DHL Paket bis 2 kg', cent: 619, regulaerCent: 619,
    quelle: 'direkt',
    mass: 'höchstens 60 × 30 × 15 cm', gewicht: 'bis 2 kg', haftungCent: 50000,
    hinweis: 'nur online buchbar', zustellung: 'Zustellung an die Haustür' },

  { groesse: 'mittel', name: 'DHL Paket bis 5 kg', cent: 769, regulaerCent: 769,
    quelle: 'direkt',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 5 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'DHL Paket bis 10 kg', cent: 1049, regulaerCent: 1049,
    quelle: 'direkt',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 10 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'DHL Paket bis 20 kg', cent: 1899, regulaerCent: 1899,
    quelle: 'direkt',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 20 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' },

  { groesse: 'gross', name: 'DHL Paket bis 31,5 kg', cent: 2399, regulaerCent: 2399,
    quelle: 'direkt',
    mass: 'höchstens 120 × 60 × 60 cm', gewicht: 'bis 31,5 kg', haftungCent: 50000,
    zustellung: 'Zustellung an die Haustür' }
];
