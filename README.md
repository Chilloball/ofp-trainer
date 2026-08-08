# OFP Trainer

Vorbereitung auf die Klausur **Objektorientierte und Funktionale Programmierung** (Universität Siegen,
31. August 2026). 528 Aufgaben aus Vorlesung, Übung und den Probeklausuren, zwölf Probeklausuren und ein
Python- und Java-Compiler, der vollständig im Browser läuft.

Die App ist ein **statischer Export** — sie besteht am Ende nur aus Dateien und braucht keinen Server,
keine Datenbank und keine Anmeldung.

## Wie der Lernstand gespeichert wird

Der Fortschritt liegt im Browser des Lernenden (IndexedDB, mit `localStorage` als Rückfallebene).
Wer den Link öffnet, macht beim nächsten Mal genau dort weiter, wo er aufgehört hat — ohne Konto.
Für den Wechsel auf einen anderen Rechner gibt es unter **Fortschritt** Export und Import als Datei.

## Entwicklung

```bash
npm install
npm run dev        # baut den Content und startet den Entwicklungsserver
```

```bash
npm run build      # erzeugt out/ — den fertigen statischen Export
npm run start      # serviert out/ lokal auf Port 3000
```

## Prüfungen

```bash
npm run check
```

Führt nacheinander aus:

| Skript        | prüft                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `content`     | Aufgaben, Klausuren und Baupläne auf Vollständigkeit und Konsistenz             |
| `typecheck`   | TypeScript ohne Fehler                                                         |
| `lint`        | ESLint über App und Skripte, inklusive Hook-Abhängigkeiten                      |
| `test:java`   | 52 Testfälle für den Java-Compiler (Semantik, Fehlermeldungen, Grenzfälle)      |
| `test:logic`  | 94 Prüfungen zu Tagesrechnung, Sicherungen, Aufgabenauswahl und Klausurbauplänen |
| `verify:java` | alle Java-Musterlösungen erzeugen exakt die hinterlegte Ausgabe                 |

Zusätzlich, wenn lokal ein JDK installiert ist:

```bash
npm run test:java:jdk
```

Übersetzt die Beispieldateien aus dem Vorlesungs-Repository (`../ofp-2`) einmal mit dem echten
`javac`/`java` und einmal mit dem eingebauten Compiler und vergleicht die Ausgabe zeichengenau.

## Aufbau

```
content/                Autorenquellen (JSON + Markdown)
  exercises/            Aufgaben je Thema
  exams/                Klausuren, fest oder als Bauplan
  theory/               Theorietexte je Thema
scripts/build-content.mjs   erzeugt daraus public/content/
src/content/topics.ts   Themenlandkarte mit Klausurgewichten
src/lib/java/           Java-Compiler: Lexer, Parser, Interpreter, Standardbibliothek
src/lib/srs.ts          Spaced Repetition (FSRS-Modell)
src/lib/mastery.ts      Beherrschungsgrad, Klausurprognose, Aufgabenauswahl
src/lib/storage.ts      lokale Speicherung, Export/Import
```

## Der Java-Compiler

`src/lib/java/` enthält einen vollständigen Übersetzer für den Sprachumfang der Vorlesung —
in TypeScript geschrieben, ohne externe Abhängigkeit, ausgeführt in einem Web Worker.

Bewusst wie in der JVM umgesetzt, weil genau das in der Klausur gefragt wird:

- `int` läuft bei 2³¹ über, Ganzzahldivision schneidet ab, `char` rechnet als Zahl
- `double` wird wie in Java ausgegeben (`4.0`, `1.0E7`), nicht wie in JavaScript
- String-Literale liegen im Pool, zur Laufzeit erzeugte Strings nicht — `==` antwortet entsprechend
- Felder binden statisch, Methoden dynamisch (Feldverdeckung)
- Konstruktoren laufen in der Reihenfolge der JVM: Oberklasse, eigene Feldinitialisierer, Rumpf
- Unicode-Escapes werden vor den Kommentaren aufgelöst
- `HashMap` und `HashSet` iterieren in Javas Bucket-Reihenfolge

Nicht enthalten: Dateien, Netzwerk, echte Nebenläufigkeit (`start()` ruft `run()` direkt auf),
Serialisierung und Generics zur Laufzeit (sie werden wie in Java gelöscht).

Python läuft über Pyodide, also über echtes CPython 3.12 als WebAssembly.
