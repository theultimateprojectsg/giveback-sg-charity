const fs = require('fs');
const path = 'src/App.jsx';
const raw = fs.readFileSync(path, 'utf8');
const lines = raw.split('\n');

function assertLine(idx1, expectedSubstr, label) {
  const line = lines[idx1 - 1];
  if (!line.includes(expectedSubstr)) throw new Error('Mismatch at ' + label + ' line ' + idx1 + ': ' + JSON.stringify(line));
}

assertLine(8867, '</div>', 'pledge-twoCol-close');
assertLine(8869, 's.twoCol', 'grants-twoCol-open');
assertLine(9034, '</div>', 'grants-twoCol-close');
assertLine(9036, 's.twoCol', 'recurring-twoCol-open');
assertLine(9200, '</div>', 'recurring-twoCol-close');
assertLine(9202, '</div>', 'pledge-section-close');
assertLine(9207, '>03<', 'donor-behavior-number');

const grantsBlock = lines.slice(8868, 9034);       // lines 8869..9034
const recurringBlock = lines.slice(9035, 9200);    // lines 9036..9200

const recurringSnapshot = [
'              {(() => {',
"                const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)",
'                const statsForYear = (y) => {',
"                  const ds = donations.filter(d => d.recurring_gift_id && d.payment_status === 'confirmed' && new Date(d.created_at).getFullYear() === y)",
'                  const total = ds.reduce((s, d) => s + d.amount, 0)',
'                  const donorKeys = new Set(ds.map(d => d.donor_email?.trim() || d.donor_nric || d.donor_name))',
'                  const newGifts = recurringGifts.filter(g => new Date(g.created_at).getFullYear() === y).length',
'                  return { total, count: ds.length, donors: donorKeys.size, newGifts }',
'                }',
'                const cur = statsForYear(yr)',
'                const prev = statsForYear(yr - 1)',
'                const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)',
'                const tiles = [',
"                  { label: 'Total Raised (Recurring)', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total confirmed donations collected through recurring gifts in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'New Recurring Gifts', val: cur.newGifts, d: delta(cur.newGifts, prev.newGifts), tip: `Number of new recurring gifts (GIRO or habitual PayNow) started in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'Recurring Donors', val: cur.donors, d: delta(cur.donors, prev.donors), tip: `Distinct donors who made at least one recurring donation in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'Recurring Donations', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of individual confirmed recurring donation charges collected in ${yr}, compared to ${yr - 1}.` },",
'                ]',
'                return (',
"                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>",
'                    {tiles.map((t, i) => (',
"                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? '100%' : 0 }}>",
"                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>",
'                        <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>',
'                        {t.d === null ? (',
'                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>',
'                        ) : (',
'                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>',
"                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}",
'                          </div>',
'                        )}',
'                      </div>',
'                    ))}',
'                  </div>',
'                )',
'              })()}',
'',
];

const grantsSnapshot = [
'              {(() => {',
"                const yr = filterYear === 'All' ? new Date().getFullYear() : parseInt(filterYear)",
'                const grantYearOf = (g) => new Date(g.start_date || g.created_at).getFullYear()',
'                const statsForYear = (y) => {',
'                  const gs = grants.filter(g => grantYearOf(g) === y)',
'                  const total = gs.reduce((s, g) => s + Number(g.amount), 0)',
'                  return { total, count: gs.length, avg: gs.length > 0 ? total / gs.length : 0 }',
'                }',
'                const cur = statsForYear(yr)',
'                const prev = statsForYear(yr - 1)',
'                const delta = (c, p) => p === 0 ? (c > 0 ? null : 0) : Math.round(((c - p) / p) * 100)',
"                const activeGrantsCount = grants.filter(g => g.status === 'active').length",
'                const tiles = [',
"                  { label: 'Grants Awarded', val: cur.count, d: delta(cur.count, prev.count), tip: `Number of grants with a start date in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'Total Secured', val: `$${cur.total.toLocaleString()}`, d: delta(cur.total, prev.total), tip: `Total value of grants awarded in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'Avg Grant Size', val: `$${cur.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, d: delta(cur.avg, prev.avg), tip: `Average grant amount awarded in ${yr}, compared to ${yr - 1}.` },",
"                  { label: 'Active Grants', val: activeGrantsCount, tip: `Grants currently marked active, as of today. Not scoped to ${yr} — this reflects your live grant portfolio right now.` },",
'                ]',
'                return (',
"                  <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>",
'                    {tiles.map((t, i) => (',
"                      <div key={i} style={{ ...s.card, flex: 1, minWidth: isMobile ? '100%' : 0 }}>",
"                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>{t.label} <InfoTip text={t.tip} /></div>",
'                        <div style={{ fontFamily: C.fontVoice, fontSize: 22, fontWeight: 500, color: C.forest, lineHeight: 1, marginBottom: 6 }}>{t.val}</div>',
'                        {t.d === undefined ? (',
'                          <div style={{ fontSize: 11, color: C.muted }}>currently active</div>',
'                        ) : t.d === null ? (',
'                          <div style={{ fontSize: 11, color: C.muted }}>new in {yr}</div>',
'                        ) : (',
'                          <div style={{ fontSize: 11, fontWeight: 500, color: t.d > 0 ? C.sage : t.d < 0 ? C.red : C.muted }}>',
"                            {t.d > 0 ? '▲' : t.d < 0 ? '▼' : '–'} {Math.abs(t.d)}% vs {yr - 1}",
'                          </div>',
'                        )}',
'                      </div>',
'                    ))}',
'                  </div>',
'                )',
'              })()}',
'',
];

function sectionHeader(num, title) {
  return [
    "            <div style={{ position: 'relative', paddingLeft: 24, marginBottom: 40 }}>",
    "              <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: C.borderStrong }} />",
    "              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>",
    '                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.muted }}>' + num + '</span>',
    "                <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: C.forest, fontWeight: 500 }}>" + title + '</span>',
    '              </div>',
    '',
  ];
}

const newRecurringSection = [
  ...sectionHeader('06', 'Recurring Donations Performance'),
  ...recurringSnapshot,
  ...recurringBlock,
  '            </div>',
  '',
];

const newGrantsSection = [
  ...sectionHeader('07', 'Grants Overview'),
  ...grantsSnapshot,
  ...grantsBlock,
  '            </div>',
  '',
];

const head = lines.slice(0, 8868); // lines 1..8868 (includes blank line 8868)
const pledgeClose = [lines[9201]]; // old line 9202 (0-indexed 9201)
let tail = lines.slice(9203); // old line 9204 onward (0-indexed 9203)

const targetIdx = tail.findIndex(l => l.includes('>03<') && l.includes('fontMono'));
if (targetIdx === -1) throw new Error('Could not find Donor Behavior 03 label in tail');
tail[targetIdx] = tail[targetIdx].replace('>03<', '>08<');

const result = [...head, ...pledgeClose, '', ...newRecurringSection, ...newGrantsSection, ...tail].join('\n');
fs.writeFileSync(path, result, 'utf8');
console.log('Done. New total lines:', result.split('\n').length, '(was', lines.length, ')');
