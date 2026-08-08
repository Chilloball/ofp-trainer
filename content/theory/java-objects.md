## Warum das in der Klausur zählt

Dieses Kapitel ist der Punktesammler des Java-Teils. **Aufgabe 3 (12 P)** ist reines Kapitel 6: sechs Lücken à 2 P in einer Klasse mit Attributen, Konstruktor, `this`, statischem Zähler und `new` (Probeklausur_Java_ausfuellbar.pdf, S. 3). **Aufgabe 4 (12 P)** verlangt: *"Schreiben Sie eine Klasse … mit zwei Instanzmethoden (ohne `static`). Ergänzen Sie außerdem eine Klassenmethode `main`, die ein Objekt der Klasse erzeugt und beide Methoden testet."* Zusammen sind das **24 der 54 Java-Punkte** — fast die Hälfte.

Dazu kommt **Aufgabe 2 (4 P, "Was ist die Ausgabe dieses Programms?")**: `Klausur05.java`, `Klausur06.java` und `Klausur07.java` des Dozenten stammen alle aus diesem Kapitel (OFP_Java.pdf, S. 361–363).

## Anatomie einer Klasse — jedes Bauteil einmal

```java
class Konto {
  private static int anzahl = 0;                 // Klassenattribut: einmal für alle
  private static final double DISPO = -500.0;    // Konstante

  private String inhaber;                        // Instanzattribute: pro Objekt
  private double stand;

  public Konto(String inhaber, double stand) {   // Konstruktor: kein Rückgabetyp
    this.inhaber = inhaber;                      // this löst die Verdeckung auf
    this.stand   = stand;
    anzahl++;                                    // zählt die erzeugten Objekte
  }

  public Konto(String inhaber) {                 // überladener Konstruktor
    this(inhaber, 0.0);                          // this(...) als ERSTE Anweisung
  }

  public double getStand() { return stand; }     // Instanzmethode (getter)

  public void einzahlen(double betrag) {
    if (betrag > 0) stand += betrag;             // Prüfung im Setter/in der Methode
  }

  public boolean abheben(double b) {             // nutzt die Konstante DISPO
    if (stand - b < DISPO) return false;
    stand -= b; return true;
  }

  public static int getAnzahl() { return anzahl; }  // Klassenmethode

  public String toString() { return inhaber + ": " + stand; }

  public static void main(String[] s) {
    Konto a = new Konto("Hans", 100.0);
    Konto b = new Konto("Erna");                 // stand = 0.0
    b.einzahlen(50.0);
    System.out.println(b.abheben(600.0));        // unter dem Dispo -> false
    System.out.println(a);
    System.out.println(b);
    System.out.println("Konten: " + Konto.getAnzahl());
  }
}
```

Ausgabe: `false`, `Hans: 100.0`, `Erna: 50.0`, `Konten: 2`. `System.out.println(a)` ruft automatisch `toString()` auf — bereits Polymorphie (OFP_Java.pdf, S. 372).

## Bauplan für Klausuraufgabe 4

Dieses Gerüst schreibst du in der Klausur aus dem Gedächtnis hin und füllst nur noch die Namen aus der Aufgabenstellung ein. Es kompiliert genau so, wie es dasteht:

```java
class Muster {                                        // 1) Klassenname aus der Aufgabe
  private String attribut1;                           // 2) Attribute: IMMER private
  private int    attribut2;
  private static int anzahl = 0;                      //    nur bei "zähle die Objekte"

  public Muster(String attribut1, int attribut2) {    // 3) Konstruktor, kein Rückgabetyp
    this.attribut1 = attribut1;                       //    this. links, Parameter rechts
    this.attribut2 = attribut2;
    anzahl++;
  }

  public String getAttribut1() { return attribut1; }  // 4) getter ...
  public void setAttribut2(int a) {                   //    ... und setter mit Prüfung
    if (a >= 0) this.attribut2 = a;
  }

  public int rechne(int p) {                          // 5) die verlangte Instanzmethode
    return attribut2 + p;
  }

  public static int getAnzahl() { return anzahl; }    // 6) Klassenmethode

  public String toString() {                          // 7) hübsche Ausgabe
    return attribut1 + "/" + attribut2;
  }

  public static void main(String[] s) {               // 8) main ist static!
    Muster m = new Muster("A", 3);                    //    erst Objekt erzeugen ...
    System.out.println(m.rechne(4));                  //    ... dann Methode aufrufen
    System.out.println(m);
    System.out.println(Muster.getAnzahl());
  }
}
```

