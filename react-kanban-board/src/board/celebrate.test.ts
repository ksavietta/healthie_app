import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import confetti from 'canvas-confetti'
import { celebrate, prefersReducedMotion } from './celebrate'
import { removeMatchMedia, stubMatchMedia } from '../test/fixtures'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const confettiMock = vi.mocked(confetti)

describe('celebrate', () => {
  beforeEach(() => {
    confettiMock.mockClear()
  })

  afterEach(() => {
    removeMatchMedia()
  })

  it('fires confetti when the user has no reduced-motion preference', () => {
    stubMatchMedia(false)

    celebrate()

    expect(confettiMock).toHaveBeenCalledTimes(1)
    expect(confettiMock).toHaveBeenCalledWith(expect.objectContaining({ particleCount: expect.any(Number) }))
  })

  it('fires confetti when matchMedia is not available at all', () => {
    removeMatchMedia()

    celebrate()

    expect(confettiMock).toHaveBeenCalledTimes(1)
  })

  it('does not fire confetti when prefers-reduced-motion is set', () => {
    stubMatchMedia(true)

    celebrate()

    expect(confettiMock).not.toHaveBeenCalled()
  })

  it('checks the prefers-reduced-motion media query', () => {
    const matchMedia = stubMatchMedia(false)

    celebrate()

    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })
})

describe('prefersReducedMotion', () => {
  afterEach(() => {
    removeMatchMedia()
  })

  it('is true when the reduce query matches', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('is false when the reduce query does not match', () => {
    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('is false when matchMedia is missing', () => {
    removeMatchMedia()
    expect(prefersReducedMotion()).toBe(false)
  })
})
