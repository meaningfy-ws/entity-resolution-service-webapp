import { describe, expect, it, vi } from 'vitest'

import { UserActionsSideMenu } from '../../components/UserActionsSideMenu'
import { createTestQueryClient, fireEvent, render, screen, waitFor } from '../test-utils'

const { listUserActionsApiV1UserActionsGetInfiniteOptions } = await import('@api/@tanstack/react-query.gen')

vi.mock('@api/@tanstack/react-query.gen', () => ({
  listUserActionsApiV1UserActionsGetInfiniteOptions: vi.fn(() => ({
    queryKey: ['user-actions-infinite'],
    queryFn: vi.fn().mockResolvedValue({ results: [], next_cursor: null })
  }))
}))

vi.mock('@hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: vi.fn(() => ({ current: null }))
}))

const makeAction = (id: string, actionType = 'ACCEPT_TOP') => ({
  id,
  about_entity_mention: {
    identified_by: { source_id: 's1', request_id: id, entity_type: 'Person' },
    parsed_representation: { name: `Entity ${id}` }
  },
  candidates: [],
  selected_cluster: { cluster_id: 'c1', confidence_score: 0.8, similarity_score: 0.7 },
  action_type: actionType,
  actor: { id: 'user-1', email: 'admin@ers.local' },
  created_at: new Date().toISOString()
})

describe('UserActionsSideMenu', () => {
  it('renders without crashing', () => {
    render(<UserActionsSideMenu onSelect={vi.fn()} />)
    expect(document.querySelector('aside')).toBeInTheDocument()
  })

  it('renders the side menu title', () => {
    render(<UserActionsSideMenu onSelect={vi.fn()} />)
    expect(screen.getByText(/sorted by/i)).toBeInTheDocument()
  })

  it('auto-selects the first action when none is active and data loads', async () => {
    const queryClient = createTestQueryClient()
    const action = makeAction('a1')
    queryClient.setQueryData(['user-actions-infinite'], {
      pages: [{ results: [action], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(<UserActionsSideMenu onSelect={onSelect} />, { queryClient })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
    })
  })

  it('calls onSelect(undefined) when actions list becomes empty with an active action', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['user-actions-infinite'], {
      pages: [{ results: [], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(
      <UserActionsSideMenu
        activeAction={makeAction('a1') as never}
        onSelect={onSelect}
      />,
      { queryClient }
    )

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(undefined)
    })
  })

  it('renders menu items for each cached action', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['user-actions-infinite'], {
      pages: [{ results: [makeAction('a1'), makeAction('a2')], next_cursor: null }],
      pageParams: [undefined]
    })

    render(<UserActionsSideMenu onSelect={vi.fn()} />, { queryClient })

    await waitFor(() => {
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('calls onSelect with clicked action', async () => {
    const queryClient = createTestQueryClient()
    const action = makeAction('a1')
    queryClient.setQueryData(['user-actions-infinite'], {
      pages: [{ results: [action], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(<UserActionsSideMenu onSelect={onSelect} />, { queryClient })

    await waitFor(() =>
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(1)
    )

    fireEvent.click(screen.getAllByRole('menuitem')[0])

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
    })
  })

  it('passes action_type filter from URL to query options', () => {
    render(<UserActionsSideMenu onSelect={vi.fn()} />, {
      initialEntries: ['/?action_type=ACCEPT_TOP']
    })

    expect(listUserActionsApiV1UserActionsGetInfiniteOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ action_type: 'ACCEPT_TOP', limit: 20 })
      })
    )
  })

  it('passes ordering filter from URL to query options', () => {
    render(<UserActionsSideMenu onSelect={vi.fn()} />, {
      initialEntries: ['/?ordering=-created_at']
    })

    expect(listUserActionsApiV1UserActionsGetInfiniteOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ ordering: '-created_at', limit: 20 })
      })
    )
  })
})
