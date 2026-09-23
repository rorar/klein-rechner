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

Gerechnet wird in ganzen Cent, die Gebühr wird kaufmännisch auf Cent gerundet.
Beispiel: 45,00 € Artikel und 5,49 € Versand ergeben 2,53 € Gebühr und 53,02 €
Endsumme.

Der Verkäufer bekommt den Artikelpreis ausgezahlt. Die Versandkosten gehen an den
Versanddienst, die Gebühr trägt der Käufer.

## Annahmen

* Die 4,5 % beziehen sich auf den Artikelpreis, nicht auf Artikelpreis plus Versand.
* Die Versandarten im Auswahlfeld sind Richtwerte vom September 2026 und jederzeit
  überschreibbar – das Feld nimmt auch freie Beträge an.
* Maßgeblich ist immer, was die Kleinanzeigen-App beim Kauf anzeigt.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Struktur der Seite |
| `styles.css` | Gestaltung, Beleg-Optik |
| `app.js` | Rechnung in Cent, Textbausteine, Combobox, Kopierfunktion |

Kein Build-Schritt, keine Abhängigkeiten. Lokal ansehen:

```sh
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen. Die Kopierfunktion braucht HTTPS oder
localhost; über `file://` greift nur die Rückfallebene.

## Rechtliches

Privates Hilfsprojekt, kein Angebot von und nicht verbunden mit der Kleinanzeigen
GmbH. Alle Angaben ohne Gewähr.

Code unter der MIT-Lizenz, siehe [LICENSE](LICENSE).
