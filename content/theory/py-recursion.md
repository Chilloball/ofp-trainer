## Warum das in der Klausur zählt

Aufgabe 4 der Probeklausur ist die **punktstärkste Aufgabe des Python-Teils: 12 Punkte**, mit der Vorgabe *"Verwenden Sie in dieser Aufgabe keine Schleifen, sondern ausschließlich Rekursion"* — String umkehren (4 P), verschachtelte Liste aufsummieren (5 P), rekursive higher order function `wiederhole(f, x, abbruch)` (3 P) (Probeklausur_Python_ausfuellbar.pdf, S. 4). Dazu Aufgabe 1c (2 P): *"Worauf muss bei jeder rekursiven Funktion zwingend geachtet werden, und was passiert intern bei rekursiven Aufrufen (Stichwort: welche Struktur entsteht)?"* In den Beispielfragen kommt Rekursion als Lückentext: `tuple_with_floats_only` mit vier Lücken (ofp_beispielfragen_mit_antworten.pdf, S. 5). Und im Überblick: *"Schreiben sie eine rekursive pure Funktion `summiere_gerade_zahlen`"* (end_summary_python_26.pdf, S. 14).

14 Punkte hängen direkt daran — und `map`/`filter`/`reduce`-Aufgaben werden leichter, wenn man rekursiv denken kann.

## Das Grundgerüst: zwei Zutaten, immer dieselben

Jede rekursive Funktion besteht aus **Basisfall** (Abbruchbedingung) und **Rekursionsschritt** (Selbstaufruf auf einem *kleineren* Problem). *"Wichtig ist, dass bei der Rekursion stets auf eine geeignete Abbruchbedingung geachtet wird, damit die Rekursion immer terminiert!"* (4_func_programming_and_recursion_26.pdf, S. 6)

```python
def faelle_baum(dicke):              # das Bild aus der Vorlesung
    if dicke <= 0:                   # Basisfall
        return "Baum fällt!"
    else:                            # Rekursionsschritt: Problem wird kleiner
        return "Hack! " + faelle_baum(dicke - 1)

def fakultaet_schleife(x):
    resultat = 1
    for i in range(1, x + 1):
        resultat = resultat * i
    return resultat

def fakultaet(x):
    if x <= 0:
        return 1
    return x * fakultaet(x - 1)

print(faelle_baum(3))
print(fakultaet_schleife(5), fakultaet(5))   # 120 120
```

## Der Stack — die Antwort auf Aufgabe 1c

Bei jedem Aufruf legt Python einen neuen Eintrag auf den **Stack (Stapel)** von Funktionsaufrufen: mit den lokalen Variablen und der Stelle, an der weitergerechnet wird. Erst wenn der Basisfall erreicht ist, wird der Stapel von oben nach unten abgearbeitet (4_func_programming_and_recursion_26.pdf, S. 7). `fakultaet(4)` baut also `4 * (3 * (2 * (1 * 1)))` auf und rechnet es rückwärts aus. Ohne Abbruchbedingung wächst der Stapel unbegrenzt → `RecursionError` (Python bricht bei ca. 1000 Ebenen ab).

**Musterantwort:** *Es muss eine geeignete Abbruchbedingung (Basisfall) geben, damit die Rekursion terminiert; intern entsteht ein Stack von Funktionsaufrufen, der anschließend abgearbeitet wird.*

Wenn eine Aufgabe nach dem Ablauf fragt, hilft ein Protokoll in zwei Spalten — hinunter bis zum Basisfall, dann wieder hinauf:

```text
umkehren("abc")  ->  umkehren("bc") + "a"        |  "cba"
  umkehren("bc") ->  umkehren("c")  + "b"        |  "cb"
    umkehren("c")->  umkehren("")   + "c"        |  "c"
      umkehren("") ->  ""            (Basisfall) |  ""
```

## Die vier Fragen, mit denen man jede Aufgabe löst

1. **Was ist der kleinste Fall, den ich sofort beantworten kann?** Meist: leere Sequenz → `0`, `""`, `()`, `[]`; oder `n <= 0` → `1`.
2. **Wie mache ich das Problem in genau einem Schritt kleiner?** Fast immer `seq[1:]` (ein Element weg) oder `n - 1`.
3. **Wie setze ich das Gesamtergebnis aus dem ersten Element und dem Teilergebnis zusammen?** `seq[0] + rek(seq[1:])`, `rek(seq[1:]) + seq[0]`, `(seq[0],) + rek(seq[1:])` …
4. **Terminiert es auf jedem Pfad?** Wird das Argument in *jedem* `return` mit Selbstaufruf echt kleiner?

