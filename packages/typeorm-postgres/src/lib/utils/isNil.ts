export function isNil<T>(
  value: T | null | undefined
): value is undefined | null {
  return typeof value === 'undefined' || value === null
}
