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

## Verlinkbare Rechnungen

Der Text zum Verschicken steht in drei Fassungen bereit: Du-Form, Sie-Form und
eine ohne Anrede an die Person, die auch passt, solange zwischen Käufer und
Verkäufer noch nicht geklärt ist, wie man sich anspricht.

Beide Felder lassen sich über die Adresse vorbelegen:

```
https://rorar.github.io/klein-rechner/?preis=45,00&versand=5,49
https://rorar.github.io/klein-rechner/?preis=12.34
https://rorar.github.io/klein-rechner/?preis=30,00&versand=2,99&paketstation=1
```

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
| `app.js` | Rechnung in Cent, Textbausteine, Combobox, Kopierfunktion |
| `fonts/` | Schriften im Repo, damit keine Besucher-IP an Google geht |

Kein Build-Schritt, keine Abhängigkeiten. Lokal ansehen:

```sh
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen. Die Kopierfunktion braucht HTTPS oder
localhost; über `file://` greift nur die Rückfallebene.

## Rechtliches

Privates Hilfsprojekt, kein Angebot von und nicht verbunden mit der Kleinanzeigen
GmbH. Alle Angaben ohne Gewähr.

Der eigene Code steht unter der MIT-Lizenz, siehe [LICENSE](LICENSE). Die
genannten Marken, die mitgelieferten Schriften und das GitHub-Zeichen gehören
anderen und haben eigene Bedingungen – siehe [NOTICE.md](NOTICE.md).
