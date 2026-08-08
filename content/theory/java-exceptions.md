## Warum das in der Klausur zählt

Kapitel 8 ist das **letzte Kapitel im Klausur-Überblick des Skripts** — die Zusammenfassung endet auf S. 374 mit genau diesem Thema, und alles danach (Kapitel 9 und 10) fehlt dort komplett. Was im Überblick steht, ist erfahrungsgemäß prüfbar. In der Probeklausur kam Exception-Stoff nicht als eigene große Aufgabe vor, dafür aber in den Formaten, in denen er billig zu prüfen ist: **Multiple Choice in Aufgabe 1 (12 P)** und **"Was ist die Ausgabe dieses Programms?" in Aufgabe 2 (4 P)**.

Zwei Sachen werden dabei fast immer gefragt: Wird `finally` auch bei `return` ausgeführt? Und in welcher Reihenfolge müssen die `catch`-Blöcke stehen? Wer die beiden Antworten sicher hat, sammelt hier ohne großen Lernaufwand Punkte ein. Zusätzlich hängt an Kapitel 8 die Erklärung fast aller Laufzeitfehler aus den anderen Aufgaben — `ArithmeticException` bei `1/0`, `NullPointerException`, `ArrayIndexOutOfBoundsException`.

## Die Hierarchie

```
Object
 └── Throwable
      ├── Error              -> Probleme in der JVM, sollten NICHT gefangen werden
      └── Exception          -> "checked": muss behandelt oder deklariert werden
           └── RuntimeException  -> "unchecked": Programmierfehler, muss nicht
```

(OFP_Java.pdf, S. 252)

Der Unterschied **checked / unchecked** ist die häufigste MC-Frage:

- **Checked** (alles unter `Exception`, aber nicht unter `RuntimeException`, z. B. `IOException`, eigene Exceptions): Der Compiler erzwingt, dass du sie entweder mit `try/catch` behandelst **oder** mit `throws` in der Signatur weiterreichst. Vergisst du beides, kompiliert es nicht.
- **Unchecked** (`RuntimeException` und Unterklassen): entstehen aus Fehlern im Code, dürfen ungefangen bleiben. Beispiele aus dem Skript (S. 253): `ArithmeticException` (`1/0` ganzzahlig), `IndexOutOfBoundsException` (`array[-1]`), `NegativeArraySizeException` (`new double[-5]`), `NullPointerException`, `ClassCastException` (`(Katze) einTier`, wenn `einTier` ein `Hund` ist).

Wichtig: `1/0` mit `int` wirft eine `ArithmeticException`, `1.0/0.0` mit `double` dagegen **nicht** — das ergibt `Infinity`.

## try / catch / finally — und die return-Falle

```java
class ExDemo {
  static int teile(int a, int b) {
    try {
      System.out.println("try");
      return a / b;                 // wirft bei b == 0 eine ArithmeticException
    }
    catch (ArithmeticException e) { // spezifisch zuerst
      System.out.println("catch: " + e.getMessage());
      return -1;
    }
    finally {
      System.out.println("finally"); // läuft IMMER, auch nach return
    }
  }
  public static void main(String[] s) {
    System.out.println(teile(10, 2));
    System.out.println("---");
    System.out.println(teile(10, 0));
  }
}
```

Ausgabe:

```
try
finally
5
---
try
catch: / by zero
finally
-1
```

Das ist die Aufgabe-2-Falle in Reinform. Merke den Ablauf: Der `try`-Block wird beim Fehler **sofort verlassen** — was danach im `try` steht, läuft nie. Dann greift der **erste passende** `catch`-Block, danach `finally`, dann geht es hinter dem `try/catch` weiter. `finally` läuft in **allen** Fällen: bei normalem Ende, bei `return`, bei gefangener Exception und auch, wenn die Exception an den Aufrufer weitergegeben wird (OFP_Java.pdf, S. 259–260). Ein `try`-`finally` **ohne** `catch` ist erlaubt.

Beachte auch die Reihenfolge in der ersten Ausgabe: erst `try`, dann `finally`, **dann erst** die `5`. Der Rückgabewert steht zwar schon fest, gedruckt wird er aber erst nach dem Verlassen der Methode.

## Reihenfolge der catch-Blöcke

Ein `catch`-Block passt, wenn das geworfene Objekt vom angegebenen Typ **oder einer Unterklasse davon** ist. Deshalb gilt: **spezifisch vor allgemein.** Steht `catch (Exception e)` zuerst, ist jeder folgende `catch`-Block unerreichbar — das ist ein **Compiler-Fehler** ("exception has already been caught"), nicht bloß ein Stilproblem.

