export function fillTemplate(str, vars) {
  if (!str) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars?.[k] ?? ''))
}
