import { describe, expect, it } from 'vitest'
import { homeFor, isStaff } from './roles'

describe('roles', () => {
  it('sends each role to its own home', () => {
    expect(homeFor('coder')).toBe('/split')
    expect(homeFor('expert')).toBe('/expert')
    expect(homeFor('lead')).toBe('/dashboard')
    expect(homeFor('researcher')).toBe('/dashboard')
  })
  it('treats lead and researcher as staff, nobody else', () => {
    expect([isStaff('lead'), isStaff('researcher'), isStaff('coder'), isStaff('expert')]).toEqual([true, true, false, false])
  })
})
