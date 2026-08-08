## Warum das in der Klausur zählt

Aufgabe 3 der Probeklausur besteht komplett aus diesem Thema — **11 Punkte**, mit der Auflage *"Verwenden Sie in dieser Aufgabe keine for- oder while-Schleifen. Nutzen Sie lambda-Ausdrücke."*: dritte Potenzen mit `map` (2 P), `vektoraddition(v, w)` mit `map` (3 P), Wörter mit mehr als vier Buchstaben mit `filter` (3 P), Durchschnitt mit `reduce` (3 P) (Probeklausur_Python_ausfuellbar.pdf, S. 3). Aufgabe 5a (5 P) verlangt, imperativen Code *"ohne Schleife und ohne Mutation in einem einzigen Ausdruck aus map, filter und reduce"* neu zu schreiben. Aufgabe 1d (2 P) fragt: *"Was gibt `map(f, liste)` zurück — eine Liste oder etwas anderes?"* Und in den Beispielfragen steht ein Lückentext `map(--- LÜCKE 1 ---, filter(--- LÜCKE 2 ---, liste))` (ofp_beispielfragen_mit_antworten.pdf, S. 2).

Das sind **18 der 49 Punkte** — mehr als jedes andere Python-Thema.

## map

`map(f, iterable)` wendet `f` auf jedes Element an. **Die Rückgabe ist ein Iterator (ein `map`-Objekt), keine Liste!** Zum Anzeigen braucht man `list(...)`. Bekommt `f` mehrere Argumente, folgen entsprechend viele gleichlange Iterables:
`map(f, l1, …, lm) = [f(l1[0], …, lm[0]), …, f(l1[-1], …, lm[-1])]` (5_map_filter_reduce_wrapup_26.pdf, S. 6).

```python
zahlen = [1, 2, 3, 4, 5]
print(map(lambda x: x ** 3, zahlen))               # <map object at 0x...>  -> Aufgabe 1d
print(list(map(lambda x: x ** 3, zahlen)))         # [1, 8, 27, 64, 125]

def vektoraddition(v, w):                          # Probeklausur 3b
    return list(map(lambda a, b: a + b, v, w))
print(vektoraddition([1, 2], [10, 20]))            # [11, 22]

nettopreise = [10.0, 23.5, 7.99]
print(list(map(lambda p: round(p * 1.19, 2), nettopreise)))    # [11.9, 27.96, 9.51]
print(list(map(len, ["a", "bbb", "cc"])))          # 5 benannte Funktion statt lambda
```

## filter

`filter(pred, iterable)` behält genau die Elemente, für die `pred(x)` zu `True` auswertet. Rückgabe ist **ebenfalls ein Iterator** (S. 8).

```python
satz = "die schnelle braune katze springt ueber den faulen hund"
woerter = satz.split()
print(list(filter(lambda w: len(w) > 4, woerter)))          # Probeklausur 3c
print(list(filter(lambda w: w[0] in "aeiou", woerter)))     # ['über']

liste = ['hallo', 'hi', 'naaa', 'ola', 'servus', 'huhu']    # die Beispielfrage
print(list(map(lambda x: 'H' + x[1:], filter(lambda x: x[0] == 'h', liste))))
# ['Hallo', 'Hi', 'Huhu']
```

## reduce

`reduce` faltet ein Iterable von links auf **einen** Wert zusammen; die Funktion bildet dabei zwei Elemente auf eines ab:
`reduce(f, [x1, x2, …, xn]) = f(…f(f(x1, x2), x3)…, xn)` (S. 7). Der Import ist Pflicht: `from functools import reduce`. Optional gibt es einen **Startwert** als drittes Argument — der rettet auch den Fall der leeren Liste.

```python
from functools import reduce

zahlen = [4, 2, 7, 1, 9, 3, 5]
print(reduce(lambda a, b: a + b, zahlen))                    # 31  Summe
print(reduce(lambda a, b: a * b, range(1, 8)))               # 5040  = 7!
print(reduce(lambda a, b: a if a > b else b, zahlen))        # 9  Maximum ohne max()
print(reduce(lambda a, b: a + b, zahlen) / len(zahlen))      # 4.43...  Durchschnitt, Aufg. 3d
print(reduce(lambda a, b: a + " " + b, ['Python', 'ist', 'toll']))   # Python ist toll
print(reduce(lambda a, b: a + b, [], 0))                     # 0  dank Startwert
```

