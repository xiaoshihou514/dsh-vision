import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

describe('browser plugin dependencies', () => {
  it('declares every service read directly from the client context', () => {
    expect(inject).toEqual(['connection', 'slots'])
  })

  it('registers settings without adding a second image intake control', () => {
    const registrations: string[] = []
    const slots = {
      inject: (name: string, register: () => unknown) => {
        registrations.push(name)
        register()
      },
      register: () => () => undefined,
    }
    apply({
      get: () => ({ api: {} }),
      slots,
    } as never)

    expect(registrations).toEqual(['settings.plugin.item'])
  })
})