## Mustersammlung — die sechs Gerüste

### Muster 1 — Zähler runterzählen

Für Zahlenprobleme: Fakultät, Potenz, ggT, Quersumme, Summe 1..n.

```python
def potenz(basis, exponent):
    if exponent == 0:
        return 1
    return basis * potenz(basis, exponent - 1)

def quersumme(n):
    if n < 10:
        return n
    return n % 10 + quersumme(n // 10)

def ggt(a, b):
    if b == 0:
        return a
    return ggt(b, a % b)

print(potenz(2, 10), quersumme(4711), ggt(48, 18))   # 1024 13 6
```

### Muster 2 — Kopf + Rest einer Sequenz

Das mit Abstand wichtigste Muster: `seq[0]` verarbeiten, Rekursion auf `seq[1:]`. Funktioniert identisch für `list`, `tuple` und `str`.

```python
def summe(zahlen):
    if len(zahlen) == 0:                  # oder: if not zahlen
        return 0
    return zahlen[0] + summe(zahlen[1:])

def maximum(zahlen):
    if len(zahlen) == 1:                  # Basisfall: ein Element
        return zahlen[0]
    rest = maximum(zahlen[1:])
    return zahlen[0] if zahlen[0] > rest else rest

def umkehren(text):                       # Probeklausur 4a
    if text == "":
        return ""
    return umkehren(text[1:]) + text[0]

def ist_palindrom(text):
    if len(text) < 2:
        return True
    return text[0] == text[-1] and ist_palindrom(text[1:-1])

print(summe((1, 2, 3, 4)), maximum([3, 9, 2]), umkehren("hallo"), ist_palindrom("reliefpfeiler"))
```

### Muster 3 — Filternde Rekursion: neue Sequenz aufbauen

Drei Zweige: Basisfall, "Element behalten", "Element überspringen". Genau die Struktur der Beispielfrage `tuple_with_floats_only`.

```python
def tuple_with_floats_only(tup):
    if tup:
        if type(tup[0]) == float:                      # Lücke 1
            return (tup[0],) + tuple_with_floats_only(tup[1:])   # Lücke 2
        else:
            return tuple_with_floats_only(tup[1:])     # Lücke 3
    else:
        return ()                                      # Lücke 4

def summiere_gerade_zahlen(liste):
    if not liste:
        return 0
    if liste[0] % 2 == 0:
        return liste[0] + summiere_gerade_zahlen(liste[1:])
    return summiere_gerade_zahlen(liste[1:])

print(tuple_with_floats_only((12, 'hello', 53.9, True, range(12), 3.1415)))
print(summiere_gerade_zahlen([1, 2, 3, 4]))            # 6
```

Beachte `(tup[0],)` — das Komma macht daraus ein Ein-Element-Tupel; ohne Komma ist es nur eine Klammer.

### Muster 4 — Verschachtelte Struktur mit `isinstance`

Zwei Rekursionsaufrufe: einer in die Tiefe, einer in die Breite. Das ist Probeklausur 4b (5 P).

```python
def verschachtelte_summe(liste):
    if not liste:
        return 0
    kopf = liste[0]
    if isinstance(kopf, list):
        return verschachtelte_summe(kopf) + verschachtelte_summe(liste[1:])
    return kopf + verschachtelte_summe(liste[1:])

print(verschachtelte_summe([1, 2, [3, 4], [5, [6]], 7]))   # 28
```

### Muster 5 — Akkumulator als Zusatzparameter mit Default

Wenn man *vorwärts* rechnen oder mehrere Werte mitführen will. Der Prof nutzt das bei Fibonacci und bei `summiere_gerade_zahlen(zahlen, wie_viele_gerade_zahlen=0)` (final_lecture_examples.ipynb).

```python
def fibonacci(aktuell=1, vorheriges=0, bis_wohin=100, ergebnis=()):
    ergebnis = ergebnis + (vorheriges,)          # Tupel: immutable, kein Default-Problem
    if aktuell > bis_wohin:
        return ergebnis
    return fibonacci(aktuell + vorheriges, aktuell, bis_wohin, ergebnis)

def zaehle_gerade(zahlen, anzahl=0):
    if not zahlen:
        return anzahl
    return zaehle_gerade(zahlen[1:], anzahl + (1 if zahlen[0] % 2 == 0 else 0))

print(fibonacci(bis_wohin=20))
print(zaehle_gerade([1, 2, 3, 4, 6]))            # 3
```