Ohne Startwert wirft `reduce` auf einer leeren Sequenz einen `TypeError`.

## Iteratoren — die Falle, die Punkte kostet

Iteratoren haben `__next__()` und einen internen Zählerstand; sie sind **genau einmal** durchlaufbar und rechnen **lazy**, also erst beim Materialisieren (3_mutable_variables…_26.pdf, S. 17).

```python
m = map(lambda x: x * 2, [1, 2, 3])
print(m.__next__())        # 2   -- Zähler steht jetzt auf Position 1
print(list(m))             # [4, 6]  -- der Rest
print(list(m))             # []      -- leer, der Iterator ist verbraucht!

lang = map(lambda x: x ** 2, range(10 ** 7))   # rechnet noch nichts (lazy evaluation)
print(type(lang).__name__)                      # map
```

## Die Übersetzungstabelle imperativ → funktional

| imperatives Konstrukt | funktionales Gegenstück |
|---|---|
| `ergebnis = []` + `ergebnis.append(f(x))` in der Schleife | `list(map(f, liste))` |
| `if bedingung(x):` innerhalb der Schleife | `filter(lambda x: bedingung(x), liste)` |
| Akkumulator `akku = start` + `akku = op(akku, x)` | `reduce(lambda akku, x: op(akku, x), liste, start)` |
| `summe += x` | `reduce(lambda a, b: a + b, liste)` |
| `zaehler += 1` unter einem `if` | `len(list(filter(pred, liste)))` |
| `text = text + s` (String aufbauen) | `reduce(lambda a, b: a + b, map(f, liste), "")` |
| `for i in range(len(v)):` mit `v[i]` und `w[i]` | `map(f, v, w)` |
| verschachtelte Schleife über Listen von Listen | `map` innen, `sum`/`reduce` außen |
| `break` mitten in der Schleife | passt nicht — hier Rekursion verwenden |

**Leserichtung:** Der Ausdruck `reduce(g, map(f, filter(p, liste)))` wird **von innen nach außen** gelesen: erst filtern, dann abbilden, dann falten.

## Das Rezept in vier Schritten — Aufgabe 5a durchgerechnet

Gegeben ist der imperative Code aus der Probeklausur (S. 5). Vorgehen:

1. **Was ist der Akkumulator?** `doku` — also brauche ich außen ein `reduce`.
2. **Welche `if`-Bedingung steht in der Schleife?** `len(name) > 3` — das wird ein `filter`, ganz innen.
3. **Was passiert mit jedem einzelnen Element?** `name.upper() + "\n"` — das wird ein `map`, in der Mitte.
4. **Wie werden zwei Teilergebnisse verbunden, und was ist der Startwert?** Verbinden mit `+`, Startwert `""` (wichtig, sonst scheitert die leere Liste).

```python
from functools import reduce

namen = ["anna", "ben", "christina", "dora"]

doku_imperativ = ""                               # vorher
for name in namen:
    if len(name) > 3:
        doku_imperativ = doku_imperativ + name.upper() + "\n"

doku = reduce(lambda a, b: a + b,                 # nachher: ein einziger Ausdruck
              map(lambda name: name.upper() + "\n",
                  filter(lambda name: len(name) > 3, namen)),
              "")

print(doku == doku_imperativ)                     # True
print(doku, end="")                               # ANNA / CHRISTINA / DORA
```

## Mustersammlung — die sechs Gerüste

