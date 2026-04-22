import { describe, expect, it, vi } from 'vitest'

import { LoginPage } from '../../pages/LoginPage'
import { fireEvent, render, screen, waitFor } from '../test-utils'

const mockLogin = vi.fn()

vi.mock('@context/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, user: null, isLoading: false, logout: vi.fn() })
}))

describe('LoginPage', () => {
  // antd Typography + Form components are heavy; allow extra time for ARIA-based queries
  vi.setConfig({ testTimeout: 20000 })

  it('renders the "Sign in" heading', () => {
    render(<LoginPage />)
    // selector scopes search to <h3>; faster than getByRole('heading') in Ant Design DOM
    expect(screen.getByText('Sign in', { selector: 'h3' })).toBeInTheDocument()
  })

  it('renders the subtitle text', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Resolution Decision Review/i)).toBeInTheDocument()
  })

  it('renders an email input', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('renders a password input', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  })

  it('renders the submit button', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument()
  })

  it('shows email required validation when form is submitted empty', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
    })
  })

  it('shows password required validation when only email is missing', async () => {
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Password is required/i)).toBeInTheDocument()
    })
  })

  it('shows email format validation for an invalid email', async () => {
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'notanemail' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid email/i)).toBeInTheDocument()
    })
  })

  it('calls login with the entered email and password on submit', async () => {
    mockLogin.mockResolvedValue(undefined)
    render(<LoginPage />)

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'admin@example.com' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@example.com', 'secret123')
    })
  })

  it('does not call login when validation fails', async () => {
    mockLogin.mockClear()
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }))

    await waitFor(() => {
      expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })
})
