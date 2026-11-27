from gen2 import *
from screens2 import city_nav

def step(name, status, tone, when):
    icon = ic('check', 13, '#fff') if tone == 'green' else ''
    dotbg = TONE[tone][3]
    return f'''<li style="flex:1 1 140px;min-width:0;display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-right:1px solid {LINE}">
<span style="width:20px;height:20px;border-radius:50%;background:{dotbg};display:inline-flex;align-items:center;justify-content:center;flex:none;margin-top:1px">{icon}</span>
<div style="min-width:0"><div style="font-weight:500">{name}</div><div style="font-size:12px;color:{TONE[tone][2]}">{status}</div><div style="font-size:12px;color:{MUTED}">{when}</div></div></li>'''

track = '<ol style="list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;border:1px solid #e6e6ea;border-radius:10px;overflow:hidden">' + ''.join([
 step('Intake', 'Complete', 'green', 'Jan 6'),
 step('Zoning', 'Approved', 'green', 'Jan 10, 4 days'),
 step('Fire prevention', 'Corrections requested', 'red', 'Day 6 of 10'),
 step('Building review', 'Waiting on Fire', 'amber', 'Day 8 of 10'),
 step('Utilities', 'Approved', 'green', 'Jan 12'),
 step('Issuance', 'Not started', 'gray', '–'),
]) + '</ol>'

def prop(k, v):
    return f'<div style="display:grid;grid-template-columns:120px 1fr;gap:8px;padding:7px 0"><dt style="color:{MUTED}">{k}</dt><dd style="margin:0;min-width:0">{v}</dd></div>'
LOCK = f'<span style="color:{MUTED};display:inline-flex;gap:6px;align-items:center">{ic("lock",13)}Internal</span>'

def act(who, unit, ucol, text, when):
    return f'''<li style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #efeff2"><span class="av">{who}</span>
<div style="flex:1;min-width:0"><div>{text}</div><div style="font-size:12px;color:{MUTED};margin-top:2px;display:flex;gap:6px;align-items:center"><span style="width:8px;height:8px;border-radius:2px;background:{ucol}"></span>{unit} · {when}</div></div></li>'''

FIRE = '#c2410c'; BLD = '#1d4ed8'; ZON = '#a16207'; MGR = '#6d28d9'; APP = '#0f766e'; INT = '#64748b'

ROLES = [('manager', 'Permit manager'), ('fire', 'Fire examiner'), ('applicant', 'Applicant')]
V = {
 'manager': dict(
   summary='Building review can’t finish until Fire prevention decides on sprinklers, and Fire has sent the applicant 2 corrections. If the applicant resubmits by Jan 19, both reviews can close in the same cycle and the permit stays inside the 30-day target.',
   needs=[(pill('Blocked', 'amber'), 'Building review is waiting on Fire’s sprinkler determination', 'Fire prevention · since Jan 14'),
          (pill('Due Jan 19', 'red'), 'Applicant to resubmit plans with 2 fire corrections', 'Applicant · requested Jan 15'),
          (pill('On track', 'green'), 'Zoning and Utilities approved', 'No action needed')],
   acts=act('MH', 'Fire prevention', FIRE, 'Fire review moved to corrections requested', 'Jan 15, 11:20 AM') + act('JT', 'Building plan review', BLD, 'Building review paused, waiting on Fire', 'Jan 14') + act('EP', 'Zoning', ZON, 'Zoning approved in 4 days', 'Jan 10'),
   props=prop('Applicant', 'Northline Homes (demo)') + prop('Lead', '<span style="display:inline-flex;gap:6px;align-items:center"><span class="av">DB</span>Dana Brooks</span>') + prop('Submitted', 'Jan 6') + prop('Time in review', pill('9 of 30 days', 'green')) + prop('Review cycle', '1 <span style="color:#5f5f6b">(city avg 2.8)</span>') + prop('Valuation', '$4.2M') + prop('Fees', pill('Paid', 'green')),
 ),
 'fire': dict(
   summary='Two items fail fire review: the exit count for floors 3 and 4, and the alarm panel location. Building review is waiting on your sprinkler determination, which affects their egress width check.',
   needs=[(pill('Your decision', 'blue'), 'Sprinkler determination: NFPA 13R proposed', 'Requested by Building review · Jan 14'),
          (pill('Correction 1', 'red'), 'Exits: second stairway required, fire code 1006.3.4', 'Sent to applicant as plain language'),
          (pill('Correction 2', 'red'), 'Alarm panel location, local amendment 907.6', 'Sent to applicant as plain language')],
   acts=act('MH', 'Fire prevention', FIRE, 'You issued 2 corrections with code citations', 'Jan 15, 11:20 AM') + act('JT', 'Building plan review', BLD, 'Asked for sprinkler determination; egress width depends on it', 'Jan 14') + act('AI', 'Plan pre-check agent', INT, 'Flagged exit count on floors 3–4 before review started', 'Jan 7'),
   props=prop('Assigned to', '<span style="display:inline-flex;gap:6px;align-items:center"><span class="av">MH</span>Marcus Hill</span>') + prop('Your target', pill('Day 6 of 10', 'amber')) + prop('Fire flow', '1,750 gal/min available') + prop('Hydrant', '48 m, within limit') + prop('Occupancy', 'R-2, 4 storeys') + prop('Code edition', 'Fire code 2024 + local amendments'),
 ),
 'applicant': dict(
   summary='Your plans need 2 changes before fire review can approve them. Zoning and utilities have already approved your application. Once you upload revised plans, the remaining reviews can finish in this same round.',
   needs=[(pill('To do', 'red'), 'Show a second exit stairway for floors 3 and 4 on the plans', 'Fire review · Jan 15'),
          (pill('To do', 'red'), 'Mark where the fire alarm panel will be installed', 'Fire review · Jan 15'),
          (pill('Approved', 'green'), 'Zoning and utilities approved', 'No action needed')],
   acts=act('CH', 'Fire review', FIRE, 'Asked for 2 changes to your plans', 'Jan 15') + act('CH', 'Zoning', ZON, 'Approved your application', 'Jan 10') + act('CH', 'Permit intake', APP, 'Received your complete application', 'Jan 6'),
   props=prop('Application', '<span class="mono">BP-2027-0418</span>') + prop('Submitted', 'Jan 6') + prop('Status', pill('Changes requested', 'amber')) + prop('Contact', 'Permit center, 604-555-0142') + prop('Internal notes', LOCK) + prop('Reviewer names', LOCK),
 ),
}

