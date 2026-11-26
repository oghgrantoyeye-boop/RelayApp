from gen2 import *
from screens2 import city_nav
import sys

FIRE = '#c2410c'; BLD = '#1d4ed8'; MGR = '#6d28d9'; APP = '#0f766e'; INS = '#4d7c0f'; PUB = '#64748b'
LEVEL = {'Full detail': 'blue', 'Summary': 'amber', 'Status only': 'green', 'Headline': 'violet', 'Not shared': 'gray'}

def irow(to, col, what, level, preview, trigger, sent):
    return f'''<tr>
<td style="white-space:nowrap">{tag(to, col)}</td>
<td>{what}</td>
<td style="white-space:nowrap">{pill(level, LEVEL[level], dot=False)}</td>
<td style="color:#3f3f46;font-size:12.5px;max-width:300px"><span style="display:block;border-left:2px solid {LINE};padding-left:8px">{preview}</span></td>
<td style="white-space:nowrap;color:{MUTED}">{trigger}</td>
<td style="white-space:nowrap;color:{MUTED}" class="mono">{sent}</td>
</tr>'''

irows = ''.join([
 irow('Applicant', APP, 'Corrections to pass fire review', 'Summary', 'Show a second exit stairway for floors 3 and 4 on your plans.', 'Review complete', '42 today'),
 irow('Building plan review', BLD, 'Items that overlap building code', 'Full detail', 'Sprinkler system NFPA 13R; egress width per comment 4.', 'On change', '17 today'),
 irow('Permit center', MGR, 'Status and days in queue', 'Status only', 'In review, day 6 of 10.', 'On change, daily digest', '186 open'),
 irow('Inspections', INS, 'Fire conditions to verify on site', 'Full detail', 'Verify alarm panel location at rough-in.', 'On approval', '9 this week'),
 irow('Public portal', PUB, 'Fire review status', 'Headline', 'Fire review: changes requested.', 'On change', '–'),
])

def member(name, role, kind, extra=''):
    badge = pill('Agent', 'violet', dot=False) if kind == 'agent' else ''
    ini = 'AI' if kind == 'agent' else ''.join(w[0] for w in name.split()[:2])
    avs = 'background:#f5f3ff;color:#5b21b6' if kind == 'agent' else ''
    return f'''<li style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #efeff2">
<span class="av" style="width:28px;height:28px;{avs}">{ini}</span>
<div style="min-width:0;flex:1"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-weight:500">{name}</span>{badge}</div>
<div style="font-size:12px;color:{MUTED}">{role}</div>{extra}</div></li>'''

agent_extra = f'''<dl style="margin:8px 0 0;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px">
<dt style="color:{MUTED}">Manager</dt><dd style="margin:0">Leo Grant</dd>
<dt style="color:{MUTED}">Sees</dt><dd style="margin:0">Fire prevention, full detail</dd>
<dt style="color:{MUTED}">Runs</dt><dd style="margin:0">On every new submission</dd>
<dt style="color:{MUTED}">Needs approval to</dt><dd style="margin:0">Send anything to applicants</dd>
<dt style="color:{MUTED}">Budget</dt><dd style="margin:0">$84 of $150 this month</dd></dl>'''

members = ''.join([
 member('Leo Grant', 'Deputy fire marshal · unit admin', 'person'),
 member('Marcus Hill', 'Fire plans examiner', 'person'),
 member('Rosa Kim', 'Fire plans examiner', 'person'),
 member('Plan pre-check agent', 'Checks exits, sprinklers and hydrant distance before review', 'agent', agent_extra),
])

def conn(name, kind, status, tone, note):
    return f'<li style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid #efeff2"><span style="width:28px;height:28px;border-radius:7px;border:1px solid {LINE};display:inline-flex;align-items:center;justify-content:center;color:{MUTED}">{ic("plug",14)}</span><div style="flex:1;min-width:0"><div style="font-weight:500">{name}</div><div style="font-size:12px;color:{MUTED}">{kind} · {note}</div></div>{pill(status, tone)}</li>'
conns = conn('Permit system', 'Applications', 'Synced', 'green', '2 min ago') + conn('Fire code library', 'Code + amendments', 'Synced', 'green', 'Updated Jan 1') + conn('Hydrant map', 'City GIS', 'Synced', 'green', 'Nightly')

tabs = ''.join(f'<a href="#" role="tab" aria-selected="{"true" if t == "Interfaces" else "false"}" style="padding:0 2px 10px;border-bottom:2px solid {"#18181b" if t == "Interfaces" else "transparent"};color:{"#18181b" if t == "Interfaces" else MUTED};font-weight:{"500" if t == "Interfaces" else "400"}">{t}</a>' for t in ['Overview', 'Interfaces', 'Members', 'Connectors', 'Activity'])

