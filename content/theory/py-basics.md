## Warum das in der Klausur zählt

Dieses Kapitel wirkt harmlos, liefert aber die Punkte, die man am ärgerlichsten verschenkt. In den Beispielfragen des Profs gibt es genau eine Aufgabe, in der `x = input(...)` eingelesen und danach `2*x` ausgegeben wird — die richtige Antwort ist `3.33.3`, weil `input` einen String liefert und `*2` einen String verdoppelt statt zu rechnen (ofp_beispielfragen_mit_antworten.pdf, S. 1). In der Zusammenfassungs-Vorlesung steht dazu die Multiple-Choice-Frage „Was passiert hier? a) Es gibt einen Fehler b) Es wird `<class 'int'>` ausgegeben c) Es wird `<class 'float'>` ausgegeben" (end_summary_python_26.pdf, S. 5) — dort geht es um `type(4/2)`. Und in Probeklausur-Aufgabe 2d (`n = n + 1` in einer Funktion) hängt alles daran, dass `int` **immutable** ist. Wer die Regeln dieses Kapitels sicher beherrscht, verliert in den Kurzfragen und in der Code-Analyse keinen Punkt.

## print und input — und die Falle mit dem Datentyp

`print` gibt auf der Konsole aus und trennt mehrere Argumente automatisch mit einem Leerzeichen. `input(prompt)` zeigt den Text an und gibt zurück, was der Benutzer getippt hat — **immer als `str`**, auch wenn es wie eine Zahl aussieht.

```python
kilo_text = input("Wie schwer ist das Paket in Kilogramm? ")   # Eingabe: 3.5
print("Eingabe:", kilo_text, "| Typ:", type(kilo_text))        # <class 'str'>
print(2 * kilo_text)                                           # 3.53.5  <- String verdoppelt!
print(2 * float(kilo_text))                                    # 7.0     <- jetzt wird gerechnet
print(float(kilo_text) * 2.99)                                 # 10.465
```

Merke: Wer rechnen will, muss umwandeln — `int(input(...))` oder `float(input(...))`.

## Variablen: Namen für Speicherplätze

Eine Variable ist ein **Name für einen Ort im Speicher**, an dem Daten liegen (1_installation_variablen_anweisungen_26.pdf, S. 17). Das `=` ist der **Zuweisungsoperator**, nicht das mathematische Gleichheitszeichen: Erst wird die rechte Seite ausgewertet, dann landet das Ergebnis links. Deshalb ist `x = x + 1` sinnvoller Code, obwohl es als Gleichung Unsinn wäre. Python ist **dynamisch typisiert** (Java: statisch): Der Typ steht nicht in der Deklaration und darf sich sogar ändern. Beide Sprachen sind **case-sensitive**.

```python
punkte_spieler1 = 0
punkte_spieler1 = punkte_spieler1 + 7   # rechts auswerten, links zuweisen
print(punkte_spieler1, type(punkte_spieler1))   # 7 <class 'int'>

punkte_spieler1 = "null"                # Typwechsel erlaubt
print(punkte_spieler1, type(punkte_spieler1))   # null <class 'str'>

Punkte = 99                             # andere Variable als punkte_spieler1!
print(punkte_spieler1, Punkte)          # null 99
```

Namenskonvention des Profs: `snake_case`, sprechende Namen (`punkte_spieler1`, `number_of_people`), keine Namen wie `aA` oder `Aaaa`.

## Zahlen und Operatoren

Es gibt drei vorimplementierte Zahlentypen: `int` (ganze Zahlen), `float` (IEEE 754 double precision) und `complex`. Dazu kommen `bool` (`True`/`False`) und `NoneType` (nur `None`, oft zur Initialisierung).

