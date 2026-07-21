import type { Donation, DonorContact } from '../types'

// Canonical donor identity. Donations and contact records store the same
// underlying person under different field names, hence two helpers — they
// must always agree on the same person's key (see pureHelpers.test.js).
export function donationDonorKey(d: Pick<Donation, 'donor_email' | 'donor_nric' | 'donor_name'>): string | null | undefined {
  return d.donor_email?.trim() || d.donor_nric || d.donor_name
}

export function contactDonorKey(c: Partial<DonorContact> & { name?: string }): string | null | undefined {
  return c.email?.trim() || c.nric || c.full_name || c.name
}
