import { C } from '../theme'
import { s } from '../styles'
import { EmptyState } from '../components/ui/EmptyState'
import type { Donation, Grant } from '../types'

interface AuditLogEntry {
  created_at: string
  actor_email?: string
  actor_type?: string
  action?: string
  details?: Record<string, unknown>
}

interface ReportsPageProps {
  donations: Donation[]
  charityName: string
  charityIsIpc: boolean
  grants: Grant[]
  auditLog: AuditLogEntry[]
  filterYear: string
  setFilterYear: (year: string) => void
  fyOf: (date: string | number | Date) => number
  showToast: (msg: string, type?: string) => void
  exportAnalyticsPDF: () => void
  exportQuarterlyBoardReportPDF: () => void
  exportWeeklySnapshotPDF: () => void
  exportYearEndSummary: () => void
  exportAllDonorYearEndStatements: () => void
  exportDonorContactsCSV: () => void
  exportIRASExcel: () => void
  exportGrantsComplianceReport: () => void
  exportPermitRegister: () => void
  exportRestrictedFundStatement: () => void
}

export function ReportsPage({
  donations, charityName, charityIsIpc, grants, auditLog, filterYear, setFilterYear, fyOf, showToast,
  exportAnalyticsPDF, exportQuarterlyBoardReportPDF, exportWeeklySnapshotPDF, exportYearEndSummary,
  exportAllDonorYearEndStatements, exportDonorContactsCSV, exportIRASExcel, exportGrantsComplianceReport,
  exportPermitRegister, exportRestrictedFundStatement,
}: ReportsPageProps) {
  return (
    <div style={s.content}>
      <div style={s.pageHeader}>
        <div>
          <div style={s.pageTitle}>📋 Reports</div>
          <div style={s.pageSub}>Annual returns, board reports, and compliance exports</div>
        </div>
      </div>

      {/* COC Annual Return */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>🏛️ COC Annual Return</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Summary of donations by financial year for your Commissioner of Charities annual submission.
        </div>
        {(() => {
          const years = [...new Set(donations.map(d => fyOf(d.created_at)))].sort((a, b) => b - a)
          if (years.length === 0) return <EmptyState icon="📋" title="No donation data yet" description="Once you've recorded donations, this monthly report will summarize activity by fiscal year." />
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {years.map(year => {
                const yearDonations = donations.filter(d => fyOf(d.created_at) === year && d.payment_status === 'confirmed')
                const total = yearDonations.reduce((s, d) => s + d.amount, 0)
                const uniqueDonors = new Set(yearDonations.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name)).size
                return (
                  <div key={year} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.ivory, borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.forest }}>FY {year}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{yearDonations.length} donations · {uniqueDonors} unique donors</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.forest }}>SGD ${total.toLocaleString()}</div>
                      <button style={s.exportSmallBtn} onClick={() => {
                        const rows = yearDonations.map(d => [
                          new Date(d.created_at).toLocaleDateString('en-SG'),
                          d.donor_name,
                          d.donor_email || '',
                          d.amount,
                          d.payment_method || '',
                          d.receipt_number || d.payment_ref || '',
                          d.receipt_issued ? 'Yes' : 'No',
                        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                        const csv = ['Date,Donor Name,Email,Amount,Payment Method,Receipt No.,Receipt Issued', ...rows].join('\n')
                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${charityName}-COC-Annual-Return-${year}.csv`
                        a.click()
                        URL.revokeObjectURL(url)
                        showToast(`FY ${year} annual return exported ✓`)
                      }}>⬇️ Export CSV</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Board Report */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>📊 Board Report</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          A full analytics snapshot formatted for your board meeting — financial summary, donor insights, campaign performance, and health check.
        </div>
        <button style={s.btnForest} onClick={exportAnalyticsPDF}>📄 Download Board Packet PDF</button>
      </div>

      {/* One-Page Quarterly Summary */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>Quarterly Board Summary</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          A single page, paste-ready for a board deck: revenue by source and payment method, donor acquisition, retention rate, and year-on-year comparison for this quarter.
        </div>
        <button style={s.btnForest} onClick={exportQuarterlyBoardReportPDF}>📄 Download Quarterly Summary PDF</button>
      </div>

      {/* Weekly Snapshot */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>🗓️ Weekly Snapshot</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          A quick one-page pulse for the ED — this week's donations, lapsed donors, overdue pledges, and milestones. Review before forwarding.
        </div>
        <button style={s.btnForest} onClick={exportWeeklySnapshotPDF}>📄 Download Weekly Snapshot PDF</button>
      </div>

      {/* Org-Wide Year-End Summary */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>Organisation Year-End Summary</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          One report covering your whole organisation's year — totals, busiest month, and top supporters.
        </div>
        <button style={s.btnForest} onClick={exportYearEndSummary}>📄 Download Year-End Summary PDF</button>
      </div>

      {/* Per-Donor Year-End Statements */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>Donor Year-End Statements</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          A personal annual statement for every donor — every gift with date, amount, and receipt number. Generated as one PDF per donor, downloaded together as a zip.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="All">Select a year</option>
            {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button style={s.btnForest} onClick={exportAllDonorYearEndStatements}>📦 Download All Statements (ZIP)</button>
          <button style={s.exportSmallBtn} onClick={exportDonorContactsCSV}>⬇️ Export Donor Contacts CSV</button>
        </div>
      </div>

      {/* IRAS Export — IPC only */}
      {charityIsIpc && (
        <div style={{ ...s.card, marginBottom: 16 }}>
          <div style={s.cardTitle}>🏛️ IRAS Tax Deduction Export</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
            Excel export of donor NRIC and giving data for IRAS 250% tax deduction submission. Select a year before exporting.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
              <option value="All">Select Year</option>
              {[...new Set(donations.map(d => new Date(d.created_at).getFullYear()))].sort((a, b) => b - a).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button style={s.btnForest} onClick={() => { if (filterYear === 'All') { showToast('Select a year first'); return } exportIRASExcel() }}>⬇️ Export IRAS Excel</button>
          </div>
        </div>
      )}

      {/* Grants Compliance Report */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>💰 Grants Compliance Report</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Every active grant's report deadlines, disbursement tranches, and matching claims in one view — overdue items flagged in red. Review before a board meeting.
        </div>
        <button style={s.btnForest} onClick={exportGrantsComplianceReport}>📄 Download Grants Compliance PDF</button>
      </div>

      {/* Fundraising Permit Register */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>🪪 Fundraising Permit Register</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Permit status for every campaign — expired permits flagged in red. Evidence of compliance with the House to House and Street Collections Act.
        </div>
        <button style={s.btnForest} onClick={exportPermitRegister}>📄 Download Permit Register PDF</button>
      </div>

      {/* Restricted Fund Statement */}
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardTitle}>🔒 Statement of Restricted Funds</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Opening balance, receipts, expenditure, and closing balance for every restricted grant — the fund movement statement your annual accounts need. Select a year before exporting.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={s.filterSelect} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="All">Select a year</option>
            {[...new Set(grants.map(g => fyOf(g.start_date || g.created_at)))].sort((a, b) => b - a).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button style={s.btnForest} onClick={exportRestrictedFundStatement}>📄 Download Restricted Funds PDF</button>
        </div>
      </div>

      {/* Audit Trail */}
      <div style={s.card}>
        <div style={s.cardTitle}>🗒️ Audit Trail Export</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Full log of all system actions — receipts issued, voids, imports, and staff activity. For auditors and compliance review.
        </div>
        <button style={s.exportSmallBtn} onClick={() => {
          const rows = auditLog.map(entry => {
            const details = entry.details ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' | ') : ''
            return [
              new Date(entry.created_at).toLocaleString('en-SG'),
              entry.actor_email || '',
              entry.actor_type || '',
              entry.action || '',
              details,
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
          })
          const csv = ['Timestamp,Actor Email,Actor Type,Action,Details', ...rows].join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${charityName}-audit-trail-${new Date().toISOString().split('T')[0]}.csv`
          a.click()
          URL.revokeObjectURL(url)
          showToast('Audit trail exported ✓')
        }}>⬇️ Export Audit Trail CSV</button>
      </div>
    </div>
  )
}
