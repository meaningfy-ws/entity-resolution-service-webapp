import { beforeEach, describe, expect, it, vi } from 'vitest'


import { ComparisonPanel } from '../../components/ComparisonPanel'
import { createTestQueryClient, fireEvent, render, screen, waitFor } from '../test-utils'

import type { ReactNode } from 'react'

const mockNotification = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn()
}))
const mockRemoveDecisionFromCache = vi.hoisted(() => vi.fn())

vi.mock('@api/@tanstack/react-query.gen', () => ({
  acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  getProposedCanonicalEntityApiV1CurationDecisionsDecisionIdProposedCanonicalEntityGetOptions:
    vi.fn(() => ({
      queryKey: ['proposed-entity'],
      queryFn: vi.fn().mockResolvedValue({ top_entities: [], confidence_score: 0.9, cluster_id: 'c1', similarity_score: 0.8 })
    })),
  getAlternativeCanonicalEntitiesApiV1CurationDecisionsDecisionIdAlternativeCanonicalEntitiesGetInfiniteOptions:
    vi.fn(() => ({
      queryKey: ['alt-clusters'],
      queryFn: vi.fn().mockResolvedValue({ results: [], next: null })
    })),
  assignDecisionApiV1CurationDecisionsDecisionIdAssignPostMutation: vi.fn(() => ({
    mutationFn: vi.fn()
  })),
  listDecisionsApiV1CurationDecisionsGetInfiniteQueryKey: vi.fn(() => ['decisions-infinite']),
  getStatisticsApiV1CurationStatsGetQueryKey: vi.fn(() => ['stats'])
}))

vi.mock('@hooks/useDecisionsLoadingState', () => ({
  useDecisionsLoadingState: () => false
}))

vi.mock('@hooks/useRemoveDecisionFromCache', () => ({
  useRemoveDecisionFromCache: () => mockRemoveDecisionFromCache
}))

vi.mock('@hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: vi.fn(() => ({ current: null }))
}))

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: {},
    cx: (...args: string[]) => args.filter(Boolean).join(' ')
  })
}))

vi.mock('@ant-design/icons', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <span aria-label={name} role="img" {...props} />
  )

  return {
    ArrowLeftOutlined: icon('arrow-left'),
    ArrowRightOutlined: icon('arrow-right'),
    CheckCircleOutlined: icon('check-circle'),
    CheckOutlined: icon('check'),
    CloseCircleOutlined: icon('close-circle'),
    CloseOutlined: icon('close'),
    EditOutlined: icon('edit'),
    PlusCircleOutlined: icon('plus-circle')
  }
})