Ausgabe: `7`, `A/3`, `1`. Die Reihenfolge 1–8 ist deine **Checkliste beim Abgeben**. Punkt 8 ist der häufigste Totalausfall: `main` ist `static` und erreicht eine Instanzmethode **nur über ein Objekt**.

## Die drei static-Regeln

```java
class Zaehler {
  private int wert = 0;              // Instanzattribut
  private static int gesamt = 0;     // Klassenattribut

  public void hoch() {               // Instanzmethode
    wert++;                          // OK: Instanzattribut
    gesamt++;                        // OK: statisch geht aus Instanzmethode immer
  }

  public static int getGesamt() {    // Klassenmethode
    // return wert;                  // FEHLER: non-static variable wert cannot be
    //                               //         referenced from a static context
    // hoch();                       // FEHLER: dasselbe für Instanzmethoden
    return gesamt;                   // OK
  }
}

class StaticRegeln {
  public static void main(String[] s) {
    Zaehler a = new Zaehler(), b = new Zaehler();
    a.hoch(); a.hoch(); b.hoch();
    System.out.println(Zaehler.getGesamt());   // 3 -- gemeinsam für alle Objekte
  }
}
```

1. **`static` kennt kein `this`** — eine Klassenmethode kann weder Instanzattribute lesen noch Instanzmethoden aufrufen.
2. **Umgekehrt geht immer**: eine Instanzmethode darf auf statische Attribute und Methoden zugreifen.
3. **Ein Klassenattribut existiert einmal**, egal wie viele Objekte es gibt — auch schon vor dem ersten. Zugriff über `Klasse.attribut`.

`Klausur07.java` kombiniert das mit der `int`-Division: `anzahl++; this.note = anzahl / 2;` liefert für vier Objekte `0.0`, `1.0`, `1.0`, `2.0`, weil `anzahl / 2` **ganzzahlig** rechnet und erst danach nach `double` erweitert wird (OFP_Java.pdf, S. 363).

## Call by value: der Klassiker aus Klausur05 und Klausur06

Java übergibt **immer** call by value. Bei Objekten und Arrays wird der **Referenzwert** kopiert — beide Namen zeigen danach auf dasselbe Objekt (OFP_Java.pdf, S. 356).

```java
class Pair { int x, y; }

class CallByValue {
  static void swap(Pair p) {       // p zeigt auf DASSELBE Objekt
    int temp = p.x; p.x = p.y; p.y = temp;
  }
  static void neu(Pair p) {        // p ist eine KOPIE der Referenz
    p = new Pair();                // bindet nur die Kopie um
    p.x = 99;
  }
  static void erhoehe(int a) {     // primitiver Wert -> Kopie
    a = a + 1;
  }
  public static void main(String[] s) {
    Pair ab = new Pair();
    ab.x = 1; ab.y = 2;
    swap(ab);
    System.out.println(ab.x + "," + ab.y);   // 2,1  -> Änderung wirkt
    neu(ab);
    System.out.println(ab.x + "," + ab.y);   // 2,1  -> unverändert
    int z = 5;
    erhoehe(z);
    System.out.println(z);                   // 5    -> unverändert
  }
}
```

**Klausur06 vorgerechnet.** `myArray = {1,33,7}`, dann `myArray[0] = myArray.length + 1` → `{4,33,7}`. In `calc` läuft `for (int z = 2; z > 0; z -= 2)` **genau einmal** und macht `array[2]--` — das wirkt auf das Original; `number` ist dagegen eine Kopie. Durchlauf 1: `calc(myArray, 7)` → `{4,33,6}`, Ausgabe `7.0` (Rückgabetyp `double`). Durchlauf 2: `6 > 5` → `calc(myArray, 6)` → `{4,33,5}`, Ausgabe `6.0`. Danach bricht die Schleife ab. **Ausgabe: `7.0`, `6.0`.**

