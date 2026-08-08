## Warum das in der Klausur zählt

Aufgabe 5b der Probeklausur (3 P) besteht aus zwei Halbsätzen: aus `potenz(basis, exponent)` per `lambda` eine Funktion `quadrat` bauen, sodass `quadrat(5)` gleich `25` ist — und angeben, *"was allgemein für die gecurryte Form `f_curry` einer zweistelligen Funktion `f` gilt: `f_curry(a1)(a2) = ?`"*. Die Bonusaufgabe (**+4 P**) verlangt einen Decorator `rufezeichen`, der an den String-Rückgabewert `"!!!"` anhängt, angewendet per `@`-Syntax auf `begruessung(name)` (Probeklausur_Python_ausfuellbar.pdf, S. 5).

Das sind **7 Punkte für zwei auswendig lernbare Gerüste** — die günstigsten Punkte der ganzen Klausur. Auf Übungsblatt 4 kommt beides ebenfalls vor (`login_required`, Tage in Sekunden umrechnen; blatt4u5.pdf, S. 3–4).

## Closures: Funktionen, die Funktionen zurückgeben

Grundlage für alles Weitere ist eine **higher order function**, die eine Funktion *zurückgibt*. Die innere Funktion "merkt" sich dabei die Variablen der äußeren — das nennt man **Closure**.

```python
def multiplizierer(n):
    return lambda x: x * n            # merkt sich n

def funktion_die_um_eins_hochzaehlt():
    def fun(a):                       # dieselbe Sache mit def statt lambda
        return a + 1
    return fun

verdreifachen = multiplizierer(3)
print(verdreifachen(7))               # 21
print(multiplizierer(10)(4))          # 40  -- zwei Klammerpaare hintereinander
print(funktion_die_um_eins_hochzaehlt()(2))   # 3

def hold_at(schwelle):                # Strategie-Fabrik aus der Pig-Übung
    return lambda rundensumme: rundensumme < schwelle
strategien = list(map(hold_at, [10, 15, 20, 25, 30]))
print(strategien[2](18), strategien[2](22))   # True False
```

`multiplizierer(3)` liefert **keine Zahl, sondern eine Funktion**. Erst das zweite Klammerpaar ruft sie auf.

## Currying — die Idee und der Merksatz

Currying heißt: *"eine von mehreren Parametern abhängige Funktion als Verkettung von Funktionen zu schreiben, die nur von einem Parameter abhängen und eine Funktion zurückgeben"* (3_mutable_variables…_26.pdf, S. 12). Statt `f(a1, a2)` schreibt man `f_curry(a1)(a2)`: `f_curry(a1)` allein liefert eine Funktion, die noch einen Parameter erwartet.

**Der Merksatz für die Klausur:**

```
f_curry(a1)(a2) = f(a1, a2)
```

und allgemein `f_curry(a1)(a2)…(an) = f(a1, a2, …, an)`. Der Name kommt vom Mathematiker Haskell Brooks Curry (1900–1982) (5_map_filter_reduce_wrapup_26.pdf, S. 13).

```python
def potenz(basis, exponent):
    return basis ** exponent

quadrat = lambda b: potenz(b, 2)          # Probeklausur 5b: einen Parameter binden
print(quadrat(5))                          # 25

potenz_curry = lambda basis: (lambda exponent: potenz(basis, exponent))
print(potenz_curry(2)(10), potenz(2, 10))  # 1024 1024  -> f_curry(a1)(a2) == f(a1,a2)

def summe(a, b):
    return a + b
zwei_weiter = lambda x: summe(2, x)        # das Beispiel aus der Vorlesung
print(zwei_weiter(40))                     # 42

def addiere(x):                            # gecurryte Form direkt definiert
    return lambda y: x + y
plus_5 = addiere(5)
print(plus_5(3), plus_5(10), plus_5(-2))   # 8 15 3
```

Wichtig für die Klausur: **Beides ist gefragt.** "Parameter binden" (`quadrat = lambda b: potenz(b, 2)`) ist die praktische Anwendung, `f_curry = lambda a1: (lambda a2: f(a1, a2))` die allgemeine Curry-Form.

## Decorators — das Gerüst, das man auswendig können muss

*"Mit einem Decorator kann man eine Funktion erweitern oder verändern, indem man sie in eine Funktion höherer Ordnung hüllt (wrapt)."* (5_map_filter_reduce_wrapup_26.pdf, S. 14) Das Gerüst ist immer identisch — drei Ebenen:

```python
def dekorator(f):                          # 1. nimmt die Funktion entgegen
    def wrapper(*args, **kwargs):          # 2. hüllt sie ein
        # ... vorher ...
        ergebnis = f(*args, **kwargs)      #    Originalaufruf
        # ... nachher ...
        return ergebnis
    return wrapper                         # 3. gibt die Hülle zurück

@dekorator                                 # Anwendung: identisch zu g = dekorator(g)
def g(x):
    return x * 2
print(g(21))                               # 42
```

`*args, **kwargs` sorgen dafür, dass der Wrapper mit beliebig vielen Argumenten funktioniert. `@dekorator` über der Definition ist reine Schreiberleichterung für `g = dekorator(g)`.

## Die Bonusaufgabe und das Beispiel des Profs