```python
from functools import reduce
zahlen = [3, 7, 2, 8, 5, 10, 1, 6]
runden = [[3, 2, 4], [1], [6, 5, 1], [4, 3, 5, 6]]

# M1  Alles transformieren
print(list(map(lambda x: x * x, zahlen)))

# M2  Auswählen
print(list(filter(lambda x: x % 2 == 0, zahlen)))

# M3  Auf einen Wert falten
print(reduce(lambda a, b: a + b, zahlen, 0))

# M4  Der Klassiker: filtern -> abbilden -> falten
print(reduce(lambda a, b: a + b, map(lambda x: x * x, filter(lambda x: x % 2 == 0, zahlen))))

# M5  Zwei Listen parallel verrechnen
print(list(map(lambda a, b: a * b, [1, 2, 3], [10, 20, 30])))

# M6  Zählen, Maximum, Summe über verschachtelte Strukturen
print(len(list(filter(lambda r: r[-1] == 1, runden))))          # Pech-Runden: 2
print(max(map(len, runden)))                                     # längste Runde: 4
print(sum(map(len, runden)))                                     # Würfe gesamt: 11
print(sum(map(lambda r: len(list(filter(lambda w: w % 2 == 0, r))), runden)))
```

Muster M6 ist genau die Stufe B3 aus der Pig-Übung, in der drei Schleifenblöcke zu je einer Zeile werden (PushYourLuck_Aufgaben_und_Loesungen.pdf, S. 27).

## Der Ausdruck, den der Prof selbst auf die Folie schreibt

Die "besonders kompakte Version" der Goofspiel-Dokumentation kombiniert alle drei Befehle und ist die beste Vorlage für jede Transferaufgabe (5_map_filter_reduce_wrapup_26.pdf, S. 7):

```python
from functools import reduce

def spieldokumentation(states, rundendokumentation, schlussdokumentation):
    return reduce(lambda x1, x2: x1 + '\n' + x2, map(rundendokumentation, states[1:])) \
           + '\n' + schlussdokumentation(states[-1])

states = ({"runde": 0, "punkte": 0}, {"runde": 1, "punkte": 3}, {"runde": 2, "punkte": 8})
print(spieldokumentation(states,
                         lambda s: "Runde {}: {} Punkte".format(s["runde"], s["punkte"]),
                         lambda s: "Endstand: {} Punkte".format(s["punkte"])))
```

Zu erkennen sind drei Bausteine: `states[1:]` überspringt den Anfangszustand, `map` erzeugt pro Runde eine Zeile, `reduce` klebt sie mit `'\n'` zusammen. Das Zeichen `\` am Zeilenende erlaubt den Umbruch im Editor.

## Typische Fehler

- **`list(...)` vergessen.** `print(map(f, l))` gibt `<map object …>` aus. In Aufgabe 1d ist genau das die richtige Antwort — in Aufgabe 3 aber der Fehler.
- **`from functools import reduce` vergessen.** `map` und `filter` sind eingebaut, `reduce` nicht. (In der Klausur darf man laut Hinweisblatt annehmen, dass der Import erfolgt ist — hinschreiben schadet nie.)
- **Iterator zweimal benutzen.** `gerade = filter(...)`, dann `len(list(gerade))` **und** `sum(gerade)` → die zweite Auswertung sieht nichts mehr.
- **`reduce`-Lambda mit falscher Stelligkeit.** Es braucht **zwei** Parameter: `lambda a, b: …`. `lambda x: …` wirft `TypeError`.
- **`filter` und `map` vertauschen.** `filter` gibt Elemente zurück, nicht Wahrheitswerte; `map(lambda x: x > 4, l)` liefert `[False, True, …]`, nicht die gefilterte Liste.
- **Startwert vergessen.** `reduce(f, [])` ohne Startwert wirft `TypeError`; beim Aufbau von Strings ist `""` fast immer nötig.
- **Doch eine Schleife oder eine List-Comprehension benutzen.** `[f(x) for x in l]` ist eine Schleife und in Aufgabe 3 nicht erlaubt.
- **Bei `map` mit mehreren Iterables ungleiche Längen.** Es wird beim kürzesten abgebrochen — stillschweigend.

## Merksätze

- `map` und `filter` geben **Iteratoren** zurück, `reduce` gibt einen **Wert** zurück.
- Ein Iterator ist einmal durchlaufbar und rechnet erst, wenn man ihn materialisiert.
- Von innen nach außen: `filter` wählt aus, `map` formt um, `reduce` faltet zusammen.
- Jeder `if`-Block in einer Schleife ist ein `filter`, jeder Akkumulator ist ein `reduce`.
- `reduce` braucht `functools` und ein Lambda mit **zwei** Parametern.
