import jwt from 'jsonwebtoken'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'

import { STORAGE_KEY, refreshTokenIfNeeded, AuthTokens } from '../src'

describe('refreshTokenIfNeeded', () => {
  it('throws an error if the requestRefresh function threw one', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // and I have a requestRefresh function that throws an error
    const requestRefresh = async () => {
      throw new Error('Server error')
    }

    // and I have an error handler
    const catchFn = jest.fn()

    // WHEN
    // I call refreshTokenIfNeeded
    await refreshTokenIfNeeded(requestRefresh).catch(catchFn)

    // THEN
    // I expect the error handler to have been called with the right error
    expect(catchFn).toHaveBeenLastCalledWith(new Error('Server error'))
  })

  it.each([[401], [422]])(
    'throws an error and clears the storage if the requestRefresh function throws an error with a %s status code',
    async (statusCode) => {
      // GIVEN
      // I have an access token that expired an hour ago
      const expiredToken = jwt.sign(
        {
          exp: Math.floor(Date.now() / 1000) - 60 * 60,
          data: 'foobar',
        },
        'secret'
      )

      // and this token is stored in local storage
      const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

      // and API requests are mocked
      const mock = new MockAdapter(axios)
      mock.onAny().reply(statusCode)

      // and I have a requestRefresh function that throws an error
      const requestRefresh = async (refreshToken: string): Promise<AuthTokens> => {
        const response = await axios.post('auth/refresh', {
          refresh: refreshToken,
        })

        return {
          accessToken: response.data.access,
          refreshToken: response.data.refresh,
        }
      }

      // and I have an error handler
      const catchFn = jest.fn()

      // WHEN
      // I call refreshTokenIfNeeded
      await refreshTokenIfNeeded(requestRefresh).catch(catchFn)

      // THEN
      // I expect the error handler to have been called with the right error
      expect(catchFn).toHaveBeenLastCalledWith(
        new Error(`Got ${statusCode} on token refresh; clearing both auth tokens`)
      )
      // and the storage to have been cleared
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    }
  )

  it('refreshes the access token if it does not have an expiration', async () => {
    // GIVEN
    // I have an access token that has no expiration
    const expiredToken = jwt.sign(
      {
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // and I have a requestRefresh function that returns an access token
    const requestRefresh = async () => 'newaccesstoken'

    // WHEN
    // I call refreshTokenIfNeeded
    const result = await refreshTokenIfNeeded(requestRefresh)

    // THEN
    // I expect the stored access token to have been updated
    const storedTokens = localStorage.getItem(STORAGE_KEY) as string
    expect(JSON.parse(storedTokens)).toEqual({ accessToken: 'newaccesstoken', refreshToken: 'refreshtoken' })

    // and the result to be the new access token
    expect(result).toEqual('newaccesstoken')
  })

  it('refreshes the access token is it has expired', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // and I have a requestRefresh function that returns an access token
    const requestRefresh = async () => 'newaccesstoken'

    // WHEN
    // I call refreshTokenIfNeeded
    const result = await refreshTokenIfNeeded(requestRefresh)

    // THEN
    // I expect the stored access token to have been updated
    const storedTokens = localStorage.getItem(STORAGE_KEY) as string
    expect(JSON.parse(storedTokens)).toEqual({ accessToken: 'newaccesstoken', refreshToken: 'refreshtoken' })

    // and the result to be the new access token
    expect(result).toEqual('newaccesstoken')
  })

  it('updates both tokens if they are provided', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // and I have a requestRefresh function that returns both tokens
    const requestRefresh = async () => ({ accessToken: 'newaccesstoken', refreshToken: 'newrefreshtoken' })

    // WHEN
    // I call refreshTokenIfNeeded
    const result = await refreshTokenIfNeeded(requestRefresh)

    // THEN
    // I expect both the stord tokens to have been updated
    const storedTokens = localStorage.getItem(STORAGE_KEY) as string
    expect(JSON.parse(storedTokens)).toEqual({ accessToken: 'newaccesstoken', refreshToken: 'newrefreshtoken' })

    // and the result to be the new access token
    expect(result).toEqual('newaccesstoken')
  })

  it('throws an error if requestRefresh returns an invalid response', async () => {
    // GIVEN
    // I have an access token that expired an hour ago
    const expiredToken = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) - 60 * 60,
        data: 'foobar',
      },
      'secret'
    )

    // and this token is stored in local storage
    const tokens = { accessToken: expiredToken, refreshToken: 'refreshtoken' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))

    // and I have a requestRefresh function that returns an access token
    const requestRefresh = async () => ({ access_token: 'wrongkey!', refresh_token: 'anotherwrongkey!' })

    // and I have an error handler
    const errorHandler = jest.fn()

    // WHEN
    // I call refreshTokenIfNeeded
    await refreshTokenIfNeeded(requestRefresh as any).catch(errorHandler)

    // THEN
    // I expect the error handler to have been called with the right error
    expect(errorHandler).toHaveBeenLastCalledWith(
      new Error('requestRefresh must either return a string or an object with an accessToken')
    )
  })
})
