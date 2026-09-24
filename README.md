# Sicher-bezahlen-Rechner

Ein kleiner Rechner für die Bezahlfunktion „Sicher bezahlen“ bei Kleinanzeigen.
Artikelpreis und Versandkosten eintragen – die Seite zeigt die Servicegebühr, die
Endsumme und einen fertigen Text, den man in den Chat kopieren kann.

**Zur Seite:** https://rorar.github.io/klein-rechner/

## Was gerechnet wird

Kleinanzeigen erhebt beim Kauf eine Servicegebühr von **0,50 € plus 4,5 % des
Artikelpreises**. Der Versand kommt unverändert dazu.

```
Gebühr = 0,50 € + 4,5 % × Artikelpreis
Summe  = Artikelpreis + Versand + Gebühr
```

Gerechnet wird in ganzen Cent. Halbe Cent gehen nach oben: 4,5 % von 1,00 € sind
genau 4,5 Cent, daraus werden 5 Cent und damit 0,55 € Gebühr. Zweites Beispiel:
45,00 € Artikel und 5,49 € Versand ergeben 2,53 € Gebühr und 53,02 € Endsumme.

Die Formel steht so im
[Hilfe-Center von Kleinanzeigen](https://hilfe.kleinanzeigen.de/hc/de/articles/17211553583388-Was-ist-Sicher-bezahlen-wie-funktioniert-der-K%C3%A4uferschutz).
Wie dort gerundet wird, steht nirgends – der Hinweis auf der Seite beschreibt
deshalb, was der Rechner tut.

Die Gebühr trägt der Käufer.

## Vergleichsmodus

Der Haken „Direktkauf vergleichen“ rechnet den Weg ohne Kleinanzeigen daneben:
Banküberweisung, PayPal Waren und Dienstleistungen, PayPal Freunde und Familie
oder Barzahlung bei Abholung, mit den Versandpreisen der Dienstleister statt den
verbilligten von Kleinanzeigen.

Er ist standardmäßig aus. Der Vergleich ist ein Werkzeug für den Verkäufer, nicht
zwingend etwas für den Käufer, und ein geteilter Link zeigt ihn nur, wenn er beim
Teilen an war.

```
Kleinanzeigen   Käufer zahlt  Preis + Versand + 0,50 € + 4,5 % × Preis
                Verkäufer     Preis

direkt          Käufer zahlt  Preis + Versand (+ Gebühr, wenn er sie drauflegt)
                Verkäufer     Preis (− Gebühr, wenn er sie trägt)
```

PayPal rechnet anders als Kleinanzeigen: **2,49 % + 0,35 € vom gesamten
überwiesenen Betrag**, also einschließlich Versand, während die
Kleinanzeigen-Gebühr nur den Artikelpreis als Grundlage hat.

Einen käuferfinanzierten PayPal-Käuferschutz gibt es nicht. Schutz gibt es nur
über „Waren und Dienstleistungen“, und dort trägt die Gebühr immer der Empfänger.
Der Käufer kann sie nur ausgleichen, indem er mehr überweist – das ist der
Schalter „legt der Käufer drauf“.

## Ab wann lohnt der Direktkauf?

Der Balken nennt die Schwelle für beide Seiten. Bei 2,99 € Kleinanzeigen-Versand
gegen 5,19 € direkt:

| Zahlweg | Käufer zahlt direkt weniger ab | Verkäufer behält direkt mehr ab |
| --- | --- | --- |
| Banküberweisung, Freunde und Familie | 37,89 € | gleich |
| PayPal W&D, Verkäufer trägt | 37,89 € | nie |
| PayPal W&D, Käufer legt drauf | 112,78 € | gleich |

Für den Verkäufer gibt es keine Schwelle. Über Kleinanzeigen behält er entweder
genau so viel wie direkt oder mehr, nie weniger – die Servicegebühr trägt der
Käufer, der Versand geht in beiden Fällen an den Dienstleister. Ein Test hält das
über den ganzen Preisbereich fest.

Die Schwellen entstehen aus binärer Suche auf denselben Funktionen, die auch die
Anzeige speisen. Eine geschlossene Formel läge wegen der Cent-Rundung um bis zu
einen Cent daneben: 37,89 € statt der errechneten 37,78 €.

## Verlinkbare Rechnungen

Der Text zum Verschicken steht in drei Fassungen bereit: Du-Form, Sie-Form und
eine ohne Anrede an die Person, die auch passt, solange zwischen Käufer und
Verkäufer noch nicht geklärt ist, wie man sich anspricht.

Beide Felder lassen sich über die Adresse vorbelegen:

```
https://rorar.github.io/klein-rechner/?preis=45,00&versand=5,49
https://rorar.github.io/klein-rechner/?preis=12.34
https://rorar.github.io/klein-rechner/?preis=30,00&versand=2,99&paketstation=1
https://rorar.github.io/klein-rechner/?preis=45,00&versand=2,99&vergleich=1&direktversand=5,19&zahlweg=paypal-wd&traeger=kaeufer
```

Im Vergleichsmodus kommen `vergleich=1`, `direktversand`, `zahlweg`
(`ueberweisung`, `paypal-wd`, `paypal-ff`, `bar`) und `traeger`
(`verkaeufer`, `kaeufer`) dazu. Unbekannte Werte fallen auf den Standard zurück,
statt die Seite zu zerlegen. Ohne `vergleich=1` werden die vier nicht geschrieben.

`paketstation=1` setzt den Haken für die Zustellung an eine Paketstation. Ohne
Versandkosten wird er ignoriert, weil es dann nichts zuzustellen gibt.

Unter der Aufstellung kopiert oder teilt „Link kopieren“ beziehungsweise
„Link teilen“ genau diese Adresse. Der Teilen-Knopf erscheint nur, wo der
Browser `navigator.share` kennt.

Der Haken ist keine Randnotiz: Aktionspreise über Kleinanzeigen kamen in der
Vergangenheit nur zustande, wenn an eine Paketstation geliefert wurde. Wer sich
die Ware nach Hause schicken lässt, zahlt dann mehr als der Rechner anzeigt.
Deshalb steht die Bedingung in der Aufstellung, in allen drei Texten und im
Bild – der Käufer soll sie sehen, bevor er zusagt.

Komma und Punkt werden beide gelesen. Beim Tippen schreibt die Seite den
aktuellen Stand per `replaceState` zurück in die Adresse, die damit jederzeit
teilbar ist.

## Werte pflegen

Preise, Gebührensätze und Bezeichnungen stehen vollständig in
[`js/daten.js`](js/daten.js). Eine Gebühr ist dort ein Deskriptor, keine
Funktion:

```js
gebuehr: { festCent: 35, basispunkte: 249, grundlage: 'gesamtbetrag' }
```

`basispunkte` sind Zehntausendstel – 450 sind 4,5 %. `grundlage` unterscheidet,
ob der Satz auf den Artikelpreis oder auf den gesamten Betrag einschließlich
Versand wirkt. Ein neuer Zahlweg oder ein geänderter Satz ist damit eine reine
Datenänderung; `rechnen.js` bleibt unberührt, und die angezeigte Formel
(„0,50 € + 4,5 %“) entsteht aus demselben Deskriptor.

Bewusst ein Modul und keine `.json`: eine Gebühr als Funktion ließe sich in JSON
nicht abbilden, eine abzurufende Datei kostete auf einer statischen Seite einen
zweiten Umlauf vor der ersten Rechnung, und JSON kennt keine Kommentare – die
Herkunft der Preise stünde dann nirgends.

## Externe Anbindung

Die Seite liegt auf GitHub Pages und liefert nur Dateien aus. **Einen Endpunkt,
den man mit `fetch` abruft und der JSON zurückgibt, kann es deshalb nicht geben** –
gerechnet wird im Browser, und ein `fetch` führt kein JavaScript aus. Wer einen
echten HTTP-Endpunkt braucht, bräuchte etwas, das Code ausführt, etwa einen
Cloudflare Worker, der `rechnen.js` importiert.

Ohne zusätzliche Infrastruktur tragen vier Wege. Pages sendet
`access-control-allow-origin: *`, Cross-Origin funktioniert also.

**Modul importieren** – im Browser, in Deno und in Bun. Node lehnt `https://` als
Modulquelle ohne Weiteres ab; dort legt man die beiden Dateien ins eigene
Projekt. `rechnen.js` importiert `daten.js`, eine einzelne Datei zu holen reicht
also nicht.

```js
const { berechneAlles } = await import('https://rorar.github.io/klein-rechner/js/rechnen.js?v=21');

berechneAlles({
  artikelpreisCent: 4500,
  versandKleinanzeigenCent: 299,
  versandDirektCent: 519,
  paketstation: true,
  vergleich: true,
  zahlweg: 'ueberweisung'
});
```

**Per Skript-Tag** steht dasselbe unter `window.kleinRechner` bereit.

**Als eingebettete Seite**

```js
rahmen.contentWindow.postMessage({ typ: 'klein-rechner:rechne', eingabe: { … } }, '*');
window.addEventListener('message', e => {
  if (e.data?.typ === 'klein-rechner:ergebnis') console.log(e.data.ergebnis);
});
```

Die Antwort geht an den fragenden Ursprung zurück, nicht an `'*'`. Eine
einbettende Seite mit undurchsichtigem Ursprung – etwa aus `file://` oder einem
`sandbox`-iframe ohne `allow-same-origin` – bekommt deshalb keine Antwort.

**Von Hand** über den Knopf „Als JSON kopieren“ oder `?format=json` in der Adresse.

### Das Format

```json
{
  "fassung": 1,
  "waehrung": "EUR",
  "stand": "2026-09-23",
  "eingabe": { "artikelpreisCent": 4500, "versandKleinanzeigenCent": 299, "paketstation": true, "vergleich": true, "versandDirektCent": 519, "zahlweg": "ueberweisung", "gebuehrTraeger": null },
  "kleinanzeigen": { "artikelCent": 4500, "versandCent": 299, "gebuehrCent": 253, "kaeuferZahltCent": 5052, "verkaeuferBehaeltCent": 4500, "kaeuferschutz": true },
  "direkt": { "zahlweg": "ueberweisung", "artikelCent": 4500, "versandCent": 519, "gebuehrCent": 0, "kaeuferZahltCent": 5019, "verkaeuferBehaeltCent": 4500, "kaeuferschutz": false },
  "breakeven": { "kaeuferAbCent": 3789, "verkaeufer": "gleich" },
  "guenstigerFuerKaeufer": "direkt",
  "differenzKaeuferCent": 33,
  "hinweis": "Richtwerte ohne Gewähr. Kein Angebot der Kleinanzeigen GmbH."
}
```

Beträge ausschließlich als ganze Cent; die Aufbereitung gehört dem Aufrufer.
`breakeven.kaeuferAbCent` und `breakeven.verkaeufer` tragen entweder eine Zahl
oder `"immer"`, `"nie"` beziehungsweise `"gleich"`. Ohne eingeschalteten Vergleich
entfallen `direkt`, `breakeven` und die beiden Vergleichsfelder. Ungültige
Eingaben liefern `{ "fehler": "…" }` statt einer Ausnahme. `fassung` steigt,
sobald sich die Bedeutung eines Feldes ändert.

## Aufstellung als Bild

„Als Bild speichern“ zeichnet den Beleg auf ein Canvas und lädt ihn als PNG
herunter. In der Fußzeile stehen das GitHub-Zeichen mit der Repo-Adresse und
darunter die Adresse der Seite selbst, damit ein weitergereichtes Bild zurück
zum Rechner führt. Auf Geräten, deren Browser
Dateien weiterreichen kann, erscheint zusätzlich „Bild teilen“ und übergibt das
PNG an die Teilen-Funktion des Systems. Beides kommt ohne Bibliothek aus.

## Annahmen

* Die 4,5 % beziehen sich auf den Artikelpreis, nicht auf Artikelpreis plus Versand.
* Die Versandarten im Auswahlfeld sind Richtwerte vom September 2026 und jederzeit
  überschreibbar – das Feld nimmt auch freie Beträge an. Die 2,99 € laufen über
  Hermes und stehen so in Anzeigen mit Kleinanzeigen-Versand; die Preise je
  Paketgröße zeigt erst der Kaufvorgang. Diese Versandart setzt den Haken für
  die Paketstation, jede andere nimmt ihn zurück – der Haken gehört zur
  Versandart, lässt sich danach aber von Hand ändern. Steht er, taucht die
  Zustellung in der Aufstellung, in allen drei Texten, im Bild und in der
  Adresse auf.
* Maßgeblich ist immer, was die Kleinanzeigen-App beim Kauf anzeigt.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Struktur der Seite |
| `styles.css` | Gestaltung, Beleg-Optik |
| `js/daten.js` | **Alle Preise, Gebührensätze und Bezeichnungen.** Wer Werte pflegt, fasst nur diese Datei an |
| `js/rechnen.js` | Die Formeln: Gebührenmodelle, Schwellensuche, JSON – ohne DOM, damit prüfbar und importierbar |
| `js/texte.js` | Textbausteine, einzeln und im Vergleich |
| `js/beleg-bild.js` | Der Beleg als PNG, ein- oder zweispaltig |
| `js/ui.js` | Verdrahtung: Eingaben, Combobox, Knöpfe, Adresse |
| `test/` | `npm test` – Rechenkerne ohne Browser |
| `fonts/` | Schriften im Repo, damit keine Besucher-IP an Google geht |

Kein Build-Schritt, keine Abhängigkeiten. Lokal ansehen:

```sh
npm start        # python3 -m http.server 8765
npm test         # node --test, ohne Browser
```

Dann http://localhost:8765 öffnen. Über `file://` läuft die Seite nicht: ES-Module
brauchen HTTP. Auch die Kopierfunktion will HTTPS oder localhost.

Die Versionsangabe hängt an den Import-Adressen (`./rechnen.js?v=21`). Ohne sie
könnte ein Browser ein frisches `ui.js` mit einem veralteten `rechnen.js` mischen.
Beim Ändern alle Vorkommen gemeinsam hochzählen:

```sh
alt=21; neu=22
sed -i "s/?v=$alt/?v=$neu/g" index.html js/*.js test/*.js README.md
```

## Rechtliches

Privates Hilfsprojekt, kein Angebot von und nicht verbunden mit der Kleinanzeigen
GmbH. Alle Angaben ohne Gewähr.

Der eigene Code steht unter der MIT-Lizenz, siehe [LICENSE](LICENSE). Die
genannten Marken, die mitgelieferten Schriften und das GitHub-Zeichen gehören
anderen und haben eigene Bedingungen – siehe [NOTICE.md](NOTICE.md).
