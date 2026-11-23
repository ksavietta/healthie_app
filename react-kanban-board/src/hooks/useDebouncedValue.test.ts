import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('returns the initial value straight away', () => {
    const { result } = renderHook(() => useDebouncedValue('rick'))

    expect(result.current).toBe('rick')
  })

  it('keeps the old value until the default 300ms have passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('b')
  })

  it('only emits the last value of a burst of changes', () => {
    const seen: string[] = []
    const { result, rerender } = renderHook(
      ({ value }) => {
        const debounced = useDebouncedValue(value)
        seen.push(debounced)
        return debounced
      },
      { initialProps: { value: 'a' } },
    )

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ value: 'abcd' })
    act(() => vi.advanceTimersByTime(299))

    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('abcd')
    expect(seen).not.toContain('ab')
    expect(seen).not.toContain('abc')
  })

  it('restarts the wait each time the value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(250))
    rerender({ value: 'c' })
    act(() => vi.advanceTimersByTime(250))

    // 500ms since 'b' but only 250ms since 'c', so still waiting.
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('c')
  })

  it('respects a custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 1000),
      { initialProps: { value: 'x' } },
    )

    rerender({ value: 'y' })
    act(() => vi.advanceTimersByTime(999))
    expect(result.current).toBe('x')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('y')
  })

  it('clears its pending timer on unmount', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    })

    rerender({ value: 'b' })
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