**Klausur05 vorgerechnet.** Entscheidend: **Argumente werden vor dem Aufruf ausgewertet, von links nach rechts.** Bei `i.print(i.me < 9, i)` ist `me == 7`, das erste Argument also `true`. Erst im Rumpf läuft `of.add3()` und setzt `me = 10` → `2+10`; `while (10 < 12)` ist erfüllt. Zweiter Durchlauf: `10 < 9` ist `false`, `add3()` setzt `me = 13` → `1-13`; `13 < 12` ist falsch, Ende. **Ausgabe: `2+10`, `1-13`.**

## this, this.x und this(...)

| Schreibweise | Bedeutung |
|---|---|
| `this` | Referenz auf das aktuelle Objekt, z. B. `return this;` |
| `this.laenge` | das **Attribut**, wenn ein Parameter gleichen Namens es verdeckt |
| `this(...)` | Aufruf eines **anderen Konstruktors derselben Klasse**, nur als **erste** Anweisung |

Im `Konto`-Beispiel oben delegiert `Konto(String)` per `this(inhaber, 0.0)` an den großen Konstruktor. Der Vorteil: `anzahl++` und alle Prüfungen stehen **an genau einer Stelle**. Das Skript zeigt dasselbe an der Klasse `Kugel` mit der Kette `Kugel(x,y,z,r)` → `Kugel(x,y,z)` → `Kugel()` (OFP_Java.pdf, S. 114). Merke: `this(...)` und `super(...)` müssen jeweils die **allererste** Anweisung sein und schließen sich damit gegenseitig aus.

## Kapselung & Sichtbarkeiten

| Modifikator | sichtbar in |
|---|---|
| `private` | nur in derselben Klasse |
| (ohne Angabe) | im selben Paket |
| `protected` | Klasse, Paket **und Unterklassen** |
| `public` | überall |

Faustregel des Skripts: **Attribute immer `private`**, Zugriff nur über `getXxx()`/`setXxx()`. Der Gewinn: Prüfungen im Setter (`if (a >= 0) …`) und eine feste Schnittstelle nach außen (OFP_Java.pdf, S. 126–127).

## Typische Fehler

1. **Instanzmethode direkt aus `main` aufrufen.** `main` ist `static` — erst `Muster m = new Muster(...)`, dann `m.methode()`.
2. **Rückgabetyp am Konstruktor.** `public void Konto(...)` ist kein Konstruktor mehr, sondern eine gewöhnliche Methode — das Objekt bleibt uninitialisiert.
3. **`this.` auf der falschen Seite.** `this.breite = this.breite;` setzt nichts; richtig ist `this.breite = breite;`.
4. **Instanzattribut in einer `static`-Methode lesen** → *"non-static variable cannot be referenced from a static context"*.
5. **`int`-Division übersehen**: `anzahl / 2` ist `0, 1, 1, 2`. Erst `(double) anzahl / 2` rechnet in Gleitkomma.
6. **Ein eigener Konstruktor verdrängt den Default-Konstruktor.** Sobald `Konto(String, double)` existiert, ist `new Konto()` ein Compiler-Fehler.
7. **`text.length` statt `text.length()`** — Strings haben eine Methode, Arrays ein Feld.

## Merksätze

- **Attribut links, Parameter rechts**: `this.x = x;` — das ist die halbe Aufgabe 3.
- **`static` hat kein `this`.** Alles andere folgt daraus.
- **Kopiert wird die Referenz, nicht das Objekt.** Deshalb wirkt `p.x = 5` nach außen, `p = new Pair()` aber nicht.
- **Argumente werden vor dem Aufruf ausgewertet**, von links nach rechts — die Falle in Klausur05.
- **`main` erzeugt erst ein Objekt, dann ruft sie Methoden darauf auf.**
