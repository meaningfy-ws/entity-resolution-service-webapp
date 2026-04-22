import { describe, expect, it, vi } from 'vitest'

import { DecisionsSideMenu } from '../../components/DecisionsSideMenu'
import { createTestQueryClient, fireEvent, render, screen, waitFor } from '../test-utils'

const { listDecisionsApiV1CurationDecisionsGetInfiniteOptions } = await import('@api/@tanstack/react-query.gen')

vi.mock('@api/@tanstack/react-query.gen', () => ({
  listDecisionsApiV1CurationDecisionsGetInfiniteOptions: vi.fn(() => ({
    queryKey: ['decisions-infinite'],
    queryFn: vi.fn().mockResolvedValue({ results: [], next_cursor: null })
  }))
}))

vi.mock('@hooks/useInfiniteScroll', () => ({
  useInfiniteScroll: vi.fn(() => ({ current: null }))
}))

const makeDecision = (id: string) => ({
  id,
  about_entity_mention: {
    identified_by: { source_id: 's1', request_id: id, entity_type: 'Person' },
    parsed_representation: { name: `Entity ${id}` }
  },
  current_placement: { cluster_id: 'c1', confidence_score: 0.8, similarity_score: 0.7 },
  created_at: new Date().toISOString()
})

describe('DecisionsSideMenu', () => {
  it('renders without crashing', () => {
    render(<DecisionsSideMenu onSelect={vi.fn()} />)
    expect(document.querySelector('aside')).toBeInTheDocument()
  })

  it('renders the side menu title', () => {
    render(<DecisionsSideMenu onSelect={vi.fn()} />)
    expect(screen.getByText(/sorted by/i)).toBeInTheDocument()
  })

  it('renders an <aside> element as the scroll container', () => {
    render(<DecisionsSideMenu onSelect={vi.fn()} />)
    expect(document.querySelector('aside')).toBeInTheDocument()
  })

  it('auto-selects the first decision when none is active and data loads', async () => {
    const queryClient = createTestQueryClient()
    const decision = makeDecision('d1')
    queryClient.setQueryData(['decisions-infinite'], {
      pages: [{ results: [decision], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(<DecisionsSideMenu onSelect={onSelect} />, { queryClient })

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }))
    })
  })

  it('calls onSelect(undefined) when the decisions list becomes empty with an active decision', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['decisions-infinite'], {
      pages: [{ results: [], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(
      <DecisionsSideMenu
        activeDecision={makeDecision('d1') as never}
        onSelect={onSelect}
      />,
      { queryClient }
    )

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(undefined)
    })
  })

  it('renders menu items for each cached decision', async () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['decisions-infinite'], {
      pages: [
        {
          results: [makeDecision('d1'), makeDecision('d2')],
          next_cursor: null
        }
      ],
      pageParams: [undefined]
    })

    render(<DecisionsSideMenu onSelect={vi.fn()} />, { queryClient })

    await waitFor(() => {
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('calls onSelect with the clicked decision when a menu item is clicked', async () => {
    const queryClient = createTestQueryClient()
    const decision = makeDecision('d1')
    queryClient.setQueryData(['decisions-infinite'], {
      pages: [{ results: [decision], next_cursor: null }],
      pageParams: [undefined]
    })

    const onSelect = vi.fn()
    render(<DecisionsSideMenu onSelect={onSelect} />, { queryClient })

    await waitFor(() =>
      expect(screen.getAllByRole('menuitem').length).toBeGreaterThanOrEqual(1)
    )

    fireEvent.click(screen.getAllByRole('menuitem')[0])

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1' }))
    })
  })

  it('normalizes legacy ordering query params before building the query options', () => {
    render(<DecisionsSideMenu onSelect={vi.fn()} />, {
      initialEntries: ['/?ordering=%2Bcreated_at']
    })

    expect(listDecisionsApiV1CurationDecisionsGetInfiniteOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ ordering: 'created_at', limit: 20 })
      })
    )
  })

  it('drops invalid ordering query params', () => {
    render(<DecisionsSideMenu onSelect={vi.fn()} />, {
      initialEntries: ['/?ordering=not-valid']
    })

    expect(listDecisionsApiV1CurationDecisionsGetInfiniteOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ ordering: undefined, limit: 20 })
      })
    )
  })

  it('selects the item at the previous index when the active decision disappears', async () => {
    const queryClient = createTestQueryClient()
    const onSelect = vi.fn()

    queryClient.setQueryData(['decisions-infinite'], {
      pages: [
        {
          results: [makeDecision('d1'), makeDecision('d2'), makeDecision('d3')],
          next_cursor: null
        }
      ],
      pageParams: [undefined]
    })

    const { rerender } = render(
      <DecisionsSideMenu activeDecision={makeDecision('d2') as never} onSelect={onSelect} />,
      { queryClient }
    )

    queryClient.setQueryData(['decisions-infinite'], {
      pages: [
        {
          results: [makeDecision('n1'), makeDecision('n2')],
          next_cursor: null
        }
      ],
      pageParams: [undefined]
    })

    rerender(
      <DecisionsSideMenu activeDecision={makeDecision('d2') as never} onSelect={onSelect} />
    )

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'n2' }))
    })
  })
})