unit_body = f'''{topbar(['Units', 'Fire prevention'], f'<button class="b">Preview as another unit</button><button class="b bp">{ic("plus",14)}New interface</button>')}
<div style="padding:22px 28px 40px;box-sizing:border-box;max-width:1180px;width:100%">
<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
<span style="width:28px;height:28px;border-radius:7px;background:{FIRE};display:inline-block"></span>
<div><h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em">Fire prevention</h1>
<p style="margin:2px 0 0;color:{MUTED}">Reviews fire and life safety on every application. Raw review notes stay in this unit.</p></div>
<span style="margin-left:auto">{pill('3 people, 1 agent', 'gray', dot=False)}</span>
</div>
<div role="tablist" aria-label="Unit sections" style="display:flex;gap:20px;border-bottom:1px solid {LINE};margin:18px 0 18px;flex-wrap:wrap">{tabs}</div>
<div style="display:flex;gap:24px;flex-wrap:wrap">
<div style="flex:999 1 560px;min-width:0">
<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h2 style="font-size:14px;font-weight:600;margin:0">What this unit shares</h2><span style="font-size:12px;color:{MUTED}">Relay writes each update at the agreed level and delivers it in Teams or email.</span></div>
<div style="border:1px solid {LINE};border-radius:10px;overflow-x:auto">
<table><thead><tr><th>With</th><th>What</th><th>Level</th><th>Example of what they receive</th><th>When</th><th>Sent</th></tr></thead><tbody>{irows}</tbody></table>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:20px">
<section style="border:1px solid {LINE};border-radius:10px;padding:14px 16px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 4px">Request from Zoning</h2>
<p style="margin:0 0 12px;color:{MUTED}">Ellen Park asks for hydrant distance on corner lots, at full detail.</p>
<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="b bp">Approve</button><button class="b">Approve as summary</button><button class="b">Decline</button></div>
</section>
{ai_card('Suggested interface', 'Building plan review asks about sprinkler requirements on <strong>40% of mid-rise applications</strong>. Send them the sprinkler determination at full detail as soon as you make it?', [('Message history', BLD)], '<button class="b bp">Create interface</button><button class="b">Dismiss</button>')}
</div>
</div>
<aside style="flex:1 1 280px;min-width:0;max-width:340px;display:flex;flex-direction:column;gap:20px">
<section><h2 style="font-size:14px;font-weight:600;margin:0 0 2px">Members</h2><ul style="list-style:none;margin:0;padding:0">{members}</ul></section>
<section><h2 style="font-size:14px;font-weight:600;margin:0 0 2px">Connectors</h2><ul style="list-style:none;margin:0;padding:0">{conns}</ul></section>
</aside>
</div>
</div>'''

if 'unit' in sys.argv:
    write('P2-Unit.dc.html', frame('Fire prevention unit', city_nav('Fire prevention', 'Leo Grant', 'Deputy fire marshal'), unit_body, 900))

# ---------------- Athlete ----------------
SM = '#c2410c'; SS = '#0e7490'; AC = '#a16207'; CO = '#4d7c0f'; GM = '#6d28d9'
SP_UNITS = [('Sports medicine', SM), ('Sports science', SS), ('Football coaching', '#1d4ed8'), ('General manager', GM), ('Academics', AC), ('Compliance and NIL', CO)]
def sports_nav():
    items = [('Inbox', 'inbox', '#', '5'), ('Athletes', 'user', 'P2-Athlete.dc.html', '112'), ('Units', 'units', '#', ''), ('Interfaces', 'iface', '#', ''), ('Agents', 'agent', '#', '2'), ('Audit log', 'log', '#', '')]
    return sidebar('Mesa State Athletics', 'M', items, SP_UNITS, 'Athletes', 'Jordan Ruiz', 'General manager')

spark = '<svg width="120" height="32" viewBox="0 0 120 32" role="img" aria-label="Workload over 14 days, spike on Oct 2 then dropping" style="display:block;margin-top:6px"><polyline fill="none" stroke="#0e7490" stroke-width="2" points="0,22 9,20 18,21 27,19 36,18 45,20 54,17 63,8 72,4 81,14 90,20 99,24 108,25 117,26"/></svg>'

