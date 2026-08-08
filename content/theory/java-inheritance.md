## Warum das in der Klausur zählt

**Aufgabe 5 ist mit 14 Punkten die punktreichste Einzelaufgabe der gesamten Klausur** — mehr als ein Viertel des Java-Teils. Ihr Zuschnitt ist seit Jahren derselbe: eine Oberklasse ist vorgegeben, du schreibst **(a)** eine Unterklasse mit zusätzlichem Attribut, `super(...)`-Konstruktor und überschriebener Methode (9 P) und **(b)** eine `main`, die ein **Array vom Obertyp** füllt und in einer Schleife polymorph durchläuft (5 P) (Probeklausur_Java_ausfuellbar.pdf, S. 4).

Dasselbe Muster steckt in `Klausur10.java`: ein `Gruss[]`-Array mit `Gruss`, `EnglischGruss` und `DeutschGruss`, dessen `gruss()`-Aufrufe die Ausgabe `Cheerio,Hi,Gutentag,` ergeben sollen (OFP_Java.pdf, S. 373). Dazu kommen Multiple-Choice-Fragen und Ausgabe-Vorhersagen, die fast immer **dynamische Bindung von Methoden gegen statische Bindung von Attributen** testen.

## Bauplan für Klausuraufgabe 5

Sechs Schritte, immer dieselben. Dieses Gerüst schreibst du in der Klausur aus dem Gedächtnis und ersetzt nur die Namen:

```java
// 0) Die Oberklasse ist in der Klausur meist vorgegeben:
class Form {
  protected String name;                       // protected -> für Unterklassen sichtbar
  public Form(String name) { this.name = name; }
  public double flaeche() { return 0.0; }
  public void druckeInfo() {
    System.out.println(name + " hat die Flaeche " + flaeche());
  }
}

// 1) Unterklasse: extends
class Kreis extends Form {
  private double radius;                       // 2) zusätzliches Attribut

  public Kreis(double radius) {                // 3) Konstruktor
    super("Kreis");                            //    super(...) als ERSTE Anweisung
    this.radius = radius;                      //    this löst die Verdeckung auf
  }

  public double flaeche() {                    // 4) überschreiben: gleiche Signatur
    return 3.14159 * radius * radius;
  }
}

class Quadrat extends Form {
  private double seite;
  public Quadrat(double seite) {
    super("Quadrat");
    this.seite = seite;
  }
  public double flaeche() { return seite * seite; }
  public void druckeInfo() {
    super.druckeInfo();                        // Fassung der Oberklasse wiederverwenden
    System.out.println("  Seite: " + seite);
  }
}

class FormTest {
  public static void main(String[] s) {
    // 5) Array vom OBERTYP -- nimmt alle Untertypen auf
    Form[] formen = { new Form("Punkt"), new Kreis(2.0), new Quadrat(3.0) };

    // 6) Schleife: dynamische Bindung wählt die richtige Methode
    for (int i = 0; i < formen.length; i++) {
      formen[i].druckeInfo();
    }
  }
}
```

Ausgabe:

```
Punkt hat die Flaeche 0.0
Kreis hat die Flaeche 12.56636
Quadrat hat die Flaeche 9.0
  Seite: 3.0
```

Zwei Details, die Punkte kosten: `super("Kreis")` ist **zwingend**, weil `Form` keinen parameterlosen Konstruktor hat — ohne die Zeile fügt der Compiler `super()` ein und bricht ab. Und in `Quadrat.druckeInfo()` muss `super.druckeInfo()` stehen; ein einfaches `druckeInfo()` wäre die eigene Methode und damit Endlosrekursion.

## Überschreiben vs. Überladen

| | Überschreiben (overriding) | Überladen (overloading) |
|---|---|---|
| Wo? | in der **Unterklasse** | in **derselben** Klasse (oder geerbt) |
| Signatur | **exakt gleich**, auch der Rückgabetyp | **andere** Parameterliste |
| Auswahl | zur **Laufzeit** (dynamisch), nach dem Objekt | zur **Übersetzungszeit** (statisch), nach den Argumenttypen |
| Zweck | Verhalten ersetzen | dieselbe Idee für verschiedene Typen |

