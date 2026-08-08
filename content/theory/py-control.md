## Warum das in der Klausur zählt

Kontrollstrukturen sind das Rückgrat jedes Programms — und in der Klausur der Ort, an dem Flüchtigkeitsfehler Punkte kosten. In der Zusammenfassungs-Vorlesung stehen dazu zwei typische Formate direkt nebeneinander: „Vervollständigen sie die beiden Lücken so, dass alle ohne Rest durch 3 teilbaren Zahlen kleiner als 100 ausgegeben werden" und „Ein Kollege von Ihnen hat den folgenden Code geschrieben und sie um Hilfe bei der Fehlersuche gebeten. Was ist hier falsch implementiert? Was gibt der Code im Beispiel aus?" (end_summary_python_26.pdf, S. 7). Die Übungsempfehlung des Profs für die Klausur lautet ausdrücklich, kleine Spiele zu programmieren — Kniffel-Light, Mäxchen, Galgenmännchen, Runterzählen von 101 — und die bestehen praktisch nur aus `if`, `while` und `for` (end_summary_python_26.pdf, S. 16–17). Wer hier sicher ist, kann sich in Aufgabe 4 und 5 auf Rekursion und map/filter/reduce konzentrieren, statt an der Schleifenlogik hängen zu bleiben.

## if, elif, else — und die Einrückung

`if` führt den eingerückten Block nur aus, wenn die Bedingung `True` ist. `elif` wird **nur geprüft**, wenn alle vorherigen Bedingungen `False` waren, `else` greift, wenn keine zutraf. Entscheidend ist: **Einrückungen sind in Python Teil des Programms** und beeinflussen die Bedeutung des Codes (1_if_else_while_26.pdf, S. 4).

```python
punkte_spieler1 = 27
punkte_spieler2 = 27
if punkte_spieler1 > punkte_spieler2:
    print("Spieler 1 hat gewonnen!")
elif punkte_spieler2 > punkte_spieler1:
    print("Spieler 2 hat gewonnen!")
else:
    print("Unentschieden!")          # -> Unentschieden!

p1, p2 = 6, 10
if p1 > p2:
    print("Spieler 1 führt")
    print("gehört noch zum if")
print("läuft IMMER")                # nicht eingerückt -> außerhalb des if

hand = []
print(3 > 0 and 3 < 5, not hand, len(hand) > 0 and hand[0] == 5)
# True True False   <- kein IndexError dank Kurzschlussauswertung
```

Die letzte Zeile zeigt die **Kurzschlussauswertung**: Weil `len(hand) > 0` schon `False` ist, wird `hand[0]` gar nicht mehr ausgewertet — sonst gäbe es einen `IndexError`.

## while-Schleifen

`while` wiederholt den eingerückten Block, solange die Bedingung `True` ist. Man muss selbst sicherstellen, dass sie irgendwann `False` wird, sonst läuft das Programm ewig. Die Python-Kurzform `while liste:` läuft, solange die Liste **nicht leer** ist — genau so ist die Runden-Schleife im Goofspiel gebaut (1_if_else_while_26.pdf, S. 17).

```python
preiskarten = [1, 2, 3, 4]
while preiskarten:                       # kurz für: while len(preiskarten) > 0
    preiskarte = preiskarten.pop()       # nimmt das LETZTE Element und entfernt es
    print("Preiskarte:", preiskarte, "| Rest:", preiskarten)
print("Keine Karten mehr.")

korrektes_passwort = "geheim123"
eingaben = ["banane", "apfel", "geheim123"]   # in echt: input("Gib das Passwort ein: ")
zähler = 0
noch_nicht_erraten = True
while noch_nicht_erraten and zähler < 3:     # zwei Abbruchgründe!
    eingabe = eingaben[zähler]
    zähler += 1
    if eingabe == korrektes_passwort:
        noch_nicht_erraten = False
        print("Zugang gewährt!")
    else:
        print("Falsch! Noch {} Versuche.".format(3 - zähler))
if noch_nicht_erraten:
    print("Zugang verweigert.")
```

Das zweite Beispiel ist die Passwort-Aufgabe aus den Beispielaufgaben (Beispielaufgaben_VL0_undVL1.pdf, Aufgabe 6). Die boolesche Steuervariable `noch_nicht_erraten` ist genau das Muster, das der Prof dort vorschlägt.

