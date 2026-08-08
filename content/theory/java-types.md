## Warum das in der Klausur zählt

Die **allererste Multiple-Choice-Frage** der Probeklausur lautet „Bringen Sie die Ganzzahl-Datentypen nach ihrer Größe in die richtige Reihenfolge" (1 P, Lösung `byte < short < int < long`). Aufgabe 1b, die **Fehlersuche über 6 Punkte**, besteht aus genau dieser Sorte Fehler; die offiziellen Übungsaufgaben dazu sind `Klausur03.java` („Finde die 2 Compiler-Fehler") und `Klausur04.java` („In welchen 3 Zeilen befinden sich Compiler-Fehler? Was gibt dieses Programm aus, wenn die Zeilen gelöscht werden?"). Dazu kommt die Ganzzahldivision: In `Klausur07.java` entscheidet `anzahl / 2` über alle vier Zeilen der Antwort.

## Die acht primitiven Datentypen

| Typ | Größe | Wertebereich |
|---|---|---|
| `byte` | 1 Byte | −128 … 127 |
| `short` | 2 Byte | −32 768 … 32 767 |
| `int` | 4 Byte | −2 147 483 648 … 2 147 483 647 |
| `long` | 8 Byte | ca. ±9,2 · 10¹⁸ |
| `float` | 4 Byte | ca. ±3,4 · 10³⁸, 7 Stellen |
| `double` | 8 Byte | ca. ±1,8 · 10³⁰⁸, 17 Stellen |
| `char` | 2 Byte | Unicode 0 … 65 535 |
| `boolean` | — | `true`, `false` |

Literale: `42`, `42L`, `3.14`, `3.14f`, `'a'`, `0x1F`, `0b1010`. Merkhilfe: Bei den Ganzzahlen **verdoppelt sich die Größe** (1, 2, 4, 8 Byte). **Attribute** bekommen Defaults (`0`, `0.0`, `false`, `null`), **lokale Variablen nicht**. Ein Überlauf wirft **keine Exception**, sondern läuft zyklisch um: `byte b = 127; b++;` ergibt `-128`. Gleitkommazahlen folgen IEEE 754 und sind **Näherungen** — Assoziativität und Kommutativität gelten nicht mehr (OFP_Java.pdf, S. 27, `DoubleDemo.java`).

## Typkonversion

Zwei Richtungen (OFP_Java.pdf, S. 37–39, S. 350): **implizit / erweiternd / verlustfrei** ohne Cast (`byte → short → int → long → float → double`, dazu `char → int`, etwa `int num3 = num2;`) und **explizit / einschränkend** nur mit Cast (`short num2 = (short) sym;`), wobei Information verloren geht. Die drei harten Regeln:

1. **`boolean` ist mit keinem Typ konvertierbar** — weder `(int) b` noch `b = i` noch `(boolean) symbol2` (zweiter Fehler in `Klausur03.java`).
2. **Implizite Verengung gibt es nicht.** Bei `int d; double a;` ist `d = d + a;` ein Fehler („possible lossy conversion from double to int").
3. **`+=` castet still zurück.** `c = c + 1;` mit `char c` ist ein Fehler, `c += 1;` erlaubt — ebenso bei `byte` und `short`.

```java
class KonversionOk {
  public static void main(String[] s) {
    double x, y = 1.1;
    char c = 'a';
    x = 3 / 4;                      // Falle: erst int-Division (0), dann 0.0
    x = c + y * 5;                  // 97 + 5.5 = 102.5
    c += 1;                         // OK, += castet zurück nach char
    System.out.println(x + " " + (int) x + " " + c
                       + " " + (int) 'a' + " " + (char) 65 + " " + (int) 4.9);
  }
}
```

Ausgabe: `102.5 102 b 97 A 4`.

`char` rechnet als Zahl (`'a'` = 97, `'A'` = 65), ein Cast **schneidet ab**. Vorsicht bei der Priorität: `(int) x + y` bedeutet `((int) x) + y`.

## Die Ganzzahldivision

`int / int` liefert **immer** `int` — unabhängig davon, wohin das Ergebnis geschrieben wird.

```java
class DivDemo {
  public static void main(String[] s) {
    System.out.println(7 / 2 + " " + 7 % 2 + " " + (-7 / 2) + " " + (-7 % 2));
    System.out.println(7 / 2.0 + " " + (double) 7 / 2 + " " + (double) (7 / 2));
    System.out.println(1.0 / 0 + " " + 0.0 / 0.0);
    // System.out.println(1 / 0);   // Laufzeitfehler: ArithmeticException
  }
}
```

Ausgabe: `3 1 -3 -1` / `3.5 3.5 3.0` / `Infinity NaN`.

Java schneidet **Richtung null** ab (`-7 / 2 == -3`, anders als Pythons `//`). `(double) (7 / 2)` ist `3.0` — der Cast kommt zu spät; richtig sind `(double) a / b` oder `a / 2.0`. Division durch 0 wirft bei `int` eine `ArithmeticException`, bei `double` entstehen `Infinity` bzw. `NaN`.

Davon lebt `Klausur07.java`: `this.note = anzahl / 2;` mit `int anzahl`. Obwohl `note` ein `double` ist, wird ganzzahlig geteilt — `anzahl` = 1, 2, 3, 4 ergibt `0.0`, `1.0`, `1.0`, `2.0`.

## Gültigkeitsbereich und final

Eine lokale Variable gilt **ab ihrer Deklaration bis zum Ende des umgebenden Blocks**; Gültigkeitsbereiche gleichnamiger Variablen dürfen sich nicht überlappen (OFP_Java.pdf, S. 35–36).

```java
class ScopeOk {
  public static void main(String[] s) {
    int a = 3, b = 1;
    if (a > 0) { int c = 0; c += a; System.out.println(c); }  // 3
    { char c = 'x'; System.out.println(c); }   // OK: der erste c-Block ist zu
    System.out.println(a + b);                 // 4
  }
}
```

Verboten wären `int b;` im `if`-Block („b bereits deklariert") und `double a;` am Ende. In `Klausur03.java` ist `String str` im inneren Block ein Fehler, weil der **Parameter** `String[] str` von `main` noch gilt. `final` macht eine Konstante; jede erneute Zuweisung ist ein Fehler, und `double a, b = 1.2;` initialisiert **nur `b`**.

## So findest du Compiler-Fehler systematisch

Arbeite diese Liste **zeilenweise** ab, statt zu raten. Der Professor sagt immer, wie viele Fehler es sind — hast du so viele, hör auf.

1. **Typ links, Typ rechts.** Ist der Ausdruck rechts „größer" als die Variable links? Dann fehlt ein Cast.
2. **`boolean` im Spiel?** In keinen und aus keinem anderen Typ — auch nicht mit Cast.
3. **`final`?** Suche eine zweite Zuweisung.
4. **Doppelte Deklaration** in einem inneren Block — Methodenparameter zählen mit.
5. **Uninitialisierte lokale Variable** gelesen? **Bedingung** keine `boolean` (`if (x = 1)`)?
6. **Syntax und Namen.** `string` statt `String`, fehlendes `new` oder `this.`, Semikolon, `return`-Typ.

### Klausur04 Schritt für Schritt

```java
class Klausur04 {
  public static void main(String[] s) {
    double a, b = 1.2;
    char c = 'a';
    System.out.println("abracadabr" + c);
    int d = 3, e = 8;
    final boolean f = false;
    a = (d > 1) ? 4.5 : 6.7;
    b = c + a * d;
    d = d + a;             // Fehler 1
    f = (e <= 8);          // Fehler 2
    d = (int) a + (int) c;
    e = (int) (a == b);    // Fehler 3
  }
}
```

**Teil 1 — die drei Fehler** (Checkliste 1, 3, 2):

| Zeile | Warum | Korrektur |
|---|---|---|
| `d = d + a;` | `d + a` ist `double`, `d` ist `int` | `d = (int) (d + a);` |
| `f = (e <= 8);` | `f` ist `final` | `final` streichen |
| `e = (int)(a == b);` | `a == b` ist `boolean` | `e = (a == b) ? 1 : 0;` |

**Teil 2 — Ausgabe nach dem Löschen dieser Zeilen** (`c` bleibt `'a'` = 97, `e` bleibt 8):

| Anweisung | a | b | d | Ausgabe |
|---|---|---|---|---|
| `println("abracadabr" + c)` | — | 1.2 | — | `abracadabra` |
| `int d = 3, e = 8;` | — | 1.2 | 3 | |
| `a = (d > 1) ? 4.5 : 6.7;` | 4.5 | 1.2 | 3 | |
| `b = c + a * d;` | 4.5 | 110.5 | 3 | |
| `d = (int) a + (int) c;` | 4.5 | 110.5 | 101 | |

`b = c + a * d` rechnet `97 + 4.5 * 3 = 110.5`, `d = (int) 4.5 + (int) 'a' = 4 + 97 = 101`. Danach wird nichts mehr ausgegeben — die vollständige Ausgabe ist nur `abracadabra`. Die Pointe: vier Zeilen sorgfältig rechnen, eine Zeile hinschreiben.

## Typische Fehler

- **`int`-Division übersehen.** `1/2` ist `0`, `anzahl/2` ergibt `0, 1, 1, 2` — auch wenn das Ziel ein `double` ist.
- **Cast zu spät gesetzt.** `(double) (7 / 2)` ist `3.0`, `(double) 7 / 2` ist `3.5`; `(int) x + y` castet nur `x`.
- **`boolean` gecastet.** `(boolean) symbol2`, `(int) b`, `b = i` — alles Compiler-Fehler.
- **`c = c + 1` mit `char`/`byte`/`short`** hat Typ `int`; nur `c += 1` geht.
- **`(int) 4.9` für gerundet gehalten.** Casts schneiden ab, runden macht `Math.round`.
- **Lokale Variable ohne Initialisierung benutzt**, oder Überlauf übersehen (`byte b = 127; b++;` → `-128`).

## Merksätze

- **`byte < short < int < long`, `float < double`, `char` = 2 Byte.**
- **`int / int` bleibt `int`** — das Ziel der Zuweisung ändert daran nichts.
- **Erweitern automatisch, Verengen nur mit Cast** — außer bei `+=`, das still zurückcastet.
- **`boolean` ist mit nichts kompatibel**, und `char` ist eine Zahl.
- **`final` nur einmal, lokale Variablen ohne Default.**
