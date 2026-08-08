## Warum das in der Klausur zählt

Strings sind das Werkzeug, mit dem in der Klausur fast jede Aufgabe formuliert ist. Die Beispielaufgabe zur ersten Vorlesung ist ein reiner Slicing-Test: Aus dem Ticketcode `250415-123-N` (Format `JJMMTT-SSS-K`) sollen Datum, Sitznummer und Kategorie herausgeschnitten werden (Beispielaufgaben_VL0_undVL1.pdf, Aufgabe 3). In der Zusammenfassung steht die Lückenaufgabe „Füllen sie die Lücke so, dass die Häufigkeit vom in `wort` gespeicherten String im String `text` gezählt und die Anzahl zurückgegeben wird" — also `.count` (end_summary_python_26.pdf, S. 4). In Probeklausur-Aufgabe 4a soll man `umkehren("hallo")` → `"ollah"` **rekursiv** schreiben, und in Aufgabe 5a taucht `name.upper()` in einem map/filter/reduce-Ausdruck auf. Ohne sicheres String-Handwerk verliert man dort Punkte, obwohl man das eigentliche Konzept verstanden hat.

## Erzeugen, Verbinden, Wiederholen

Strings sind beliebige Aneinanderreihungen von Zeichen und lassen sich mit einfachen, doppelten oder dreifach-doppelten Anführungszeichen erzeugen (1_strings_26.pdf, S. 2). Dreifache Anführungszeichen erlauben mehrere Zeilen — praktisch, wenn im String selbst `'` oder `"` vorkommen sollen.

```python
name = "Michael"
gruss = 'Hallo'
mehrzeilig = """Zeile 1
Zeile 2"""
print(gruss + ", " + name + "!")      # Hallo, Michael!   -> + konkateniert
print("-" * 20, len(name))            # -------------------- 7
print(mehrzeilig)
print("Karte\tWert\nAss\t11")         # \t Tabulator, \n neue Zeile
```

## Slicing `[a:b:c]`

Slicing ist das am häufigsten geprüfte String-Werkzeug. Drei Regeln reichen: Die Indizierung beginnt bei **0**, die obere Grenze `b` ist **ausgeschlossen**, und der dritte Wert `c` ist die **Schrittweite**. Negative Indizes zählen von hinten, `-1` ist das letzte Zeichen.

```python
ticket = "250415-123-N"
jahr, monat, tag = ticket[0:2], ticket[2:4], ticket[4:6]
sitz = ticket[7:10]
kategorie = ticket[-1]
print("Film am {}.{}.20{}, Sitz {}, Kategorie: {}".format(tag, monat, jahr, sitz, kategorie))
# Film am 15.04.2025, Sitz 123, Kategorie: N
print(ticket[:6], ticket[7:], ticket[::-1], ticket[::3])
# 250415 123-N N-321-514052 24-3
```

`ticket[:6]` heißt „von Anfang bis Index 6 (ausgeschlossen)", `ticket[7:]` heißt „ab Index 7 bis zum Ende", und `ticket[::-1]` mit Schrittweite `-1` kehrt den String um.

## Strings sind immutable

Ein String kann nach dem Erzeugen **nicht mehr verändert** werden. Jede „Änderung" erzeugt in Wahrheit einen neuen String. Genau das prüft der Prof gern als Fehlerfrage.

```python
wort = "hallo"
neu = "H" + wort[1:]        # neuen String bauen -- das ist der Weg
print(wort, neu)            # hallo Hallo
try:
    wort[0] = "H"           # verboten!
except TypeError as fehler:
    print("Fehler:", fehler)   # 'str' object does not support item assignment
```

Aus demselben Grund gibt `.replace()` einen **neuen** String zurück und ändert das Original nicht — wer das Ergebnis nicht speichert, hat nichts erreicht.

## Methoden und Formatierung

