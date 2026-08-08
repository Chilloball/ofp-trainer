## Warum das in der Klausur zählt

Der Prof gibt in seiner Zusammenfassung eine wörtliche Anweisung: *"Wichtige Klausur-Übungstipps: Üben Sie kleine Spiele zu programmieren"* — und listet dann sechs Spiele mit vollständigen Regeln auf (end_summary_python_26.pdf, S. 16–17). Dazu kommt das Goofspiel als roter Faden der gesamten Vorlesung. Der Grund ist der Aufgabentyp, den er ankündigt: **Transfer** der Konzepte auf ein neues Problem.

In den Beispielfragen sieht das so aus: *"Erklären sie die Spielregeln des folgenden funktional implementierten Spiels. Insbesondere erklären sie a) Wie viele Spieler gibt es? b) Wann gibt es wie viele Punkte? c) Was wird am Ende ausgegeben?"* (ofp_beispielfragen_mit_antworten.pdf, S. 4). Der gezeigte Code ist genau 15 Zeilen lang und enthält `states`, Rekursion, `map` und `reduce` auf einmal. Wer das Leseschema unten beherrscht, beantwortet solche Fragen in drei Minuten.

## Das Goofspiel in fünf Stufen

Regeln: Zwei Spieler besitzen je ein Kartenspiel mit den Werten 1 bis 13. Die 13 Preiskarten werden gemischt und einzeln aufgedeckt. Beide legen verdeckt eine Karte; wer die höhere legt, bekommt den Wert der Preiskarte als Punkte, bei Gleichstand bekommt niemand etwas. Jede Karte darf nur einmal gespielt werden. Am Ende gewinnt, wer mehr Punkte hat.

Der Prof entwickelt es in fünf Stufen — **jede Stufe kann abgefragt werden**:

| Stufe | Datei | Kern |
|---|---|---|
| 1 imperativ | goofspiel26.py | `while`, globale Zähler, `liste.remove(...)` |
| 2 mit Funktionen | goofspiel26-2.py + helper.py | Logik in Funktionen, Strategien als Argumente |
| 3 pure + `state` | goofspiel26-3.py + helper-2.py | `tuple` statt `list`, `print` → String-Rückgabe, `seed` statt `random` |
| 4 Rekursion | goofspiel26-4.py + helper-3.py | `spiel_rekursiv(abbruch, runde, states)` |
| 5 map/filter/reduce | Folie 7 der VL 5 | `reduce(…, map(rundendoku, states[1:]))` |

## Das universelle Gerüst für ein funktionales Spiel

Dieses Skelett passt auf **jedes** der empfohlenen Spiele. Nur der Inhalt von `naechste_runde` und `abbruch` ändert sich.

```python
from functools import reduce
import random

anfang = ({"punkte": 101, "wurf_nr": 0, "rundenpunkte": 0, "seed": 42, "wurf": 0},)

def naechster_wurf(state):                       # pure: state rein, neuer state raus
    wurf = random.Random(state["seed"]).randint(1, 6)
    rundenpunkte = 0 if wurf == 1 else state["rundenpunkte"] + wurf
    aufhoeren = wurf == 1 or rundenpunkte >= 8   # die Strategie: "hold at 8"
    return {"punkte": state["punkte"] - (rundenpunkte if aufhoeren else 0),
            "wurf_nr": state["wurf_nr"] + 1,
            "rundenpunkte": 0 if aufhoeren else rundenpunkte,
            "seed": state["seed"] + 1,
            "wurf": wurf}

def spiel(states):                               # Rekursion statt while
    if states[-1]["punkte"] <= 0 or states[-1]["wurf_nr"] >= 8:
        return states
    return spiel(states + (naechster_wurf(states[-1]),))

states = spiel(anfang)
doku = reduce(lambda a, b: a + b,                # Nebeneffekte gesammelt: ein print
              map(lambda s: "Wurf {}: eine {} -> Runde {}, gesamt {}\n".format(
                      s["wurf_nr"], s["wurf"], s["rundenpunkte"], s["punkte"]),
                  states[1:]), "")
print(doku + "Endstand: {} Punkte".format(states[-1]["punkte"]))
```

