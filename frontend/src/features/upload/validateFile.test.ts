import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '@/lib/api/errors'

import { MAX_UPLOAD_BYTES, uploadProblem, validateFile } from './validateFile'

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name)

describe('validateFile', () => {
  it('accepts .zip, .kml and .kmz in any case', () => {
    for (const name of ['a.zip', 'b.KML', 'c.kmz']) expect(validateFile(file(name))).toBeNull()
  })

  it('rejects other types with what to upload instead', () => {
    expect(validateFile(file('parcels.shp'))).toEqual({
      message: '“parcels.shp” is not a supported file type.',
      hint: expect.stringContaining('.shp, .shx and .dbf') as unknown,
    })
  })

  it('rejects empty files and files over 10 MB', () => {
    expect(validateFile(file('a.kml', 0))?.message).toBe('“a.kml” is empty.')
    expect(validateFile(file('a.kml', MAX_UPLOAD_BYTES))).toBeNull()
    expect(validateFile(file('big.zip', MAX_UPLOAD_BYTES + 1))?.message).toBe(
      '“big.zip” is 10.0 MB; the limit is 10 MB.',
    )
  })
})

describe('uploadProblem', () => {
  it('keeps the server reason and adds what to do next for 413/415/422', () => {
    expect(uploadProblem(new ApiError(422, 'Missing .dbf.'))).toEqual({
      message: 'Missing .dbf.',
      hint: expect.stringContaining('QGIS') as unknown,
    })
    expect(uploadProblem(new ApiError(413, 'Too big.')).hint).toMatch(/10 MB/)
    expect(uploadProblem(new ApiError(415, 'Nope.')).hint).toMatch(/\.kml or \.kmz/)
    expect(uploadProblem(new ApiError(500, 'Server error.'))).toEqual({ message: 'Server error.' })
  })

  it('explains network failures', () => {
    expect(uploadProblem(new NetworkError('offline')).message).toMatch(/Could not reach the server/)
    expect(uploadProblem(new Error('?')).message).toBe('The upload failed. Try again.')
  })
})
