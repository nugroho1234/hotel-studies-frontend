export type Role = 'lead' | 'researcher' | 'expert' | 'coder'

export const ROLE_LABEL: Record<Role, string> = {
  lead: 'Lead researcher',
  researcher: 'Researcher',
  expert: 'Expert',
  coder: 'Coder',
}

/** Where a signed-in user lands. */
export function homeFor(role: Role): string {
  if (role === 'coder') return '/split'
  if (role === 'expert') return '/expert'
  return '/dashboard'
}

/** Lead and researcher see the same pages for now. */
export function isStaff(role: Role): boolean {
  return role === 'lead' || role === 'researcher'
}