blocks = ''
for k, lab in ROLES:
    v = V[k]
    needs = ''.join(f'<li style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-bottom:1px solid #efeff2"><span style="flex:none;min-width:96px">{p}</span><div><div style="font-weight:500">{t}</div><div style="font-size:12px;color:{MUTED}">{s}</div></div></li>' for p, t, s in v['needs'])
    upload = f'<div style="margin-top:12px"><button class="b bp">{ic("plus",14)}Upload revised plans</button></div>' if k == 'applicant' else ''
    blocks += f'''<sc-if value="{{{{ is_{k} }}}}" hint-placeholder-val="{{{{ {'true' if k == 'manager' else 'false'} }}}}">
<div style="display:flex;gap:24px;flex-wrap:wrap;margin-top:20px">
<div style="flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:20px">
{ai_card('Summary for ' + lab.lower(), v['summary'], [('Fire prevention', FIRE), ('Building plan review', BLD), ('Permit system', MGR)])}
<section><h2 style="font-size:14px;font-weight:600;margin:0 0 8px">What needs to happen</h2>
<ul style="list-style:none;margin:0;padding:0;border:1px solid {LINE};border-radius:10px;overflow:hidden">{needs}</ul>{upload}</section>
<section><h2 style="font-size:14px;font-weight:600;margin:0 0 2px">Activity</h2><p style="margin:0 0 4px;font-size:12px;color:{MUTED}">Each event shown at the level the {lab.lower()} is allowed to see.</p>
<ul style="list-style:none;margin:0;padding:0">{v['acts']}</ul></section>
</div>
<aside aria-label="Details" style="flex:1 1 280px;min-width:0;max-width:340px;border-left:1px solid {LINE};padding-left:20px">
<h2 style="font-size:14px;font-weight:600;margin:0 0 4px">Details</h2>
<dl style="margin:0">{v['props']}</dl>
</aside>
</div>
</sc-if>'''

body = f'''{topbar(['Applications', 'BP-2027-0418'], role_switch(ROLES) + '<button class="b">Follow</button>')}
<div style="padding:22px 28px 40px;box-sizing:border-box;max-width:1180px;width:100%">
<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px">
<div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><h1 style="margin:0;font-size:20px;font-weight:600;letter-spacing:-0.01em">12-unit apartment building</h1>{pill('In review, cycle 1', 'blue')}</div>
<p style="margin:2px 0 0;color:{MUTED}">1840 Alder Street · New construction, 4 storeys · <span class="mono">BP-2027-0418</span></p></div>
</div>
{track}
{blocks}
</div>'''

write('P2-Application.dc.html', frame('Permit application BP-2027-0418', city_nav('Applications', 'Dana Brooks', 'Permit center manager'), body, 980, role_logic([k for k, _ in ROLES])))
