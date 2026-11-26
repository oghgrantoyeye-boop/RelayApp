from gen2 import *

CITY_UNITS = [('Permit center', '#6d28d9'), ('Fire prevention', '#c2410c'), ('Building plan review', '#1d4ed8'), ('Zoning', '#a16207'), ('Utilities', '#0e7490')]
def city_nav(current, user, role, badge='12'):
    items = [('Inbox', 'inbox', '#', badge), ('Queue', 'queue', 'P2-Queue.dc.html', '186'), ('Applications', 'doc', 'P2-Application.dc.html', ''),
             ('Units', 'units', 'P2-Unit.dc.html', ''), ('Interfaces', 'iface', '#', ''), ('Agents', 'agent', '#', '3'), ('Audit log', 'log', '#', '')]
    return sidebar('Harborview Permits', 'H', items, CITY_UNITS, current, user, role)

G = TONE['green'][3]

# ---------------- 1. Queue ----------------
def q_row(id_, proj, addr, steps, waiting, wcol, days, target_tone, cycle, who):
    return f'''<tr>
<td class="mono" style="white-space:nowrap"><a href="P2-Application.dc.html" style="color:{BLUE}">{id_}</a></td>
<td><div style="font-weight:500">{proj}</div><div style="font-size:12px;color:{MUTED}">{addr}</div></td>
<td>{dept_track(steps)}</td>
<td style="white-space:nowrap">{tag(waiting, wcol) if waiting else f'<span style="color:{MUTED}">–</span>'}</td>
<td style="white-space:nowrap">{pill(days, target_tone)}</td>
<td class="mono" style="text-align:right">{cycle}</td>
<td><span class="av">{who}</span></td>
</tr>'''

rows = ''.join([
 q_row('BP-2027-0418', '12-unit apartment building', '1840 Alder St', [('Intake done','green'),('Zoning done','green'),('Building waiting','amber'),('Fire corrections','red'),('Utilities done','green')], 'Fire prevention', '#c2410c', '9 of 10 days', 'amber', '1', 'MH'),
 q_row('BP-2027-0369', 'Warehouse addition', '1200 Industrial Way', [('Intake done','green'),('Zoning done','green'),('Building corrections','red'),('Fire done','green'),('Utilities done','green')], 'Applicant', '#0f766e', '21 of 10 days', 'red', '3', 'RK'),
 q_row('BP-2027-0381', 'Restaurant fit-out', '88 Front St', [('Intake done','green'),('Zoning done','green'),('Building in review','blue'),('Fire in review','blue'),('Health waiting','amber')], 'Fire prevention', '#c2410c', '11 of 10 days', 'red', '1', 'MH'),
 q_row('BP-2027-0402', 'Tenant improvement, suite 300', '220 Harbor Ave', [('Intake done','green'),('Zoning done','green'),('Building in review','blue'),('Fire done','green'),('Utilities n/a','gray')], 'Building plan review', '#1d4ed8', '6 of 10 days', 'green', '2', 'JT'),
 q_row('BP-2027-0397', 'Single-family home', '77 Cedar Ln', [('Intake done','green'),('Zoning corrections','red'),('Building waiting','amber'),('Fire n/a','gray'),('Utilities done','green')], 'Applicant', '#0f766e', '14 of 30 days', 'green', '2', 'EP'),
 q_row('BP-2027-0390', '4-storey mixed use', '510 Quay St', [('Intake done','green'),('Zoning in review','blue'),('Building waiting','amber'),('Fire waiting','amber'),('Utilities waiting','amber')], 'Zoning', '#a16207', '3 of 10 days', 'green', '1', 'EP'),
 q_row('BP-2027-0375', 'Duplex', '302 Spruce Ave', [('Intake done','green'),('Zoning done','green'),('Building done','green'),('Fire n/a','gray'),('Utilities in review','blue')], 'Utilities', '#0e7490', '8 of 10 days', 'green', '1', 'SN'),
 q_row('BP-2027-0388', 'Detached garage', '19 Birch Pl', [('Intake done','green'),('Zoning done','green'),('Building done','green'),('Fire n/a','gray'),('Utilities n/a','gray')], '', '', 'Ready to issue', 'green', '1', 'DB'),
])

chips = ''.join(f'<button class="b" style="height:28px;border-radius:999px;{s}">{t}</button>' for t, s in [('All open <span class="mono" style="color:#5f5f6b">186</span>', 'background:#18181b;color:#fff;border-color:#18181b'), ('Blocked between units <span class="mono" style="color:#5f5f6b">14</span>', ''), ('Past target <span class="mono" style="color:#5f5f6b">9</span>', ''), ('Waiting on applicant <span class="mono" style="color:#5f5f6b">41</span>', ''), ('Ready to issue <span class="mono" style="color:#5f5f6b">7</span>', '')])

queue_body = f'''{topbar(['Permit center', 'Queue'], f'<button class="b">{ic("filter",14)}Filter</button><button class="b">Export</button><button class="b bp">{ic("plus",14)}New application</button>')}
<div style="padding:24px 28px 40px;box-sizing:border-box;max-width:1180px;width:100%">
<div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:16px">
<div><h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em">Good morning, Dana</h1><p style="margin:2px 0 0;color:{MUTED}">Thursday, January 15. Synced with the permit system 3 minutes ago.</p></div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));border:1px solid {LINE};border-radius:10px;overflow:hidden;margin-bottom:16px">
{metric('Open applications', '186', '12 more than last week')}
{metric('Median days to permit', '38', 'Target 30 days', 'amber')}
{metric('Review cycles per application', '1.9', 'Down from 2.8 last year', 'green')}
{metric('Blocked between units', '14', '6 waiting on Fire prevention', 'red')}
</div>
{ai_card('Since yesterday', 'Fire prevention is today’s bottleneck: <strong>6 applications</strong> are waiting on it and <strong>3 are past the 10-day target</strong>. Building plan review has paused 4 of those until Fire decides on sprinklers. Two applicants answered corrections overnight, so BP-2027-0397 and BP-2027-0369 are back in review.', [('Permit system', '#6d28d9'), ('Fire prevention', '#c2410c'), ('Building plan review', '#1d4ed8')], f'<button class="b">Show the 6 applications</button><button class="b">Message Fire prevention lead</button>')}
<div style="display:flex;gap:8px;flex-wrap:wrap;margin:20px 0 10px">{chips}</div>
<div style="border:1px solid {LINE};border-radius:10px;overflow-x:auto">
<table><thead><tr><th>Application</th><th>Project</th><th>Departments</th><th>Waiting on</th><th>Time in review</th><th style="text-align:right">Cycle</th><th>Lead</th></tr></thead><tbody>{rows}</tbody></table>
</div>
<p style="font-size:12px;color:{MUTED};margin:10px 2px 0">Bars show each department’s status: green done, blue in review, amber waiting on another unit, red corrections requested, grey not required.</p>
</div>'''

write('P2-Queue.dc.html', frame('Permit queue', city_nav('Queue', 'Dana Brooks', 'Permit center manager'), queue_body, 1040))
