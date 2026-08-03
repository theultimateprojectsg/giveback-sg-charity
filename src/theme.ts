// Shared color palette + font stacks. Every color/typography value used across
// the app should come from here rather than being hand-picked at the call
// site, so a rebrand or contrast fix is a one-file change.
export const C = {
  forest:    '#1B4332',
  forestInk: '#0F2A1F',
  teal:      '#1A3C34',
  sage:      '#3D7A5C',
  gold:      '#B4870E',
  ivory:     '#FAF7F2',
  ivoryDark: '#F0EBE1',
  border:    '#E2D9CC',
  borderStrong: '#CFC3AF',
  text:      '#1C1C1C',
  muted:     '#6B6255',
  white:     '#FFFFFF',
  red:       '#A0472F',
  warning:       '#B4870E',
  warningBg:     '#FBF2DE',
  warningBorder: '#E8CC7A',
  successBg: '#EAF3EC',
  bucket1:   '#74C69D',
  dangerText: '#A32D2D',
  dangerTextStrong: '#791F1F',
  dangerBg:   '#FBEEE9',
  dangerBorder: '#E0BBA9',
  successText: '#27500A',
  warningTextStrong: '#854F0B',
  tealBg: '#E8F0EE',
  warningFill: '#96700B',
  successFill: '#2F6A48',
  refundTag: '#E11D48',
  mintOnDark: '#9FD9BC',
  emailMuted: '#7A6E62',
  emailAccentGreen: '#40916C',
  emailAccentGold: '#D4A017',
  // Secondary accent, deliberately not gold — reserves gold for its actual
  // warning/pending meaning instead of using it as the default accent
  // everywhere, which reads as flat/generic when overused.
  slate: '#3B5A6B',
  slateBg: '#E9F0F3',
  // Shared shadow so cards/tables get consistent depth instead of a flat
  // 1px border everywhere. Radius is intentionally NOT here — it's a
  // number, not a color, and this palette is consumed elsewhere as
  // Record<string, string> (e.g. a theme color list).
  shadow: '0 1px 2px rgba(15,42,31,0.04), 0 8px 20px rgba(15,42,31,0.06)',
  fontVoice: "'Fraunces', serif",
  fontMono:  "'IBM Plex Mono', monospace",
}