| Operator | Bedeutung | Beispiel | Resultat |
|---|---|---|---|
| `+ - *` | Grundrechenarten | `3*2` | `6` |
| `/` | Division, Ergebnis **immer** `float` | `4/2` | `2.0` |
| `//` | ganzzahlige Division, **rundet immer ab** | `-13//2` | `-7` |
| `%` | Modulo (Rest) | `5%3` | `2` |
| `**` | Potenz | `3**2` | `9` |
| `+=` `-=` `*=` `//=` `**=` | Kurzform für `a = a (op) b` | `a += 1` | — |
| `int() float() complex() str()` | Typumwandlung | `int("42")` | `42` |
| `type(x)` | Typ abfragen | `type(4/2)` | `<class 'float'>` |

```python
karten = 13
print(karten / 2, type(karten / 2))      # 6.5 <class 'float'>
print(karten // 2, -13 // 2, karten % 2, 2 ** 10)   # 6 -7 1 1024
print(0.1 + 0.2, 0.1 + 0.2 == 0.3)       # 0.30000000000000004 False
punkte = 0
punkte += 5
punkte **= 2
print(punkte)                            # 25
```

Zwei Details, die gerne geprüft werden: `//` rundet **Richtung minus unendlich** ab, deshalb ist `-13//2` gleich `-7` und nicht `-6`. Und Floats haben nur endliche Präzision — `0.1 + 0.2 == 0.3` ist `False`.

## Umwandeln, Wahrheitswerte und None

```python
alter_text = "42"
print(int(alter_text) + 1, str(9) + " Punkte", int(3.99))
# 43 9 Punkte 3          -> int() schneidet ab, rundet NICHT
print(bool(0), bool(""), bool([]), bool(3))    # False False False True
ergebnis = None
print(ergebnis, type(ergebnis))                # None <class 'NoneType'>
```

`0`, `""`, `[]`, `{}` und `None` gelten als „falsch" — das ist der Grund, warum `while liste:` läuft, solange die Liste nicht leer ist.

## Ausdruck vs. Anweisung, Kommentare

Ein **Ausdruck** (expression) liefert einen Wert, z. B. `2+5` oder `input(...)`. Eine **Anweisung** (statement) wird ausgeführt, z. B. eine Zuweisung oder ein Funktionsaufruf. Kommentare beginnen mit `#`; für Blockkommentare nutzt man `""" ... """` — formal ein mehrzeiliger String, der keiner Variablen zugeordnet wird und daher folgenlos bleibt (2_functions_and_comments_26.pdf, S. 11).

## Typische Fehler

- **`input`-Rückgabe nicht umgewandelt.** `zahl = input(...)` und dann `zahl + 1` → `TypeError`, `zahl * 2` verdoppelt still den String. Beides klassische Klausurfallen.
- **`/` mit `//` verwechselt.** `13/2` ist `6.5`, `13//2` ist `6`. Und `4/2` ist `2.0` (float), nicht `2`.
- **`-13//2` als `-6` geraten.** Abrunden heißt „Richtung minus unendlich", also `-7`.
- **`int(3.99)` für gerundet gehalten.** `int()` schneidet die Nachkommastellen ab; runden macht `round()`.
- **Floats exakt vergleichen.** `0.1 + 0.2 == 0.3` ist `False`. Bei Geldbeträgen oder Messwerten nie auf Gleichheit prüfen.
- **String und Zahl mit `+` verbinden.** `"Punkte: " + 7` wirft einen `TypeError`; korrekt ist `"Punkte: " + str(7)` oder `print("Punkte:", 7)`.
- **Groß-/Kleinschreibung.** `Punkte` und `punkte` sind zwei verschiedene Variablen; ein Tippfehler erzeugt still eine neue Variable statt eines Fehlers.

## Merksätze

- **`input` liefert immer einen String** — ohne `int()`/`float()` wird nicht gerechnet, sondern wiederholt.
- **`/` liefert immer `float`, `//` rundet immer ab** — auch bei negativen Zahlen.
- **`=` ist keine Gleichung**: erst rechts auswerten, dann links zuweisen.
- **Python ist dynamisch typisiert, aber nicht typenlos** — `"7" + 7` bleibt ein Fehler.
- **Floats sind Näherungen**, `int`/`str`/`bool`/`tuple` sind immutable — das ist die Brücke zu Klausuraufgabe 2.
