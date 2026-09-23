/**
 * Removes own enumerable keys whose value is strictly `undefined` while
 * preserving explicit `null` values. Applies to partial PATCH DTOs that are
 * transformed by class-transformer with class-field semantics: every declared
 * optional field becomes an own enumerable property initialized to
 * `undefined`, and a naive object spread silently clears the existing value.
 * Only genuinely absent keys are dropped so merged updates keep current
 * values, while `null` still means "clear this field".
 */
export function stripUndefined<T>(input: T): T {
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(input as Record<string, unknown>)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}