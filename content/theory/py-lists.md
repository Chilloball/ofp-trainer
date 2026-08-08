## Warum das in der Klausur zählt

Hier liegt der direkteste Punktehebel der ganzen Python-Klausur. Aufgabe 1b der Probeklausur lautet wörtlich: „Ordnen Sie die folgenden Python-Typen in mutable und immutable ein: int, list, tuple, dict, string, set, float, bool" (2 P). Aufgabe 2e ist ein Tupel-Beispiel: `t = (1, 2)`, `t = t + (3,)` in einer Funktion — hier muss man erklären, warum das äußere `t` unverändert bleibt. Und in den Beispielfragen des Profs steht die Antwort im Klartext: „Da der Datentyp *tuple* immutable ist, kann *karten* nicht *in place* verändert (geshuffled) werden" (ofp_beispielfragen_mit_antworten.pdf, S. 1). Dazu kommt die Zusammenfassungsfrage „Für welches der t1, t2, t3 wäre ein Aufruf der Form `t1[2] = 0` ohne Fehler möglich? Woran liegt dies?" (end_summary_python_26.pdf, S. 12). Wer die Tabelle mutable/immutable im Schlaf kann, holt sich diese Punkte geschenkt.

## Listen — die mutable Arbeitspferde

Listen stehen in eckigen Klammern, dürfen Elemente unterschiedlicher Typen enthalten und sind **veränderbar (mutable)** (1_if_else_while_26.pdf, S. 13).

```python
meine_liste = [5, "hallo", 6.3, True, None]   # gemischte Typen erlaubt
karten = [1, 2, 3, 4, 5]
karten.append(6)          # hängt hinten an          -> [1,2,3,4,5,6]
karten.insert(0, 0)       # fügt an Index 0 ein      -> [0,1,2,3,4,5,6]
karten.remove(3)          # löscht den WERT 3 (erstes Vorkommen)
oberste = karten.pop()    # letztes Element zurück UND löschen
zweite = karten.pop(1)    # per Index
print(karten, oberste, zweite, len(karten))   # [0, 2, 4, 5] 6 1 4
print(karten[1:3], karten[-1], meine_liste[1], type(meine_liste[2]))
# [2, 4] 5 hallo <class 'float'>
verschachtelt = [[1, 2], [3, 4]]
print(verschachtelt[1][0])                    # 3
```

`pop()` ohne Argument nimmt **immer das letzte Element** — deshalb funktioniert im Goofspiel „einmal mischen, dann immer die oberste Karte ziehen" (1_if_else_while_26.pdf, S. 15). Indizierung und Slicing arbeiten genau wie bei Strings.

## Tupel — dasselbe in immutable

Tupel stehen in runden Klammern und sind **unveränderbar**. Ein Ein-Element-Tupel braucht ein Komma, sonst ist `(3)` nur die eingeklammerte Zahl 3. Addition zweier Tupel erzeugt ein **neues** Tupel — das ist keine Mutation, sondern genau das, was funktionale Programmierung will.

```python
import random
karten = (1, 2, 3)
einzel = (3,)                        # Komma nötig!
print(type((3)), type(einzel))       # <class 'int'> <class 'tuple'>
neue_karten = karten + (4,)          # NEUES Tupel
print(karten, neue_karten)           # (1, 2, 3) (1, 2, 3, 4)
try:
    random.shuffle(karten)           # mischt IN PLACE -> nur für mutable
except TypeError as fehler:
    print("Fehler:", fehler)         # 'tuple' object does not support item assignment
print(random.Random(42).sample(karten, 3))    # [3, 1, 2] -> neue Liste, kein Problem
```

Im funktionalen Goofspiel des Profs ist das Kartenspiel deshalb ein Tupel, und eine Karte wird über `kartenspiel[:i] + kartenspiel[i+1:]` „entfernt" — durch Neubau statt Mutation (helper-3.py).

## Dictionaries und Mengen

Ein Dictionary ordnet Schlüsseln Werte zu, ist mutable und der zentrale Baustein des funktionalen Stils: Der **state** eines Spiels ist bei Möller ein Dictionary, und alle states zusammen sind ein Tupel (4_func_programming_and_recursion_26.pdf, S. 11).

