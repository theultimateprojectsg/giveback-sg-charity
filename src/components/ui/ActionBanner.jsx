import { C } from '../../theme'

const ACTION_BANNER_TONES = {
  danger: { fill: '#A0472F' },
  warning: { fill: '#96700B' },
  success: { fill: '#2F6A48' },
}

// Standard bottom-of-card status callout — a dashed divider to separate it from the card body,
// then a bold filled pill (white text) so it actually pops instead of blending into the card.
export function ActionBanner({ text, sub, tone = 'danger' }) {
  const t = ACTION_BANNER_TONES[tone] || ACTION_BANNER_TONES.danger
  const icon = tone === 'success' ? '✓' : '⚠'
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: t.fill, borderRadius: 20, padding: '7px 14px 7px 10px' }}>
        <span style={{ fontSize: 14, color: '#fff', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{text}</span>
          {sub && <span style={{ fontSize: 12, color: '#fff', opacity: 0.9 }}> — {sub}</span>}
        </div>
      </div>
    </div>
  )
}
