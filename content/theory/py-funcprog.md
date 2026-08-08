## Warum das in der Klausur zählt

Aufgabe 1a der Probeklausur lautet wörtlich: *"Nennen Sie die zwei Bedingungen, die eine Funktion erfüllen muss, um eine pure function zu sein. (2 P)"* (Probeklausur_Python_ausfuellbar.pdf, S. 1). Das sind zwei geschenkte Punkte — wenn man die Formulierung des Profs kennt. Im Überblick zur Vorlesung 3 kündigt er außerdem drei Aufgabentypen explizit an: *"(Code) Ist diese Funktion pure?"*, *"(Funktionaler Code) Schreiben Sie diesen Code imperativ"*, *"(Imperativer Code) Schreiben Sie diesen Code funktional"* (end_summary_python_26.pdf, S. 13). Genau der dritte Typ ist Aufgabe 5a der Probeklausur (5 P). Das Thema selbst ist außerdem das Fundament der Aufgaben 3, 4 und 5 — zusammen über 30 Punkte.

## Die zwei Bedingungen — wörtlich

Eine **pure function** ist eine Funktion, die

1. **nur von ihren Eingabeargumenten abhängt** und
2. **keine Nebeneffekte hat — ihr einziger Effekt ist die Rückgabe von Werten.**

(3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf, S. 10)

Bedingung 1 beschreibt der Prof auch als *"das Vermeiden der Abhängigkeit von sogenannten states (Zuständen)"*. Eine Funktion, die nur von ihren Eingabeargumenten abhängt, heißt **referentially transparent**: Man kann jeden Aufruf durch sein Ergebnis ersetzen, ohne das Programm zu ändern. Das Vorbild ist die Mathematik: Wenn dort `y = f(x)` steht, hängt `y` von nichts anderem als `x` ab, und `x` hat hinterher denselben Wert wie vorher.

## Prüfschema: "Ist diese Funktion pure?"

Gehe die Zeilen des Funktionskörpers durch und suche nach genau diesen sechs Verstößen:

| Verstoß | Beispiel im Code | Bricht Bedingung |
|---|---|---|
| liest globale/externe Daten | `return x + steuersatz` | 1 |
| `input()` | `antwort = input("weiter?")` | 1 |
| `random`, `time`, Datei-/DB-Zugriff ohne übergebenen Zustand | `random.randint(1, 6)` | 1 |
| `print()` | `print(punkte)` | 2 |
| ändert eine globale Variable | `global punkte` … | 2 |
| mutiert ein übergebenes mutable Argument | `kartenspiel.remove(karte)` | 2 |

Faustregel: **Zwei gleiche Aufrufe müssen immer denselben Wert liefern, und nach dem Aufruf muss die Welt exakt so aussehen wie vorher.**

```python
import random

steuersatz = 19
def brutto_unpure(netto):            # nicht pure: liest globale Variable
    return netto * (1 + steuersatz / 100)

def brutto_pure(netto, satz):        # pure
    return netto * (1 + satz / 100)

def wuerfeln_unpure():               # nicht pure: nicht deterministisch
    return random.randint(1, 6)

def wuerfeln_pure(seed):             # pure: gleicher seed -> gleiches Ergebnis
    return random.Random(seed).randint(1, 6), seed + 1

def erste_weg_unpure(liste):         # nicht pure: mutiert das Argument
    liste.pop(0)
    return liste

def erste_weg_pure(liste):           # pure: neues Objekt als Rückgabe
    return liste[1:]

print(brutto_pure(100, 19), wuerfeln_pure(42), wuerfeln_pure(42))
l = [1, 2, 3]
print(erste_weg_pure(l), l)          # [2, 3] [1, 2, 3] -- l ist unverändert
```

Der Trick mit dem `seed` ist genau der des Profs: `ziehe_karte(kartenspiel, seed)` gibt `(karte, seed + 1)` zurück, statt einen globalen Zufallsgenerator zu benutzen (helper-3.py).

## Vier Rezepte: unrein → rein

Das ist das Handwerkszeug für Aufgabe 5a und für jede "Schreiben Sie diesen Code funktional"-Frage.

1. **`print` durch eine String-Rückgabe ersetzen.** Der Prof macht das im Goofspiel: `spielstand_ausgeben` druckt in `helper.py` und *returned* in `helper-2.py`. Alle Nebeneffekte werden am Ende zu **einem einzigen** `print` im Hauptprogramm gesammelt.
2. **Mutation durch Neubau ersetzen.** Statt `liste.remove(karte)` schreibt er `entferne_karte(kartenspiel, karte)` mit `return kartenspiel[:i] + kartenspiel[i+1:]` — und wechselt den Typ von `list` auf `tuple`, damit Mutation gar nicht mehr möglich ist (pythonvorlesung_06.ipynb).
3. **Globale Variablen in einen `state` packen.** Alles, was der Spielverlauf braucht, kommt in ein Dictionary; jede Runde bekommt den alten state als Argument und gibt einen neuen zurück (goofspiel26-3.py).
4. **Schleife durch Rekursion oder `map`/`filter`/`reduce` ersetzen.** Damit verschwindet die letzte Mutation — die Akkumulator-Variable.

