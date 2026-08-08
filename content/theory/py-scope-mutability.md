## Warum das in der Klausur zählt

Aufgabe 2 der Probeklausur ist genau dieses Thema: fünf kleine Programme, je 2 Punkte, **10 Punkte insgesamt** — "Geben Sie an, was auf der Kommandozeile ausgegeben wird oder ob ein Fehler auftritt. Begründen Sie Ihre Antwort jeweils in einem Satz." (Probeklausur_Python_ausfuellbar.pdf, S. 2). Dazu kommt Aufgabe 1b (2 P): "Ordnen Sie die folgenden Python-Typen in mutable und immutable ein". In den Beispielfragen des Profs taucht dasselbe Thema als *"Wieso wirft der folgende Code einen Fehler?"* auf — Antwort dort: `random.shuffle` auf ein `tuple` (ofp_beispielfragen_mit_antworten.pdf, S. 1). Und im Überblick fragt er: *"Für welches der t1, t2, t3 wäre ein Aufruf der Form `t1[2] = 0` ohne Fehler möglich? Woran liegt dies?"* (end_summary_python_26.pdf, S. 12).

Zusammen sind das rund 14 der 49 Punkte. Wer die Checkliste unten mechanisch abarbeitet, macht hier keinen Fehler mehr.

## Das mentale Modell: Namen sind Etiketten

In Python ist eine Variable **kein Kasten mit Inhalt**, sondern ein *Name*, der an ein *Objekt* gebunden ist. `=` bindet den Namen neu — es verändert nie das alte Objekt. Methoden wie `.append()` oder eine Index-Zuweisung `x[0] = …` verändern dagegen das Objekt selbst, während der Name bleibt.

```python
a = [1, 2, 3]
b = a                 # kein Kopieren: zweites Etikett auf demselben Objekt
b.append(4)           # verändert DAS OBJEKT
print(a, a is b)      # [1, 2, 3, 4] True
b = [9]               # bindet nur den NAMEN b neu
print(a, b, a is b)   # [1, 2, 3, 4] [9] False
```

## Die Tabelle, die man auswendig können muss

| immutable (unveränderbar) | mutable (veränderbar) |
|---|---|
| `int`, `float`, `bool`, `complex` | `list` |
| `str` | `dict` |
| `tuple` | `set` |
| `frozenset`, `bytes` | selbstgeschriebene Klassen |

(3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf, S. 4)

Immutable heißt: **jede "Änderung" erzeugt ein neues Objekt.** `s = s + "!"` baut einen neuen String; der alte bleibt unangetastet. Deshalb schlägt jeder Versuch fehl, ein immutable Objekt an Ort und Stelle ("in place") zu ändern:

```python
s = "hallo"
try:
    s[0] = "H"
except TypeError as e:
    print("TypeError:", e)      # 'str' object does not support item assignment

t = (1, 2, 3)
try:
    t[2] = 0
except TypeError as e:
    print("TypeError:", e)      # 'tuple' object does not support item assignment

print(s.upper(), s)             # HALLO hallo  -> upper() gibt einen NEUEN String zurück
print(t + (4,), t)              # (1, 2, 3, 4) (1, 2, 3)  -> Addition erzeugt neues Tupel
```

Genau daran scheitert `random.shuffle(tuple(range(10)))`: `shuffle` mischt *in place* und braucht deshalb eine `list`.

## Die vier Grundfälle im Geltungsbereich

Alles, was in Aufgabe 2 vorkommt, ist eine Kombination dieser vier Fälle (3_mutable_variables…_26.pdf, S. 5–9):

```python
zahl = 1
liste = [1]

def lesen():                 # 1) LESEN: geht immer
    print("gelesen:", zahl, liste)

def mutieren():              # 2) MUTIEREN eines mutable Objekts: wirkt nach außen
    liste[0] = 5
    liste.append(7)

def zuweisen():              # 3) ZUWEISEN: erzeugt eine NEUE LOKALE Variable
    zahl = 5
    liste = [99]
    print("lokal:", zahl, liste)

def global_machen():         # 4) global: erweitert den Geltungsbereich
    global zahl
    zahl = zahl * 2

lesen();  mutieren();  zuweisen();  global_machen()
print("global:", zahl, liste)    # global: 2 [5, 7]
```

Der gefährlichste Fall ist Nummer 3 in Kombination mit einem Lesezugriff: Sobald irgendwo im Funktionskörper eine Zuweisung an den Namen steht, gilt der Name für die **gesamte** Funktion als lokal — auch in den Zeilen davor.

```python
n = 1
def k():
    n = n + 1        # n ist lokal (wegen der Zuweisung), aber noch ohne Wert
    return n
try:
    print(k())
except UnboundLocalError as e:
    print("UnboundLocalError:", e)
```

Dasselbe passiert bei `n += 1`, bei `liste += [4]` (auch bei Listen! `+=` ist eine Zuweisung) und bei `for zahl in …`, weil auch die Schleifenvariable zugewiesen wird.

## Die Checkliste: jede "Was wird ausgegeben?"-Aufgabe systematisch lösen

Arbeite pro Codeschnipsel und pro Name diese Fragen **in dieser Reihenfolge** ab:

**Frage 1 — Steht `global name` in der Funktion?**
Ja → alle Zuweisungen wirken auf die globale Variable. Fertig, Fall geklärt.

**Frage 2 — Kommt im Funktionskörper irgendwo eine Zuweisung an den Namen vor?**
Zuweisung heißt: `name = …`, `name += …`, `for name in …`, `def name`, Parameter der Funktion.
- **Ja** → der Name ist in dieser Funktion **lokal**, in jeder Zeile.
  - Wird er *vor* der Zuweisung gelesen? → **UnboundLocalError**.
  - Sonst: Es entsteht eine neue lokale Variable; die globale bleibt **unverändert**.