```java
class Drucker {
  public void drucke(int zahl)      { System.out.println("int: " + zahl); }
  public void drucke(String name)   { System.out.println("String: " + name); }
  public void drucke(int a, int b)  { System.out.println("zwei: " + (a + b)); }
  // public String drucke(int zahl) { return ""; }  // FEHLER: nur der Rückgabetyp
  //                                                //        unterscheidet nicht
}
```

Ausgabe von `drucke(10)`, `drucke("hallo")`, `drucke(3, 4)`: `int: 10`, `String: hallo`, `zwei: 7`. Beim **Überschreiben** müssen Signatur und Ergebnistyp exakt übereinstimmen: `void op(double p)` in der Unterklasse überschreibt `void op(int p)` nicht, sondern überlädt es, und `int op(int p)` gegenüber `void op(int p)` ist ein Compiler-Fehler (OFP_Java.pdf, S. 216). `@Override` ist optional, deckt aber genau solche Tippfehler auf.

## Dynamische Bindung — und warum Attribute davon ausgenommen sind

Das ist die Lieblingsfangfrage. **Methoden werden dynamisch gebunden** (es zählt das Objekt), **Attribute und Klassenmethoden statisch** (es zählt der Typ der Variablen) (OFP_Java.pdf, S. 232–233).

```java
class Ober {
  public int attr = 1;                              // Attribut der Oberklasse
  public static int kattr = 10;
  public int op(int i) { return i + 1; }
  public static int kop() { return 4; }
}

class Unter extends Ober {
  public int attr = 2;                              // verdeckt Ober.attr
  public static int kattr = 20;
  public int op(int i) { return i + 2; }            // UEBERSCHREIBEN
  public int op(double d) { return 7; }             // UEBERLADEN (andere Parameterliste)
  public static int kop() { return 8; }
}

class Bindung {
  public static void main(String[] s) {
    Ober o = new Ober();
    Unter u = new Unter();
    Ober[] arr = { new Ober(), new Unter() };

    System.out.println(arr[0].op(1));   // 2  -> Ober.op
    System.out.println(arr[1].op(1));   // 3  -> Unter.op  (dynamische Bindung!)
    System.out.println(o.op(5));        // 6
    System.out.println(u.op(6.2));      // 7  -> überladene Fassung, statisch gewählt
    System.out.println(o.attr);         // 1  \  Attribute: STATISCH gebunden,
    System.out.println(u.attr);         // 2  /  es zählt der Variablentyp
    System.out.println(((Ober) u).attr);// 1  -> Beweis: Cast ändert das Ergebnis!
    System.out.println(Ober.kattr);     // 10
    System.out.println(Unter.kop());    // 8
  }
}
```

`((Ober) u).attr` ist der Beweis: bei Attributen ändert ein Cast das Ergebnis (`1` statt `2`), bei Methoden **nie**. Merkregel des Skripts: *"jedes Objekt kennt seine Methoden"* — die Attribute liegen dagegen doppelt im Speicher, und der Compiler wählt nach dem deklarierten Typ.

**Casts und `instanceof`.** Aufwärts geht implizit: `Form f = new Kreis(2.0);`. Abwärts braucht einen expliziten Cast, der bei falschem Typ zur Laufzeit eine `ClassCastException` wirft — deshalb erst prüfen: `if (f instanceof Kreis) { Kreis k = (Kreis) f; … }` (OFP_Java.pdf, S. 235).

## Abstrakte Klassen und Interfaces