```python
punkte = 0                                   # imperativ, mit Nebeneffekt
def runde_unpure(wurf):
    global punkte
    punkte += wurf
    print("Stand:", punkte)

def runde_pure(state, wurf):                 # funktional: state rein, state raus
    return {"punkte": state["punkte"] + wurf,
            "doku": state["doku"] + "Wurf {}, Stand {}\n".format(wurf, state["punkte"] + wurf)}

state = {"punkte": 0, "doku": ""}
for w in (3, 5):                             # nur zur Demonstration
    state = runde_pure(state, w)
print(state["doku"], end="")                 # einziger Nebeneffekt
```

## Vorteile funktionaler Programmierung

Diese Liste ist eine klassische Kurzfrage (3_mutable_variables…_26.pdf, S. 13–16):

1. **Einfacheres Finden von Fehlern.** Ist `y = meine_pure_function(x)` falsch, steckt der Fehler in genau dieser Funktion. Bei Nebeneffekten muss man jede globale Variable und jede vorher aufgerufene Funktion mitprüfen.
2. **Gefahrloses Wiederverwenden** von Funktionen — sie hängen von nichts ab, was zufällig nicht passt.
3. **Parallelisierbarkeit.** `y = f(x)` und `z = f(x)` dürfen gleichzeitig laufen.
4. **Teilweise kompakterer/kürzerer Code.**
5. **Memoisation** — Rückgabewerte dürfen zwischengespeichert werden, weil sie sich nie ändern.
6. **Lazy Evaluation** — Auswertung erst, wenn das Ergebnis gebraucht wird (`map` rechnet erst bei `list(...)`).

## Charakteristika und Paradigmen

Charakteristisch für funktionale Programmierung sind laut Vorlesung: **pure functions**, **higher order functions** (Funktionen, die Funktionen als Eingabe bekommen und/oder zurückgeben), **immutable Datenstrukturen**, **anonyme Funktionen**, **Rekursion**, **Funktionen auf Iteratoren** (`map`, `filter`, `reduce`) und **Currying** (S. 12). Wichtig: *"Eine ganz formale Definition von Funktionaler Programmierung gibt es nicht. Das Vermeiden von Nebeneffekten und Abhängigkeiten von states sind die Grundpfeiler."*

Die vier Paradigmen: **prozedural** (C, Pascal), **deklarativ** (Prolog, SQL), **objektorientiert** (Java, C++), **funktional** (Haskell, ML). Und der Merksatz, den der Prof wörtlich auf die Folie schreibt: **"Python ist eine hybride und keine funktionale Sprache."** (OFP -- Einleitung_SoSe26.pdf, S. 19)

## lambda-Ausdrücke

`lambda x1, x2, …: aus Eingaben bestimmter Rückgabewert` — eine anonyme Funktion in einer Zeile, ohne `def`. Es gibt **kein `return`** und **nur einen Ausdruck**, keine Anweisungen.

```python
addition = lambda a, b: a + b
subtraktion = lambda a, b: a - b
multiplikation = lambda a, b: a * b
ist_gerade = lambda x: x % 2 == 0

liste = [addition, subtraktion, multiplikation]
op = liste[2]                                  # Funktionen in Listen speichern
print(op(3, 4), ist_gerade(4), ist_gerade(7))  # 12 True False

def hold_at(schwelle):                         # higher order function
    return lambda rundensumme: rundensumme < schwelle
print(hold_at(20)(15), hold_at(20)(25))        # True False
```

Hauptzweck von `lambda`: kurze Funktionen für `map`, `filter`, `reduce`, `sorted(key=…)` und als Strategie-Objekte in Spielen (`neues_spiel.py` des Profs baut genau so seine Würfelstrategien).

## Typische Fehler

- **Nur eine der zwei Bedingungen nennen.** In Aufgabe 1a gibt es 1 Punkt pro Bedingung — beide hinschreiben, "keine Nebeneffekte" **und** "hängt nur von den Eingabeargumenten ab".
- **`print` für harmlos halten.** Eine Funktion mit `print` ist nicht pure, auch wenn sie sonst nichts anstellt.
- **Denken, "nicht pure" sei ein Fehler.** Ein Programm ohne jeden Nebeneffekt zeigt nichts an. Ziel ist, die Logik von den Nebeneffekten zu **trennen** und diese an einer Stelle zu sammeln.
- **`return` im `lambda` schreiben.** `lambda x: return x+1` ist ein Syntaxfehler.
- **Mutation im `lambda` versuchen.** `lambda l: l.append(1)` gibt `None` zurück — richtig wäre `lambda l: l + [1]`.
- **"Rekursion und map/filter/reduce" mit "funktional" gleichsetzen.** Das sind Werkzeuge; Grundpfeiler sind pure functions und Immutabilität.
- **Python für eine funktionale Sprache halten.** Sie ist hybrid — das fragt der Prof gern als Ankreuzfrage.

## Merksätze

- Pure = hängt **nur** von den Argumenten ab **und** hat **keine** Nebeneffekte.
- Gleiche Eingabe → gleiche Ausgabe, und die Welt bleibt unverändert.
- Nebeneffekte nicht abschaffen, sondern an genau eine Stelle verschieben.
- `lambda` hat einen Ausdruck und kein `return`.
- Python ist eine hybride, keine funktionale Sprache.
