/**
 * Löst den Kürzel-Pfad `@/…` auch außerhalb von Next auf, damit die
 * Testskripte dieselben Module laden wie die App.
 */
const path = require('node:path')
const Module = require('node:module')

const ROOT = path.join(__dirname, '..')
const original = Module._resolveFilename

Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) request = path.join(ROOT, 'src', request.slice(2))
  return original.call(this, request, ...rest)
}