## for, range, enumerate, break, continue

```python
for zahl in range(0, 100, 3):        # Start 0, Ende 100 (exklusiv), Schrittweite 3
    if zahl > 12:
        break                        # verlässt die Schleife komplett
    print(zahl, end=" ")             # 0 3 6 9 12
print()
for i in range(10, 0, -2):
    print(i, end=" ")                # 10 8 6 4 2   <- rückwärts
print()
hand = [3, 7, 11]
for index, karte in enumerate(hand):          # Paare (index, wert)
    print("Position {} -> Karte {}".format(index, karte))
summe = 0
for k in hand:
    if k == 7:
        continue                     # springt zur nächsten Runde
    summe += k
print("Summe ohne die 7:", summe)    # 14
```

Verschachtelte Schleifen braucht man für Tabellen und Paarungen. Das Beispiel des Profs ist die Spielregel-Tabelle von Stein-Schere-Papier-Echse-Spock (1_installation_variablen_anweisungen_26.pdf, S. 22):

```python
symbols = ["scissors", "paper", "rock", "lizzard", "spock"]
verbs = ["cuts", "gets crushed by", "decapitates", "gets smashed by",
         "covers", "gets eaten by", "disproves",
         "crushes", "gets vaporized by",
         "poisons"]
counter = 0
for i in range(len(symbols)):
    for j in range(len(symbols)):
        if i < j:                    # jedes Paar nur einmal, keine Selbstpaarung
            print(symbols[i], verbs[counter], symbols[j])
            counter = counter + 1
```

| Befehl | Bedeutung |
|---|---|
| `if` / `elif` / `else` | Fallunterscheidung; `elif` wird nur bei vorherigem `False` geprüft |
| `== != > < >= <=` | Vergleichsoperatoren, liefern `True`/`False` |
| `and` / `or` / `not` | logische Verknüpfung mit Kurzschlussauswertung |
| `while bedingung:` | wiederholt, solange die Bedingung `True` ist |
| `while liste:` | läuft, solange die Liste nicht leer ist |
| `for x in objekt:` | über Listen, Strings, Tupel, `range`, dicts … |
| `range(a, b, c)` | Start, Ende (**exklusiv**), Schrittweite; `range(n)` = `0…n-1` |
| `enumerate(liste)` | liefert Paare `(index, wert)` |
| `break` / `continue` | Schleife verlassen / nächste Runde beginnen |

## Typische Fehler

- **Endindex bei `range` mitgezählt.** `range(1, 10)` endet bei `9`. Wer bis 10 zählen will, braucht `range(1, 11)`.
- **Endlosschleife.** In `while zahl <= n:` den Zähler `zahl += 1` vergessen — das Programm hängt. In der eKlausur ein sicherer Punktverlust.
- **`elif` durch mehrere `if` ersetzt.** Bei drei separaten `if` werden alle geprüft; wenn ein früherer Block Variablen ändert, greifen mehrere Zweige.
- **Falsche Einrückung.** Eine Zeile zu weit links steht außerhalb der Schleife und läuft nur einmal — das ist das Standardmotiv der Fehlersuch-Aufgaben.
- **Liste während der `for`-Schleife verändern.** `for k in hand: hand.remove(k)` überspringt Elemente. Über eine Kopie iterieren oder eine neue Liste bauen.
- **`=` statt `==` in der Bedingung.** `if x = 3:` ist in Python ein `SyntaxError` — anders als in C oder Java, wo es still kompiliert.
- **`break` und `continue` verwechselt.** `break` beendet die Schleife, `continue` überspringt nur den Rest des aktuellen Durchlaufs.

## Merksätze

- **Einrückung ist Syntax, nicht Kosmetik** — sie entscheidet, was zum Block gehört.
- **`range(a, b, c)`: `a` ist dabei, `b` nie.**
- **Jede `while`-Schleife braucht einen Grund zu enden** — meist ein Zähler oder eine boolesche Steuervariable.
- **`while liste:` heißt „solange noch Karten da sind"** — genau das Muster aus dem Goofspiel.
- **`enumerate`, wenn du Index *und* Wert brauchst** — nicht `range(len(...))` mit Handindizierung.
