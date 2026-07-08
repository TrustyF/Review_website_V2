import { type } from 'arktype'

export function parseOrThrow<T>(validator: (v: unknown) => T | type.errors, json: unknown): T {
  const out = validator(json)
  if (out instanceof type.errors) throw new Error(out.summary)
  return out
}
