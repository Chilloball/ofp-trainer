## Warum das in der Klausur zählt

Kapitel 1 und 2 bekommen keine eigene große Aufgabe — sie liefern aber die billigsten Punkte der ganzen Java-Hälfte. Aufgabe 1a der Probeklausur besteht aus **6 Multiple-Choice-Fragen à 1 Punkt** (Aufgabe 1 insgesamt 12 von 54 P), und Fragen nach Bezeichnerregeln, nach `javac` gegen `java` oder nach dem Kopf der `main`-Methode gehören genau hierher. Aufgabe 1b („der Code enthält genau 3 Fehler", 6 P) hat fast immer mindestens einen rein syntaktischen Fehler — in der Probeklausur war es `public string getMarke()` statt `String`. Und die offizielle Übungsaufgabe `Klausur01.java` beginnt mit `import java.util.Scanner;` plus `main`-Methode: Wer diese Kopfzeilen nicht auswendig hinschreiben kann, verliert in den Programmieraufgaben 4 und 5 (zusammen 26 P) sofort Zeit — und ohne lauffähiges Gerüst gibt es dort keine vollen Punkte.

## Von der Quelle zum laufenden Programm

Das Skript zeichnet eine feste Kette (OFP_Java.pdf, S. 348): **Spezifikation → Lösungsidee → Algorithmus → Programm in Programmiersprache (Quellcode) → Programm in Maschinensprache (Objektcode) → Ausführungsplattform**. Für Java sieht das konkret so aus:

| Schritt | Werkzeug | Kommando | Ergebnis |
|---|---|---|---|
| Programmieren | Editor | `nano Program.java` | Quelldatei `Program.java` |
| Compilen | Java-Compiler | `javac Program.java` | Bytecode `Program.class` |
| Binden, Laden, Ausführen | Java Virtual Machine | `java Program` | laufendes Programm |

Drei Details, die gern abgefragt werden:

- Beim **Aufruf von `java` steht die Endung `.class` nicht dabei** — `java Program`, nicht `java Program.class`. Beim Compiler dagegen schon: `javac Program.java`.
- Java ist **compiliert *und* interpretiert**. Der Compiler erzeugt keinen Maschinencode für einen bestimmten Prozessor, sondern **Bytecode**, den die JVM interpretiert. Vorteile: Portabilität (derselbe Bytecode läuft überall) und Sicherheit (die JVM kann Zugriffe einschränken). Nachteil: geringere Ausführungsgeschwindigkeit (OFP_Java.pdf, S. 10).
- Der Compiler erzeugt **eine `.class`-Datei pro Klasse**, auch wenn alle Klassen in einer Quelldatei stehen. `javac *.java` übersetzt alle Dateien eines Verzeichnisses.

Die JVM lädt die angegebene Klasse und sucht darin die Methode `public static void main(String[] args)`. Fehlt sie, gibt es eine Fehlermeldung — kein Compiler-Fehler, sondern ein Startfehler zur Laufzeit (OFP_Java.pdf, S. 11).

## Programmaufbau

Jedes Java-Programm besteht aus **mindestens einer Klasse**. Der Code einer **öffentlichen** Klasse muss in einer Datei stehen, die genauso heißt wie die Klasse (`public class Auto` → `Auto.java`); nicht-öffentliche Klassen dürfen in beliebigen Dateien liegen (OFP_Java.pdf, S. 6). Deshalb kann der Professor in seinen Beispielen mehrere Klassen ohne `public` in eine Datei schreiben, wie in `Klausur05.java` oder `Klausur10.java`.

```java
// Datei: Willkommen.java   ->  javac Willkommen.java  ->  java Willkommen
class Willkommen {
  public static void main(String[] args) {
    int jahr = 2026;                       // Anweisung, endet mit Semikolon
    System.out.print("OFP ");              // ohne Zeilenumbruch
    System.out.println("Klausur " + jahr); // mit Zeilenumbruch
    /* Blockkommentar:
       darf sich über mehrere Zeilen erstrecken */
  }
}
```

Ausgabe:

```
OFP Klausur 2026
```

Den Kopf `public static void main(String[] args)` muss man Wort für Wort können: `public` (von außen aufrufbar), `static` (Klassenmethode, die JVM braucht dafür kein Objekt), `void` (kein Rückgabewert), `String[] args` (die Kommandozeilenargumente). Der Name des Parameters ist frei — der Professor schreibt oft `String[] str` oder `String[] s`.

Für Eingaben nutzt der Kurs die Klasse `Scanner` (genau so in `Klausur01.java`):

```java
import java.util.Scanner;

class EingabeDemo {
  public static void main(String[] args) {
    Scanner input = new Scanner(System.in);
    System.out.println("Maximum?");
    int max = input.nextInt();
    while (max < 6 || max > 999) {         // solange ungültig: erneut fragen
      System.out.println("Bitte 6 bis 999:");
      max = input.nextInt();
    }
    System.out.println("Gewaehlt: " + max);
  }
}
```

Bei den Eingaben `3`, `1000`, `42` erscheint:

```
Maximum?
Bitte 6 bis 999:
Bitte 6 bis 999:
Gewaehlt: 42
```

Der `import` muss **vor** der Klassendefinition stehen. `input.nextInt()` liest eine ganze Zahl, `input.nextDouble()` eine Gleitkommazahl, `input.next()` ein Wort und `input.nextLine()` eine ganze Zeile.

## Syntaktische Grundelemente

**Schlüsselwörter** sind reserviert und werden immer klein geschrieben: `class`, `public`, `static`, `void`, `int`, `if`, `else`, `while`, `for`, `switch`, `case`, `break`, `continue`, `return`, `new`, `final`, `this`, `super`, `extends`, `implements`, `abstract`, `try`, `catch`, `throw`, `null`, `true`, `false`. Ein Schlüsselwort darf nie als Name benutzt werden.

**Bezeichner (Identifikatoren)** dürfen beliebig lang sein, bestehen aus Buchstaben, Ziffern, `_` und `$` und müssen mit einem Buchstaben, `_` oder `$` beginnen (OFP_Java.pdf, S. 16 und S. 349):

| korrekt | falsch | Grund |
|---|---|---|
| `Summe` | `get Name` | Leerzeichen verboten |
| `getName` | `Tuer-1` | `-` verboten |
| `$all4you` | `2hoch4` | Ziffer am Anfang |
| `_1_2` | `while` | reserviertes Wort |
| `beliebige_Länge_123` | `null` | reserviertes Literal |

Java ist **case-sensitive**: `punkte`, `Punkte` und `PUNKTE` sind drei verschiedene Namen — und `string` ist eben nicht `String`.

**Konstanten (Literale)** tragen ihren Typ in der Schreibweise:

```java
class LiteraleDemo {
  public static void main(String[] args) {
    int dezimal = 42;
    long gross = 42L;
    int hexa = 0x1F;            // 31
    int binaer = 0b01010101;    // 85
    double d = 3.14;
    float f = 3.14f;
    char zeichen = 'a';
    String text = "Text";
    boolean flagge = true;
    System.out.println(dezimal + " " + gross + " " + hexa + " " + binaer);
    System.out.println(d + " " + f + " " + zeichen + " " + text + " " + flagge);
  }
}
```

Ausgabe:

```
42 42 31 85
3.14 3.14 a Text true
```

Merke die Anführungszeichen: **einfache für `char`** (`'a'`, genau ein Zeichen), **doppelte für `String`** (`"Text"`). `'ab'` ist ein Compiler-Fehler.

**Klammern** haben je eine feste Rolle: `( )` für Argumente, Parameterlisten, Bedingungen und Casts; `[ ]` für Arrays; `{ }` für Blöcke und Array-Initialisierungen. **Trennzeichen** sind `;`, `,` und `.` — dazu Leerräume, Tabstops und Zeilenwechsel, die für den Compiler bedeutungslos sind, für den Korrektor aber nicht.

Jede Anweisung endet mit `;`. Mehrere Anweisungen werden mit `{ }` zu einem **Block** zusammengefasst, und ein Block darf überall stehen, wo eine Anweisung stehen darf; der abschließende Strichpunkt entfällt dann (OFP_Java.pdf, S. 51).

**Kommentare** gibt es in drei Formen: `// bis Zeilenende`, `/* über mehrere Zeilen */` und `/** Javadoc */` für die Dokumentation von Klassen und Methoden. Der Professor stellt seine Aufgaben fast immer als Javadoc-Kommentar über die Klasse — lies ihn zuerst, dort steht die eigentliche Aufgabenstellung.

## Typische Fehler

- **`javac Program` oder `java Program.java`.** Der Compiler will den Dateinamen *mit* `.java`, die JVM den Klassennamen *ohne* Endung.
- **Dateiname ungleich Klassenname.** Bei einer `public`-Klasse ist das ein Compiler-Fehler („class X is public, should be declared in a file named X.java").
- **Klein geschriebener Typname.** `string`, `system.out.println`, `Int` — Java ist case-sensitive, und `String`/`System` sind Klassen (groß), `int`/`double` primitive Typen (klein).
- **`main` falsch geschrieben.** Ohne `static`, ohne `String[]` oder mit `Main` findet die JVM keinen Einstiegspunkt und meldet erst zur Laufzeit einen Fehler.
- **Semikolon vergessen oder eines zu viel.** `if (x > 0);` ist syntaktisch korrekt, aber der Rumpf ist leer — ein Logikfehler, den der Compiler nie meldet.
- **`import` an der falschen Stelle** oder ganz vergessen: `Scanner` ohne `import java.util.Scanner;` ergibt „cannot find symbol".
- **Bezeichner mit Ziffer am Anfang oder mit Bindestrich** (`2hoch4`, `Tuer-1`) — beliebte Multiple-Choice-Falle.
- **Verschachtelte Blockkommentare.** `/* … /* … */ … */` ist verboten; das erste `*/` beendet den Kommentar.

## Merksätze

- **`javac Datei.java` erzeugt `.class`, `java Klassenname` startet die JVM** — einmal mit Endung, einmal ohne.
- **Bytecode statt Maschinencode**: Java ist compiliert *und* interpretiert, deshalb plattformunabhängig.
- **Einstiegspunkt ist immer `public static void main(String[] args)`** — der Parametername ist frei, der Rest nicht.
- **Bezeichner beginnen nie mit einer Ziffer** und dürfen nur Buchstaben, Ziffern, `_` und `$` enthalten.
- **Einfache Anführungszeichen = `char`, doppelte = `String`** — und Java unterscheidet Groß- und Kleinschreibung überall.