AR = [('coach', 'Head coach'), ('trainer', 'Athletic trainer'), ('gm', 'General manager')]
AV = {
 'coach': dict(m=[('Availability', pill('Limited through Sat', 'amber'), 'Sports medicine'), ('Workload, 7 days', '−18%', 'Sports science'), ('Eligibility', pill('Eligible', 'green'), 'Academics'), ('NIL and contract', '<span style="color:#5f5f6b">Not shared</span>', 'Compliance and NIL')],
               s='Cole can practice in a limited role through Saturday. His workload spiked on Oct 2 and has dropped 18% since. Plan for reduced reps this week.',
               rows=[('Availability', 'Limited through Saturday', SM), ('Treatment plan', None, SM), ('Workload', 'Trending down 18% this week', SS), ('Academic eligibility', 'Eligible', AC), ('NIL and revenue share', None, CO)]),
 'trainer': dict(m=[('Availability', pill('Limited through Sat', 'amber'), 'Sports medicine'), ('High-speed running', '2.1× avg', 'Sports science'), ('Return-to-run test', 'Oct 9', 'Sports medicine'), ('NIL and contract', '<span style="color:#5f5f6b">Not shared</span>', 'Compliance and NIL')],
               s='Grade 1 left hamstring strain, reported Oct 3. High-speed running on Oct 2 was 2.1 times his four-week average. Daily rehab with Andre Moss; return-to-run test on Oct 9.',
               rows=[('Availability', 'Limited through Saturday. Grade 1 left hamstring strain', SM), ('Treatment plan', 'Daily rehab with Andre Moss; return-to-run test Oct 9', SM), ('Workload', 'High-speed running 410 m on Oct 2, 2.1× average', SS), ('Academic eligibility', None, AC), ('NIL and revenue share', None, CO)]),
 'gm': dict(m=[('Availability', pill('Out ~2 weeks', 'amber'), 'Sports medicine'), ('Expected back', 'Oct 18', 'Sports medicine'), ('Eligibility', pill('Eligible', 'green'), 'Academics'), ('Revenue share', '$85,000', 'Compliance and NIL')],
               s='Cole is expected to miss about two weeks and return for the Oct 18 game. He is eligible, has two NIL deals cleared and one pending NIL Go review.',
               rows=[('Availability', 'Out about 2 weeks, back for Oct 18', SM), ('Treatment plan', None, SM), ('Workload', None, SS), ('Academic eligibility', 'Eligible, on track; 2 years left', AC), ('NIL and revenue share', '$85,000 revenue share; 2 deals cleared, 1 pending', CO)]),
}
ab = ''
for k, lab in AR:
    v = AV[k]
    ms = ''.join(f'<div style="padding:12px 14px;border-right:1px solid {LINE};min-width:0"><div style="font-size:12px;color:{MUTED}">{a}</div><div style="font-size:17px;font-weight:600;margin-top:4px">{b}</div><div style="font-size:11.5px;color:{MUTED};margin-top:4px">{c}</div></div>' for a, b, c in v['m'])
    OWN = {SM: 'Sports medicine', SS: 'Sports science', AC: 'Academics', CO: 'Compliance and NIL'}
    LOCKED = '<span style="color:' + MUTED + ';display:inline-flex;gap:6px;align-items:center">' + ic('lock', 13) + 'Not shared with your unit</span>'
    rows = ''.join('<tr><td style="color:' + MUTED + ';width:170px">' + f + '</td><td>' + (val or LOCKED) + '</td><td style="white-space:nowrap">' + tag(OWN[c], c) + '</td></tr>' for f, val, c in v['rows'])
    extra = f'<div style="padding:12px 14px;min-width:0"><div style="font-size:12px;color:{MUTED}">Load, 14 days</div>{spark}</div>' if k != 'gm' else ''
    ab += f'''<sc-if value="{{{{ is_{k} }}}}" hint-placeholder-val="{{{{ {'true' if k == 'coach' else 'false'} }}}}">
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));border:1px solid {LINE};border-radius:10px;overflow:hidden;margin:18px 0 16px">{ms}{extra}</div>
{ai_card('Summary for ' + lab.lower(), v['s'], [('Sports medicine', SM), ('Sports science', SS), ('Academics', AC)])}
<h2 style="font-size:14px;font-weight:600;margin:20px 0 8px">Record, field by field</h2>
<div style="border:1px solid {LINE};border-radius:10px;overflow-x:auto"><table><thead><tr><th>Field</th><th>What you see</th><th>Owner</th></tr></thead><tbody>{rows}</tbody></table></div>
</sc-if>'''

ath_body = f'''{topbar(['Athletes', 'Football', 'Cole Brennan'], role_switch(AR) + '<button class="b">Follow</button>')}
<div style="padding:22px 28px 40px;box-sizing:border-box;max-width:1180px;width:100%">
<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
<span class="av" style="width:44px;height:44px;font-size:15px">CB</span>
<div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em">Cole Brennan</h1>{pill('Limited', 'amber')}</div>
<p style="margin:2px 0 0;color:{MUTED}">Wide receiver · #11 · Junior · Football</p></div>
</div>
{ab}
</div>'''

if 'athlete' in sys.argv:
    write('P2-Athlete.dc.html', frame('Athlete record, Cole Brennan', sports_nav(), ath_body, 800, role_logic([k for k, _ in AR])))
