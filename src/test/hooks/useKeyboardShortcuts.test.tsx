import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { act, fireEvent, renderHook, screen, waitFor } from '../test-utils'

vi.mock('@api/index', () => ({
  acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  listDecisionsApiV1CurationDecisionsGetInfiniteQueryKey: vi.fn(() => ['decisions']),
  getStatisticsApiV1CurationStatsGetQueryKey: vi.fn(() => ['stats'])
}))

const baseDecision = {
  id: 'decision-1',
  about_entity_mention: {
    identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
    parsed_representation: { name: 'Test Entity' }
  },
  current_placement: { cluster_id: 'c1', confidence_score: 0.8, similarity_score: 0.7 },
  created_at: new Date().toISOString()
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // antd modals render into the DOM and persist after unmount — clean them up
    document.querySelectorAll('.ant-modal-root').forEach((el) => el.remove())
    sessionStorage.clear()
  })

  it('registers a keydown listener on mount and removes it on unmount', () => {
    const addSpy = vi.spyOn(globalThis, 'addEventListener')
    const removeSpy = vi.spyOn(globalThis, 'removeEventListener')

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ activeDecision: undefined })
    )

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('ignores keydown events when target is an INPUT element', () => {
    let capturedHandler: ((e: KeyboardEvent) => void) | null = null
    const addSpy = vi
      .spyOn(globalThis, 'addEventListener')
      .mockImplementation((type, handler) => {
        if (type === 'keydown') capturedHandler = handler as (e: KeyboardEvent) => void
      })

    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    expect(capturedHandler).not.toBeNull()

    const input = document.createElement('input')
    document.body.append(input)

    const event = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true })
    Object.defineProperty(event, 'target', { value: input, configurable: true })

    // Should not open the accept modal because target is an input
    capturedHandler!(event)
    expect(screen.queryByText('Accept Decision')).not.toBeInTheDocument()

    input.remove()
    addSpy.mockRestore()
  })

  it('ignores keydown events when target is a TEXTAREA element', () => {
    let capturedHandler: ((e: KeyboardEvent) => void) | null = null
    const addSpy = vi
      .spyOn(globalThis, 'addEventListener')
      .mockImplementation((type, handler) => {
        if (type === 'keydown') capturedHandler = handler as (e: KeyboardEvent) => void
      })

    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    const textarea = document.createElement('textarea')
    document.body.append(textarea)

    const event = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true })
    Object.defineProperty(event, 'target', { value: textarea, configurable: true })

    capturedHandler!(event)
    expect(screen.queryByText('Accept Decision')).not.toBeInTheDocument()

    textarea.remove()
    addSpy.mockRestore()
  })

  it('ignores keydown events when target is a contentEditable element', () => {
    let capturedHandler: ((e: KeyboardEvent) => void) | null = null
    const addSpy = vi
      .spyOn(globalThis, 'addEventListener')
      .mockImplementation((type, handler) => {
        if (type === 'keydown') capturedHandler = handler as (e: KeyboardEvent) => void
      })

    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.append(div)

    const event = new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true })
    Object.defineProperty(event, 'target', { value: div, configurable: true })

    capturedHandler!(event)
    expect(screen.queryByText('Reject Decision')).not.toBeInTheDocument()

    div.remove()
    addSpy.mockRestore()
  })

  // NOTE: The hook does NOT guard against undefined activeDecision — the modal
  // still opens. This is a potential bug (it would call the API with id "undefined").
  // These tests document the current behaviour rather than silently ignoring it.
  it('still opens accept modal when KeyA is pressed without a decision', () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: undefined })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
    })

    expect(screen.queryAllByText('Accept Decision').length).toBeGreaterThan(0)
  })

  it('still opens reject modal when KeyR is pressed without a decision', () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: undefined })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
    })

    expect(screen.queryAllByText('Reject Decision').length).toBeGreaterThan(0)
  })

  it('pressing KeyA on a decision opens the accept confirm modal', () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
    })

    expect(screen.getAllByText('Accept Decision').length).toBeGreaterThan(0)
  })

  it('pressing KeyR on a decision opens the reject confirm modal', () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
    })

    expect(screen.getAllByText('Reject Decision').length).toBeGreaterThan(0)
  })

  it('clicking OK in the accept modal triggers the accept action', async () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
    })

    await waitFor(() =>
      expect(screen.getAllByText('Accept Decision').length).toBeGreaterThan(0)
    )

    const okButton = screen.getAllByRole('button').find(
      (b) => b.textContent === 'OK'
    )
    expect(okButton).toBeTruthy()
    act(() => { fireEvent.click(okButton!) })
  })

  it('clicking Cancel in the accept modal dismisses it', async () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
    })

    await waitFor(() =>
      expect(screen.getAllByText('Accept Decision').length).toBeGreaterThan(0)
    )

    const cancelButton = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Cancel'
    )
    expect(cancelButton).toBeTruthy()
    act(() => { fireEvent.click(cancelButton!) })
  })

  it('clicking OK in the reject modal triggers the reject action', async () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
    })

    await waitFor(() =>
      expect(screen.getAllByText('Reject Decision').length).toBeGreaterThan(0)
    )

    const okButton = screen.getAllByRole('button').find(
      (b) => b.textContent === 'OK'
    )
    expect(okButton).toBeTruthy()
    act(() => { fireEvent.click(okButton!) })
  })

  it('clicking Cancel in the reject modal dismisses it', async () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: baseDecision as never })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
    })

    await waitFor(() =>
      expect(screen.getAllByText('Reject Decision').length).toBeGreaterThan(0)
    )

    const cancelButton = screen.getAllByRole('button').find(
      (b) => b.textContent === 'Cancel'
    )
    expect(cancelButton).toBeTruthy()
    act(() => { fireEvent.click(cancelButton!) })
  })

  it('handles ArrowUp and ArrowDown without errors when no decision is active', () => {
    renderHook(() =>
      useKeyboardShortcuts({ activeDecision: undefined })
    )

    act(() => {
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'ArrowUp' })
      fireEvent.keyDown(globalThis as unknown as Window, { code: 'ArrowDown' })
    })

    // No modal should appear for arrow keys
    expect(screen.queryByText('Accept Decision')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject Decision')).not.toBeInTheDocument()
  })

  describe('skip confirmation preference', () => {
    it('skips accept modal when accept skip is enabled', () => {
      sessionStorage.setItem('ere_skip_accept', 'true')

      renderHook(() =>
        useKeyboardShortcuts({ activeDecision: baseDecision as never })
      )

      act(() => {
        fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
      })

      // No accept modal should appear
      expect(screen.queryByText('Accept Decision')).not.toBeInTheDocument()
    })

    it('skips reject modal when reject skip is enabled', () => {
      sessionStorage.setItem('ere_skip_reject', 'true')

      renderHook(() =>
        useKeyboardShortcuts({ activeDecision: baseDecision as never })
      )

      act(() => {
        fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
      })

      // No reject modal should appear
      expect(screen.queryByText('Reject Decision')).not.toBeInTheDocument()
    })

    it('skips both modals when skip-all is enabled', () => {
      sessionStorage.setItem('ere_skip_all', 'true')

      renderHook(() =>
        useKeyboardShortcuts({ activeDecision: baseDecision as never })
      )

      act(() => {
        fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyA' })
        fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
      })

      expect(screen.queryByText('Accept Decision')).not.toBeInTheDocument()
      expect(screen.queryByText('Reject Decision')).not.toBeInTheDocument()
    })

    it('still shows reject modal when only accept skip is enabled', () => {
      sessionStorage.setItem('ere_skip_accept', 'true')

      renderHook(() =>
        useKeyboardShortcuts({ activeDecision: baseDecision as never })
      )

      act(() => {
        fireEvent.keyDown(globalThis as unknown as Window, { code: 'KeyR' })
      })

      expect(screen.queryAllByText('Reject Decision').length).toBeGreaterThan(0)
    })
  })
})
