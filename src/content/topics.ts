import type { Topic } from '@/lib/types'

/* ==================================================================== *
 *  VOLLSTÄNDIGE THEMENLANDKARTE OFP — Uni Siegen, Klausur 31.08.2026
 *
 *  Quellen der Gewichtung:
 *   • Probeklausur Python (49 P + 4 Bonus) und Probeklausur Java (54 P)
 *   • Folien "Klausurrelevante Dinge/Befehle" am Ende jeder Python-VL
 *   • Kapitel "Überblick" im Java-Skript (S. 347–374) — deckt NUR Kap. 1–8 ab
 *   • Beispielfragen des Profs (ofp_beispielfragen*.pdf)
 *   • Klausur01.java … Klausur10.java aus dem offiziellen Repo
 * ==================================================================== */

export const EXAM_DATE = '2026-08-31T09:00:00+02:00'

export const TOPICS: Topic[] = [
  /* ================================ PYTHON ================================ */
  {
    id: 'py-basics',
    lang: 'python',
    order: 1,
    title: 'Grundlagen, Variablen & Zahlen',
    summary:
      'print/input, Variablen, dynamische Typisierung, Zahlentypen und alle Rechenoperatoren — die Basis, auf der jede andere Python-Aufgabe steht.',
    lecture: 'VL 1a/1b — Installation, Variablen, Anweisungen',
    relevance: 'core',
    examWeight: 0.08,
    examFormats: ['Kurzfrage', 'Was gibt der Code aus?', 'Lücke füllen'],
    prereqs: [],
    subtopics: [
      {
        id: 'py-basics-io',
        title: 'print, input und der Datentyp von Eingaben',
        relevance: 'core',
        points: [
          '`print(...)` mit mehreren Argumenten trennt automatisch mit Leerzeichen',
          '`input(prompt)` liefert **immer** einen `str` — auch wenn der Nutzer eine Zahl tippt',
          'Klassiker aus den Beispielfragen: `x = input(...)`, dann `2*x` verdoppelt den **String** ("3.33.3"), rechnet nicht',
          'Umwandlung nötig: `int(input(...))` / `float(input(...))`',
        ],
      },
      {
        id: 'py-basics-vars',
        title: 'Variablen, Zuweisung, dynamische Typisierung',
        relevance: 'core',
        points: [
          'Eine Variable ist ein **Name für einen Ort im Speicher**',
          '`=` ist der Zuweisungsoperator und **nicht** das mathematische Gleichheitszeichen (`x = x + 1` ist sinnvoll, mathematisch wäre es falsch)',
          'Python ist **dynamisch typisiert** (Java: statisch), Typ kann sich zur Laufzeit ändern',
          'Python und Java sind **case-sensitive**',
          'Namenskonvention: `snake_case`, sprechende Namen',
        ],
      },
      {
        id: 'py-basics-numbers',
        title: 'Zahlentypen und Operatoren',
        relevance: 'core',
        points: [
          '`int`, `float` (IEEE 754 double), `complex`; dazu `bool` und `NoneType`',
          '`+ - * /` — `/` liefert **immer** `float`, auch `4/2` → `2.0`',
          '`//` ganzzahlige Division **rundet immer ab**: `-4//3 == -2`',
          '`%` Modulo, `**` Potenz',
          'Alle Operatoren auch als `+=`, `-=`, `*=`, `//=`, `**=`',
          'Float-Ungenauigkeit: `0.1 + 0.2 != 0.3`',
          '`int()`, `float()`, `complex()`, `str()` konvertieren',
        ],
      },
      {
        id: 'py-basics-expr',
        title: 'Ausdruck vs. Anweisung, Kommentare',
        relevance: 'edge',
        points: [
          'Ausdruck (expression) liefert einen **Wert** (`2+5`)',
          'Anweisung (statement) wird **ausgeführt** (Zuweisung, Funktionsaufruf)',
          'Kommentar mit `#`; Blockkommentar über `""" ... """` (formal ein ungenutzter String)',
        ],
      },
    ],
    sources: [
      { file: '1_installation_variablen_anweisungen_26.pdf', page: 25, label: 'Klausurrelevante Befehle' },
      { file: '1_strings_26.pdf', page: 10, label: 'Operationen mit Zahlen' },
      { file: 'ofp_beispielfragen_mit_antworten.pdf', page: 3, label: 'input liefert String' },
    ],
  },
  {
    id: 'py-strings',
    lang: 'python',
    order: 2,
    title: 'Strings',
    summary:
      'Slicing, split, format, count/replace/find — String-Handwerk, das in fast jeder Programmieraufgabe vorkommt.',
    lecture: 'VL 1b — Strings',
    relevance: 'core',
    examWeight: 0.09,
    examFormats: ['Lücke füllen', 'Was gibt der Code aus?', 'Funktion schreiben'],
    prereqs: ['py-basics'],
    subtopics: [
      {
        id: 'py-strings-basic',
        title: 'Erzeugen, Konkatenieren, Wiederholen',
        relevance: 'core',
        points: [
          "Anführungszeichen: `'…'`, `\"…\"`, `\"\"\"…\"\"\"` (mehrzeilig)",
          '`\\n` Zeilenumbruch, `\\t` Tabulator',
          '`+` konkateniert, `*n` wiederholt',
          '`len(s)` Anzahl Zeichen',
          'Strings sind **immutable** — `s[0] = "X"` ist ein Fehler',
        ],
      },
      {
        id: 'py-strings-slicing',
        title: 'Slicing [a:b:c]',
        relevance: 'core',
        points: [
          'Index beginnt bei **0**',
          '`s[a:b]` schließt `b` **nicht** ein',
          'Dritter Wert ist die Schrittweite: `s[::2]`, `s[::-1]` kehrt um',
          'Negative Indizes zählen von hinten: `s[-1]` letztes Zeichen',
          'Weglassen von a/b = "von Anfang" / "bis Ende"',
        ],
      },
      {
        id: 'py-strings-methods',
        title: 'Methoden: split, count, replace, find, format',
        relevance: 'core',
        points: [
          '`.split(z)` zerlegt in eine **Liste**; ohne Argument an Whitespace',
          '`.count(z)` zählt Vorkommen',
          '`.replace(alt, neu)` gibt **neuen** String zurück',
          '`.find(z)` liefert Index oder **-1**, wenn nicht gefunden',
          '`.format()` mit `{}` und benannten Platzhaltern `{name}`',
          '`.upper()`, `.lower()`, `.strip()`',
          '`==` / `!=` vergleichen Inhalte',
        ],
      },
    ],
    sources: [
      { file: '1_strings_26.pdf', page: 13, label: 'Klausurrelevante Befehle' },
      { file: 'Beispielaufgaben_VL0_undVL1.pdf', label: 'Ticketcode-Aufgabe (Slicing)' },
    ],
  },
  {
    id: 'py-control',
    lang: 'python',
    order: 3,
    title: 'Kontrollstrukturen & Schleifen',
    summary:
      'if/elif/else, while, for, range, enumerate. Einrückung ist Syntax — hier entstehen die meisten Flüchtigkeitsfehler.',
    lecture: 'VL 1c — If, else, while',
    relevance: 'core',
    examWeight: 0.09,
    examFormats: ['Lücke füllen', 'Fehlersuche', 'Programm schreiben'],
    prereqs: ['py-basics'],
    subtopics: [
      {
        id: 'py-control-if',
        title: 'if / elif / else',
        relevance: 'core',
        points: [
          '`elif` wird nur geprüft, wenn alle vorherigen Bedingungen `False` waren',
          'Die **Einrückung** bestimmt, was zum Block gehört — sie ist Teil des Programms',
          'Vergleichsoperatoren `== != > < >= <=`',
          'Logische Verknüpfung `and`, `or`, `not` (Kurzschlussauswertung)',
        ],
      },
      {
        id: 'py-control-while',
        title: 'while-Schleifen',
        relevance: 'core',
        points: [
          'Läuft, solange die Bedingung `True` ist — Abbruch **muss** sichergestellt sein',
          'Python-Kürzel: `while liste:` läuft, solange die Liste **nicht leer** ist',
          'Typisches Muster: Eingabe wiederholt abfragen, bis sie gültig ist',
        ],
      },
      {
        id: 'py-control-for',
        title: 'for, range, enumerate',
        relevance: 'core',
        points: [
          '`for x in iterierbares_objekt:` — Listen, Strings, Tupel, range, dict …',
          '`range(a, b, c)`: Start, Ende (exklusiv), Schrittweite; `range(n)` = 0…n-1',
          'Rückwärts: `range(10, 0, -1)`',
          '`enumerate(liste)` liefert Paare `(index, wert)`',
          'Verschachtelte Schleifen (z. B. Stein-Schere-Papier-Echse-Spock-Tabelle, Dreiecke)',
          '`break` verlässt die Schleife, `continue` springt zur nächsten Runde',
        ],
      },
    ],
    sources: [
      { file: '1_if_else_while_26.pdf', page: 22, label: 'Klausurrelevante Befehle' },
      { file: '1_installation_variablen_anweisungen_26.pdf', page: 22, label: 'Stein-Schere-Papier-Echse-Spock' },
    ],
  },
  {
    id: 'py-lists',
    lang: 'python',
    order: 4,
    title: 'Listen, Tupel, Dicts & Mengen',
    summary:
      'Die Datenstrukturen. Listen sind mutable, Tupel nicht — genau dieser Unterschied wird in der Klausur abgefragt.',
    lecture: 'VL 1d + VL 4 — Listen, Tupel, Dictionaries',
    relevance: 'core',
    examWeight: 0.09,
    examFormats: ['Was gibt der Code aus?', 'Wieso wirft der Code einen Fehler?', 'Lücke füllen'],
    prereqs: ['py-control'],
    subtopics: [
      {
        id: 'py-lists-list',
        title: 'Listen',
        relevance: 'core',
        points: [
          'Eckige Klammern, gemischte Typen erlaubt, **mutable**',
          '`append(x)` hängt an, `insert(i, x)` fügt ein, `remove(x)` löscht **erstes Vorkommen**',
          '`pop()` gibt letztes Element zurück **und** löscht es; `pop(i)` mit Index',
          'Indizierung und Slicing wie bei Strings',
          'Verschachtelte Listen',
        ],
      },
      {
        id: 'py-lists-tuple',
        title: 'Tupel',
        relevance: 'core',
        points: [
          'Runde Klammern, **immutable**',
          'Ein-Element-Tupel braucht Komma: `(3,)`',
          '`t1 + t2` erzeugt ein **neues** Tupel (keine Mutation!)',
          'Deshalb: `random.shuffle(tupel)` wirft einen Fehler — der Klassiker aus den Beispielfragen',
          'Zentral für funktionale Programmierung: Tupel von states',
        ],
      },
      {
        id: 'py-lists-dict',
        title: 'Dictionaries & Mengen',
        relevance: 'likely',
        points: [
          '`{"schlüssel": wert}`, Zugriff über `d["schlüssel"]`, **mutable**',
          'Im funktionalen Stil des Profs: der **state** eines Spiels ist ein Dictionary',
          'Neues Dict statt Mutation: `{**d, "punkte": d["punkte"]+1}` bzw. Dict-Literal neu bauen',
          '`set` — Menge ohne Duplikate, mutable',
        ],
      },
      {
        id: 'py-lists-random',
        title: 'Zufall (Modul random)',
        relevance: 'likely',
        points: [
          '`random.shuffle(liste)` mischt **in place** → nur für mutable Objekte',
          '`random.sample(bereich, k)` liefert neue Auswahl (auch für immutable geeignet)',
          '`random.choice(liste)`, `random.randint(a, b)` (b inklusive!)',
          '`random.Random(seed)` für reproduzierbare Ergebnisse',
        ],
      },
    ],
    sources: [
      { file: '1_if_else_while_26.pdf', page: 15, label: 'Listen & pop' },
      { file: '4_func_programming_and_recursion_26.pdf', page: 11, label: 'Dictionary + Tuple als state' },
      { file: 'ofp_beispielfragen_mit_antworten.pdf', page: 1, label: 'shuffle auf Tupel' },
    ],
  },
  {
    id: 'py-functions',
    lang: 'python',
    order: 5,
    title: 'Funktionen & Module',
    summary:
      'def, return, Docstrings, positional/keyword-Argumente, *args/**kwargs, Type Hints, import. Grundlage für alles Funktionale.',
    lecture: 'VL 2 — Functions and Comments',
    relevance: 'core',
    examWeight: 0.09,
    examFormats: ['Funktion schreiben', 'Kurzfrage', 'Lücke füllen'],
    prereqs: ['py-control'],
    subtopics: [
      {
        id: 'py-functions-def',
        title: 'Definition, return, Docstring',
        relevance: 'core',
        points: [
          '`def name(args):` — alles Eingerückte gehört zur Funktion',
          'Ohne `return` liefert die Funktion `None`',
          'Docstring als erster String `""" … """`, abrufbar über `help(name)`',
          'Kommentare mit `#` sollen die **Logik** erklären, nicht den Code wiederholen',
        ],
      },
      {
        id: 'py-functions-args',
        title: 'Argumente',
        relevance: 'core',
        points: [
          '**positional arguments**: Reihenfolge zählt',
          '**keyword arguments**: haben Default-Werte, beliebige Reihenfolge beim Aufruf',
          '`*args` — beliebig viele positionale Argumente (als Tupel)',
          '`**kwargs` — beliebig viele Keyword-Argumente (als Dict)',
          'Type Hints `def f(x: int) -> str:` haben **keinen** Einfluss auf die Ausführung',
        ],
      },
      {
        id: 'py-functions-hof',
        title: 'Funktionen als Werte & higher order functions',
        relevance: 'core',
        points: [
          'Funktionen können in Variablen gespeichert werden (`f = say_hello`) — ohne Klammern!',
          'Mit Klammern wird **aufgerufen**, ohne Klammern wird die **Funktion selbst** übergeben',
          'Higher order function = Funktion, die Funktionen als Argument nimmt **oder** zurückgibt',
          'Beispiel des Profs: `anwenden(funktion, a, b)`, `auf_jedes_element(funktion, liste)`',
        ],
      },
      {
        id: 'py-functions-import',
        title: 'Module & Namespaces',
        relevance: 'likely',
        points: [
          '`import modul` → Zugriff über `modul.funktion`',
          '`from modul import funktion` → direkter Zugriff, kein Namespace',
          '`import modul as alias` → eigener Namespace-Name',
          'Eigene Dateien: Datei muss im selben Ordner oder im PYTHONPATH liegen; Unterordner mit `.`',
          'Bekannte Module: `random`, `math`, `time`, `functools`',
        ],
      },
    ],
    sources: [{ file: '2_functions_and_comments_26.pdf', page: 21, label: 'Klausurrelevante Befehle' }],
  },
  {
    id: 'py-scope-mutability',
    lang: 'python',
    order: 6,
    title: 'Geltungsbereiche & Mutability',
    summary:
      'Klausuraufgabe 2 (10 P): "Was wird ausgegeben oder tritt ein Fehler auf?" — das mit Abstand fehleranfälligste Python-Thema.',
    lecture: 'VL 3 — Mutable variables, scopes',
    relevance: 'core',
    examWeight: 0.2,
    examFormats: ['Was gibt der Code aus? (mit Begründung)', 'Kurzfrage', 'Wieso wirft der Code einen Fehler?'],
    prereqs: ['py-functions', 'py-lists'],
    subtopics: [
      {
        id: 'py-scope-mut-table',
        title: 'Die Tabelle, die man auswendig können muss',
        relevance: 'core',
        points: [
          '**immutable**: `int`, `float`, `bool`, `str`, `tuple`, `complex`, `frozenset`, `bytes`',
          '**mutable**: `list`, `dict`, `set`, selbstgeschriebene Klassen',
          'Immutable heißt: jede "Änderung" erzeugt ein **neues Objekt**',
        ],
      },
      {
        id: 'py-scope-local-global',
        title: 'Lokal vs. global',
        relevance: 'core',
        points: [
          '**Lesen** globaler Variablen in einer Funktion: geht immer',
          '**Mutieren** globaler mutable Objekte (`liste[0] = …`, `liste.append(…)`): wirkt nach außen',
          '**Zuweisen** (`a = …`) erzeugt eine **neue lokale** Variable, das Globale bleibt unberührt',
          '`n = n + 1` ohne `global` → **UnboundLocalError**, weil `n` durch die Zuweisung als lokal gilt',
          '`global n` erweitert den Geltungsbereich; danach wirkt `n = n*2` global',
          'Lokale Variablen existieren nur während des Funktionsaufrufs',
        ],
      },
      {
        id: 'py-scope-aliasing',
        title: 'Aliasing & copy',
        relevance: 'likely',
        points: [
          '`b = a` bei einer Liste erzeugt **keine** Kopie — beide Namen zeigen auf dasselbe Objekt',
          '`b = a.copy()` (oder `a[:]`) erzeugt eine flache Kopie',
          'Bei verschachtelten Listen reicht eine flache Kopie nicht',
          'Übergabe an Funktionen: der Name wird gebunden, nicht das Objekt kopiert',
        ],
      },
    ],
    sources: [
      { file: '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf', page: 4, label: 'mutable/immutable' },
      { file: '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf', page: 9, label: 'global' },
      { file: 'Probeklausur_Python_ausfuellbar.pdf', page: 2, label: 'Aufgabe 2 — Code-Analyse' },
    ],
  },
  {
    id: 'py-funcprog',
    lang: 'python',
    order: 7,
    title: 'Funktionale Programmierung & pure functions',
    summary:
      'Kurzfragen-Garant: die zwei Bedingungen einer pure function, Vorteile der FP, Paradigmenvergleich, lambda.',
    lecture: 'VL 3/4 — Motivation of functional programming',
    relevance: 'core',
    examWeight: 0.12,
    examFormats: ['Kurzfrage (Definition)', 'Ist diese Funktion pure? Begründung', 'lambda schreiben'],
    prereqs: ['py-scope-mutability'],
    subtopics: [
      {
        id: 'py-fp-pure',
        title: 'Pure functions — die zwei Bedingungen',
        relevance: 'core',
        points: [
          '1) Sie hängt **nur von ihren Eingabeargumenten** ab (keine globalen Variablen, keine externen Daten, kein state)',
          '2) Sie hat **keine Nebeneffekte** — ihr einziger Effekt ist die Rückgabe von Werten',
          'Eine Funktion, die nur von ihren Eingaben abhängt, heißt **referentially transparent**',
          'Typische Verstöße: `print` in der Funktion, globale Variable ändern, mutable Argument mutieren, `input()`, `random` ohne übergebenen Generator',
        ],
      },
      {
        id: 'py-fp-advantages',
        title: 'Vorteile funktionaler Programmierung',
        relevance: 'core',
        points: [
          '1. Einfacheres Finden von Fehlern (Fehler steckt in genau einer Funktion)',
          '2. Gefahrloses Wiederverwenden von Funktionen',
          '3. Parallelisierbarkeit (`y=f(x)` und `z=f(x)` gleichzeitig möglich)',
          '4. Teilweise kompakterer/kürzerer Code',
          '5. Memoisation (Zwischenspeichern von Rückgabewerten)',
          '6. Lazy Evaluation (Auswertung erst, wenn gebraucht)',
        ],
      },
      {
        id: 'py-fp-characteristics',
        title: 'Charakteristika & Paradigmen',
        relevance: 'likely',
        points: [
          'Charakteristisch: pure functions, higher order functions, immutable Datenstrukturen, anonyme Funktionen, Rekursion, Funktionen auf Iteratoren (map/filter/reduce), Currying',
          'Paradigmen: **prozedural** (C, Pascal), **deklarativ** (Prolog, SQL), **objektorientiert** (Java, C++), **funktional** (Haskell, ML)',
          '**Python ist eine hybride, keine funktionale Sprache** — wichtiger Merksatz des Profs',
        ],
      },
      {
        id: 'py-fp-lambda',
        title: 'lambda-Ausdrücke',
        relevance: 'core',
        points: [
          '`lambda x1, x2: rückgabewert` — anonyme Funktion in einer Zeile, ohne `def`',
          'Nur **ein Ausdruck**, kein `return`, keine Anweisungen',
          'Kann in Variablen gespeichert werden: `addition = lambda a, b: a + b`',
          'Hauptzweck: kurze Funktionen für `map`, `filter`, `reduce`, `sorted(key=…)`',
        ],
      },
    ],
    sources: [
      { file: '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf', page: 10, label: 'pure functions' },
      { file: '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf', page: 13, label: 'Vorteile' },
      { file: 'OFP -- Einleitung_SoSe26.pdf', page: 19, label: 'Programmierparadigmen' },
    ],
  },
  {
    id: 'py-recursion',
    lang: 'python',
    order: 8,
    title: 'Rekursion',
    summary:
      'Klausuraufgabe 4 (12 P): Funktionen ausschließlich rekursiv — ohne jede Schleife. Höchstes Punktegewicht im Python-Teil.',
    lecture: 'VL 4 — Functional programming and recursion',
    relevance: 'core',
    examWeight: 0.22,
    examFormats: ['Rekursive Funktion schreiben (keine Schleifen!)', 'Lücken in rekursivem Code', 'Kurzfrage zum Stack'],
    prereqs: ['py-functions', 'py-lists'],
    subtopics: [
      {
        id: 'py-rec-basics',
        title: 'Prinzip, Abbruchbedingung, Stack',
        relevance: 'core',
        points: [
          'Eine Funktion ruft sich selbst auf',
          'Es **muss** eine geeignete Abbruchbedingung (Basisfall) geben, damit die Rekursion terminiert',
          'Intern entsteht ein **Stack (Stapel)** von Funktionsaufrufen, der danach abgearbeitet wird',
          'Bild des Profs: Baum der Dicke a fällen — "HACK", Dicke-1, bis 0 → "Baum fällt!"',
        ],
      },
      {
        id: 'py-rec-vs-loop',
        title: 'Rekursion vs. Schleife',
        relevance: 'core',
        points: [
          '**Vorteile**: eleganter, weniger Code, vermeidet Mutation → ideal für FP',
          '**Nachteile**: meist langsamer (Funktionsaufrufe), speicherhungriger (Stack)',
          'Python hat ein Rekursionslimit (~1000)',
        ],
      },
      {
        id: 'py-rec-patterns',
        title: 'Die Standardmuster',
        relevance: 'core',
        points: [
          'Zahlen: Fakultät, Fibonacci, Potenz, ggT, Quersumme',
          'Strings: umkehren (`text[0]` ans Ende von `umkehren(text[1:])`), Palindrom',
          'Listen/Tupel: Summe, Maximum, Filtern, `tup[0]` + Rekursion auf `tup[1:]`',
          'Verschachtelte Listen aufsummieren mit `isinstance(x, list)`',
          'Rekursive higher order function: `wiederhole(f, x, abbruch)`',
          'states: `rungame(states + (naechsteRunde(states[-1]),))` — das Goofspiel-Muster',
        ],
      },
    ],
    sources: [
      { file: '4_func_programming_and_recursion_26.pdf', page: 6, label: 'Abbruchbedingung' },
      { file: '4_func_programming_and_recursion_26.pdf', page: 7, label: 'Stack' },
      { file: 'Probeklausur_Python_ausfuellbar.pdf', page: 4, label: 'Aufgabe 4' },
      { file: 'ofp_beispielfragen_mit_antworten.pdf', page: 5, label: 'tuple_with_floats_only' },
    ],
  },
  {
    id: 'py-mfr',
    lang: 'python',
    order: 9,
    title: 'map, filter, reduce',
    summary:
      'Klausuraufgabe 3 (11 P) + Aufgabe 5a: imperativen Code in einen einzigen funktionalen Ausdruck umschreiben.',
    lecture: 'VL 5 — map, filter, reduce',
    relevance: 'core',
    examWeight: 0.2,
    examFormats: ['Einzeiler mit map/filter/reduce', 'Lücke im map/filter-Ausdruck', 'Imperativ → funktional umschreiben'],
    prereqs: ['py-funcprog'],
    subtopics: [
      {
        id: 'py-mfr-map',
        title: 'map',
        relevance: 'core',
        points: [
          '`map(f, iterable)` wendet `f` auf jedes Element an',
          '**Rückgabe ist ein Iterator (map-Objekt), keine Liste!** → `list(map(...))` zum Anzeigen',
          'Mehrere Iterables: `map(f, l1, l2)` → `f(l1[i], l2[i])` — so geht Vektoraddition',
          'Iteratoren haben `__next__()` und einen internen Zählerstand; sie sind **einmal** durchlaufbar',
        ],
      },
      {
        id: 'py-mfr-filter',
        title: 'filter',
        relevance: 'core',
        points: [
          '`filter(pred, iterable)` behält die Elemente, für die `pred(x)` zu `True` auswertet',
          'Rückgabe ebenfalls ein **Iterator**',
          'Prädikat als `lambda x: bedingung`',
        ],
      },
      {
        id: 'py-mfr-reduce',
        title: 'reduce',
        relevance: 'core',
        points: [
          '`from functools import reduce` ist nötig',
          '`reduce(f, [x1,…,xn]) = f(…f(f(x1,x2),x3)…,xn)` — faltet von links',
          'Optionaler Startwert: `reduce(f, iterable, start)`',
          'Standardanwendungen: Summe, Produkt, Durchschnitt (`reduce(add, l)/len(l)`), Strings verbinden',
        ],
      },
      {
        id: 'py-mfr-combine',
        title: 'Kombination & Umschreiben',
        relevance: 'core',
        points: [
          'Typischer Klausurausdruck: `reduce(g, map(f, filter(p, liste)))`',
          'Reihenfolge von innen nach außen lesen: erst filtern, dann abbilden, dann falten',
          'Schleife + Mutation → ein Ausdruck: `for`-Body wird zu `map`, `if` wird zu `filter`, Akkumulator wird zu `reduce`',
          'In der Klausur explizit verboten: `for`/`while` in dieser Aufgabe',
        ],
      },
    ],
    sources: [
      { file: '5_map_filter_reduce_wrapup_26.pdf', page: 6, label: 'map' },
      { file: '5_map_filter_reduce_wrapup_26.pdf', page: 7, label: 'reduce' },
      { file: '5_map_filter_reduce_wrapup_26.pdf', page: 8, label: 'filter' },
      { file: 'Probeklausur_Python_ausfuellbar.pdf', page: 3, label: 'Aufgabe 3' },
    ],
  },
  {
    id: 'py-currying-decorators',
    lang: 'python',
    order: 10,
    title: 'Currying, Closures & Decorators',
    summary:
      'Klausuraufgabe 5b (3 P) + Bonusaufgabe (4 P). Klein, aber praktisch geschenkte Punkte, wenn man das Muster kennt.',
    lecture: 'VL 5 — Currying, Decorators',
    relevance: 'core',
    examWeight: 0.12,
    examFormats: ['Currying mit lambda', 'Decorator schreiben', 'Kurzfrage f_curry(a1)(a2) = ?'],
    prereqs: ['py-funcprog'],
    subtopics: [
      {
        id: 'py-curry',
        title: 'Currying',
        relevance: 'core',
        points: [
          'Idee: eine Funktion mit mehreren Parametern als **Verkettung** von Funktionen mit je einem Parameter',
          'Merksatz für die Klausur: **`f_curry(a1)(a2) = f(a1, a2)`**',
          'Parameter binden: `quadrat = lambda b: potenz(b, 2)` bzw. `zwei_weiter = lambda x: summe(2, x)`',
          'Curry-Form selbst bauen: `f_curry = lambda a1: (lambda a2: f(a1, a2))`',
          'Name kommt von Haskell Brooks Curry',
        ],
      },
      {
        id: 'py-closure',
        title: 'Closures / Funktionen, die Funktionen zurückgeben',
        relevance: 'likely',
        points: [
          'Eine innere Funktion "merkt" sich die Variablen der äußeren',
          '`def multiplizierer(n): return lambda x: x*n`',
          'Basis für Currying **und** Decorators',
        ],
      },
      {
        id: 'py-decorator',
        title: 'Decorators',
        relevance: 'core',
        points: [
          'Ein Decorator hüllt (wrapt) eine Funktion in eine higher order function',
          'Muster: `def deko(f): def wrapper(*args, **kwargs): … return f(...) … ; return wrapper`',
          'Anwendung mit `@deko` direkt über der Funktionsdefinition',
          '`@functools.wraps(f)` am Wrapper erhält Name und Docstring des Originals',
          'Beispiele des Profs: Ausgabe in Großbuchstaben, Aufrufe loggen, "!!!" anhängen',
        ],
      },
    ],
    sources: [
      { file: '5_map_filter_reduce_wrapup_26.pdf', page: 13, label: 'Currying' },
      { file: '5_map_filter_reduce_wrapup_26.pdf', page: 14, label: 'Decorators' },
      { file: 'Probeklausur_Python_ausfuellbar.pdf', page: 5, label: 'Aufgabe 5b + Bonus' },
    ],
  },
  {
    id: 'py-games',
    lang: 'python',
    order: 11,
    title: 'Transfer: kleine Spiele programmieren',
    summary:
      'Der Prof empfiehlt genau das zur Klausurvorbereitung. Hier trainierst du, Konzepte auf ein neues Problem zu übertragen — das wird geprüft.',
    lecture: 'Klausur-Übungstipps (end_summary)',
    relevance: 'core',
    examWeight: 0.14,
    examFormats: ['Programm/Teilfunktion schreiben', 'Funktionalen Spielcode lesen & Regeln erklären', 'Imperativ → funktional'],
    prereqs: ['py-recursion', 'py-mfr'],
    subtopics: [
      {
        id: 'py-games-goofspiel',
        title: 'Goofspiel (roter Faden der Vorlesung)',
        relevance: 'core',
        points: [
          'Jeder Spieler hat eine Farbe; die Preiskarten werden gemischt und einzeln aufgedeckt',
          'Wer die höhere Karte legt, gewinnt die Preiskarte; bei Gleichstand niemand',
          'Der Prof entwickelt es in 5 Stufen: imperativ → Funktionen → pure functions + state-dict → Rekursion → map/filter/reduce',
          'Alle 5 Stufen verstehen — Aufgaben können jede Stufe abfragen',
        ],
      },
      {
        id: 'py-games-recommended',
        title: 'Die empfohlenen Übungsspiele',
        relevance: 'core',
        points: [
          '**Kniffel-Light**: 5 Würfel, 3 Versuche, Dreierpasch, Würfel festhalten',
          '**Mäxchen/Meiern**: verdeckt würfeln, Zahl ansagen, glauben oder anzweifeln',
          '**Hohe Hausnummer**: 3 Würfe auf Hunderter/Zehner/Einer verteilen',
          '**Galgenmännchen**: Buchstaben raten, 6 Fehlversuche',
          '**Runterzählen von 101** (Push Your Luck): würfeln, bei 1 verfällt die Runde',
          '**Kooperationsspiel** (Gefangenendilemma): 3/3, 0/5, 0/0',
        ],
      },
      {
        id: 'py-games-read',
        title: 'Funktionalen Code lesen & erklären',
        relevance: 'core',
        points: [
          'Beispielfrage des Profs: "Erklären sie die Spielregeln des folgenden funktional implementierten Spiels"',
          'Teilfragen: Wie viele Spieler? Wann gibt es wie viele Punkte? Was wird am Ende ausgegeben?',
          'Technik: state-Dict entschlüsseln, Rekursionsabbruch finden, reduce/map-Ausgabe rekonstruieren',
        ],
      },
    ],
    sources: [
      { file: 'end_summary_python_26.pdf', page: 16, label: 'Klausur-Übungstipps: Spiele' },
      { file: 'PushYourLuck_Aufgaben_und_Loesungen.pdf', label: 'Push Your Luck mit Lösungen' },
      { file: 'goofspiel26.py', label: 'Originalcode des Profs' },
    ],
  },

  /* ================================= JAVA ================================= */
  {
    id: 'java-basics-syntax',
    lang: 'java',
    order: 12,
    title: 'Java-Programme & syntaktische Grundelemente',
    summary:
      'javac/java, Programmaufbau, main-Methode, Bezeichnerregeln. Liefert die Multiple-Choice-Punkte in Aufgabe 1.',
    lecture: 'Kap. 1+2 (Woche 1)',
    relevance: 'core',
    examWeight: 0.07,
    examFormats: ['Multiple Choice', 'Kurzfrage', 'Fehlersuche'],
    prereqs: [],
    subtopics: [
      {
        id: 'java-toolchain',
        title: 'Von der Quelle zum laufenden Programm',
        relevance: 'core',
        points: [
          'Spezifikation → Lösungsidee → Algorithmus → Quellcode → Objektcode → Ausführung',
          '`javac Program.java` erzeugt `Program.class` (Bytecode)',
          '`java Program` führt den Bytecode auf der **JVM** aus (ohne `.class`!)',
          'Java ist **compiliert und interpretiert** — Bytecode ist plattformunabhängig',
          'Dateiname muss dem Namen der (public) Klasse entsprechen',
        ],
      },
      {
        id: 'java-structure',
        title: 'Programmaufbau',
        relevance: 'core',
        points: [
          '`class Name { … }`',
          'Einstiegspunkt: `public static void main(String[] args) { … }`',
          '`System.out.println(…)` mit Zeilenumbruch, `System.out.print(…)` ohne',
          'Eingaben mit `Scanner input = new Scanner(System.in); input.nextInt();` (`import java.util.Scanner;`)',
        ],
      },
      {
        id: 'java-lexical',
        title: 'Syntaktische Grundelemente',
        relevance: 'likely',
        points: [
          'Schlüsselwörter (reserviert, klein geschrieben)',
          'Bezeichner: Buchstaben, Ziffern, `_`, `$` — **nie mit einer Ziffer beginnend**',
          'Konstanten/Literale: `42`, `42L`, `3.14`, `3.14f`, `\'a\'`, `"text"`, `true`',
          'Klammern `()` `[]` `{}`, Trennzeichen `;` `,` `.` und Leerräume',
          'Jede Anweisung endet mit `;`, Anweisungsfolgen werden mit `{ }` zu einem Block',
          'Kommentare `//`, `/* */`, `/** */` (Javadoc)',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 348, label: 'Überblick 1' },
      { file: 'OFP_Java.pdf', page: 349, label: 'Überblick 2' },
    ],
  },
  {
    id: 'java-types',
    lang: 'java',
    order: 13,
    title: 'Datentypen, Variablen & Typkonversion',
    summary:
      'Der Compiler-Fehler-Klassiker (Klausur03/04) und die int-Divisions-Falle. Statische Typisierung ist der große Unterschied zu Python.',
    lecture: 'Kap. 3 (Woche 1)',
    relevance: 'core',
    examWeight: 0.15,
    examFormats: ['Multiple Choice (Größenreihenfolge)', 'Compiler-Fehler finden', 'Was gibt der Code aus?'],
    prereqs: ['java-basics-syntax'],
    subtopics: [
      {
        id: 'java-primitives',
        title: 'Die 8 primitiven Datentypen',
        relevance: 'core',
        points: [
          'Ganzzahlen: `byte` (1 B), `short` (2 B), `int` (4 B), `long` (8 B) — **byte < short < int < long**',
          'Gleitkomma: `float` (4 B), `double` (8 B)',
          '`char` (2 B, Unicode), `boolean`',
          'Literale: `100L`, `1.5f`, `0x1F`, `\'A\'`',
          'Wertebereiche: `byte` −128…127, `int` ≈ ±2,1 Mrd.',
          'Überlauf wirft **keine** Exception, sondern läuft zyklisch um',
        ],
      },
      {
        id: 'java-conversion',
        title: 'Typkonversion',
        relevance: 'core',
        points: [
          '**Implizit** (erweiternd, verlustfrei): `int n = myShort;`',
          '**Explizit** (einschränkend, mit Cast): `short s = (short) myChar;`',
          '`boolean` lässt sich mit **keinem** anderen Typ casten → `(boolean) symbol2` ist ein Compiler-Fehler',
          '`char` rechnet als Zahl: `(int) \'a\'` = 97, `\'a\' + 1` = 98 (int!)',
          '`(int) 4.9` schneidet ab → 4 (keine Rundung)',
          '`d = d + a;` mit `int d, double a` ist ein Fehler — implizite Verengung gibt es nicht',
        ],
      },
      {
        id: 'java-intdiv',
        title: 'Die Ganzzahldivision',
        relevance: 'core',
        points: [
          '`int / int` ergibt **immer** `int`: `7/2 == 3`, `1/2 == 0`',
          'Klausur07: `anzahl/2` bei anzahl = 1,2,3,4 → 0, 1, 1, 2 — auch wenn das Ergebnis in ein `double` geschrieben wird!',
          'Abhilfe: `(double) a / b` oder `a / 2.0`',
          'Division durch 0: bei `int` **ArithmeticException**, bei `double` `Infinity`/`NaN`',
        ],
      },
      {
        id: 'java-scope-final',
        title: 'Gültigkeitsbereich & final',
        relevance: 'core',
        points: [
          'Variablen leben im Block `{ … }`, in dem sie deklariert wurden',
          'Neudeklaration desselben Namens im inneren Block = **Compiler-Fehler**',
          'Nach dem Block ist der Name wieder frei',
          '`final` = Konstante; erneute Zuweisung ist ein Compiler-Fehler',
          '`double a, b = 1.2;` — nur `b` ist initialisiert, `a` nicht (Nutzung → Fehler)',
          'Lokale Variablen haben **keinen** Default-Wert; Attribute schon (0, 0.0, false, null)',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 350, label: 'Überblick 3' },
      { file: 'Klausur03.java', path: '11_Ueberblick/Klausur03.java', label: '2 Compiler-Fehler' },
      { file: 'Klausur04.java', path: '11_Ueberblick/Klausur04.java', label: '3 Compiler-Fehler + Ausgabe' },
    ],
  },
  {
    id: 'java-statements',
    lang: 'java',
    order: 14,
    title: 'Anweisungen, Operatoren & Schleifen',
    summary:
      'Klausuraufgabe 2 "Ausgabe vorhersagen". Prä-/Postinkrement und Operatorpriorität sind die klassischen Stolperfallen.',
    lecture: 'Kap. 4 (Woche 1)',
    relevance: 'core',
    examWeight: 0.15,
    examFormats: ['Ausgabe vorhersagen', 'Multiple Choice', 'Code-Lücken', 'Programm schreiben'],
    prereqs: ['java-types'],
    subtopics: [
      {
        id: 'java-operators',
        title: 'Operatoren',
        relevance: 'core',
        points: [
          'Arithmetik `+ - * / %`, Zuweisung `=`, zusammengesetzt `+= -= *= /= %=`',
          '**Präfix** `y = ++x` → x wird zuerst erhöht, y bekommt den neuen Wert',
          '**Postfix** `y = x++` → y bekommt den alten Wert, x wird danach erhöht',
          'Vergleich `== != < > <= >=`, Logik `&& || !` (Kurzschluss) vs. `& |` (immer beide Seiten)',
          'Bitoperatoren `& | ^ ~ << >> >>>`',
          'Priorität: `()` > unär > `* / %` > `+ -` > Vergleich > `&&` > `||` > `?:` > `=`',
          '`+` mit String konkateniert: `1 + 2 + "a"` → `"3a"`, aber `"a" + 1 + 2` → `"a12"`',
        ],
      },
      {
        id: 'java-conditions',
        title: 'Bedingungen',
        relevance: 'core',
        points: [
          '`if (b) … else if (b2) … else …`',
          'Ternärer Operator: `signum = (z==0) ? 0 : (z>0 ? +1 : -1);`',
          '`switch (x) { case 1: … break; case 2: case 3: … break; default: … }`',
          'Ohne `break` läuft es in den nächsten Fall weiter (**Fall-Through**) — beliebte Falle',
          'Bedingung muss `boolean` sein — `if (x = 1)` ist ein Compiler-Fehler (anders als in C)',
        ],
      },
      {
        id: 'java-loops',
        title: 'Schleifen',
        relevance: 'core',
        points: [
          '`while (b) { … }` — prüft **vor** dem Durchlauf',
          '`do { … } while (b);` — läuft **mindestens einmal**',
          '`for (init; bedingung; schritt) { … }`',
          'Erweitertes for: `for (int x : array) { … }`',
          'Vorzeitiger Ausstieg: `break`, `continue` — oder (Stil des Profs) durch Setzen der Laufvariablen',
          'Verschachtelte Schleifen: Dreiecke, Sterne, Primzahlen, Multiplikationstabellen',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 351, label: 'Überblick 4 (1/2)' },
      { file: 'OFP_Java.pdf', page: 352, label: 'Überblick 4 (2/2)' },
      { file: 'Klausur01.java', path: '11_Ueberblick/Klausur01.java', label: 'hop/pla/hoppla' },
      { file: 'Klausur02.java', path: '11_Ueberblick/Klausur02.java', label: 'X-Dreieck' },
    ],
  },
  {
    id: 'java-arrays-strings',
    lang: 'java',
    order: 15,
    title: 'Arrays & Strings',
    summary:
      'Referenzsemantik: Arrays werden nicht kopiert. Genau darauf zielt Klausur06 — und `==` vs. `equals` ist Standard-MC.',
    lecture: 'Kap. 5 (Woche 2)',
    relevance: 'core',
    examWeight: 0.13,
    examFormats: ['Ausgabe vorhersagen', 'Methode schreiben', 'Multiple Choice'],
    prereqs: ['java-statements'],
    subtopics: [
      {
        id: 'java-arrays',
        title: 'Arrays',
        relevance: 'core',
        points: [
          'Deklaration `double[] x;`, Erzeugung `x = new double[3];`, Kurzform `int[] a = {2,4,6,8};`',
          '`a.length` — **ohne** Klammern (Strings dagegen: `s.length()` mit Klammern)',
          'Default-Werte nach `new`: 0 / 0.0 / false / null',
          'Index 0 … length-1, sonst `ArrayIndexOutOfBoundsException`',
          'Arrays sind **Referenztypen**: `double[] y = x;` → beide zeigen auf dasselbe Array',
          'Als Methodenparameter kann eine Methode das Array des Aufrufers verändern (Klausur06!)',
          'Mehrdimensional: `int[][] m = new int[3][4];`',
        ],
      },
      {
        id: 'java-strings',
        title: 'Strings',
        relevance: 'core',
        points: [
          '`String s = "Text";` — automatisches `new`',
          '`s.length()`, `s.charAt(i)`, `s.substring(a,b)`, `s.indexOf(t)`, `s.toUpperCase()`, `s.split(t)`',
          '**`==` vergleicht Referenzen, `.equals()` vergleicht Inhalte** — der MC-Klassiker',
          'Strings sind **immutable**: jede Operation liefert einen neuen String',
          'Konkatenation mit `+`, auch mit `char` und Zahlen — Auswertung von links nach rechts',
          '`char[]` ↔ `String`: `new String(chars)`, `s.toCharArray()`',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 354, label: 'Überblick 5' },
      { file: 'Klausur06.java', path: '11_Ueberblick/Klausur06.java', label: 'Array als Referenz' },
      { file: 'Klausur09.java', path: '11_Ueberblick/Klausur09.java', label: 'char[] → String' },
    ],
  },
  {
    id: 'java-objects',
    lang: 'java',
    order: 16,
    title: 'Objekte, Methoden & Kapselung',
    summary:
      'Klausuraufgaben 3 + 4 (24 P zusammen): Code-Lücken und eine eigene Klasse mit Methoden und main schreiben.',
    lecture: 'Kap. 6 (Woche 3)',
    relevance: 'core',
    examWeight: 0.25,
    examFormats: ['Code-Lücken (6 × 2 P)', 'Klasse mit Methoden schreiben', 'Ausgabe vorhersagen', 'Multiple Choice'],
    prereqs: ['java-arrays-strings'],
    subtopics: [
      {
        id: 'java-class-object',
        title: 'Klassen, Objekte, Attribute, Methoden',
        relevance: 'core',
        points: [
          '`class X { … }` als Bauplan, `new X(...)` erzeugt ein Objekt',
          '**Instanzattribut** (pro Objekt) vs. **Klassenattribut** `static` (einmal für alle)',
          '**Instanzmethode** vs. **Klassenmethode** `static` — statische Methoden können nicht auf `this` zugreifen',
          '`static final` für Konstanten',
          'Zugriff: `objekt.attribut`, `Klasse.statischesAttribut`',
        ],
      },
      {
        id: 'java-constructor',
        title: 'Konstruktoren',
        relevance: 'core',
        points: [
          'Heißt wie die Klasse, **kein** Rückgabetyp',
          'Sobald ein eigener Konstruktor existiert, gibt es den Default-Konstruktor nicht mehr',
          'Überladung: mehrere Konstruktoren mit verschiedenen Parameterlisten',
          '`this(...)` als **erste** Anweisung ruft einen anderen Konstruktor derselben Klasse',
          '`this.laenge = laenge;` löst die Verdeckung durch gleichnamige Parameter auf',
          'Statischer Zähler im Konstruktor (`anzahl++`) zählt erzeugte Objekte',
        ],
      },
      {
        id: 'java-encapsulation',
        title: 'Kapselung & Sichtbarkeiten',
        relevance: 'core',
        points: [
          '`private` — nur innerhalb derselben Klasse',
          '`public` — überall',
          '`protected` — Klasse, Paket und Unterklassen',
          'ohne Angabe (package-private) — im selben Paket',
          'getter/setter als kontrollierter Zugang',
          'Faustregel: Attribute `private`, Methoden nach Bedarf',
        ],
      },
      {
        id: 'java-callby',
        title: 'Parameterübergabe & Auswertungsreihenfolge',
        relevance: 'core',
        points: [
          'Java übergibt **immer** call by value — bei Objekten wird der **Referenzwert** kopiert',
          'Folge: Attribute eines übergebenen Objekts / Elemente eines Arrays sind änderbar (`swap(Pair p)` funktioniert)',
          'Aber: `p = new Pair()` in der Methode wirkt **nicht** nach außen',
          'Argumente werden **vor** dem Aufruf ausgewertet, von links nach rechts (Klausur05!)',
          'Rekursion in Java funktioniert analog zu Python (`fak(n)`)',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 355, label: 'Überblick 6 (1/5)' },
      { file: 'OFP_Java.pdf', page: 356, label: 'call by value / reference' },
      { file: 'Klausur05.java', path: '11_Ueberblick/Klausur05.java', label: 'Seiteneffekte' },
      { file: 'Klausur07.java', path: '11_Ueberblick/Klausur07.java', label: 'static Zähler + int-Division' },
      { file: 'Klausur08.java', path: '11_Ueberblick/Klausur08.java', label: 'Objekt als Rückgabewert' },
      { file: 'Probeklausur_Java_ausfuellbar.pdf', page: 2, label: 'Aufgabe 3 + 4' },
    ],
  },
  {
    id: 'java-inheritance',
    lang: 'java',
    order: 17,
    title: 'Vererbung, Polymorphie & Interfaces',
    summary:
      'Klausuraufgabe 5 (14 P) — die punktreichste Java-Aufgabe: Unterklasse schreiben und Polymorphie im Array demonstrieren.',
    lecture: 'Kap. 7 (Woche 4+5)',
    relevance: 'core',
    examWeight: 0.24,
    examFormats: ['Unterklasse schreiben + main mit Array', 'Ausgabe vorhersagen', 'Multiple Choice', 'UML ↔ Code'],
    prereqs: ['java-objects'],
    subtopics: [
      {
        id: 'java-extends',
        title: 'Vererbung, super, this',
        relevance: 'core',
        points: [
          '`class Unter extends Ober { … }` — Einfachvererbung',
          '`super(...)` ruft den Konstruktor der Oberklasse und muss **erste** Anweisung sein',
          '`super.attribut` / `super.methode()` greift auf die Oberklasse zu',
          '`this` = aktuelles Objekt; löst Verdeckung auf',
          '`protected` macht Attribute für Unterklassen zugänglich',
          'Wird `super()` nicht geschrieben, ruft Java implizit den parameterlosen Konstruktor der Oberklasse',
        ],
      },
      {
        id: 'java-override',
        title: 'Überschreiben vs. Überladen',
        relevance: 'core',
        points: [
          '**Überschreiben (overriding)**: gleiche Signatur in der Unterklasse — ersetzt die Implementierung',
          '**Überladen (overloading)**: gleicher Name, **andere** Parameterliste — in derselben Klasse',
          'Der Rückgabetyp allein unterscheidet keine Überladung',
          '`@Override` ist optional, hilft aber gegen Tippfehler',
        ],
      },
      {
        id: 'java-polymorphism',
        title: 'Polymorphie & dynamische Bindung',
        relevance: 'core',
        points: [
          'Eine Variable des **Obertyps** kann auf Objekte von Untertypen zeigen',
          'Beim Methodenaufruf entscheidet der **tatsächliche Objekttyp** (dynamische Bindung) — nicht der Variablentyp',
          'Standardaufgabe: `Fahrzeug[] arr = { new Fahrzeug(…), new Auto(…) };` und in einer Schleife `arr[i].beschreibung()`',
          '**Attribute** werden dagegen **statisch** gebunden (Feld-Verdeckung) — beliebte Fangfrage',
          'Upcast implizit, Downcast explizit mit Prüfung über `instanceof`',
        ],
      },
      {
        id: 'java-abstract-interface',
        title: 'Abstrakte Klassen & Interfaces',
        relevance: 'core',
        points: [
          'Eine Klasse mit mindestens einer abstrakten Methode **muss** `abstract` sein',
          'Abstrakte Klassen können **nicht** mit `new` instanziiert werden, aber Attribute und normale Methoden haben',
          '`interface I { … }` deklariert Methoden ohne Rumpf; `class C implements I` muss sie implementieren',
          'Eine Klasse kann **mehrere** Interfaces implementieren, aber nur **eine** Klasse erweitern',
          'UML: `<<interface>>`, Realisierung gestrichelt mit Dreiecksspitze',
        ],
      },
      {
        id: 'java-object-tostring',
        title: 'Object & toString',
        relevance: 'likely',
        points: [
          'Jede Klasse erbt implizit von `Object`',
          '`toString()` überschreiben → `System.out.println(obj)` nutzt es automatisch (Polymorphie!)',
          '`equals()` und `hashCode()` gehören zusammen',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 366, label: 'Überblick 7 (1/5)' },
      { file: 'OFP_Java.pdf', page: 368, label: 'Interfaces & abstrakte Klassen' },
      { file: 'OFP_Java.pdf', page: 369, label: 'this und super' },
      { file: 'Klausur10.java', path: '11_Ueberblick/Klausur10.java', label: 'Polymorphie im Array' },
      { file: 'Probeklausur_Java_ausfuellbar.pdf', page: 4, label: 'Aufgabe 5' },
    ],
  },
  {
    id: 'java-uml',
    lang: 'java',
    order: 18,
    title: 'UML: Klassen- & Objektdiagramme',
    summary:
      'Explizites Lernziel der Vorlesung ("Objektorientierte Modellierung mit UML und Java"). Beide Richtungen üben: Code → Diagramm und Diagramm → Code.',
    lecture: 'Kap. 6+7, UML Teil 1 & 2',
    relevance: 'likely',
    examWeight: 0.09,
    examFormats: ['Diagramm zu Code zeichnen/beschreiben', 'Code aus Diagramm schreiben', 'Kurzfrage zu Notation'],
    prereqs: ['java-inheritance'],
    subtopics: [
      {
        id: 'java-uml-class',
        title: 'Klassendiagramm',
        relevance: 'likely',
        points: [
          'Drei Fächer: Klassenname / Attribute / Operationen',
          'Sichtbarkeiten: `+` public, `#` protected, `-` private, `~` package',
          'Schreibweise `name: Typ`, `operation(param: Typ): Rückgabetyp`',
          '**Klassenattribute und -methoden werden unterstrichen** (static)',
          'Abstrakte Klassen und Methoden **kursiv**, `<<interface>>` als Stereotyp',
          'Vererbung: durchgezogene Linie mit **leerer Dreiecksspitze** zur Oberklasse',
          'Realisierung (implements): gestrichelte Linie mit leerer Dreiecksspitze',
          'Assoziationen mit Multiplizitäten `1`, `0..1`, `*`, `1..10`, `1..3`',
        ],
      },
      {
        id: 'java-uml-object',
        title: 'Objektdiagramm',
        relevance: 'likely',
        points: [
          'Notation `objektname : Klasse` (unterstrichen) mit konkreten Attributwerten',
          'Zeigt eine **Momentaufnahme** zur Laufzeit',
          'Links zwischen Objekten entsprechen den Assoziationen des Klassendiagramms',
          'Aufgabe: aus gegebenem Code die entstandenen Objekte und Werte zeichnen',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 364, label: 'UML Klassendiagramm' },
      { file: 'OFP_Java.pdf', page: 365, label: 'UML Objektdiagramm' },
      { file: 'Aufgaben_Objekte_Klassen_UML.pdf', label: 'Übungsaufgaben UML' },
    ],
  },
  {
    id: 'java-exceptions',
    lang: 'java',
    order: 19,
    title: 'Ausnahmebehandlung',
    summary:
      'Letztes Kapitel im Klausur-Überblick des Skripts. Realistisch: Multiple Choice oder eine Ausgabe-Vorhersage mit try/catch/finally.',
    lecture: 'Kap. 8 (Woche 6)',
    relevance: 'likely',
    examWeight: 0.07,
    examFormats: ['Ausgabe vorhersagen', 'Multiple Choice', 'Kurzfrage'],
    prereqs: ['java-objects'],
    subtopics: [
      {
        id: 'java-trycatch',
        title: 'try / catch / finally',
        relevance: 'likely',
        points: [
          '`try { … } catch (Typ e) { … } finally { … }`',
          '`finally` wird **immer** ausgeführt — auch bei `return` im try-Block',
          'Mehrere catch-Blöcke: **spezifische vor allgemeinen** (sonst Compiler-Fehler)',
          '`e.getMessage()`',
        ],
      },
      {
        id: 'java-throw',
        title: 'throw, throws, eigene Exceptions',
        relevance: 'likely',
        points: [
          '`throw new ArithmeticException("Divide by 0.");` löst aus',
          '`throws IOException` in der Signatur deklariert weitergereichte Ausnahmen',
          'Eigene Exception: `class MyExcept extends Exception { … }`',
          'Hierarchie: `Throwable` → `Error` / `Exception` → `RuntimeException`',
          '**Checked** (Exception, muss behandelt/deklariert werden) vs. **unchecked** (RuntimeException)',
          'Häufig: `ArithmeticException` (int-Division durch 0), `NullPointerException`, `ArrayIndexOutOfBoundsException`, `NumberFormatException`, `IOException`',
        ],
      },
    ],
    sources: [{ file: 'OFP_Java.pdf', page: 374, label: 'Überblick 8' }],
  },
  {
    id: 'java-io-threads',
    lang: 'java',
    order: 20,
    title: 'Dateien, Ströme, Threads & Sockets',
    summary:
      'Niedrige Priorität: Diese Kapitel (9 und 10) fehlen komplett im Klausur-Überblick des Skripts und tauchen in der Probeklausur nicht auf. Nur Grundverständnis.',
    lecture: 'Kap. 9+10 (Woche 6+7)',
    relevance: 'low',
    examWeight: 0.03,
    examFormats: ['Kurzfrage', 'Multiple Choice'],
    prereqs: ['java-exceptions'],
    subtopics: [
      {
        id: 'java-io',
        title: 'Dateien, Ströme, Serialisierung',
        relevance: 'low',
        points: [
          '`FileWriter` / `PrintWriter` schreiben, `FileReader` / `BufferedReader` lesen',
          'Ströme im `finally` schließen (oder try-with-resources)',
          '`implements Serializable` macht Objekte serialisierbar',
          '`ObjectOutputStream.writeObject()` / `ObjectInputStream.readObject()`',
          '`transient` schließt ein Attribut von der Serialisierung aus',
        ],
      },
      {
        id: 'java-threads',
        title: 'Threads & Sockets',
        relevance: 'low',
        points: [
          '`class T extends Thread` **oder** `implements Runnable`',
          '`start()` startet einen neuen Thread — `run()` würde nur normal aufrufen!',
          '`join()` wartet auf das Ende eines Threads',
          '`synchronized` schützt kritische Abschnitte (Bankkonto-Beispiel, Race Conditions)',
          'Sockets: `ServerSocket` akzeptiert, `Socket` verbindet (EchoServer / EchoClient)',
        ],
      },
    ],
    sources: [
      { file: 'OFP_Java.pdf', page: 267, label: 'Kap. 9' },
      { file: 'OFP_Java.pdf', page: 309, label: 'Kap. 10' },
    ],
  },
]

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]))

export const PY_TOPICS = TOPICS.filter((t) => t.lang === 'python').sort((a, b) => a.order - b.order)
export const JAVA_TOPICS = TOPICS.filter((t) => t.lang === 'java').sort((a, b) => a.order - b.order)

/** Normierte Klausur-Gewichte pro Sprache (jede Sprache zählt 50 %). */
export function examWeight(topicId: string): number {
  const t = TOPIC_BY_ID[topicId]
  if (!t) return 0
  const pool = t.lang === 'python' ? PY_TOPICS : JAVA_TOPICS
  const sum = pool.reduce((s, x) => s + x.examWeight, 0)
  return (t.examWeight / sum) * 0.5
}

export const RELEVANCE_LABEL: Record<string, { label: string; hint: string }> = {
  core: { label: 'Sicher klausurrelevant', hint: 'Kam in Probeklausur, Beispielfragen oder auf einer "Klausurrelevant"-Folie vor.' },
  likely: { label: 'Sehr wahrscheinlich', hint: 'Im Skript ausführlich behandelt und im Klausur-Überblick enthalten.' },
  edge: { label: 'Randthema', hint: 'Kann als Kurzfrage auftauchen — kennen, aber nicht vertiefen.' },
  low: { label: 'Niedrige Priorität', hint: 'Fehlt im Klausur-Überblick und in der Probeklausur. Zuletzt lernen.' },
}