**Wichtig:** als Default niemals `liste=[]` verwenden — mutable Defaults werden nur einmal erzeugt und über Aufrufe hinweg geteilt. `()` oder `None` sind sicher.

### Muster 6 — Rekursive higher order function und das `states`-Muster

Die Rekursion bekommt Funktionen als Argumente. Das ist Probeklausur 4c und gleichzeitig das Gerüst, mit dem der Prof das ganze Goofspiel rekursiv macht.

```python
def wiederhole(f, x, abbruch):                   # Probeklausur 4c
    if abbruch(x):
        return x
    return wiederhole(f, f(x), abbruch)

def spiel_rekursiv(abbruchbedingung, spielrunde, states):   # helper-3.py
    if abbruchbedingung(states):
        return states
    return spiel_rekursiv(abbruchbedingung, spielrunde, states + (spielrunde(states),))

def naechste_runde(state):
    return {"runde": state["runde"] + 1, "punkte": state["punkte"] + state["runde"]}

anfang = ({"runde": 1, "punkte": 0},)
states = spiel_rekursiv(lambda s: s[-1]["runde"] > 4,
                        lambda s: naechste_runde(s[-1]),
                        anfang)
print(wiederhole(lambda x: x * 2, 1, lambda x: x > 50))       # 64
print(tuple(map(lambda s: s["punkte"], states)))              # (0, 1, 3, 6, 10)
```

Die Kurzform, die in der Beispielfrage vorkommt, ist dasselbe ohne Hilfsfunktion: `return rungame(states + (naechsteRunde(states[-1]),))` mit dem Basisfall `else: return states`.

## Von der Schleife zur Rekursion — mechanisch

Der Prof fragt explizit: *"(Imperativer Code) Schreiben Sie diesen Code funktional … Rekursion statt Schleifen"* (end_summary_python_26.pdf, S. 13). Das geht nach festem Schema:

| imperativ | rekursiv |
|---|---|
| Akkumulator `summe = 0` vor der Schleife | Basisfall-Rückgabewert `return 0` |
| `for x in liste:` | Kopf `liste[0]` + Selbstaufruf auf `liste[1:]` |
| `summe += f(x)` | `return f(liste[0]) + rek(liste[1:])` |
| `if bedingung:` in der Schleife | zusätzlicher `if`-Zweig ohne den Kopf: `return rek(liste[1:])` |
| `while bedingung:` | `if not bedingung: return x` sonst `return rek(schritt(x))` |

## Rekursion vs. Schleife

**Vorteile:** eleganter, weniger Code, weniger Fehler, und vor allem — *"Rekursion kann oft die Mutation von Variablen verhindern und ist daher für die funktionale Programmierung sehr interessant"*. **Nachteile:** meist weniger laufzeiteffizient (Funktionsaufrufe kosten), speicherhungriger (alle Aufrufe liegen auf dem Stack) (4_func_programming_and_recursion_26.pdf, S. 8).

## Typische Fehler

- **Basisfall vergessen oder unerreichbar formuliert.** `if len(l) == 1` scheitert bei der leeren Liste; `if n == 0` scheitert bei negativem `n`. Sicherer: `if not l` bzw. `if n <= 0`.
- **`return` beim Selbstaufruf vergessen.** `rek(x-1)` statt `return rek(x-1)` liefert stillschweigend `None`.
- **Das Problem wird nicht kleiner.** `summe(zahlen)` statt `summe(zahlen[1:])` → `RecursionError`.
- **Bei Tupeln das Komma vergessen.** `(x)` ist `x`, erst `(x,)` ist ein Tupel — `tup + (tup[0])` wirft `TypeError`.
- **Trotz Verbots eine Schleife benutzen.** In Aufgabe 4 sind `for` und `while` verboten; auch List-Comprehensions sind Schleifen.
- **Mutable Default-Argumente** (`liste=[]`) als Akkumulator — der Zustand überlebt den Aufruf.
- **`isinstance(x, list)` mit `type(x) == list` verwechseln**, wenn auch Tupel vorkommen können: `isinstance(x, (list, tuple))` deckt beides ab.

## Merksätze

- Zwei Zutaten, immer: Abbruchbedingung und ein *kleineres* Teilproblem.
- Das Standardgerüst heißt `seq[0]` verrechnet mit `rek(seq[1:])`.
- Intern entsteht ein **Stack** von Aufrufen, der rückwärts abgearbeitet wird.
- Jeder rekursive Zweig braucht ein `return`.
- Für Spiele: `states + (naechste_runde(states[-1]),)` — Tupel wachsen lassen statt mutieren.