Vier Bausteine, immer dieselben: **`state`-Dictionary** → **`naechste_runde` als pure function** → **Rekursion über ein `states`-Tupel** → **`map`/`reduce` für die Dokumentation, ein einziges `print`**.

## Die empfohlenen Spiele und was man dafür braucht

**Kniffel-Light (Yahtzee Mini).** Fünf Würfel, drei Versuche, Ziel ist ein Dreierpasch; nach jedem Wurf dürfen einzelne Würfel festgehalten werden. Nur Dreierpasch-Punkte zählen.
*Konzepte:* Tupel von Würfen, `dict` oder `count` für Häufigkeiten (Dreierpasch = ein Wert kommt mindestens dreimal vor), `map` zum Neuwürfeln der nicht gehaltenen Würfel, Rekursion über die drei Versuche.

**Mäxchen/Meiern.** Ein Würfel, zwei Spieler. Man würfelt verdeckt und nennt eine Zahl (Wahrheit oder Lüge). Der Nächste glaubt sie — dann muss er selbst würfeln und eine *höhere* Zahl ansagen — oder zweifelt an. War die Ansage gelogen, bekommt der Zweifler einen Punkt, sonst der Ansager.
*Konzepte:* `state` mit `letzte_ansage` und `echter_wurf`, Strategien als Funktionen (`lügen?`, `anzweifeln?`), boolesche Logik, `seed` für Reproduzierbarkeit.

**Hohe Hausnummer.** Drei Würfe mit einem Würfel; die Augenzahlen werden auf Hunderter-, Zehner- und Einerstelle verteilt. Variante 1: automatisch optimal. Variante 2: nach jedem Wurf entscheidet der Spieler. Die höchste Zahl gewinnt.
*Konzepte:* `sorted` bzw. `reduce(lambda a, z: a * 10 + z, ziffern)` zum Zusammensetzen, Strategie als Funktion, Tupel als state.

**Galgenmännchen.** Buchstaben eines unbekannten Wortes bekannter Länge raten; Treffer werden an allen passenden Stellen eingetragen, Fehlversuche werden gezählt, beim 6. Fehler ist das Spiel verloren.
*Konzepte:* Strings sind immutable — die Maske baut man mit `''.join(map(...))` neu; `set` der geratenen Buchstaben, `filter` für die Fehlversuche, Rekursion über die Rateversuche.

**Runterzählen von 101 (Push Your Luck / Pig).** 101 Punkte, Ziel ist 0 oder weniger. Pro Runde startet man bei 0 Rundenpunkten und würfelt: eine 1 beendet die Runde und löscht die Rundenpunkte, sonst wird der Wurf addiert. Nach jedem Wurf darf man freiwillig aufhören — dann werden die Rundenpunkte von den Gesamtpunkten abgezogen.
*Konzepte:* rekursive Runde (genau `spieler_wurf(strategie, aktuelle_Punkte)` aus `neues_spiel.py`), Strategie als Closure `hold_at(20)`, Abbruchbedingung als übergebene Funktion.

**Kooperationsspiel (Gefangenendilemma).** Jede Runde entscheidet jeder verdeckt: kooperieren (k) oder ausnutzen (a). Beide k → je 3 Punkte. k gegen a → 0 für k, 5 für a. Beide a → je 0 Punkte.
*Konzepte:* `dict` als Auszahlungsmatrix `{("k","k"): (3,3), …}`, Strategien als Funktionen der bisherigen Historie (z. B. tit-for-tat), `states`-Tupel, `reduce` für die Punktesumme.

**Goofspiel** wie oben — plus als Aufwärmspiel Stein-Schere-Papier-Echse-Spock, bei dem nur die Gewinnmatrix als `dict` dazukommt.

## Fremden funktionalen Spielcode systematisch lesen

Sieben Schritte, in dieser Reihenfolge:

1. **Anfangszustand lesen.** Welche Schlüssel hat das `state`-Dictionary, und mit welchen Werten startet es? Daraus ergeben sich Kartenanzahl, Startpunkte, Rundenzähler.
2. **Spielerzahl abzählen.** Gibt es `punkte_spieler1` *und* `punkte_spieler2` → zwei Spieler. Steht dort nur `punkte` → **ein** Spieler (Solitärspiel).
3. **Abbruchbedingung finden.** Das `if` in der rekursiven Funktion bzw. das Lambda in `spiel_rekursiv`. Es sagt, *wann* das Spiel endet — und damit, wie viele Runden es gibt.
4. **Die Rundenfunktion Schlüssel für Schlüssel übersetzen.** Jeder Eintrag des neuen Dictionaries ist eine Spielregel. Der Ausdruck beim Schlüssel `punkte` **ist** die Punkteregel.
5. **Boolesche Ausdrücke in der Arithmetik entlarven.** In Python ist `True == 1` und `False == 0`. `runde * (karte > runde)` bedeutet also: "gibt es `runde` Punkte, falls die Karte größer ist, sonst 0". Das ist der Trick, den der Prof am liebsten einbaut.
6. **Die Ausgabe von innen nach außen aufdröseln.** `rungame(states)` liefert alle Zustände, `map` macht daraus je eine Zeile, `reduce` klebt sie zusammen. Der Formatstring verrät den genauen Wortlaut.
7. **In drei Sätzen antworten** — Spielerzahl, Punkteregel, Endausgabe. Genau die drei Teilfragen.

Am Originalcode der Beispielfrage sieht das so aus:

```python
import random
random.seed(1)

runden = 10
states = ({"karten": tuple(random.sample(range(1, runden), runden - 1)), "punkte": 0, "runde": 1},)

def naechsteRunde(state):
    return {"karten": state["karten"][:-1],
            "punkte": state["punkte"] + (state["runde"]) * (state["karten"][-1] > state["runde"]),
            "runde": state["runde"] + 1}

def rungame(states):
    if states[-1]["karten"]:
        return rungame(states + (naechsteRunde(states[-1]),))
    else:
        return states

from functools import reduce
print(reduce(lambda x, y: x + y,
             map(lambda x: "In Runde {} haben wir {} Punkte \n".format(x["runde"], x["punkte"]),
                 rungame(states))))
```

Musterantwort des Profs: *"Es gibt einen Spieler. Er besitzt 10 gemischte Karten der Wertigkeit von 1 bis 10. Jede Runde zieht er eine zufällige Karte und schaut, ob der Wert der Karte größer ist als die Runde, die das Spiel schon läuft. Falls ja, bekommt er so viele Punkte wie die aktuelle Rundennummer. Falls nein, bekommt er keine Punkte. Am Ende wird für jede Runde die aktuelle Anzahl der Punkte ausgegeben."*

## Typische Fehler

- **Aus zwei `if`-Zweigen auf zwei Spieler schließen.** Entscheidend ist der `state`, nicht die Fallunterscheidung.
- **`state["karten"][:-1]` und `[1:]` verwechseln.** `[:-1]` nimmt das **letzte** Element weg — dann ist `karten[-1]` die gerade gespielte Karte.
- **Den booleschen Faktor übersehen.** `punkte + runde * (bedingung)` ist eine vollständige Wenn-dann-Regel, kein Rechenfehler.
- **`random` benutzen, wo Reproduzierbarkeit verlangt ist.** Pure bleibt es nur mit `random.Random(seed)` und weitergereichtem `seed`.
- **Beim Umschreiben Mutation stehen lassen.** `liste.remove(karte)` mutiert; die pure Variante ist `kartenspiel[:i] + kartenspiel[i+1:]` auf einem Tupel.
- **Die Dokumentation in die Spiellogik mischen.** Erst alle `states` sammeln, dann *einmal* drucken — sonst gibt es keine pure function mehr.
- **Beim `states`-Tupel das Komma vergessen.** `states + (naechste_runde(...),)` — ohne Komma ist es kein Tupel.

## Merksätze

- Jedes Spiel besteht aus `state`-Dictionary, pure `naechste_runde`, Rekursion über `states` und einem einzigen `print`.
- Die Anzahl der Spieler steht im `state`, nicht in den `if`-Zweigen.
- `True` ist `1`: Ein boolescher Faktor in einer Formel ist eine versteckte Fallunterscheidung.
- Die Abbruchbedingung der Rekursion ist die Spielende-Regel.
- Ausgabe immer von innen nach außen lesen: `rungame` → `map` → `reduce`.
