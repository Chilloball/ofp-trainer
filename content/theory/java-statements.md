## Warum das in der Klausur zählt

**Aufgabe 2 der Java-Klausur ist genau dieses Kapitel**: „Was gibt der folgende Code-Ausschnitt auf der Konsole aus?" — 4 von 54 Punkten, in der Probeklausur eine `for`-Schleife über ein Array mit `%`-Test, ohne Teilpunkte für den Rechenweg. Dieselbe Frage stellt der Professor in `Klausur05.java`, `Klausur06.java` und `Klausur07.java`. Dazu kommen Multiple-Choice-Punkte (Priorität, Prä-/Postinkrement) und die Programmieraufgaben 4 und 5 (26 P), in denen Schleifen die Arbeit machen — offizielle Übungen: `Klausur01.java` (hop/pla) und `Klausur02.java` (X-Dreieck).

## Operatoren und Priorität

| Prio | Operatoren | Assoziativität |
|---|---|---|
| 14 | `( )` `[ ]` postfix `++` `--` | von links |
| 13 | unäres `+` `-`, präfix `++` `--`, `~`, `!` | von rechts |
| 12 | `(<Typ>)`, `new` | von links |
| 11 / 10 / 9 | `*` `/` `%` — dann `+` `-` — dann `<<` `>>` `>>>` | von links |
| 8 / 7 | `<` `<=` `>` `>=` — dann `==` `!=` | von links |
| 6–4 | `&` — `^` — `\|` | von links |
| 3 / 2 / 1 | `&&` — `\|\|` — `?:` | von links |
| 0 | `=` `+=` `-=` `*=` `/=` `%=` … | von rechts |

(OFP_Java.pdf, S. 49). Praktisch: `a = b * c + d` ist `a = ((b*c)+d)`, `a / b * c % d` ist `(((a/b)*c)%d)`, `summe = x + y / 2` ist `x + (y/2)`. Im Zweifel klammern.

```java
class PrioDemo {
  public static void main(String[] s) {
    int x = 2, y = 3, z = 7;
    System.out.println((x + y * 2) + " " + ((x + y) * 2) + " " + (x + z / 2));
    System.out.println(10 / 4 * 4);
    System.out.println(1 + 2 + "a");                 // erst 3, dann Konkatenation
    System.out.println("a" + 1 + 2);                 // von links nach rechts
    System.out.println(0.5 + 0.5 + " ist " + 1);
    System.out.println(('a' + 1) + " " + ("" + 'a' + 1));  // char rechnet als Zahl
  }
}
```

Ausgabe: `8 10 5` / `8` / `3a` / `a12` / `1.0 ist 1` / `98 a1`.

Der Operator `+` ist **überladen**: `int + int` addiert, sobald ein `String` beteiligt ist, wird konkateniert — und zwar **von links nach rechts** (OFP_Java.pdf, S. 89).

**Prä- und Postfix** sind die Lieblingsfalle: `y = ++x` erhöht zuerst und gibt den **neuen** Wert zurück, `y = x++` gibt den **alten** Wert zurück und erhöht danach.

```java
class InkrementDemo {
  public static void main(String[] s) {
    int a = 10, b = ++a;                             // a = 11, b = 11
    System.out.println(a + " " + b);
    a = 10; b = a++;                                 // a = 11, b = 10
    System.out.println(a + " " + b);
    int i = 5;
    System.out.println(i++ + " " + i++ + " " + ++i); // 5 6 8
  }
}
```

Ausgabe: `11 11` / `11 10` / `5 6 8`.

**Logische Operatoren mit und ohne Kurzschluss:** `&&` und `||` werten die rechte Seite nur aus, wenn nötig; `&` und `|` werten **immer beide** Seiten aus (OFP_Java.pdf, S. 47). Bei Seiteneffekten macht das den Unterschied:

```java
class KurzschlussDemo {
  public static void main(String[] s) {
    int x = 0, y = 10, z = 0;
    if (x != 0 && y / x < 5) System.out.println("nie");  // kein Absturz
    boolean b1 = (z++ < 0) && (z++ < 0);   // && bricht ab -> z == 1
    System.out.print(z + " ");
    z = 0;
    boolean b2 = (z++ < 0) & (z++ < 0);    // & wertet beide Seiten aus
    System.out.println(z + " " + b1 + " " + b2);        // 1 2 false false
  }
}
```

## Bedingungen

`if (b) … else if (b2) … else …`, dazu der ternäre Operator `signum = (zahl == 0) ? 0 : (zahl > 0 ? +1 : -1);`. Die Bedingung **muss `boolean` sein** — `if (x = 1)` ist ein Compiler-Fehler, anders als in C. Bei `switch` muss der Ausdruck ganzzahlig sein (oder `char`/`String`); ohne `break` läuft die Ausführung in den nächsten Fall weiter — **Fall-Through**:

```java
class SwitchDemo {
  public static void main(String[] s) {
    for (int menuItem = 1; menuItem <= 5; menuItem++) {
      System.out.print(menuItem + ":");
      switch (menuItem) {
        case 1:  System.out.print(" eins");            // kein break -> Fall-Through!
        case 2:  System.out.print(" zwei"); break;
        case 3:
        case 4:  System.out.print(" drei-oder-vier"); break;
        default: System.out.print(" rest");
      }
      System.out.println();
    }
  }
}
```

Ausgabe: `1: eins zwei` / `2: zwei` / `3: drei-oder-vier` / `4: drei-oder-vier` / `5: rest`. Nur `menuItem == 1` fällt durch und druckt zwei Texte.

