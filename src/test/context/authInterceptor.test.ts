/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setupAuthInterceptors } from '../../context/authInterceptor'
import * as authTokens from '../../context/authTokens'

const { axiosInstance } = vi.hoisted(() => {
  const instance = vi.fn() as unknown as {
    (config: unknown): Promise<unknown>
    defaults: { headers: { common: Record<string, string> } }
    interceptors: {
      request: {
        use: ReturnType<typeof vi.fn>
        eject: ReturnType<typeof vi.fn>
      }
      response: {
        use: ReturnType<typeof vi.fn>
        eject: ReturnType<typeof vi.fn>
      }
    }
  }

  instance.defaults = { headers: { common: {} } }
  instance.interceptors = {
    request: { use: vi.fn(), eject: vi.fn() },
    response: { use: vi.fn(), eject: vi.fn() }
  }

  return { axiosInstance: instance }
})

vi.mock('@api/client.gen', () => ({
  client: {
    instance: axiosInstance
  }
}))

vi.mock('@api/sdk.gen', () => ({
  refreshApiV1AuthRefreshPost: vi.fn()
}))

vi.mock('../../context/authTokens', () => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  storeTokens: vi.fn(),
  clearTokens: vi.fn()
}))

describe('authInterceptor', () => {
  let requestInterceptor: (config: { headers: Record<string, string> }) => { headers: Record<string, string> }
  let onResponseError: (error: any) => Promise<unknown>
  let onLogout: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    axiosInstance.defaults.headers.common = {}

    vi.mocked(axiosInstance.interceptors.request.use).mockImplementation(
      (onFulfilled: (config: { headers: Record<string, string> }) => { headers: Record<string, string> }) => {
        requestInterceptor = onFulfilled
        return 10
      }
    )

    vi.mocked(axiosInstance.interceptors.response.use).mockImplementation(
      (_onFulfilled: (res: unknown) => unknown, onRejected: (error: any) => Promise<unknown>) => {
        onResponseError = onRejected
        return 20
      }
    )

    onLogout = vi.fn()
    setupAuthInterceptors(onLogout)
  })

  it('adds Authorization header in request interceptor when access token exists', () => {
    vi.mocked(authTokens.getAccessToken).mockReturnValue('abc')

    const config = { headers: {} }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBe('Bearer abc')
  })

  it('does not set Authorization header when access token is missing', () => {
    vi.mocked(authTokens.getAccessToken).mockReturnValue(null)

    const config = { headers: {} }
    const result = requestInterceptor(config)

    expect(result.headers.Authorization).toBeUndefined()
  })

  it('rejects non-401 errors', async () => {
    const error = { response: { status: 500 }, config: { url: '/api/x' } }
    await expect(onResponseError(error)).rejects.toBe(error)
  })

  it('rejects 401 errors for auth endpoints', async () => {
    const error = { response: { status: 401 }, config: { url: '/auth/login' } }
    await expect(onResponseError(error)).rejects.toBe(error)
  })

  it('rejects 401 errors for already retried requests', async () => {
    const error = {
      response: { status: 401 },
      config: { url: '/api/x', _retry: true }
    }
    await expect(onResponseError(error)).rejects.toBe(error)
  })

  it('refreshes token and retries original request on 401', async () => {
    const { refreshApiV1AuthRefreshPost } = await import('@api/sdk.gen')

    vi.mocked(authTokens.getRefreshToken).mockReturnValue('refresh-1')
    vi.mocked(refreshApiV1AuthRefreshPost).mockResolvedValue({
      data: { access_token: 'new-access', refresh_token: 'new-refresh' }
    } as any)

    vi.mocked(axiosInstance).mockResolvedValueOnce({ data: 'retried-ok' })

    const error = {
      response: { status: 401 },
      config: { url: '/api/protected', headers: {} as Record<string, string>, _retry: false }
    }

    const result = await onResponseError(error)

    expect(vi.mocked(authTokens.storeTokens)).toHaveBeenCalledWith(
      'new-access',
      'new-refresh'
    )
    expect(axiosInstance.defaults.headers.common.Authorization).toBe(
      'Bearer new-access'
    )
    expect(error.config._retry).toBe(true)
    expect(error.config.headers.Authorization).toBe('Bearer new-access')
    expect(result).toEqual({ data: 'retried-ok' })
  })

  it('queues concurrent 401 requests while refresh is in progress', async () => {
    const { refreshApiV1AuthRefreshPost } = await import('@api/sdk.gen')

    vi.mocked(authTokens.getRefreshToken).mockReturnValue('refresh-2')

    let resolveRefresh: ((value: unknown) => void) | undefined
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve
    })
    vi.mocked(refreshApiV1AuthRefreshPost).mockReturnValue(
      refreshPromise as Promise<any>
    )

    vi.mocked(axiosInstance)
      .mockResolvedValueOnce({ data: 'first-retry' })
      .mockResolvedValueOnce({ data: 'queued-retry' })

    const firstError = {
      response: { status: 401 },
      config: { url: '/api/a', headers: {} as Record<string, string> }
    }
    const secondError = {
      response: { status: 401 },
      config: { url: '/api/b', headers: {} as Record<string, string> }
    }

    const p1 = onResponseError(firstError)
    const p2 = onResponseError(secondError)

    resolveRefresh?.({
      data: { access_token: 'queue-access', refresh_token: 'queue-refresh' }
    })

    const [r1, r2] = await Promise.all([p1, p2])

    expect([r1, r2]).toEqual(
      expect.arrayContaining([
        { data: 'first-retry' },
        { data: 'queued-retry' }
      ])
    )
    expect(secondError.config.headers.Authorization).toBe('Bearer queue-access')
    expect(vi.mocked(axiosInstance)).toHaveBeenCalledTimes(2)
  })

  it('clears tokens and logs out when refresh fails', async () => {
    const { refreshApiV1AuthRefreshPost } = await import('@api/sdk.gen')

    vi.mocked(authTokens.getRefreshToken).mockReturnValue('refresh-3')
    vi.mocked(refreshApiV1AuthRefreshPost).mockRejectedValue(new Error('refresh failed'))

    const error = {
      response: { status: 401 },
      config: { url: '/api/fail', headers: {} as Record<string, string> }
    }

    await expect(onResponseError(error)).rejects.toBe(error)

    expect(vi.mocked(authTokens.clearTokens)).toHaveBeenCalledOnce()
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('clears tokens and logs out when refresh token is missing', async () => {
    vi.mocked(authTokens.getRefreshToken).mockReturnValue(null)

    const error = {
      response: { status: 401 },
      config: { url: '/api/no-refresh', headers: {} as Record<string, string> }
    }

    await expect(onResponseError(error)).rejects.toBe(error)

    expect(vi.mocked(authTokens.clearTokens)).toHaveBeenCalledOnce()
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('cleanup ejects both interceptors', () => {
    const cleanup = setupAuthInterceptors(onLogout)
    cleanup()

    expect(axiosInstance.interceptors.request.eject).toHaveBeenCalledWith(10)
    expect(axiosInstance.interceptors.response.eject).toHaveBeenCalledWith(20)
  })
})
