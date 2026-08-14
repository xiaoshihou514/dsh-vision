import { describe, expect, it } from 'vitest'
import { inject } from '../src/client/index.ts'

describe('browser plugin dependencies', () => {
  it('declares every service read directly from the client context', () => {
    expect(inject).toEqual(['connection', 'settingsScope', 'slots'])
  })
})
