import { describe, expect, it, vi } from 'vitest'

import { Header } from '../../components/Header'
import { createTestQueryClient, fireEvent, render, screen } from '../test-utils'

const mockNavigate = vi.hoisted(() => vi.fn())

vi.mock('@api/@tanstack/react-query.gen', () => ({
  getStatisticsApiV1CurationStatsGetOptions: vi.fn(() => ({
    queryKey: ['curation-stats'],
    queryFn: vi.fn()
  }))
}))

vi.mock('@context/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: null, logout: vi.fn() }))
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()

  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const { useAuth } = await import('@context/useAuth')

describe('Header', () => {
  it('renders the main page title', () => {
    render(<Header />)
    expect(screen.getByText('Resolution Decision Review')).toBeInTheDocument()
  })

  it('shows loading skeleton while stats are loading', () => {
    render(<Header />)
    expect(screen.getByText('Resolution Decision Review')).toBeInTheDocument()
  })

  it('shows selected top, alternative, rejected, and total when stats are loaded', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['curation-stats'], {
      curation: {
        selected_top: 15,
        selected_alternative: 3,
        rejected_all: 2,
        total_decisions: 20
      }
    })

    render(<Header />, { queryClient })

    expect(screen.getByText(/15 Selected Top/)).toBeInTheDocument()
    expect(screen.getByText(/3.*Selected Alternative/)).toBeInTheDocument()
    expect(screen.getByText(/2 Rejected/)).toBeInTheDocument()
    expect(screen.getByText(/20 decisions/)).toBeInTheDocument()
  })

  it('shows zero counts when curation stats are absent', () => {
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['curation-stats'], {})

    render(<Header />, { queryClient })

    expect(screen.getByText(/0 Selected Top/)).toBeInTheDocument()
    expect(screen.getByText(/0 decisions/)).toBeInTheDocument()
  })

  it('renders sign out button', () => {
    render(<Header />)
    expect(screen.getByRole('button', { name: /user/i })).toBeInTheDocument()
  })

  it('renders the current user email when a user exists', () => {
    const logout = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { email: 'user@example.com' },
      logout
    } as never)

    render(<Header />)

    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('calls logout when sign out is clicked', () => {
    const logout = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { email: 'user@example.com', is_superuser: false },
      logout
    } as never)

    render(<Header />)
    fireEvent.click(screen.getByRole('button', { name: /user@example.com/i }))
    fireEvent.click(screen.getByText(/sign out/i))

    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows admin panel option only for admin users', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { email: 'admin@example.com', is_superuser: true },
      logout: vi.fn()
    } as never)

    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /admin@example.com/i }))
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('navigates to admin panel when Admin Panel is clicked', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { email: 'admin@example.com', is_superuser: true },
      logout: vi.fn()
    } as never)

    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /admin@example.com/i }))
    fireEvent.click(screen.getByText('Admin Panel'))

    expect(mockNavigate).toHaveBeenCalledWith('/admin')
  })

  describe('confirmation preference toggles', () => {
    it('renders skip all confirmations menu item', () => {
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))

      expect(screen.getByText('Skip all confirmations')).toBeInTheDocument()
    })

    it('renders per-action skip toggles', () => {
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))

      expect(screen.getByText('Skip accept')).toBeInTheDocument()
      expect(screen.getByText('Skip reject')).toBeInTheDocument()
      expect(screen.getByText('Skip assign alternative')).toBeInTheDocument()
    })

    it('toggles skipAll when "Skip all confirmations" is clicked', () => {
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))
      fireEvent.click(screen.getByText('Skip all confirmations'))

      // After toggling on, the switch should be checked
      const skipAllSwitch = screen.getByText('Skip all confirmations')
        .closest('[class*="menu"]')?.querySelector('[role="switch"]')
      expect(skipAllSwitch).toBeTruthy()
    })

    it('persists accept skip to sessionStorage when "Skip accept" is clicked', () => {
      sessionStorage.clear()
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))
      fireEvent.click(screen.getByText('Skip accept'))

      expect(sessionStorage.getItem('ere_skip_accept')).toBe('true')
    })

    it('persists reject skip to sessionStorage when "Skip reject" is clicked', () => {
      sessionStorage.clear()
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))
      fireEvent.click(screen.getByText('Skip reject'))

      expect(sessionStorage.getItem('ere_skip_reject')).toBe('true')
    })

    it('persists assign skip to sessionStorage when "Skip assign alternative" is clicked', () => {
      sessionStorage.clear()
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))
      fireEvent.click(screen.getByText('Skip assign alternative'))

      expect(sessionStorage.getItem('ere_skip_assign')).toBe('true')
    })

    it('removes accept skip from sessionStorage when toggling off', () => {
      sessionStorage.setItem('ere_skip_accept', 'true')
      render(<Header />)

      fireEvent.click(screen.getByRole('button', { name: /user/i }))
      fireEvent.click(screen.getByText('Skip accept'))

      expect(sessionStorage.getItem('ere_skip_accept')).toBeNull()
    })
  })
})