| Befehl | Wirkung | Beispiel → Resultat |
|---|---|---|
| `len(s)` | Anzahl der Zeichen | `len("Michael")` → `7` |
| `s[a:b:c]` | Slicing | `"abcdef"[1:5:2]` → `'bd'` |
| `s.split(z)` | zerlegt in eine **Liste**; ohne Argument an Whitespace | `"a,b".split(",")` → `['a','b']` |
| `s.count(z)` | zählt Vorkommen | `"aab".count("a")` → `2` |
| `s.replace(z, s2)` | gibt **neuen** String zurück | `"aa".replace("a","b")` → `'bb'` |
| `s.find(z)` | Index des ersten Vorkommens, sonst **`-1`** | `"abc".find("x")` → `-1` |
| `s.upper()`, `s.lower()`, `s.strip()` | Groß/klein, Leerzeichen entfernen | `" a ".strip()` → `'a'` |
| `"{}".format(x)` | Platzhalter füllen, auch benannt `{name}` | `"{}!".format(3)` → `'3!'` |
| `str(x)`, `int(s)`, `float(s)` | Typumwandlung | `str(11)` → `'11'` |
| `==`, `!=` | vergleichen die **Inhalte** | `"abc" == "abc"` → `True` |

```python
satz = "Wenn Fliegen hinter Fliegen fliegen, fliegen Fliegen Fliegen nach."
print(satz.count("Fliegen"))                                 # 4  -> case-sensitive!
print(satz.replace("Fliegen", "fliegen").count("fliegen"))   # 6
print(satz.find("hinter"), satz.find("Mücken"))             # 13 -1
wörter = satz.split(" ")
print(wörter[1], len(wörter), type(wörter))               # Fliegen 9 <class 'list'>
print("   spieler 1  ".strip().upper())                      # SPIELER 1
print("{name} hat {p} Punkte".format(name="Spieler 1", p=27))
print("abc" == "abc", "abc" != "ABC")                        # True True
print(int("42") + 1, str(11) + " Punkte")                    # 43 11 Punkte
```

Das Beispiel mit den Fliegen stammt direkt aus der Vorlesung (pythonvorlesung_02.ipynb) und zeigt die Falle: `.count` unterscheidet Groß- und Kleinschreibung, deshalb liefert der erste Aufruf `4` und erst nach `.replace` kommt man auf `6`.

## Typische Fehler

- **Ergebnis von `.replace()` / `.upper()` nicht zugewiesen.** `satz.replace("a","b")` allein ändert `satz` nicht — Strings sind immutable.
- **Obere Slicing-Grenze mitgezählt.** `s[0:3]` liefert drei Zeichen (Index 0, 1, 2), nicht vier.
- **`.find()` mit „nicht gefunden = 0" verwechselt.** Bei Misserfolg kommt `-1`; ein `if s.find(x):` ist deshalb fast immer falsch, `if s.find(x) != -1:` ist richtig.
- **String und Zahl mit `+` verbunden.** `"Punkte: " + 27` wirft `TypeError`; korrekt ist `str(27)` oder `.format(27)`.
- **`split` liefert eine Liste, keinen String.** Auf `satz.split(" ")` kann man nicht `.upper()` anwenden, wohl aber auf ein einzelnes Element.
- **Groß-/Kleinschreibung bei `count`, `find` und `==` vergessen.** `"Hallo" == "hallo"` ist `False`.
- **Negative Indizes bei Slices vertauscht.** `s[-3:]` sind die letzten drei Zeichen, `s[:-3]` ist alles **ohne** die letzten drei.

## Merksätze

- **Index ab 0, Endindex nie dabei** — `s[a:b]` enthält `b` nicht.
- **`s[::-1]` dreht um**, `s[::2]` nimmt jedes zweite Zeichen.
- **Strings sind immutable**: jede String-Methode gibt einen neuen String zurück, das Original bleibt.
- **`.find` liefert `-1`, wenn nichts gefunden wird** — nicht `0` und keine Exception.
- **`.split` macht aus einem String eine Liste** und ist damit die Brücke zum nächsten Kapitel.
