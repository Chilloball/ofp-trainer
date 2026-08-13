import { asset } from './paths'

/* ==================================================================== *
 *  Vorlesungs-PDFs
 *
 *  Die Folien und Aufgabenblätter des Lehrstuhls liegen unter
 *  public/material/ und werden mit ausgeliefert — die Seite ist privat
 *  für den Lernkreis. Sie sind bewusst NICHT im (öffentlichen) Git-Repo:
 *  .gitignore schließt sie aus, .vercelignore lässt sie durch.
 *
 *  Jeder Quellenverweis in Aufgaben und Themen springt damit direkt
 *  auf die richtige Seite: `#page=N` verstehen die eingebauten
 *  PDF-Betrachter von Chrome, Safari, Firefox und Edge.
 * ==================================================================== */

const BUNDLED = new Set([
  '1_if_else_while_26.pdf',
  '1_installation_variablen_anweisungen_26.pdf',
  '1_strings_26.pdf',
  '2_functions_and_comments_26.pdf',
  '3_mutable_variables_scopes_and_motivation_of_func_prog_26.pdf',
  '4_func_programming_and_recursion_26.pdf',
  '5_map_filter_reduce_wrapup_26.pdf',
  'Aufgaben_Objekte_Klassen_UML.pdf',
  'Beispielaufgaben_VL0_undVL1.pdf',
  'Beispielaufgaben_VL2.pdf',
  'Beispielaufgaben_VL3.pdf',
  'OFP -- Einleitung_SoSe26.pdf',
  'OFP_Java.pdf',
  'Probeklausur_Java_ausfuellbar.pdf',
  'Probeklausur_Python_ausfuellbar.pdf',
  'PushYourLuck_Aufgaben_und_Loesungen.pdf',
  'blatt4u5.pdf',
  'end_summary_python_26.pdf',
  'ofp_beispielfragen_mit_antworten.pdf',
])

export function hasPdf(file: string): boolean {
  return BUNDLED.has(file)
}

/** URL zum PDF, optional direkt auf einer Seite aufgeschlagen. */
export function pdfUrl(file: string, page?: number): string {
  return asset(`/material/${encodeURIComponent(file)}`) + (page ? `#page=${page}` : '')
}
