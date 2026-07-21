import type { ReactNode } from 'react'
import { C } from '../../theme'

interface EmptyStateProps {
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  ctaLabel?: ReactNode
  onCta?: () => void
}

export function EmptyState({ icon, title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', background: C.ivory, borderRadius: 8, border: `1px dashed ${C.border}` }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: C.forest, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: onCta ? 18 : 0, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>{description}</div>
      {onCta && (
        <button style={{ background: C.forest, color: 'white', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={onCta}>
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
