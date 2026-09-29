export function pointLabel(value: number) {
  return Math.abs(value) <= 1 ? 'pt' : 'pts'
}
