import confetti from 'canvas-confetti'

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function celebrate(): void {
  if (prefersReducedMotion()) return
  void confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } })
}
