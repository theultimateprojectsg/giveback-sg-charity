// A charity's fiscal year is labeled by the calendar year it ENDS in (e.g. FY ending 31 Mar 2026 = "FY2026",
// covering 1 Apr 2025 – 31 Mar 2026). For a fyEndMonth/fyEndDay of 12/31 this collapses to the calendar year,
// so it's a safe drop-in replacement for `.getFullYear()` everywhere stats bucket dates by "year".
export function fiscalYearOf(dateInput: string | number | Date, fyEndMonth: number, fyEndDay: number): number {
  const d = new Date(dateInput)
  const y = d.getFullYear()
  const fyEndThisCalYear = new Date(y, fyEndMonth - 1, fyEndDay, 23, 59, 59, 999)
  return d <= fyEndThisCalYear ? y : y + 1
}

export function fiscalYearBounds(yearLabel: number | string, fyEndMonth: number, fyEndDay: number): { start: Date, end: Date } {
  const end = new Date(Number(yearLabel), fyEndMonth - 1, fyEndDay, 23, 59, 59, 999)
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  start.setDate(start.getDate() + 1)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ISO 8601 week key ("2026-W03") for a given date — used to key weekly-recurring
// donor-insight dismissals so the same insight can resurface next week.
export function isoWeekKey(d: string | number | Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNo = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