- **Nein** → weiter zu Frage 3.

**Frage 3 — Wird das Objekt in place verändert?**
In-place-Operationen sind: `x[i] = …`, `x[i:j] = …`, `del x[i]`, `.append`, `.extend`, `.insert`, `.remove`, `.pop`, `.sort`, `.reverse`, `.clear`, `.update`, `.add`, `random.shuffle(x)`.
- **Nein** (nur Lesen, `+`, Slicing, `.upper()`, `sorted()`) → nichts ändert sich draußen.
- **Ja** → weiter zu Frage 4.

**Frage 4 — Ist der Typ mutable?**
- `list`, `dict`, `set`, eigene Klasse → die Änderung **wirkt nach außen** (auch ohne `return` und ohne `global`).
- `int`, `float`, `bool`, `str`, `tuple` → **TypeError**.

**Frage 5 — Bei Funktionsargumenten:** Der Parametername ist immer lokal. Ein `parameter = …` im Rumpf bindet nur um und ändert draußen nichts; ein `parameter.append(…)` ändert das übergebene Objekt.

## Die fünf Probeklausur-Fälle im Schnelldurchlauf

```python
liste = [1, 2, 3]                      # a)
def f(): liste[0] = liste[0] + 10      # F2 nein -> F3 ja -> F4 mutable
f(); print(liste)                      # [11, 2, 3]

a = [1]                                # b)
def g():
    a = [5]                            # F2 ja -> neue lokale Liste
    a.append(7)                        # mutiert nur die lokale
g(); print(a)                          # [1]

x = 3                                  # c)
def h():
    global x                           # F1 ja
    x = x * 2
h(); print(x)                          # 6

t = (1, 2)                             # e)
def m(t):
    t = t + (3,)                       # neues Tupel, nur lokal gebunden
    return t
s = m(t); print(t, s)                  # (1, 2) (1, 2, 3)
```

Fall d) ist der `UnboundLocalError` von oben.

## Aliasing und copy

```python
original = [1, 2, 3]
alias = original                 # dasselbe Objekt
kopie = original.copy()          # oder original[:] bzw. list(original)
original.append(4)
print(alias, kopie)              # [1, 2, 3, 4] [1, 2, 3]

verschachtelt = [[1, 2], [3]]
flach = verschachtelt.copy()     # FLACHE Kopie: innere Listen sind geteilt!
flach[0].append(99)
print(verschachtelt)             # [[1, 2, 99], [3]]

import copy
tief = copy.deepcopy(verschachtelt)
tief[0].append(0)
print(verschachtelt[0])          # [1, 2, 99] -- unverändert
```

Merke die typische Prüfungsformulierung: *"Wie könnte man `copy` benutzen, um Änderungen der Eingabe zu vermeiden?"* (Beispielaufgaben_VL3.pdf, Aufgabe 2). Antwort: gleich in der ersten Zeile der Funktion mit `liste2 = liste.copy()` arbeiten und `liste2` zurückgeben — genau so macht es der Prof in `runde_ungerade_zahlen_auf` (zusammenfassung.ipynb).

## Die Falle mit mutable Default-Argumenten

```python
def sammle(x, bisher=[]):        # Default wird EINMAL bei der Definition erzeugt
    bisher.append(x)
    return bisher

print(sammle(1))                 # [1]
print(sammle(2))                 # [1, 2]  -- Überraschung!

def sammle_gut(x, bisher=None):
    bisher = [] if bisher is None else bisher
    return bisher + [x]          # gibt eine NEUE Liste zurück -> pure
print(sammle_gut(1), sammle_gut(2))   # [1] [2]
```

Der Prof stolpert im Vorlesungsnotebook selbst darüber und ruft seine Fibonacci-Funktion deshalb mit `fibbonaci(liste=[], bis_wohin=300)` auf (pythonvorlesung_06.ipynb).

## Typische Fehler

- **`.append()` mit `+` verwechseln.** `liste.append(x)` gibt `None` zurück und mutiert; `liste + [x]` gibt eine neue Liste zurück und mutiert nicht. `l = l.append(x)` setzt `l` auf `None`.
- **`+=` für harmlos halten.** `n += 1` und `liste += [4]` sind Zuweisungen → ohne `global` lokal → häufig `UnboundLocalError`.
- **Aus "die Funktion hat kein `return`" schließen, sie tue nichts.** Bei mutable Argumenten ist genau das der Nebeneffekt (der Prof zeigt das an `mischen(kartenspiel)`).
- **Denken, `b = a.copy()` schütze verschachtelte Listen.** Eine flache Kopie kopiert nur die äußere Ebene.
- **`global` mit "Variable existiert überall" verwechseln.** Lesen geht immer *ohne* `global`; `global` braucht man ausschließlich zum **Zuweisen**.
- **`sort()` und `sorted()` vertauschen.** `liste.sort()` mutiert und gibt `None`; `sorted(liste)` gibt eine neue Liste zurück.
- **Ein Tupel für vollständig unveränderbar halten.** `t = ([1], 2)` ist immutable, aber `t[0].append(9)` funktioniert — unveränderbar sind nur die Bindungen im Tupel.

## Merksätze

- Zuweisung bindet den **Namen** neu, Mutation ändert das **Objekt**.
- Eine Zuweisung irgendwo im Funktionskörper macht den Namen in der **ganzen** Funktion lokal.
- Lesen braucht kein `global`, Zuweisen schon.
- Mutable Objekte ändern sich auch ohne `return` nach außen — das ist der klassische Nebeneffekt.
- Bei "Was wird ausgegeben?" nie raten: Frage 1 `global`? Frage 2 Zuweisung? Frage 3 in place? Frage 4 mutable?