## Schleifen

`while` prüft **vor** dem Durchlauf, `do while` **nach** dem Durchlauf (läuft also mindestens einmal), `for` ist die Zählschleife. Dazu das erweiterte `for` über Arrays.

```java
class SchleifenDemo {
  public static void main(String[] s) {
    int i = 1, summe = 0;
    while (i < 10) { summe += i; i++; }        // 1 bis 9
    System.out.println(summe);                 // 45
    i = 1; summe = 0;
    do { summe += i; i++; } while (i <= 10);   // 1 bis 10
    System.out.println(summe);                 // 55
    summe = 0;
    for (i = 1; i <= 10; i++) summe += i;      // Zählschleife
    for (int w : new int[] { 2, 4, 6 }) summe += w;   // erweitertes for
    System.out.println(summe);                 // 55 + 12 = 67
  }
}
```

Vorzeitig aussteigen: `break` verlässt die Schleife, `continue` springt zum nächsten Durchlauf. Der Professor setzt stattdessen gern die Laufvariable auf den Endwert (`teiler = zahl; // verlasse die for-teiler-Schleife`, OFP_Java.pdf, S. 71). Verschachtelte Schleifen erzeugen Muster — so löst man `Klausur02.java`:

```java
class Dreieck {
  public static void dreieck(int size) {
    if (size < 3) return;                         // 1. Vorbedingung
    for (int zeile = 0; zeile < size; zeile++) {  // 2. eine Zeile pro Durchlauf
      for (int leer = 0; leer < zeile; leer++)
        System.out.print(" ");
      for (int kreuz = 0; kreuz < size - zeile; kreuz++)
        System.out.print("X");
      System.out.println();
    }
  }
  public static void main(String[] s) { dreieck(4); }   // 3. Aufruf
}
```

Ausgabe (4 Zeilen): `XXXX`, ` XXX`, `  XX`, `   X`.

## So gehst du eine Ausgabe-vorhersagen-Aufgabe an

1. **Wertetabelle anlegen** — eine Spalte pro Variable, eine Zeile pro Durchlauf. Nie im Kopf rechnen.
2. **Argumente vor dem Aufruf auswerten**, von links nach rechts, mitsamt Seiteneffekten.
3. **Typen prüfen:** `int`-Division? `char` als Zahl? `+` als Konkatenation statt Addition?
4. **Prä- oder Postfix?** Notiere, welcher Wert *benutzt* und welcher *gespeichert* wird.
5. **Bedingung nach dem Rumpf erneut prüfen** — `do while` testet am Ende, `while` am Anfang.
6. **`print` gegen `println`** unterscheiden und Zeilenumbrüche exakt setzen.
7. **Zum Schluss abschreiben**, Zeile für Zeile aus der Tabelle.

### Klausur05 Schritt für Schritt

```java
class Klausur05 {
  public static void main(String[] s) {
    MyInt i = new MyInt();
    do {
      System.out.println( i.print(i.me < 9, i) );
    } while (i.me < 12);
  }
}
class MyInt {
  public int me;
  public MyInt() { me = 7; }
  public int add3() { me = me + 3; return me; }
  public String print(boolean b, MyInt of) {
    if (!b) return "1" + "-" + of.add3();
    else    return "2" + "+" + of.add3();
  }
}
```

Der Trick: `i.me < 9` wird **vor** dem Aufruf ausgewertet (Regel 2), während `of.add3()` erst **im** Aufruf `me` verändert.

| Durchlauf | `me` vorher | Argument `i.me < 9` | `add3()` setzt `me` auf | Ausgabe | `while (i.me < 12)` |
|---|---|---|---|---|---|
| 1 | 7 | `true` | 10 | `2+10` | 10 < 12 → weiter |
| 2 | 10 | `false` | 13 | `1-13` | 13 < 12 → Ende |

Vollständige Ausgabe:

```
2+10
1-13
```

Häufigster Fehler hier: Man wertet `i.me < 9` erst *nach* `add3()` aus und bekommt im ersten Durchlauf `1-10`.

## Typische Fehler

- **Postfix mit Präfix verwechselt.** `b = a++` speichert den alten Wert; `b = ++a` den neuen.
- **`+` als Addition gelesen, wo konkateniert wird.** `1 + 2 + "a"` ist `"3a"`, `"a" + 1 + 2` ist `"a12"`.
- **`break` im `switch` vergessen** — die Ausführung läuft in den nächsten `case`.
- **Semikolon hinter `if`/`for`/`while`** (`while (b);` = Endlosschleife mit leerem Rumpf) oder **`{ }` vergessen**: ohne Block gehört nur die *erste* Anweisung dazu.
- **Off-by-one**, oder **`do while` als `while` gerechnet**: der Rumpf läuft mindestens einmal.
- **Seiteneffekte in Argumenten übersehen** (`i.print(i.me < 9, i)`) — genau das prüft `Klausur05.java`.

## Merksätze

- **`y = ++x` neu, `y = x++` alt** — das entscheidet ganze Ausgabe-Aufgaben.
- **`*` `/` `%` vor `+` `-`, alles vor Vergleichen, Zuweisung zuletzt.**
- **Sobald ein String im Spiel ist, konkateniert `+`** — von links nach rechts.
- **`while` prüft vorher, `do while` nachher, `for` zählt.**
- **Argumente werden vor dem Aufruf ausgewertet** — mit allen Seiteneffekten.