```java
class ExOrder {
  public static void main(String[] s) {
    int[] zahlen = { 1, 0, 3 };
    int[] indizes = { 5, 1 };
    for (int i = 0; i < indizes.length; i++) {
      try {
        System.out.println(1 / zahlen[indizes[i]]);
      }
      catch (ArithmeticException e) {           // spezifisch ...
        System.out.println("Arithmetik: " + e.getMessage());
      }
      catch (IndexOutOfBoundsException e) {     // ... vor ...
        System.out.println("Index: " + e.getMessage());
      }
      catch (Exception e) {                     // ... allgemein
        System.out.println("Sonst: " + e);
      }
    }
  }
}
```

Ausgabe:

```
Index: Index 5 out of bounds for length 3
Arithmetik: / by zero
```

Beachte die Auswertungsreihenfolge im ersten Durchlauf: `zahlen[indizes[0]]` ist `zahlen[5]` und fliegt schon **vor** der Division heraus.

## throw, throws und eigene Exceptions

- **`throw`** löst aus: `throw new ArithmeticException("Divide by 0.");` — ein `new`-Objekt, kein Typname allein.
- **`throws`** steht in der **Signatur** und reicht weiter: `public void kehrwert() throws MyExcept`.
- **Eigene Exception**: `class MyExcept extends Exception { … }` (checked) oder `extends RuntimeException` (unchecked). Das Skript definiert *immer* zwei Konstruktoren: den parameterlosen und einen mit `String`, der per `super(s)` an `Throwable` durchreicht — nur so funktioniert später `getMessage()`.

```java
class MyExcept extends Exception {           // checked -> muss deklariert werden
  private int elNr = -1;
  public MyExcept() {}
  public MyExcept(String s) { super(s); }
  public MyExcept(String s, int elNr) { super(s); this.elNr = elNr; }
  public int getElementNr() { return elNr; }
  public String toString() {
    return "Eigener Fehler im Element " + elNr + ": " + getMessage();
  }
}

class Vektor {
  private double[] werte;
  public Vektor(double[] werte) { this.werte = werte; }
  public void kehrwert() throws MyExcept {   // Weitergabe deklarieren
    for (int i = 0; i < werte.length; i++) {
      if (werte[i] == 0.0) throw new MyExcept("Teilung durch 0.", i);
      werte[i] = 1.0 / werte[i];
    }
  }
}

class MyExceptDemo {
  public static void main(String[] s) {
    Vektor v = new Vektor(new double[] { 2.0, 0.0, 4.0 });
    try {
      v.kehrwert();
    }
    catch (MyExcept e) {
      System.out.println(e);                  // nutzt das eigene toString()
      System.out.println("Index: " + e.getElementNr());
    }
  }
}
```

Ausgabe: `Eigener Fehler im Element 1: Teilung durch 0.` und `Index: 1` (nach OFP_Java.pdf, S. 254–255).

Wird eine Exception nirgends gefangen, bricht die Methode sofort ab und gibt sie an ihren Aufrufer weiter; spätestens in `main` ungefangen beendet sie das Programm mit Stacktrace. Auch in einem `catch`-Block darf `throw e;` stehen, um nach lokaler Behandlung weiterzureichen (OFP_Java.pdf, S. 256–257).

## Typische Fehler

1. **`finally` bei `return` übersehen.** `finally` läuft immer — und in der Ausgabe **vor** dem gedruckten Rückgabewert.
2. **Allgemeinen `catch` zuerst.** `catch (Exception e)` vor `catch (ArithmeticException e)` ist ein Compiler-Fehler.
3. **Checked Exception weder fangen noch deklarieren** → *"unreported exception … must be caught or declared to be thrown"*.
4. **`throw` und `throws` verwechseln.** `throw` ist eine Anweisung im Rumpf, `throws` gehört in die Signatur.
5. **Eigene Exception ohne `super(s)`-Konstruktor** — dann liefert `getMessage()` immer `null`.
6. **Erwarten, dass `1.0/0.0` eine Exception wirft.** Nur die ganzzahlige Division tut das; `double` liefert `Infinity` bzw. `NaN`.
7. **Annehmen, der `try`-Block laufe nach dem Fehler weiter.** Er wird sofort verlassen.
8. **`e.getMessage()` mit `e.toString()` verwechseln**: `getMessage()` gibt nur den Text, `println(e)` den Klassennamen mit Text (bzw. dein eigenes `toString()`).

## Merksätze

- **`finally` gewinnt immer** — auch gegen `return`.
- **Spezifisch vor allgemein**, sonst kompiliert es nicht.
- **Checked musst du behandeln oder deklarieren; unchecked (`RuntimeException`) darfst du ignorieren.**
- **`throw` wirft ein Objekt, `throws` steht in der Signatur.**
- **Ganzzahlige Division durch 0 wirft, Gleitkommadivision liefert `Infinity`.**
