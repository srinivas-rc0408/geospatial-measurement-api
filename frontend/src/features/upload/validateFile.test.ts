import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '@/lib/api/errors'

import { formatLimit, uploadProblem, validateFile } from './validateFile'

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name)
const limits = { max_upload_mb: 10, accepted_extensions: ['.zip', '.kml', '.kmz'] }
const MB = 1024 * 1024

describe('validateFile', () => {
  it('accepts the server’s extensions in any case', () => {
    for (const name of ['a.zip', 'b.KML', 'c.kmz']) expect(validateFile(file(name), limits)).toBeNull()
  })

  it('rejects other types with what to upload instead', () => {
    expect(validateFile(file('parcels.shp'), limits)).toEqual({
      message: '“parcels.shp” is not a supported file type.',
      hint: expect.stringContaining('.shp, .shx and .dbf') as unknown,
    })
  })

  it('rejects empty files and files over the server’s limit', () => {
    expect(validateFile(file('a.kml', 0), limits)?.message).toBe('“a.kml” is empty.')
    expect(validateFile(file('a.kml', 10 * MB), limits)).toBeNull()
    expect(validateFile(file('big.zip', 10 * MB + 1), limits)?.message).toBe(
      '“big.zip” is 10.0 MB; the limit is 10 MB.',
    )
    const small = { ...limits, max_upload_mb: 2.5 }
    expect(validateFile(file('big.zip', 3 * MB), small)?.message).toBe(
      '“big.zip” is 3.0 MB; the limit is 2.5 MB.',
    )
  })

  it('leaves type and size to the server while its limits are unknown', () => {
    expect(validateFile(file('notes.txt', 50 * MB), undefined)).toBeNull()
    expect(validateFile(file('a.kml', 0), undefined)?.message).toBe('“a.kml” is empty.')
  })
})

describe('formatLimit', () => {
  it('shows whole megabytes without decimals', () => {
    expect(formatLimit(10)).toBe('10 MB')
    expect(formatLimit(0.5)).toBe('0.5 MB')
  })
})

describe('uploadProblem', () => {
  it('keeps the server reason and adds what to do next for 413/415/422', () => {
    expect(uploadProblem(new ApiError(422, 'Missing .dbf.'))).toEqual({
      message: 'Missing .dbf.',
      hint: expect.stringContaining('QGIS') as unknown,
    })
    expect(uploadProblem(new ApiError(413, 'Too big.'), limits).hint).toMatch(/up to 10 MB/)
    expect(uploadProblem(new ApiError(413, 'Too big.')).hint).toBe('Split the data into smaller files.')
    expect(uploadProblem(new ApiError(415, 'Nope.')).hint).toMatch(/\.kml or \.kmz/)
    expect(uploadProblem(new ApiError(500, 'Server error.'))).toEqual({ message: 'Server error.' })
  })

  it('treats the rate limit as a calm wait, keeping the server’s retry time', () => {
    const problem = uploadProblem(new ApiError(429, 'Too many uploads. Try again in 3 minutes.'))
    expect(problem).toEqual({
      message: 'Too many uploads. Try again in 3 minutes.',
      hint: expect.stringContaining('earlier results are still in Files') as unknown,
      wait: true,
    })
  })

  it('explains network failures', () => {
    expect(uploadProblem(new NetworkError('offline')).message).toMatch(/Could not reach the server/)
    expect(uploadProblem(new Error('?')).message).toBe('The upload failed. Try again.')
  })
})
