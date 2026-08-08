/* Testfälle für den Java-Interpreter. Aufruf: npm run test:java */
import { runJava } from '../src/lib/java/index'

interface Case {
  name: string
  src: string
  stdin?: string
  expect: string
}

const cases: Case[] = [
  {
    name: 'Hallo Welt',
    src: `public class Main { public static void main(String[] a){ System.out.println("Hallo Welt"); } }`,
    expect: 'Hallo Welt\n',
  },
  {
    name: 'int-Division schneidet ab',
    src: `int a = 7, b = 2; System.out.println(a / b); System.out.println(a % b); System.out.println(7.0 / 2);`,
    expect: '3\n1\n3.5\n',
  },
  {
    name: 'double wird mit .0 ausgegeben',
    src: `System.out.println(4.0); System.out.println(2.0 * 3); System.out.println(1.0 / 3);`,
    expect: '4.0\n6.0\n0.3333333333333333\n',
  },
  {
    name: 'int-Ueberlauf',
    src: `int x = Integer.MAX_VALUE; System.out.println(x + 1);`,
    expect: '-2147483648\n',
  },
  {
    name: 'char rechnet als Zahl',
    src: `char c = 'a'; System.out.println(c + 1); System.out.println((char)(c + 1)); System.out.println("" + c + 1);`,
    expect: '98\nb\na1\n',
  },
  {
    name: 'String-Verkettung mit Zahlen',
    src: `System.out.println(1 + 2 + "x" + 1 + 2);`,
    expect: '3x12\n',
  },
  {
    name: 'Schleifen und break/continue',
    src: `int s = 0; for (int i = 1; i <= 10; i++) { if (i % 2 == 0) continue; if (i > 7) break; s += i; } System.out.println(s);`,
    expect: '16\n',
  },
  {
    name: 'while mit Vor- und Nachinkrement',
    src: `int i = 0; int a = i++; int b = ++i; System.out.println(a + " " + b + " " + i);`,
    expect: '0 2 2\n',
  },
  {
    name: 'Arrays',
    src: `int[] z = new int[5]; z[2] = 42; System.out.println(z.length + " " + z[2] + " " + z[0]);
int[] f = {3, 1, 2};
java.util.Arrays.sort(f);
System.out.println(java.util.Arrays.toString(f));`,
    expect: '5 42 0\n[1, 2, 3]\n',
  },
  {
    name: 'zweidimensionale Arrays',
    src: `int[][] m = new int[2][3]; m[1][2] = 9;
for (int[] row : m) System.out.println(java.util.Arrays.toString(row));`,
    expect: '[0, 0, 0]\n[0, 0, 9]\n',
  },
  {
    name: 'String-Methoden',
    src: `String s = "Hallo Welt";
System.out.println(s.length());
System.out.println(s.substring(6));
System.out.println(s.toUpperCase());
System.out.println(s.indexOf("Welt"));
System.out.println(s.charAt(0));
System.out.println(s.replace("l", "L"));`,
    expect: '10\nWelt\nHALLO WELT\n6\nH\nHaLLo WeLt\n',
  },
  {
    name: 'Klassen, Konstruktor, toString',
    src: `class Punkt {
  private int x, y;
  Punkt(int x, int y) { this.x = x; this.y = y; }
  public String toString() { return "(" + x + "|" + y + ")"; }
  int summe() { return x + y; }
}
public class Main {
  public static void main(String[] a) {
    Punkt p = new Punkt(3, 4);
    System.out.println(p);
    System.out.println(p.summe());
  }
}`,
    expect: '(3|4)\n7\n',
  },
  {
    name: 'Vererbung und Polymorphie',
    src: `class Tier {
  String name;
  Tier(String n) { name = n; }
  String laut() { return "..."; }
  public String toString() { return name + " sagt " + laut(); }
}
class Hund extends Tier {
  Hund(String n) { super(n); }
  @Override String laut() { return "Wau"; }
}
class Katze extends Tier {
  Katze(String n) { super(n); }
  @Override String laut() { return "Miau"; }
}
public class Main {
  public static void main(String[] a) {
    Tier[] tiere = { new Hund("Rex"), new Katze("Mimi"), new Tier("Ding") };
    for (Tier t : tiere) System.out.println(t);
    System.out.println(tiere[0] instanceof Hund);
    System.out.println(tiere[1] instanceof Hund);
  }
}`,
    expect: 'Rex sagt Wau\nMimi sagt Miau\nDing sagt ...\ntrue\nfalse\n',
  },
  {
    name: 'statische Felder und Methoden',
    src: `class Zaehler {
  static int anzahl = 0;
  Zaehler() { anzahl++; }
  static int get() { return anzahl; }
}
public class Main { public static void main(String[] a) {
  new Zaehler(); new Zaehler(); new Zaehler();
  System.out.println(Zaehler.get());
} }`,
    expect: '3\n',
  },
  {
    name: 'Interface mit Default-Methode',
    src: `interface Form {
  double flaeche();
  default String beschreibung() { return "Flaeche = " + flaeche(); }
}
class Rechteck implements Form {
  double a, b;
  Rechteck(double a, double b) { this.a = a; this.b = b; }
  public double flaeche() { return a * b; }
}
public class Main { public static void main(String[] x) {
  Form f = new Rechteck(2, 3.5);
  System.out.println(f.beschreibung());
} }`,
    expect: 'Flaeche = 7.0\n',
  },
  {
    name: 'abstrakte Klasse',
    src: `abstract class Fahrzeug {
  abstract int raeder();
  void zeig() { System.out.println(getClass().getSimpleName() + ": " + raeder()); }
}
class Auto extends Fahrzeug { int raeder() { return 4; } }
class Rad extends Fahrzeug { int raeder() { return 2; } }
public class Main { public static void main(String[] a) { new Auto().zeig(); new Rad().zeig(); } }`,
    expect: 'Auto: 4\nRad: 2\n',
  },
  {
    name: 'Ausnahmebehandlung',
    src: `public class Main { public static void main(String[] a) {
  try {
    int[] z = new int[2];
    z[5] = 1;
  } catch (ArrayIndexOutOfBoundsException e) {
    System.out.println("Index-Fehler");
  } finally {
    System.out.println("fertig");
  }
  try { System.out.println(1 / 0); }
  catch (ArithmeticException e) { System.out.println("Fehler: " + e.getMessage()); }
} }`,
    expect: 'Index-Fehler\nfertig\nFehler: / by zero\n',
  },
  {
    name: 'eigene Ausnahme',
    src: `class ZuKleinException extends Exception {
  ZuKleinException(String m) { super(m); }
}
public class Main {
  static void pruefe(int x) throws ZuKleinException {
    if (x < 10) throw new ZuKleinException("x ist " + x);
  }
  public static void main(String[] a) {
    try { pruefe(3); }
    catch (ZuKleinException e) { System.out.println("Gefangen: " + e.getMessage()); }
    catch (Exception e) { System.out.println("falscher Zweig"); }
  }
}`,
    expect: 'Gefangen: x ist 3\n',
  },
  {
    name: 'switch mit Fallthrough',
    src: `int n = 2;
switch (n) {
  case 1: System.out.println("eins");
  case 2: System.out.println("zwei");
  case 3: System.out.println("drei"); break;
  default: System.out.println("andere");
}`,
    expect: 'zwei\ndrei\n',
  },
  {
    name: 'switch mit String',
    src: `String s = "gruen";
switch (s) { case "rot": System.out.println(1); break; case "gruen": System.out.println(2); break; default: System.out.println(3); }`,
    expect: '2\n',
  },
  {
    name: 'Rekursion',
    src: `public class Main {
  static long fak(int n) { return n <= 1 ? 1 : n * fak(n - 1); }
  static int fib(int n) { return n < 2 ? n : fib(n-1) + fib(n-2); }
  public static void main(String[] a) {
    System.out.println(fak(10));
    System.out.println(fib(15));
  }
}`,
    expect: '3628800\n610\n',
  },
  {
    name: 'ArrayList und HashMap',
    src: `import java.util.*;
public class Main { public static void main(String[] a) {
  List<String> liste = new ArrayList<>();
  liste.add("b"); liste.add("a"); liste.add("c");
  System.out.println(liste);
  System.out.println(liste.size() + " " + liste.get(1) + " " + liste.contains("c"));
  Collections.sort(liste);
  System.out.println(liste);
  Map<String, Integer> m = new HashMap<>();
  m.put("eins", 1); m.put("zwei", 2);
  System.out.println(m.get("zwei") + " " + m.containsKey("drei") + " " + m.size());
} }`,
    expect: '[b, a, c]\n3 a true\n[a, b, c]\n2 false 2\n',
  },
  {
    name: 'StringBuilder',
    src: `StringBuilder sb = new StringBuilder();
for (int i = 1; i <= 3; i++) sb.append(i).append("-");
sb.append("Ende");
System.out.println(sb.toString());
System.out.println(sb.length());
System.out.println(new StringBuilder("abc").reverse());`,
    expect: '1-2-3-Ende\n10\ncba\n',
  },
  {
    name: 'Scanner liest Eingaben',
    src: `import java.util.Scanner;
public class Main { public static void main(String[] a) {
  Scanner sc = new Scanner(System.in);
  int n = sc.nextInt();
  String name = sc.next();
  System.out.println("Hallo " + name + ", " + (n * 2));
} }`,
    stdin: '21\nWelt\n',
    expect: 'Hallo Welt, 42\n',
  },
  {
    name: 'printf',
    src: `System.out.printf("%d %5.2f %s %b%n", 42, 3.14159, "hi", true);
System.out.printf("[%-6s][%06d]%n", "ab", 42);`,
    expect: '42  3.14 hi true\n[ab    ][000042]\n',
  },
  {
    name: 'Math-Funktionen',
    src: `System.out.println(Math.max(3, 7));
System.out.println(Math.abs(-4.5));
System.out.println(Math.pow(2, 10));
System.out.println(Math.sqrt(16));
System.out.println(Math.round(2.5));`,
    expect: '7\n4.5\n1024.0\n4.0\n3\n',
  },
  {
    name: 'Wrapper und Parsen',
    src: `int x = Integer.parseInt("123");
double d = Double.parseDouble("2.5");
System.out.println(x + " " + d);
System.out.println(Integer.MAX_VALUE);
System.out.println(Integer.toBinaryString(10));
System.out.println(Character.isDigit('7'));`,
    expect: '123 2.5\n2147483647\n1010\ntrue\n',
  },
  {
    name: 'String-Vergleich mit == und equals',
    src: `String a = "abc";
String b = "abc";
String c = new String("abc");
System.out.println(a == b);
System.out.println(a.equals(c));`,
    expect: 'true\ntrue\n',
  },
  {
    name: 'Enum',
    src: `enum Farbe { ROT, GRUEN, BLAU }
public class Main { public static void main(String[] a) {
  for (Farbe f : Farbe.values()) System.out.print(f + " ");
  System.out.println();
  Farbe f = Farbe.GRUEN;
  switch (f) { case ROT: System.out.println("r"); break; case GRUEN: System.out.println("g"); break; default: System.out.println("?"); }
  System.out.println(f.ordinal());
} }`,
    expect: 'ROT GRUEN BLAU \ng\n1\n',
  },
  {
    name: 'Endlosschleife wird gestoppt',
    src: `while (true) { int x = 1; }`,
    expect: '__TIMEOUT__',
  },
  {
    name: 'markierte Schleife',
    src: `aussen:
for (int i = 0; i < 3; i++) {
  for (int j = 0; j < 3; j++) {
    if (j == 2) continue aussen;
    if (i == 2) break aussen;
    System.out.print(i + "" + j + " ");
  }
}
System.out.println();`,
    expect: '00 01 10 11 \n',
  },
  {
    name: 'Überladung',
    src: `public class Main {
  static String f(int x) { return "int"; }
  static String f(double x) { return "double"; }
  static String f(String x) { return "String"; }
  public static void main(String[] a) {
    System.out.println(f(1) + " " + f(1.5) + " " + f("x"));
  }
}`,
    expect: 'int double String\n',
  },
  {
    name: 'Ganzzahltypen und Casts',
    src: `byte b = (byte) 200;
short s = (short) 70000;
long l = 3000000000L;
System.out.println(b + " " + s + " " + l);
System.out.println((int) 3.99);
System.out.println((int) -3.99);`,
    expect: '-56 4464 3000000000\n3\n-3\n',
  },
  {
    name: 'Nullzeiger',
    src: `String s = null;
try { System.out.println(s.length()); }
catch (NullPointerException e) { System.out.println("NPE gefangen"); }`,
    expect: 'NPE gefangen\n',
  },
  {
    name: 'Bitoperationen',
    src: `int a = 12, b = 10;
System.out.println((a & b) + " " + (a | b) + " " + (a ^ b) + " " + (~a) + " " + (a << 2) + " " + (a >> 2) + " " + (-8 >>> 28));`,
    expect: '8 14 6 -13 48 3 15\n',
  },
  {
    name: 'Verbundzuweisung mit implizitem Cast',
    src: `int i = 5; i += 2.7; System.out.println(i);
char c = 'a'; c += 2; System.out.println(c);`,
    expect: '7\nc\n',
  },
  {
    name: 'Objekt-Gleichheit und equals',
    src: `class P { int x; P(int x){this.x=x;} public boolean equals(Object o){ return o instanceof P && ((P)o).x == x; } }
public class Main { public static void main(String[] a) {
  P p1 = new P(1), p2 = new P(1);
  System.out.println(p1 == p2);
  System.out.println(p1.equals(p2));
} }`,
    expect: 'false\ntrue\n',
  },
  {
    name: 'erweiterte for-Schleife über ArrayList',
    src: `import java.util.*;
public class Main { public static void main(String[] a) {
  List<Integer> zahlen = new ArrayList<>();
  for (int i = 1; i <= 4; i++) zahlen.add(i * i);
  int summe = 0;
  for (int z : zahlen) summe += z;
  System.out.println(zahlen + " -> " + summe);
} }`,
    expect: '[1, 4, 9, 16] -> 30\n',
  },
  {
    name: 'do-while',
    src: `int i = 5; do { System.out.print(i + " "); i--; } while (i > 3); System.out.println();`,
    expect: '5 4 \n',
  },
  {
    name: 'Array wird ohne Arrays.toString als Referenz gedruckt',
    src: `int[] z = {1,2,3}; String s = "" + z; System.out.println(s.startsWith("[I@"));`,
    expect: 'true\n',
  },
  {
    name: 'Getter/Setter und Kapselung',
    src: `class Konto {
  private double stand;
  public void einzahlen(double b) { if (b > 0) stand += b; }
  public double getStand() { return stand; }
}
public class Main { public static void main(String[] a) {
  Konto k = new Konto();
  k.einzahlen(50.5); k.einzahlen(-10); k.einzahlen(9.5);
  System.out.println(k.getStand());
} }`,
    expect: '60.0\n',
  },
  {
    name: 'Konstruktorverkettung mit this(...)',
    src: `class A {
  int x, y;
  A() { this(1, 2); }
  A(int x, int y) { this.x = x; this.y = y; }
  public String toString(){ return x + "," + y; }
}
public class Main { public static void main(String[] a){ System.out.println(new A()); } }`,
    expect: '1,2\n',
  },
  {
    name: 'String-Identität: Pool, new und Verkettung',
    src: `String a = "Java";
String b = "Java";
String c = new String("Java");
String d = "Ja" + "va";
String e = "Ja";
String f = e + "va";
System.out.println(a == b);
System.out.println(a == c);
System.out.println(a.equals(c));
System.out.println(a == d);
System.out.println(a == f);
System.out.println(a.equals(f));
System.out.println(a == f.intern());`,
    expect: 'true\nfalse\ntrue\ntrue\nfalse\ntrue\ntrue\n',
  },
  {
    name: 'split liefert neue String-Objekte',
    src: `String[] w = "Wir lernen Java".split(" ");
System.out.println(w[2].equals("Java"));
System.out.println(w[2] == "Java");
System.out.println("abc".substring(0) == "abc");`,
    expect: 'true\nfalse\ntrue\n',
  },
  {
    name: 'Feldverdeckung: Felder binden statisch, Methoden dynamisch',
    src: `class Ober {
  public int attr = 1;
  public int hole() { return attr; }
}
class Unter extends Ober {
  public int attr = 2;
  public int hole() { return attr; }
  public int holeOber() { return super.attr; }
}
public class Main { public static void main(String[] s) {
  Ober o = new Unter();
  Unter u = new Unter();
  System.out.println(o.attr);
  System.out.println(u.attr);
  System.out.println(o.hole());
  System.out.println(((Ober) u).attr);
  System.out.println(u.holeOber());
} }`,
    expect: '1\n2\n2\n1\n1\n',
  },
  {
    name: 'Konstruktorreihenfolge: Oberklasse sieht Standardwerte',
    src: `class Basis {
  protected int wert = 1;
  public Basis() { System.out.println("Basis-Konstruktor"); zeige(); }
  public void zeige() { System.out.println("Basis wert = " + wert); }
}
class Abgeleitet extends Basis {
  private int extra = 100;
  public Abgeleitet(int w) { super(); wert = w; System.out.println("Abgeleitet-Konstruktor"); }
  public void zeige() { System.out.println("Abgeleitet wert = " + wert + ", extra = " + extra); }
}
public class Main { public static void main(String[] s) { new Abgeleitet(7).zeige(); } }`,
    expect:
      'Basis-Konstruktor\nAbgeleitet wert = 1, extra = 0\nAbgeleitet-Konstruktor\nAbgeleitet wert = 7, extra = 100\n',
  },
  {
    name: 'impliziter Aufruf von super()',
    src: `class A { A() { System.out.println("A()"); } }
class B extends A { B(int x) { System.out.println("B(" + x + ")"); } }
class C extends B { C() { super(9); System.out.println("C()"); } }
public class Main { public static void main(String[] s) { new C(); System.out.println("---"); new B(1); } }`,
    expect: 'A()\nB(9)\nC()\n---\nA()\nB(1)\n',
  },
  {
    name: 'Interface-Konstanten werden geerbt',
    src: `interface Figur { double FAKTOR = 0.5; double flaeche(); }
class Dreieck implements Figur {
  private double g, h;
  Dreieck(double g, double h) { this.g = g; this.h = h; }
  public double flaeche() { return FAKTOR * g * h; }
}
public class Main { public static void main(String[] s) {
  System.out.println(new Dreieck(8, 5).flaeche());
  System.out.println(Figur.FAKTOR);
} }`,
    expect: '20.0\n0.5\n',
  },
  {
    name: 'Integer.parseInt ist streng',
    src: `try { Integer.parseInt("7x"); } catch (NumberFormatException e) { System.out.println("1: " + e.getMessage()); }
try { Integer.parseInt(" 8"); } catch (NumberFormatException e) { System.out.println("2: " + e.getMessage()); }
System.out.println(Integer.parseInt("-42"));`,
    expect: '1: For input string: "7x"\n2: For input string: " 8"\n-42\n',
  },
  {
    name: 'Unicode-Escape wird vor dem Kommentar aufgelöst',
    src: `public class Main { public static void main(String[] a) {
    // Debug: \\u000A System.out.println("versteckt");
    System.out.println("sichtbar");
  } }`,
    expect: 'versteckt\nsichtbar\n',
  },
  {
    name: 'Thread: start() ruft run()',
    src: `class Zaehler extends Thread {
  private String was;
  Zaehler(String was) { this.was = was; }
  public void run() { for (int i = 1; i <= 2; i++) System.out.println(was + ": " + i); }
}
public class Main { public static void main(String[] a) throws Exception {
  Zaehler z = new Zaehler("A");
  z.start(); z.join();
  System.out.println("in " + Thread.currentThread().getName());
} }`,
    expect: 'A: 1\nA: 2\nin main\n',
  },
  {
    name: 'Fehlermeldung bei fehlendem Semikolon',
    src: `int x = 5\nSystem.out.println(x);`,
    expect: '__COMPILE_ERROR__',
  },
]

let passed = 0
const failures: string[] = []

for (const c of cases) {
  const r = runJava(c.src, { stdin: c.stdin, maxMillis: 2500 })
  let ok: boolean
  let actual: string

  if (c.expect === '__TIMEOUT__') {
    ok = r.timedOut
    actual = r.timedOut ? '<timeout>' : r.stdout + r.stderr
  } else if (c.expect === '__COMPILE_ERROR__') {
    ok = !r.compiled
    actual = r.compiled ? '<kompiliert>' : r.stderr
  } else {
    actual = r.stdout
    ok = actual === c.expect && !r.exception
    if (!ok && r.exception) actual += `\n[Ausnahme] ${r.exception.type}: ${r.exception.message}`
    if (!ok && r.stderr) actual += `\n[stderr] ${r.stderr}`
  }

  if (ok) passed++
  else {
    failures.push(
      `✗ ${c.name}\n  erwartet: ${JSON.stringify(c.expect)}\n  bekommen: ${JSON.stringify(actual)}`,
    )
  }
}

console.log(`Java-Interpreter: ${passed}/${cases.length} Tests bestanden`)
if (failures.length) {
  console.log('\n' + failures.join('\n\n'))
  process.exit(1)
}