```python
state = {"runde": 1, "punkte_spieler1": 0, "punkte_spieler2": 0}
state["punkte_spieler1"] = state["punkte_spieler1"] + 7    # Mutation (imperativ)
print(state["punkte_spieler1"], "runde" in state, list(state.keys()))
# 7 True ['runde', 'punkte_spieler1', 'punkte_spieler2']

# funktionaler Stil: NEUES dict statt Mutation
neuer_state = {**state, "runde": state["runde"] + 1, "punkte_spieler2": 5}
print(state)        # {'runde': 1, 'punkte_spieler1': 7, 'punkte_spieler2': 0}
print(neuer_state)  # {'runde': 2, 'punkte_spieler1': 7, 'punkte_spieler2': 5}

for schlüssel, wert in neuer_state.items():
    print(schlüssel, "->", wert)

gespielte = {3, 7, 3, 11}            # set: Duplikate verschwinden
gespielte.add(7)
print(sorted(gespielte), len(gespielte), 7 in gespielte)   # [3, 7, 11] 3 True
```

## Die Tabelle, die sitzen muss

| Typ | mutable? | typische Befehle |
|---|---|---|
| `list` | **mutable** | `append`, `insert`, `remove`, `pop`, `[i] = x`, Slicing |
| `dict` | **mutable** | `d[k]`, `d[k] = v`, `.keys()`, `.values()`, `.items()`, `{**d, k: v}` |
| `set` | **mutable** | `add`, `remove`, `in`, keine Duplikate |
| eigene Klassen | **mutable** | Attribute zuweisen |
| `int`, `float`, `bool` | immutable | Rechnen erzeugt neue Werte |
| `str` | immutable | `.replace`, `.upper` geben neue Strings zurück |
| `tuple` | immutable | `t1 + t2`, Slicing, `.index(x)` |

| `random`-Befehl | Wirkung |
|---|---|
| `random.shuffle(liste)` | mischt **in place**, gibt `None` zurück — nur für mutable |
| `random.sample(objekt, k)` | liefert eine **neue** Liste, geht auch für Tupel |
| `random.choice(objekt)` | ein zufälliges Element |
| `random.randint(a, b)` | ganze Zahl, **`b` inklusive** |
| `random.Random(seed)` | eigener Zufallsgenerator, reproduzierbar |

## Typische Fehler

- **`remove(3)` als „Index 3 löschen" gelesen.** `remove` sucht den **Wert**, `pop(3)` nimmt den **Index**. Kommt der Wert nicht vor, gibt es einen `ValueError`.
- **`random.shuffle` auf einem Tupel oder String.** Klassiker aus den Beispielfragen: `TypeError`, weil in place gemischt wird. Lösung: `random.sample`.
- **Rückgabewert von `shuffle`/`append`/`sort` gespeichert.** `karten = karten.append(6)` setzt `karten` auf `None` — diese Methoden ändern in place und geben nichts zurück.
- **Ein-Element-Tupel ohne Komma.** `(3)` ist ein `int`, erst `(3,)` ist ein Tupel.
- **`liste2 = liste1` für eine Kopie gehalten.** Beide Namen zeigen auf **dasselbe** Objekt; Änderungen sind überall sichtbar. Eine echte Kopie liefert `liste1[:]`, `list(liste1)` oder `copy`.
- **`randint(1, 6)` für „1 bis 5" gehalten.** Anders als bei `range` ist die obere Grenze **inklusive**.
- **Zugriff auf einen fehlenden Schlüssel.** `d["x"]` wirft `KeyError`; sicherer sind `d.get("x")` oder `if "x" in d:`.

## Merksätze

- **`list`, `dict`, `set` und eigene Klassen sind mutable — `int`, `float`, `bool`, `str`, `tuple` sind immutable.**
- **`t1 + t2` erzeugt ein neues Tupel** und mutiert nichts — deshalb liebt funktionale Programmierung Tupel.
- **`pop()` gibt zurück *und* löscht**, ohne Argument immer das letzte Element.
- **In-place-Methoden geben `None` zurück** — niemals ihr Ergebnis zuweisen.
- **Ein state ist ein dict, die Historie ein Tupel von states** — so baut Möller das Goofspiel funktional um.
