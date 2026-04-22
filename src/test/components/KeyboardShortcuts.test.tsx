import { describe, expect, it, vi } from 'vitest'

import { KeyboardShortcuts } from '../../components/KeyboardShortcuts'
import { render, screen } from '../test-utils'

import type { DecisionSummary } from '../../api/types.gen'

// Mock the hook so the component renders without API/mutation setup
vi.mock('@hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn()
}))

const mockDecision: DecisionSummary = {
  id: 'decision-1',
  about_entity_mention: {
    identified_by: { source_id: 's1', request_id: 'e1', entity_type: 'Person' },
    parsed_representation: { name: 'Test Entity' }
  },
  current_placement: { cluster_id: 'c1', confidence_score: 0.8, similarity_score: 0.7 },
  created_at: new Date().toISOString()
}

describe('KeyboardShortcuts', () => {
  it('renders keyboard shortcuts heading', () => {
    render(<KeyboardShortcuts />)
    expect(screen.getByText(/Keyboard shortcuts:/)).toBeInTheDocument()
  })

  it('displays Accept shortcut instruction', () => {
    render(<KeyboardShortcuts />)
    expect(screen.getByText(/A = Accept/)).toBeInTheDocument()
  })

  it('displays Reject shortcut instruction', () => {
    render(<KeyboardShortcuts />)
    expect(screen.getByText(/R = Reject/)).toBeInTheDocument()
  })

  it('displays Navigate queue shortcut instruction', () => {
    render(<KeyboardShortcuts />)
    expect(screen.getByText(/Navigate queue/)).toBeInTheDocument()
  })

  it('renders all shortcut instructions when an active decision is provided', () => {
    render(<KeyboardShortcuts activeDecision={mockDecision} />)
    expect(screen.getByText(/A = Accept/)).toBeInTheDocument()
    expect(screen.getByText(/R = Reject/)).toBeInTheDocument()
    expect(screen.getByText(/Navigate queue/)).toBeInTheDocument()
  })
})