```python
def grossbuchstaben(f):                    # Beispiel aus der Vorlesung
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs).upper()
    return wrapper

def rufezeichen(f):                        # Bonusaufgabe der Probeklausur
    def wrapper(*args, **kwargs):
        return f(*args, **kwargs) + "!!!"
    return wrapper

@rufezeichen
def begruessung(name):
    return "Hallo, " + name

@grossbuchstaben
@rufezeichen                               # Dekoratoren stapeln: von unten nach oben
def abschied(name):
    return "Tschüss, " + name

print(begruessung("Anna"))                 # Hallo, Anna!!!
print(abschied("Ben"))                     # TSCHÜSS, BEN!!!
```

Bei gestapelten Dekoratoren wird der **unterste zuerst** angewendet.

## functools.wraps und ein Decorator mit Nebeneffekt

*"Damit Metadaten (Funktionsname, docstring, etc.) trotz Dekorator noch von der ursprünglichen Funktion erhalten bleiben"*, schreibt man `@functools.wraps(f)` an den Wrapper (S. 15).

```python
import functools

def logge_aufruf(f):                       # Aufgabe von Folie 15
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        print("Aufruf von {} mit {} {}".format(f.__name__, args, kwargs))
        return f(*args, **kwargs)
    return wrapper

@logge_aufruf
def addiere(a, b=1):
    """Addiert zwei Zahlen."""
    return a + b

print(addiere(3, b=4))
print(addiere.__name__, "|", addiere.__doc__)   # addiere | Addiert zwei Zahlen.
```

Ohne `@functools.wraps` würde `addiere.__name__` den Wert `'wrapper'` liefern.

## Decorator mit eigenem Argument

Die Zusatzaufgabe von Übungsblatt 4 (`@login_required(rolle='admin')`) braucht eine **vierte** Ebene: eine Funktion, die einen Decorator zurückgibt.

```python
def mindestens(rolle):                     # Ebene 0: nimmt das Argument
    def dekorator(f):                      # Ebene 1: nimmt die Funktion
        def wrapper(*args, **kwargs):      # Ebene 2: hüllt ein
            if rolle != "admin":
                return "Zugriff verweigert."
            return f(*args, **kwargs)
        return wrapper
    return dekorator

@mindestens("admin")
def loeschen(was):
    return "Gelöscht: " + was

@mindestens("gast")
def formatieren(was):
    return "Formatiert: " + was

print(loeschen("Datei"))                   # Gelöscht: Datei
print(formatieren("Platte"))               # Zugriff verweigert.
```

## Funktionen verketten — Übungsblatt 4, Aufgabe 6

Die dort gestellte Aufgabe lautet: *"Verwende Currying, um schrittweise Tage in Sekunden umzurechnen. Schreibe für jeden Schritt eine eigene pure function und führe sie am Ende in einer Funktion zusammen, welche übergebene Funktionen nacheinander ausführt."* Die Verkettungsfunktion ist selbst eine higher order function und ein sauberer `reduce`-Einsatz.

```python
from functools import reduce

mal = lambda faktor: (lambda x: x * faktor)     # gecurryte Multiplikation
tage_zu_stunden   = mal(24)
stunden_zu_minuten = mal(60)
minuten_zu_sekunden = mal(60)

def verkette(*funktionen):
    return lambda x: reduce(lambda wert, f: f(wert), funktionen, x)

tage_zu_sekunden = verkette(tage_zu_stunden, stunden_zu_minuten, minuten_zu_sekunden)
print(tage_zu_sekunden(1), tage_zu_sekunden(2))     # 86400 172800
```

`verkette` gibt eine Funktion zurück, die `x` nacheinander durch alle übergebenen Funktionen schiebt — ganz ohne Schleife und ohne Mutation.

## Typische Fehler

- **Klammern beim Übergeben setzen.** `strategien[i]` ist die Funktion, `strategien[i]()` ihr Ergebnis. Beim Übergeben an eine andere Funktion **niemals** Klammern anhängen.
- **Im Decorator die Funktion zurückgeben statt aufzurufen — oder umgekehrt.** Der Decorator gibt `wrapper` **ohne** Klammern zurück; im Wrapper wird `f(*args, **kwargs)` **mit** Klammern aufgerufen.
- **`return` im Wrapper vergessen.** Dann liefert jede dekorierte Funktion `None` — bei der Bonusaufgabe der Klassiker.
- **`f_curry(a1, a2)` schreiben.** Gecurryt heißt zwei getrennte Klammerpaare: `f_curry(a1)(a2)`.
- **Beim Currying `def` statt Rückgabe einer Funktion.** `lambda a1, a2: f(a1, a2)` ist *nicht* gecurryt — es fehlt die Verkettung.
- **`@functools.wraps` ohne Argument oder ohne Import.** Richtig ist `import functools` und `@functools.wraps(f)` direkt über `def wrapper`.
- **Denken, `@deko` verändere den Originalcode.** Es bindet nur den Namen neu: `g = deko(g)`.

## Merksätze

- `f_curry(a1)(a2) = f(a1, a2)` — Currying ersetzt ein Komma durch ein Klammerpaar.
- Eine Funktion, die eine Funktion zurückgibt, ist eine Closure — sie merkt sich die äußeren Variablen.
- Decorator-Gerüst: `def deko(f): def wrapper(*args, **kwargs): … return f(*args, **kwargs); return wrapper`.
- `@deko` über `def g` bedeutet exakt `g = deko(g)`.
- `@functools.wraps(f)` rettet Name und Docstring.
