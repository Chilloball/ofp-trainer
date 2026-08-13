# OFP Trainer

Vorbereitung auf die Klausur **Objektorientierte und Funktionale Programmierung** (Universität Siegen,
31. August 2026). 528 Aufgaben aus Vorlesung, Übung und den Probeklausuren, zwölf Probeklausuren und ein
Python- und Java-Compiler, der vollständig im Browser läuft.

Die App ist ein **statischer Export** — sie besteht am Ende nur aus Dateien und braucht keinen Server,
keine Datenbank und keine Anmeldung. Die gepflegte Instanz läuft privat für den Lernkreis unter
**https://ofp.teachinggrid.com**.

## Veröffentlichen

```bash
npx vercel deploy --prod
```

**Nur so — nicht über einen Git-Push.** Die Vorlesungs-PDFs (`public/material/`) gehören dem
Lehrstuhl: Sie sind per `.gitignore` aus diesem öffentlichen Repo ausgeschlossen und kommen nur über
die `.vercelignore` ins Deployment. Ein Git-Build hätte sie nicht — deshalb sind Git-Deploys in der
`vercel.json` abgeschaltet (`git.deploymentEnabled: false`). Wer neu aufsetzt, legt die PDFs aus dem
Kursordner unter `public/material/` ab (die Liste steht in `src/lib/material.ts`).

## Wie gelernt wird

Der Trainer ist keine Aufgabensammlung mit Suchfeld, sondern ein Kurs mit einem Enddatum. Vier Befunde
aus der Lernforschung bestimmen den Aufbau — sie stehen ausführlich in `src/lib/curriculum.ts`:

| Befund                                                             | Wie er in der App auftaucht                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Verteiltes Lernen und Abrufübung sind die wirksamsten Techniken     | Jeder Tag im Plan hat einen Wiederholungsblock; Wiederholung hat Vorrang vor neuem Stoff                            |
| Verschränken überträgt besser als Blocklernen                       | Ab der zweiten Phase werden Themen gemischt statt am Stück gelernt                                                  |
| Gelöste Beispiele schlagen freies Problemlösen bei fehlendem Vorwissen | Die erste Aufgabe eines neuen Themas kommt mit fertiger Lösung, danach mit Tipp, danach ohne (`Support`-Stufen)  |
| Fehler mit hoher Sicherheit lassen sich am besten korrigieren        | Sicherheitsabfrage vor dem Prüfen, deutliche Markierung hochsicherer Fehler, sofortige Fehlerschleife am Rundenende |

Der Lernplan wird bei **jedem** Aufruf neu aus dem Lernstand gerechnet. Er sagt auch, wenn die Zeit
nicht reicht — inklusive der Themen, die man dann streichen sollte (die mit den wenigsten Punkten pro
Minute).

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
| `test:logic`  | 142 Prüfungen zu Tagesrechnung, Sicherungen, Aufgabenauswahl, Lernplan und Klausurbauplänen |
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
src/lib/curriculum.ts   Lektionen, Gates, Phasen, Tagesplan, „was mache ich jetzt"
src/lib/storage.ts      lokale Speicherung, Export/Import
src/app/globals.css     Designsystem „Blaupause": Farben, Typografie, Bausteine
```

## Gestaltung

Ein Designsystem, kein Baukasten. Das Wichtigste in Kurzform, ausführlich als Kommentar in
`src/app/globals.css`:

- **Eine Schriftfamilie, zwei Stimmen.** Archivo hat eine echte Breitenachse: Überschriften laufen
  breit (`wdth` 112–118) und wirken plakatiert, Fließtext läuft normal. IBM Plex Mono übernimmt
  Quelltext, Zahlen und Kennzeichnungen und gibt der Oberfläche ihren technischen Grundton.
- **Fünf Farben, jede mit Bedeutung:** Ultramarin (Aktion, Python, Fortschritt), Oxid (Java, Achtung),
  Grün (richtig), Rot (falsch), Tinte für alles andere.
- **Struktur über Haarlinien**, nicht über schwebende Karten. Schatten trägt nur, was wirklich über der
  Seite liegt: Dialog, Menü, Meldung.
- **Bewegung nur mit Aussage.** Zahlen zählen hoch, Balken füllen sich, das Häkchen zeichnet sich, eine
  falsche Antwort stupst die Karte an. Kein „alles fährt beim Erscheinen von unten ein".

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
