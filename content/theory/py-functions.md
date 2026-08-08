## Warum das in der Klausur zählt

Funktionen sind das Fundament, auf dem der komplette funktionale Teil der Klausur steht. Die Zusammenfassung stellt dazu die Aufgabe „Schreiben sie eine Beispielfunktion mit mindestens einem positional und einem keyword Argument. Ihre Funktion soll mit einem docstring beginnen und als Rückgabe nur das positional Argument liefern" (end_summary_python_26.pdf, S. 10). Eine Folie weiter kommen die Lückenaufgaben zu higher order functions: „Füllen sie Lücke 1 so aus, dass die Rechenoperation auf x und y angewendet wird … Schreiben sie eine Funktion, die eine Funktion als Rückgabewert liefert" (S. 11). Genau dieses Muster taucht in Probeklausur-Aufgabe 4c wieder auf: `wiederhole(f, x, abbruch)` nimmt zwei Funktionen entgegen. Und Aufgabe 5b (Currying) besteht darin, aus `potenz(basis, exponent)` per `lambda` eine neue Funktion `quadrat` zu bauen. Ohne den Unterschied zwischen „Funktion übergeben" und „Funktion aufrufen" ist keine dieser Aufgaben lösbar.

## Definition, return und Docstring

`def name(argumente):` startet eine Funktion; alles Eingerückte gehört dazu. Ohne `return` liefert die Funktion `None`. Der **Docstring** ist der erste String im Rumpf und wird von `help(name)` angezeigt (2_functions_and_comments_26.pdf, S. 5–8).

```python
def neues_kartenspiel(n=13):
    """
    Erstellt ein neues Kartenspiel als Liste mit den Zahlen 1 bis n.
    Eingabe: Integer n
    Ausgabe: Liste mit Integern von 1 bis n
    """
    return list(range(1, n + 1))

def spielstand_ausgeben(ps1, ps2):
    print("Spieler 1 hat", ps1, "Punkte. Spieler 2 hat", ps2, "Punkte!")

print(neues_kartenspiel(5))            # [1, 2, 3, 4, 5]
rückgabe = spielstand_ausgeben(3, 8)
print(rückgabe)                       # None -- kein return im Rumpf
print(neues_kartenspiel.__doc__.strip().split("\n")[0])
```

Kommentare mit `#` sollen die **Logik** erklären, nicht den Code wiederholen. Der Prof zeigt dafür ausdrücklich ein „schlecht/besser"-Beispiel (2_functions_and_comments_26.pdf, S. 10).

## Argumente: positional, keyword, `*args`, `**kwargs`

Bei **positional arguments** zählt die Reihenfolge. Wer einem Argument in der Definition einen Default-Wert gibt, macht es zum **keyword argument**: Es darf beim Aufruf weggelassen oder über seinen Namen in beliebiger Reihenfolge gesetzt werden.

```python
def division(nenner, zähler=1.0):
    return zähler / nenner

print(division(2, 4.084))                 # 2.042  -> positional, Reihenfolge zählt
print(division(zähler=4.084, nenner=2))  # 2.042  -> keyword, Reihenfolge egal
print(division(2))                        # 0.5    -> Default greift

def erstelle_bericht(*werte, **optionen):
    print(type(werte), werte)             # <class 'tuple'> (3, 5, 7, 2, 9)
    print(type(optionen), optionen)       # <class 'dict'> {'mittelwert': True, ...}
    if optionen.get("mittelwert"):
        print("Mittelwert:", sum(werte) / len(werte))   # 5.2
    if optionen.get("anzahl"):
        print("Anzahl:", len(werte))                    # 5

erstelle_bericht(3, 5, 7, 2, 9, mittelwert=True, anzahl=True)
```

`*args` sammelt beliebig viele positionale Argumente in einem **Tupel**, `**kwargs` beliebig viele Keyword-Argumente in einem **Dictionary**. Genau so ist die Statistik-Aufgabe aus den Beispielaufgaben gebaut (Beispielaufgaben_VL3.pdf, Aufgabe 1).

**Type Hints** dokumentieren erwartete Typen, haben aber **keinen Einfluss auf die Ausführung** (2_functions_and_comments_26.pdf, S. 14):

```python
a: int = 3.1415                 # kein Fehler, obwohl float!
def verdopple(x: int) -> int:
    return x * 2
print(a, verdopple("ha"))       # 3.1415 haha
```