```java
interface Bezahlbar {                          // Methoden ohne Rumpf, implizit public
  double gebuehr();
}

abstract class Zahlungsmethode implements Bezahlbar {
  protected String name;
  public Zahlungsmethode(String name) { this.name = name; }
  public abstract void bezahlen(double betrag); // abstrakt -> Klasse muss abstract sein
  public void protokoll() {                     // normale Methode ist erlaubt
    System.out.print(name + ": ");
  }
}

class Kreditkarte extends Zahlungsmethode {
  public Kreditkarte() { super("Kreditkarte"); }
  public void bezahlen(double betrag) {
    protokoll();
    System.out.println(betrag + " Euro, Gebuehr " + gebuehr());
  }
  public double gebuehr() { return 1.5; }
}

class ZahlungTest {
  public static void main(String[] s) {
    // Zahlungsmethode z = new Zahlungsmethode("x");  // FEHLER: abstrakt, kein new
    Zahlungsmethode[] arten = { new Kreditkarte() };
    for (int i = 0; i < arten.length; i++) {
      arten[i].bezahlen(20.0);
      if (arten[i] instanceof Kreditkarte) {         // Typtest vor dem Downcast
        Kreditkarte k = (Kreditkarte) arten[i];
        System.out.println("  -> Kartenzahlung, " + k.gebuehr() + " Euro extra");
      }
    }
  }
}
```

Ausgabe: `Kreditkarte: 20.0 Euro, Gebuehr 1.5` und `  -> Kartenzahlung, 1.5 Euro extra`.

Die Regeln: eine Klasse mit mindestens einer abstrakten Methode **muss** `abstract` sein und lässt sich nicht mit `new` erzeugen — Attribute, Konstruktoren und normale Methoden darf sie trotzdem haben. Ein Interface deklariert nur Signaturen; implementierende Methoden **müssen public** sein. Eine Klasse erweitert genau **eine** Klasse, implementiert aber **beliebig viele** Interfaces; implementiert sie nicht alle Methoden, bleibt sie abstrakt (OFP_Java.pdf, S. 204–208).

## Object und toString

Jede Klasse erbt implizit von `Object`. Überschreibst du `toString()`, nutzt `System.out.println(obj)` es automatisch, weil `println(Object)` intern `obj.toString()` aufruft — echte Polymorphie im Standard-Framework (OFP_Java.pdf, S. 372).

```java
class Tier {
  protected String gattung;
  public Tier(String g) { gattung = g; }
  public String toString() { return "Tier der Gattung " + gattung + "."; }
}
class Hund extends Tier {
  private String name;
  public Hund(String name) { super("Hund"); this.name = name; }
  public String toString() { return "Ich bin " + name + "."; }
}
class TierDemo {
  public static void main(String[] s) {
    Tier[] tiere = { new Tier("Katze"), new Hund("Waldi") };
    for (int i = 0; i < tiere.length; i++) {
      System.out.println(tiere[i]);   // println(Object) ruft intern toString() auf
    }
  }
}
```

Ausgabe: `Tier der Gattung Katze.` und `Ich bin Waldi.`

## Typische Fehler

1. **`super(...)` vergessen**, obwohl die Oberklasse keinen parameterlosen Konstruktor hat → *"constructor Form in class Form cannot be applied to given types"*.
2. **`super(...)` nicht als erste Anweisung** — wie `this(...)` muss es ganz oben stehen; beide schließen sich aus.
3. **`Kreis[] arr` statt `Form[] arr`** — damit ist keine Polymorphie gezeigt, Teil (b) bringt kaum Punkte.
4. **`druckeInfo()` statt `super.druckeInfo()`** in der überschriebenen Methode → `StackOverflowError`.
5. **Signatur beim Überschreiben verändert** (`flaeche(int)`) — das ist Überladen, die Oberklassen-Version bleibt aktiv.
6. **Von Attributen dynamische Bindung erwarten.** `((Ober) u).attr` liefert `1`, nicht `2`.
7. **Downcast ohne `instanceof`** → `ClassCastException` zur Laufzeit.
8. **Interface-Methode nicht `public` implementieren** → *"attempting to assign weaker access privileges"*.

## Merksätze

- **Methoden folgen dem Objekt, Attribute folgen dem Variablentyp.**
- **`super(...)` und `this(...)` stehen ganz oben — oder gar nicht.**
- **Array vom Obertyp + Schleife = die 5 Punkte aus Teil (b).** Ohne sie ist es keine Polymorphie.
- **Gleiche Signatur = überschreiben, andere Parameterliste = überladen.** Der Rückgabetyp allein unterscheidet nichts.
- **`extends` einmal, `implements` beliebig oft.**
