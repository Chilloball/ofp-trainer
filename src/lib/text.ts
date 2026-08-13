/* ==================================================================== *
 *  Textwerkzeuge für die Erklärungen
 *
 *  Die Erklärungen der Aufgaben sind gründlich — im Median rund 1000
 *  Zeichen. Gründlich ist gut, aber niemand liest nach jeder Aufgabe
 *  einen Aufsatz. Was man sich merken soll, sind ein bis zwei Sätze.
 *
 *  `splitLead` trennt deshalb den MERKSATZ (die ersten ein bis zwei
 *  Sätze) vom Rest. Der Merksatz steht groß und zuerst, der Rest ist
 *  einen Klick entfernt. Die deutschen Abkürzungen („z. B.", „d. h.",
 *  „S. 12") dürfen den Satz dabei nicht vorzeitig beenden.
 * ==================================================================== */

const ABBREV =
  /(?:z|bzw|d|u|o|ggf|etc|vgl|Nr|S|Kap|engl|sog|ca|evtl|inkl|bspw|usw|Abs|bzgl|allg|max|min)\.$/i

export interface LeadSplit {
  /** die ersten ein bis zwei Sätze — der Merksatz */
  lead: string
  /** alles danach */
  rest: string
}

export function splitLead(text: string, maxLen = 260): LeadSplit {
  const clean = text.trim()
  /* Beginnt der Text strukturell (Liste, Codeblock, Überschrift,
     Tabelle), gibt es keinen sinnvollen „ersten Satz" — dann lieber gar
     kein Merksatz als ein kaputter. `inline code` am Satzanfang ist
     dagegen völlig normal („\`new\` legt ein Array an …"). */
  if (/^(?:```|#|[-*]\s|>|\|)/.test(clean)) return { lead: '', rest: clean }

  /* Der Merksatz endet spätestens am ersten Absatz — ein Zeilenumbruch
     mitten im „einen Satz" wäre keiner mehr. */
  const nl = clean.search(/\n/)
  const scan = nl === -1 ? clean : clean.slice(0, nl)

  /* Satzende: .!? (bewusst OHNE Doppelpunkt — der kündigt etwas an,
     ein Merksatz darf nicht in der Luft hängen), optional gefolgt von
     einem schließenden Anführungszeichen, dann Leerraum und der Beginn
     des nächsten Satzes (Großbuchstabe, Ziffer, öffnendes Zeichen,
     Code oder Fettdruck). */
  const re = /[.!?]['"”“»«)*_]*(?=\s+(?:[`'"„“»«(*_]|[A-ZÄÖÜ\d-]))/g
  let cut = -1
  let sentences = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(scan))) {
    const end = m.index + m[0].length
    const before = scan.slice(0, end)
    const lastWord = before.replace(/['"”“»«)*_]+$/, '').split(/\s+/).pop() ?? ''
    if (ABBREV.test(lastWord)) continue
    /* Nicht mitten in `inline code` schneiden. */
    if (((before.match(/`/g)?.length ?? 0) % 2) === 1) continue
    sentences++
    cut = end
    /* Ein Satz reicht, wenn er Substanz hat; sonst noch einen dazu. */
    if (cut >= 90 || sentences >= 2) break
  }

  /* Kein Schnitt gefunden, aber die erste Zeile ist selbst ein
     abgeschlossener Satz (auch mit Fettdruck oder \`Code\` am Ende)?
     Dann ist sie der Merksatz. */
  if ((cut <= 0 || cut > maxLen) && /(?:[.!?]['"”“»«)*_]*|`)$/.test(scan) && scan.length <= maxLen) {
    cut = scan.length
  }

  /* Zeile endet mit Doppelpunkt? Wenn davor ein vollwertiger Satz steht
     („Der Operator \`+\` ist überladen und wird von links nach rechts
     ausgewertet:"), ist das der Merksatz — der Doppelpunkt wird zum
     Punkt. Kurze Ankündigungen („Positionstabelle:") fallen durch die
     Mindestlänge. */
  if ((cut <= 0 || cut > maxLen) && /:$/.test(scan) && scan.length >= 60 && scan.length <= maxLen) {
    const words = scan.split(/\s+/).length
    if (words >= 8 && ((scan.match(/`/g)?.length ?? 0) % 2) === 0) {
      return { lead: scan.slice(0, -1).trim() + '.', rest: clean.slice(nl === -1 ? scan.length : nl).trim() }
    }
  }

  if (cut <= 0 || cut > maxLen) {
    return clean.length <= maxLen && nl === -1 ? { lead: clean, rest: '' } : { lead: '', rest: clean }
  }
  return { lead: clean.slice(0, cut).trim(), rest: clean.slice(cut).trim() }
}
