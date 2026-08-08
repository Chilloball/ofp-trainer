## Warum das hier bewusst kurz ist

Ehrlich gesagt: **Diese beiden Kapitel fehlen komplett im Klausur-Überblick des Skripts.** Die Zusammenfassung auf S. 347–374 deckt nur die Kapitel 1 bis 8 ab und endet mit der Ausnahmebehandlung (OFP_Java.pdf, S. 374). Auch in der Probeklausur kommen Dateien, Serialisierung, Threads und Sockets in keiner der fünf Aufgaben vor.

Trotzdem gilt die Warnung des Dozenten sinngemäß: *"Sollte etwas aus der Vorlesung in dem Überblick fehlen, bedeutet dies NICHT, dass dies nicht klausurrelevant ist!"* Realistisch bleibt hier eine **Kurzfrage oder ein Multiple-Choice-Punkt** aus Aufgabe 1 — mehr nicht. Lerne deshalb genau die vier Begriffspaare unten und investiere die Zeit lieber in Kapitel 6 und 7.

## Dateien, Ströme, Serialisierung (Kap. 9)

- **Schreiben**: `FileWriter` / `PrintWriter`. **Lesen**: `FileReader` / `BufferedReader` oder `Scanner`.
- Ströme im **`finally`** schließen (`if (pw != null) pw.close();`) oder try-with-resources nutzen — genau so steht es in der Zusammenfassung (OFP_Java.pdf, S. 374).
- **Serialisierung** heißt: ein Objekt als Bytefolge speichern und später wieder herstellen. Voraussetzung: `implements Serializable` — ein **Marker-Interface** ganz ohne Methoden. Alle Referenzen im Objekt müssen ebenfalls serialisierbar sein (OFP_Java.pdf, S. 295).
- `ObjectOutputStream.writeObject(obj)` schreibt, `ObjectInputStream.readObject()` liest zurück (Rückgabetyp `Object`, also casten).
- **`transient`** schließt ein Attribut von der Serialisierung aus — beim Einlesen steht dort der Standardwert.

## Threads & Sockets (Kap. 10)

- Ein Thread entsteht über `class T extends Thread` **oder** `class T implements Runnable`; die Arbeit steht in `run()`.
- **`start()` startet einen neuen Thread, `run()` ruft nur ganz normal eine Methode auf** — das ist die klassische Prüfungsfrage.
- **`join()`** wartet auf das Ende eines Threads, wenn man sein Ergebnis braucht (OFP_Java.pdf, S. 313).
- **`synchronized`** schützt kritische Abschnitte, damit zwei Threads eine gemeinsame Variable nicht gleichzeitig verändern (Race Condition, Bankkonto-Beispiel). Anwendbar auf eine Methode oder einen Block: `synchronized (obj) { … }`.
- **Sockets**: `ServerSocket` wartet mit `accept()` auf Verbindungen, `Socket` verbindet sich als Client (EchoServer / EchoClient).

## Ein Beispiel, das beides zeigt

```java
import java.io.*;

class Punkt implements Serializable {       // Marker-Interface, keine Methoden
  private int x;
  private transient int cache;              // wird NICHT serialisiert
  public Punkt(int x) { this.x = x; this.cache = 42; }
  public String toString() { return "x=" + x + ", cache=" + cache; }
}

class Zaehlwerk extends Thread {
  private static int gemeinsam = 0;
  public void run() {                       // läuft nebenläufig
    for (int i = 0; i < 1000; i++) erhoehe();
  }
  private static synchronized void erhoehe() { gemeinsam++; }  // kritischer Abschnitt
  public static int get() { return gemeinsam; }
}

class IoThreadDemo {
  public static void main(String[] s) throws Exception {
    // 1) Serialisieren und wieder einlesen
    ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream("p.ser"));
    oos.writeObject(new Punkt(7));
    oos.close();
    ObjectInputStream ois = new ObjectInputStream(new FileInputStream("p.ser"));
    System.out.println((Punkt) ois.readObject());   // cache ist weg -> 0
    ois.close();

    // 2) Threads: start() statt run(), dann join()
    Zaehlwerk t1 = new Zaehlwerk(), t2 = new Zaehlwerk();
    t1.start(); t2.start();
    t1.join();  t2.join();
    System.out.println(Zaehlwerk.get());            // 2000 dank synchronized
  }
}
```

Ausgabe: `x=7, cache=0` und `2000`. Beide Zeilen sind genau die prüfbaren Pointen: `transient` überlebt die Serialisierung nicht, und ohne `synchronized` wäre die zweite Zahl zufällig kleiner als 2000.

## Typische Fehler

1. **`run()` statt `start()` aufrufen** — dann läuft alles nacheinander im selben Thread, ganz ohne Nebenläufigkeit.
2. **`join()` vergessen** und das Ergebnis lesen, bevor die Threads fertig sind.
3. **Strom nicht geschlossen** — Daten bleiben im Puffer und landen nie in der Datei.
4. **Klasse nicht `Serializable`** oder ein Attribut mit nicht-serialisierbarem Typ → `NotSerializableException`.
5. **`transient`-Attribut nach dem Einlesen wie vorher erwarten** — es steht auf `0` bzw. `null`.
6. **Cast nach `readObject()` vergessen**: die Methode liefert `Object`.

## Merksätze

- **`start()` startet, `run()` ruft nur auf.**
- **`Serializable` ist ein Marker ohne Methoden — `transient` ist der Ausschalter dafür.**
- **Ströme gehören ins `finally`.**
- **Kapitel 9 und 10 stehen nicht im Klausur-Überblick: Begriffe kennen reicht, Tiefe lohnt hier nicht.**