## Funktionen als Werte und higher order functions

Funktionen sind in Python normale Objekte und lassen sich in Variablen speichern. Der Unterschied ist eine Klammer: **ohne** Klammern übergibt man die Funktion selbst, **mit** Klammern ruft man sie auf und übergibt das Ergebnis.

```python
def spiele_den_wert_der_preiskarte(hand, preiskarte):
    return preiskarte

strategie = spiele_den_wert_der_preiskarte   # OHNE Klammern: Funktion selbst
print(strategie([1, 2, 3], 7))               # MIT Klammern: Aufruf -> 7

def auf_jedes_element(funktion, liste):
    """Wendet funktion auf jedes Element von liste an (higher order function)."""
    ergebnis = []
    for element in liste:
        ergebnis.append(funktion(element))
    return ergebnis

print(auf_jedes_element(lambda x: x * x, [0, 1, 2, 3]))   # [0, 1, 4, 9]

def erzeuge_addierer(n):                     # gibt eine FUNKTION zurück
    return lambda x: x + n

plus_drei = erzeuge_addierer(3)
print(plus_drei(10))                         # 13
```

Eine **higher order function** ist eine Funktion, die Funktionen als Argument nimmt **oder** zurückgibt. Beide Richtungen kommen vor: `auf_jedes_element` nimmt eine, `erzeuge_addierer` gibt eine zurück. Im Goofspiel des Profs sind die Spielstrategien genau so austauschbar gemacht — `strategie_spieler1(karten_spieler1, preiskarte)` (goofspiel26-2.py).

## Module und Namespaces

| Schreibweise | Wirkung |
|---|---|
| `import random` | Zugriff nur über den Namespace: `random.shuffle(...)` |
| `from math import sqrt` | direkter Zugriff: `sqrt(81)`, kein Namespace |
| `import random as zufall` | eigener Namespace-Name: `zufall.choice(...)` |
| `import unterordner.datei` | Datei aus einem Unterordner, getrennt mit `.` |
| `help("modules")` | zeigt alle verfügbaren Module |

```python
import random
from math import sqrt
import random as zufall
print(random.Random(1).randint(1, 6))                       # 2
print(sqrt(81))                                             # 9.0
print(zufall.Random(2).choice(["Stein", "Schere", "Papier"]))   # Stein
```

Eigene Dateien lassen sich genauso importieren — die Datei muss im selben Ordner wie das ausgeführte Skript liegen oder im `PYTHONPATH` (2_functions_and_comments_26.pdf, S. 20). So nutzt der Prof `import helper` und ruft dann `helper.neues_kartenspiel()` auf.

## Typische Fehler

- **Funktion mit Klammern übergeben.** `auf_jedes_element(quadriere(), liste)` ruft `quadriere` sofort auf. Richtig ist `auf_jedes_element(quadriere, liste)`.
- **`return` vergessen.** Eine Funktion, die nur `print` macht, liefert `None`; `ergebnis = f(x)` ist dann `None` und jede Weiterrechnung scheitert.
- **`return` innerhalb der Schleife.** Ein `return` beendet die Funktion sofort — im Schleifenrumpf platziert, wird nur der erste Durchlauf ausgewertet.
- **Positional nach keyword im Aufruf.** `f(nenner=2, 4.084)` ist ein `SyntaxError`; benannte Argumente stehen immer hinten.
- **Mutable Default-Werte.** `def f(liste=[])` teilt dieselbe Liste über alle Aufrufe hinweg — ein berüchtigter Seiteneffekt. Besser `def f(liste=None)`.
- **Type Hints für Typprüfung gehalten.** `a: int = 3.1415` läuft fehlerfrei durch; Hints sind reine Dokumentation.
- **`from modul import *` und Namenskollisionen.** Wer `import random` und `from random import choice` mischt, verliert schnell den Überblick, welche Funktion gerade gemeint ist.

## Merksätze

- **Ohne `return` gibt eine Funktion `None` zurück** — auch wenn sie fleißig gedruckt hat.
- **Klammer = Aufruf, keine Klammer = die Funktion selbst.** Das ist der ganze Trick bei higher order functions.
- **`*args` ist ein Tupel, `**kwargs` ist ein Dictionary.**
- **Type Hints sind Kommentare mit Syntax** — sie ändern die Ausführung nicht.
- **`import modul` bringt einen Namespace mit, `from modul import f` nicht.**
