// Core domain types shared across the app. Fields reflect what's actually
// read/written by the codebase, not necessarily the full Supabase schema.

export interface Donation {
  id: string
  donor_name?: string | null
  donor_email?: string | null
  donor_nric?: string | null
  amount: number
  created_at: string
  payment_status: 'confirmed' | 'pending' | 'refunded' | string
  receipt_issued?: boolean
  receipt_number?: string | null
  payment_ref?: string | null
  payment_method?: string | null
  thank_you_sent?: boolean
  is_anonymous?: boolean
  source?: 'manual' | string
  cause_id?: string | null
  recurring_gift_id?: string | null
  notes?: string | null
  impact_note?: string | null
  donor_deactivated?: boolean
  donor_do_not_contact?: boolean
  donor_deceased?: boolean
  [key: string]: unknown
}

export interface DonorContact {
  id: string
  full_name: string
  email?: string | null
  nric?: string | null
  notes?: string | null
  household_id?: string | null
  preferred_channel?: string | null
  preferred_timing?: string | null
  communication_restrictions?: string | null
  receipt_name_override?: string | null
  linked_family_contact?: string | null
  last_visited_date?: string | null
  next_visit_planned_date?: string | null
  birth_date?: string | null
  tax_residency_country?: string | null
  mailing_address?: string | null
  [key: string]: unknown
}

export interface DonorSummary {
  name: string
  email?: string | null
  nric?: string | null
  total: number
  count: number
  receipts: number
  lastDate?: string | null
  deactivated?: boolean
  doNotContact?: boolean
  deceased?: boolean
  isContactOnly?: boolean
  [key: string]: unknown
}

export interface Pledge {
  id: string
  donor_name?: string | null
  donor_email?: string | null
  amount: number
  status: 'pending' | 'fulfilled' | 'cancelled' | string
  expected_date?: string | null
  is_multi_year?: boolean
  [key: string]: unknown
}

export interface RecurringGift {
  id: string
  donor_name?: string | null
  donor_email?: string | null
  amount: number
  frequency: string
  status: 'active' | 'paused' | 'cancelled' | string
  authorization_status?: string
  next_expected_date?: string | null
  [key: string]: unknown
}

export interface Grant {
  id: string
  funder_name?: string
  amount: number
  status: 'active' | string
  cause_id?: string | null
  report_due_date?: string | null
  is_matching?: boolean
  unrestricted_amount?: number
  [key: string]: unknown
}

export type DonationBadgeInfo = Record<string, {
  isFirstTime: boolean
  isBigGift: boolean
  isLoyal: boolean
  isBiggestYet: boolean
}>

export type DonorBadgeMap = Record<string, {
  isFirstTime: boolean
  isBigGift: boolean
  isLoyal: boolean
  isBiggestYet: boolean
  isMajorDonor: boolean
  mostRecent: string
}>
