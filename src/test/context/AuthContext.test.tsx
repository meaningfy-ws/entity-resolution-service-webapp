/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../../context/AuthContext'
import { useAuth } from '../../context/useAuth'
import { fireEvent, render, screen, waitFor } from '../test-utils'

// Mock the API functions
vi.mock('@api/sdk.gen', () => ({
  getCurrentUserApiV1UsersMeGet: vi.fn(),
  loginApiV1AuthLoginPost: vi.fn()
}))

vi.mock('@api/client.gen', () => ({
  client: {
    instance: {
      defaults: { headers: { common: {} } }
    }
  }
}))

vi.mock('../../context/authInterceptor', () => ({
  setupAuthInterceptors: vi.fn(() => vi.fn())
}))

vi.mock('../../context/authTokens', () => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  storeTokens: vi.fn(),
  clearTokens: vi.fn()
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  )

  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  roles: ['admin']
}

const TestComponent = () => {
  const auth = useAuth()

  return (
    <div>
      <div>{auth.isLoading ? 'loading' : 'loaded'}</div>
      <div>{auth.user?.email ?? 'no-user'}</div>
      <button
        onClick={() => {
          void auth.login('test@example.com', 'password').catch(() => {})
        }}
      >
        Login
      </button>
      <button onClick={() => auth.logout()}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    localStorage.clear()
  })

  describe('AuthProvider bootstrap', () => {
    it('sets isLoading to false when no token is stored', async () => {
      const { getCurrentUserApiV1UsersMeGet } = await import('@api/sdk.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue(null)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('loaded')).toBeInTheDocument()
      })

      expect(vi.mocked(getCurrentUserApiV1UsersMeGet)).not.toHaveBeenCalled()
    })

    it('fetches current user when access token exists', async () => {
      const { getCurrentUserApiV1UsersMeGet } = await import('@api/sdk.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue('valid-token')
      vi.mocked(getCurrentUserApiV1UsersMeGet).mockResolvedValue({
        data: mockUser
      } as any)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      expect(vi.mocked(getCurrentUserApiV1UsersMeGet)).toHaveBeenCalled()
    })

    it('handles bootstrap error gracefully', async () => {
      const { getCurrentUserApiV1UsersMeGet } = await import('@api/sdk.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue('invalid-token')
      vi.mocked(getCurrentUserApiV1UsersMeGet).mockRejectedValue(
        new Error('Unauthorized')
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('loaded')).toBeInTheDocument()
      })

      expect(screen.getByText('no-user')).toBeInTheDocument()
    })

    it('sets Authorization header when token exists', async () => {
      const { client } = await import('@api/client.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue('test-token')
      vi.mocked((await import('@api/sdk.gen')).getCurrentUserApiV1UsersMeGet).mockResolvedValue(
        { data: mockUser } as any
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      expect(client.instance.defaults.headers.common.Authorization).toBe(
        'Bearer test-token'
      )
    })
  })

  describe('login', () => {
    it('stores tokens and fetches user on successful login', async () => {
      const { loginApiV1AuthLoginPost, getCurrentUserApiV1UsersMeGet } =
        await import('@api/sdk.gen')
      const { storeTokens, getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue(null)
      vi.mocked(loginApiV1AuthLoginPost).mockResolvedValue({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh'
        }
      } as any)

      vi.mocked(getCurrentUserApiV1UsersMeGet).mockResolvedValue({
        data: mockUser
      } as any)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('Login')).toBeInTheDocument()
      })

      const loginButton = screen.getByText('Login')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      expect(vi.mocked(storeTokens)).toHaveBeenCalledWith(
        'new-access',
        'new-refresh'
      )

      expect(vi.mocked(loginApiV1AuthLoginPost)).toHaveBeenCalledWith({
        body: { email: 'test@example.com', password: 'password' },
        throwOnError: true
      })

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })

    it('sets Authorization header after successful login', async () => {
      const { client } = await import('@api/client.gen')
      const { loginApiV1AuthLoginPost, getCurrentUserApiV1UsersMeGet } =
        await import('@api/sdk.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue(null)
      vi.mocked(loginApiV1AuthLoginPost).mockResolvedValue({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh'
        }
      } as any)

      vi.mocked(getCurrentUserApiV1UsersMeGet).mockResolvedValue({
        data: mockUser
      } as any)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => screen.getByText('Login'))

      fireEvent.click(screen.getByText('Login'))

      await waitFor(() => {
        expect(client.instance.defaults.headers.common.Authorization).toBe(
          'Bearer new-access'
        )
      })
    })

    it('handles login error', async () => {
      const { loginApiV1AuthLoginPost } = await import('@api/sdk.gen')
      const { getAccessToken } = await import('../../context/authTokens')

      vi.mocked(getAccessToken).mockReturnValue(null)
      vi.mocked(loginApiV1AuthLoginPost).mockRejectedValue(
        new Error('Invalid credentials')
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => screen.getByText('Login'))

      const loginButton = screen.getByText('Login')
      fireEvent.click(loginButton)

      await waitFor(() => {
        expect(screen.getByText('no-user')).toBeInTheDocument()
      })
    })
  })

  describe('logout', () => {
    it('clears tokens and navigates to login on logout', async () => {
      const { getAccessToken } = await import('../../context/authTokens')
      const { clearTokens } = await import('../../context/authTokens')
      const { client } = await import('@api/client.gen')
      const { getCurrentUserApiV1UsersMeGet } = await import('@api/sdk.gen')

      vi.mocked(getAccessToken).mockReturnValue('valid-token')
      vi.mocked(getCurrentUserApiV1UsersMeGet).mockResolvedValue({
        data: mockUser
      } as any)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Logout')
      fireEvent.click(logoutButton)

      expect(vi.mocked(clearTokens)).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
      expect(client.instance.defaults.headers.common.Authorization).toBeUndefined()
    })

    it('clears user state on logout', async () => {
      const { getAccessToken } = await import('../../context/authTokens')
      const { getCurrentUserApiV1UsersMeGet } = await import('@api/sdk.gen')

      vi.mocked(getAccessToken).mockReturnValue('valid-token')
      vi.mocked(getCurrentUserApiV1UsersMeGet).mockResolvedValue({
        data: mockUser
      } as any)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Logout'))

      await waitFor(() => {
        expect(screen.getByText('no-user')).toBeInTheDocument()
      })
    })
  })

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      const BadComponent = () => {
        useAuth()
        return null
      }

      // Suppress console error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<BadComponent />)
      }).toThrow('useAuth must be used within AuthProvider')

      consoleError.mockRestore()
    })
  })
})
