import React from 'react'

export function InfoTip({ text }) {
  const [show, setShow] = React.useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(v => !v)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'default', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
      {show && (
        <span style={{ position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)', background: 'white', color: '#444', fontSize: 11, fontWeight: 400, lineHeight: 1.6, padding: '8px 12px', borderRadius: 8, whiteSpace: 'normal', width: 200, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #e5e7eb', pointerEvents: 'none', textTransform: 'none', letterSpacing: 0 }}>
          {text}
          <span style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: 5, borderStyle: 'solid', borderColor: 'white transparent transparent transparent' }} />
        </span>
      )}
    </span>
  )
}
