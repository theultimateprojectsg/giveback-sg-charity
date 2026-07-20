export function fillTemplate(str, vars) {
  if (!str) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars?.[k] ?? ''))
}

// Named presets for the ~10 distinct `.toLocaleDateString('en-SG', {...})` option
// combinations found in App.jsx. `'numeric'` matches the bare `toLocaleDateString('en-SG')`
// call with no options (locale-default numeric date, e.g. "1/6/2025").
const DATE_FORMAT_PRESETS = {
  numeric: undefined,
  short: { day: 'numeric', month: 'short', year: 'numeric' },       // "1 Jun 2025"
  long: { day: 'numeric', month: 'long', year: 'numeric' },         // "1 June 2025"
  shortNoYear: { day: 'numeric', month: 'short' },                  // "1 Jun"
  longNoYear: { day: 'numeric', month: 'long' },                    // "1 June"
  monthShort: { month: 'short' },                                   // "Jun"
  monthLong: { month: 'long' },                                     // "June"
  monthYearShort: { month: 'short', year: 'numeric' },              // "Jun 2025"
  monthYearLong: { month: 'long', year: 'numeric' },                // "June 2025"
  year: { year: 'numeric' },                                        // "2025"
}

// Formats a date the way this app displays dates everywhere: Singapore locale,
// one of the presets above. `style` defaults to the most common one used in the app.
export function formatDate(dateInput, style = 'short') {
  if (dateInput == null) return ''
  const preset = DATE_FORMAT_PRESETS[style]
  if (!(style in DATE_FORMAT_PRESETS)) throw new Error(`formatDate: unknown style "${style}"`)
  return new Date(dateInput).toLocaleDateString('en-SG', preset)
}

// Thousands-separated number, no currency symbol — for counts, not money
// (e.g. "1,234 donations"). Use formatCurrency for dollar amounts.
export function formatNumber(n) {
  return Number(n || 0).toLocaleString()
}

// Dollar amount with thousands separators, e.g. "$1,234". This app is
// Singapore-only and single-currency (SGD), so no currency-code parameter.
export function formatCurrency(n) {
  return `$${formatNumber(n)}`
}
