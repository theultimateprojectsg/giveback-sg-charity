import { C } from '../../theme'

interface SenderIdentityLineProps {
  recipientName?: string | null
  recipientEmail?: string | null
  senderDomainStatus?: string | null
  senderDomain?: string | null
  senderEmailLocalPart?: string | null
  replyToEmail?: string | null
  charityName?: string | null
}

export function SenderIdentityLine({ recipientName, recipientEmail, senderDomainStatus, senderDomain, senderEmailLocalPart, replyToEmail, charityName }: SenderIdentityLineProps) {
  const isVerified = senderDomainStatus === 'verified' && senderDomain
  // Mirrors the "from" header the send-thank-you edge function actually sets, so what the charity
  // previews here matches exactly what lands in the recipient's inbox — no surprises about who it
  // looks like it's from.
  const displayName = isVerified ? (charityName || 'Your charity') : `${charityName || 'Your charity'} via Giving Tree`
  const fromAddress = isVerified ? `${senderEmailLocalPart}@${senderDomain}` : 'hello@givingtree.sg'
  const rowStyle = { display: 'flex', gap: 10, padding: '6px 0' }
  const labelStyle = { fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, width: 78, flexShrink: 0, paddingTop: 1, whiteSpace: 'nowrap' as const }
  return (
    <div style={{ marginBottom: 14, background: isVerified ? C.successBg : (C.gold + '14'), border: `1px solid ${isVerified ? C.sage : C.gold}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ ...rowStyle, borderBottom: `1px solid ${isVerified ? C.sage : C.gold}33` }}>
        <span style={labelStyle}>From</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: isVerified ? C.sage : C.gold }}>
          {isVerified ? '✓ ' : ''}{displayName} <span style={{ fontWeight: 400, color: C.muted }}>&lt;{fromAddress}&gt;</span>
        </span>
      </div>
      <div style={{ ...rowStyle, borderBottom: !isVerified ? `1px solid ${isVerified ? C.sage : C.gold}33` : 'none' }}>
        <span style={labelStyle}>To</span>
        <span style={{ fontSize: 13, color: C.text }}>
          {recipientName} {recipientEmail ? <span style={{ color: C.muted }}>&lt;{recipientEmail}&gt;</span> : <span style={{ color: C.red }}>(no email on file)</span>}
        </span>
      </div>
      {!isVerified && (
        <div style={rowStyle}>
          <span style={labelStyle}>Replies to</span>
          <span style={{ fontSize: 13, color: C.text }}>{replyToEmail}</span>
        </div>
      )}
    </div>
  )
}