vi.mock('antd', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>

  const Popconfirm = ({
    children,
    description,
    onConfirm,
    onCancel,
    onOpenChange,
    disabled
  }: {
    children: ReactNode
    description?: ReactNode
    onConfirm?: () => void
    onCancel?: () => void
    onOpenChange?: (open: boolean) => void
    disabled?: boolean
  }) => (
    <div>
      {children}
      {!disabled && (
        <>
          {description}
          <button type="button" aria-label="confirm-pop" onClick={onConfirm}>
            confirm
          </button>
          <button type="button" aria-label="cancel-pop" onClick={onCancel}>
            cancel
          </button>
          <button
            type="button"
            aria-label="openchange-pop"
            onClick={() => onOpenChange?.(true)}
          >
            open
          </button>
        </>
      )}
    </div>
  )

  const Alert = ({ closable, title }: { closable?: { onClose?: () => void }; title?: ReactNode }) => (
    <div>
      <div>{title}</div>
      <button type="button" aria-label="close-alert" onClick={() => closable?.onClose?.()}>
        close
      </button>
    </div>
  )

  const Button = ({ children, icon, onClick, disabled }: { children?: ReactNode; icon?: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{icon}{children}</button>
  )

  const Card = ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
    <div>{title}{children}</div>
  )

  const Checkbox = ({ children, checked, onChange }: { children?: ReactNode; checked?: boolean; onChange?: (e: { target: { checked: boolean } }) => void }) => (
    <label><input type="checkbox" checked={checked} onChange={onChange as never} />{children}</label>
  )

  const Collapse = ({ items }: { items?: { key: string; label: ReactNode; children: ReactNode }[] }) => (
    <>{items?.map((item) => <div key={item.key}>{item.label}{item.children}</div>)}</>
  )

  const Tag = ({ children }: { children?: ReactNode }) => <span>{children}</span>
  const Tooltip = ({ children }: { children?: ReactNode }) => <>{children}</>
  const Typography = { Text: ({ children }: { children?: ReactNode }) => <span>{children}</span> }

  const AppComponent = ({ children }: { children?: ReactNode }) => <>{children}</>
  const App = Object.assign(AppComponent, {
    useApp: () => ({ notification: mockNotification })
  })

  return {
    Alert, App, Button, Card, Checkbox,
    Col: Pass, Collapse, ConfigProvider: Pass, Flex: Pass,
    Popconfirm, Row: Pass, Space: Pass,
    Tag, Tooltip, Typography
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

const mockDecision = {
  id: 'decision-99',
  about_entity_mention: {
    identified_by: {
      source_id: 'src-1',
      request_id: 'entity-99',
      entity_type: 'Person'
    },
    parsed_representation: { name: 'Test Entity' }
  },
  current_placement: {
    cluster_id: 'cluster-1',
    confidence_score: 0.8,
    similarity_score: 0.75
  },
  created_at: new Date().toISOString()
}

describe('ComparisonPanel', () => {
  describe('empty state', () => {
    it('shows "No Decisions to Review" when no decision is provided', () => {
      render(<ComparisonPanel />)
      expect(screen.getByText('No Decisions to Review')).toBeInTheDocument()
    })
  })

  describe('with a decision', () => {
    it('renders accept and reject confirm buttons', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)
      const confirmButtons = screen.getAllByRole('button', { name: 'confirm-pop' })
      expect(confirmButtons).toHaveLength(2)
    })

    it('renders the warning alert explaining why review is needed', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)
      expect(screen.getByText(/Why review needed/)).toBeInTheDocument()
    })

    it('closes the warning alert when close icon is clicked', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      expect(screen.getByText(/Why review needed/i)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'close-alert' }))
      expect(screen.queryByText(/Why review needed/i)).not.toBeInTheDocument()
    })
  })

  describe('entity navigation', () => {
    it('navigates between entities in the proposed cluster', () => {
      const queryClient = createTestQueryClient()
      queryClient.setQueryData(['proposed-entity'], {
        cluster_id: 'cluster-1',
        confidence_score: 0.9,
        similarity_score: 0.8,
        top_entities: [
          {
            identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
            parsed_representation: { name: 'Entity A' }
          },
          {
            identified_by: { source_id: 's1', request_id: 'e2', entity_type: 'Person' },
            parsed_representation: { name: 'Entity B' }
          }
        ]
      })
      render(<ComparisonPanel currentDecision={mockDecision as never} />, { queryClient })

      // Should start at entity 1
      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()

      // Navigate forward
      const nextBtn = document.querySelector('[aria-label="arrow-right"]')?.closest('button')
      expect(nextBtn).toBeTruthy()
      expect(nextBtn).not.toBeDisabled()
      fireEvent.click(nextBtn!)

      expect(screen.getByText(/Entity 2 of 2/)).toBeInTheDocument()

      // Navigate back
      const prevBtn = document.querySelector('[aria-label="arrow-left"]')?.closest('button')
      expect(prevBtn).toBeTruthy()
      fireEvent.click(prevBtn!)

      expect(screen.getByText(/Entity 1 of 2/)).toBeInTheDocument()
    })
  })

  describe('accept flow', () => {
    it('calls mutation, removes from cache, and shows success notification', async () => {
      const { acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockResolvedValue({})
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const confirms = screen.getAllByRole('button', { name: 'confirm-pop' })
      fireEvent.click(confirms[0])

      await waitFor(() => {
        expect(mockRemoveDecisionFromCache).toHaveBeenCalledWith('decision-99')
        expect(mockNotification.success).toHaveBeenCalledWith({ message: 'Decision accepted' })
      })
    })

    it('shows error notification when accept mutation fails', async () => {
      const { acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockRejectedValue({
          body: { detail: 'accept failed' }
        })
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const confirms = screen.getAllByRole('button', { name: 'confirm-pop' })
      fireEvent.click(confirms[0])

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalled()
      })
    })
  })

  describe('reject flow', () => {
    it('calls mutation, removes from cache, and shows success notification', async () => {
      const { rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockResolvedValue({})
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const confirms = screen.getAllByRole('button', { name: 'confirm-pop' })
      fireEvent.click(confirms[1])

      await waitFor(() => {
        expect(mockRemoveDecisionFromCache).toHaveBeenCalledWith('decision-99')
        expect(mockNotification.success).toHaveBeenCalledWith({ message: 'Decision rejected' })
      })
    })

    it('shows error notification when reject mutation fails', async () => {
      const { rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockRejectedValue({
          body: { detail: 'reject failed' }
        })
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const confirms = screen.getAllByRole('button', { name: 'confirm-pop' })
      fireEvent.click(confirms[1])

      await waitFor(() => {
        expect(mockNotification.error).toHaveBeenCalled()
      })
    })
  })

  describe('skip confirmation preference', () => {
    it('hides Popconfirm buttons when accept skip is enabled', () => {
      sessionStorage.setItem('ere_skip_accept', 'true')

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      // Only 1 confirm button should remain (for reject), accept Popconfirm is disabled
      const confirmButtons = screen.getAllByRole('button', { name: 'confirm-pop' })
      expect(confirmButtons).toHaveLength(1)
    })

    it('hides Popconfirm buttons when reject skip is enabled', () => {
      sessionStorage.setItem('ere_skip_reject', 'true')

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      // Only 1 confirm button should remain (for accept), reject Popconfirm is disabled
      const confirmButtons = screen.getAllByRole('button', { name: 'confirm-pop' })
      expect(confirmButtons).toHaveLength(1)
    })

    it('hides all Popconfirm buttons when skip-all is enabled', () => {
      sessionStorage.setItem('ere_skip_all', 'true')

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      expect(screen.queryByRole('button', { name: 'confirm-pop' })).not.toBeInTheDocument()
    })

    it('directly accepts when accept skip is enabled and button is clicked', async () => {
      sessionStorage.setItem('ere_skip_accept', 'true')

      const { acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockResolvedValue({})
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      // Click the accept (check) button directly — no confirm step
      const acceptBtn = document.querySelector('[aria-label="check"]')?.closest('button')
      expect(acceptBtn).toBeTruthy()
      fireEvent.click(acceptBtn!)

      await waitFor(() => {
        expect(mockRemoveDecisionFromCache).toHaveBeenCalledWith('decision-99')
        expect(mockNotification.success).toHaveBeenCalledWith({ message: 'Decision accepted' })
      })
    })

    it('directly rejects when reject skip is enabled and button is clicked', async () => {
      sessionStorage.setItem('ere_skip_reject', 'true')

      const { rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(rejectDecisionApiV1CurationDecisionsDecisionIdRejectPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockResolvedValue({})
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      // Click the reject (close) button directly — no confirm step
      const rejectBtn = document.querySelector('[aria-label="close"]')?.closest('button')
      expect(rejectBtn).toBeTruthy()
      fireEvent.click(rejectBtn!)

      await waitFor(() => {
        expect(mockRemoveDecisionFromCache).toHaveBeenCalledWith('decision-99')
        expect(mockNotification.success).toHaveBeenCalledWith({ message: 'Decision rejected' })
      })
    })
  })

  describe('"Don\'t show again" checkbox on cancel/open', () => {
    it('persists accept skip to sessionStorage when canceling with checkbox checked', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      // Two Popconfirms render two checkboxes — index 0 is the accept one
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const cancelButtons = screen.getAllByRole('button', { name: 'cancel-pop' })
      fireEvent.click(cancelButtons[0])

      expect(sessionStorage.getItem('ere_skip_accept')).toBe('true')
    })

    it('persists reject skip to sessionStorage when canceling with checkbox checked', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      const cancelButtons = screen.getAllByRole('button', { name: 'cancel-pop' })
      fireEvent.click(cancelButtons[1])

      expect(sessionStorage.getItem('ere_skip_reject')).toBe('true')
    })

    it('does not persist skip on cancel when the checkbox is not checked', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const cancelButtons = screen.getAllByRole('button', { name: 'cancel-pop' })
      fireEvent.click(cancelButtons[0])

      expect(sessionStorage.getItem('ere_skip_accept')).toBeNull()
    })

    it('resets the accept checkbox when the Popconfirm re-opens', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])
      expect(checkboxes[0]).toBeChecked()

      // Trigger onOpenChange(true) — component should reset dontShowAccept
      const openButtons = screen.getAllByRole('button', { name: 'openchange-pop' })
      fireEvent.click(openButtons[0])

      // After the reset, the accept checkbox should be unchecked again
      const refreshedCheckboxes = screen.getAllByRole('checkbox')
      expect(refreshedCheckboxes[0]).not.toBeChecked()
    })

    it('resets the reject checkbox when the Popconfirm re-opens', () => {
      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])
      expect(checkboxes[1]).toBeChecked()

      const openButtons = screen.getAllByRole('button', { name: 'openchange-pop' })
      fireEvent.click(openButtons[1])

      const refreshedCheckboxes = screen.getAllByRole('checkbox')
      expect(refreshedCheckboxes[1]).not.toBeChecked()
    })

    it('persists accept skip on confirm when the checkbox is checked', async () => {
      const { acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation } =
        await import('@api/@tanstack/react-query.gen')

      vi.mocked(acceptDecisionApiV1CurationDecisionsDecisionIdAcceptPostMutation).mockReturnValueOnce({
        mutationFn: vi.fn().mockResolvedValue({})
      })

      render(<ComparisonPanel currentDecision={mockDecision as never} />)

      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[0])

      const confirmButtons = screen.getAllByRole('button', { name: 'confirm-pop' })
      fireEvent.click(confirmButtons[0])

      await waitFor(() => {
        expect(sessionStorage.getItem('ere_skip_accept')).toBe('true')
      })
    })
  })
})
