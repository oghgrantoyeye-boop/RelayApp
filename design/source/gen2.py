import os
ROOT = '/home/claude/relay2/project'
os.makedirs(ROOT, exist_ok=True)

INK = '#18181b'; MUTED = '#5f5f6b'; LINE = '#e6e6ea'; SOFT = '#f6f6f7'; BLUE = '#1d4ed8'

HELMET = '''<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
body{margin:0;font-family:Geist,system-ui,sans-serif;font-size:13px;line-height:1.45;color:#18181b;background:#fff;-webkit-font-smoothing:antialiased;font-feature-settings:"tnum" 1}
a{color:#18181b;text-decoration:none}a:hover{color:#1d4ed8}
.nv a{display:flex;align-items:center;gap:9px;height:30px;padding:0 8px;border-radius:6px;color:#3f3f46}
.nv a:hover{background:#ececef}
.b{font:inherit;font-size:13px;height:30px;padding:0 10px;border-radius:7px;border:1px solid #e6e6ea;background:#fff;color:#18181b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 1px 0 rgba(24,24,27,.04)}
.bp{background:#18181b;color:#fff;border-color:#18181b}
table{border-collapse:collapse;width:100%}
th{font-weight:500;font-size:12px;color:#5f5f6b;text-align:left;padding:8px 12px;border-bottom:1px solid #e6e6ea;white-space:nowrap;background:#fafafa}
td{padding:9px 12px;border-bottom:1px solid #efeff2;vertical-align:middle}
tr:hover td{background:#fafafb}
.av{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#eef0f5;color:#3f3f46;font-size:10px;font-weight:600;flex:none;border:1px solid #fff}
.mono{font-family:"Geist Mono",ui-monospace,monospace;font-size:12px}
.kbd{font-family:"Geist Mono",monospace;font-size:11px;border:1px solid #e6e6ea;border-radius:4px;padding:0 4px;color:#5f5f6b;background:#fff}
:focus-visible{outline:2px solid #1d4ed8;outline-offset:2px}
</style>
</helmet>'''

TONE = {  # bg, border, text, dot
 'green': ('#f0fdf4', '#bbf7d0', '#166534', '#16a34a'),
 'amber': ('#fffbeb', '#fde68a', '#92400e', '#d97706'),
 'red':   ('#fef2f2', '#fecaca', '#991b1b', '#dc2626'),
 'blue':  ('#eff6ff', '#bfdbfe', '#1e40af', '#2563eb'),
 'gray':  ('#f4f4f5', '#e4e4e7', '#3f3f46', '#a1a1aa'),
 'violet':('#f5f3ff', '#ddd6fe', '#5b21b6', '#7c3aed'),
}
def pill(text, tone='gray', dot=True):
    bg, bd, fg, dt = TONE[tone]
    d = f'<span style="width:6px;height:6px;border-radius:50%;background:{dt};flex:none"></span>' if dot else ''
    return f'<span style="display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px;border-radius:999px;background:{bg};border:1px solid {bd};color:{fg};font-size:12px;font-weight:500;white-space:nowrap">{d}{text}</span>'
def tag(text, color):
    return f'<span style="display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 7px;border-radius:6px;border:1px solid {LINE};font-size:12px;color:#3f3f46;white-space:nowrap;background:#fff"><span style="width:8px;height:8px;border-radius:2px;background:{color}"></span>{text}</span>'

P = {
 'home':'<path d="M4 11l8-7 8 7v9H4z"/>', 'inbox':'<path d="M4 13l2-8h12l2 8v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>',
 'queue':'<path d="M4 6h16M4 12h16M4 18h10"/>', 'doc':'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
 'units':'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 'iface':'<path d="M7 7h10l-3-3M17 17H7l3 3"/>', 'agent':'<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/>',
 'log':'<path d="M5 4h14v16H5zM9 8h6M9 12h6M9 16h4"/>', 'search':'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>',
 'spark':'<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>', 'chev':'<path d="M8 10l4 4 4-4"/>', 'plus':'<path d="M12 5v14M5 12h14"/>',
 'filter':'<path d="M4 6h16M7 12h10M10 18h4"/>', 'check':'<path d="M5 12l5 5 9-10"/>', 'lock':'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 'clock':'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', 'plug':'<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
 'bell':'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20h4"/>', 'user':'<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
}
def ic(n, s=15, c='currentColor'):
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[n]}</svg>'

def sidebar(org, initial, items, units, current, user, role):
    cur = ' aria-current="page" style="background:#e9e9ed;color:#18181b;font-weight:500"'
    links = ''
    for label, icon, href, badge in items:
        b = f'<span style="margin-left:auto;font-size:11px;color:{MUTED}" class="mono">{badge}</span>' if badge else ''
        links += f'<a href="{href}"{cur if label == current else ""}>{ic(icon)}{label}{b}</a>'
    u = ''.join(f'<a href="#"{cur if n == current else ""}><span style="width:8px;height:8px;border-radius:2px;background:{c};flex:none;margin:0 3px"></span>{n}</a>' for n, c in units)
    ini = ''.join(w[0] for w in user.split()[:2])
    return f'''<nav class="nv" aria-label="Main" style="flex:0 0 240px;box-sizing:border-box;background:{SOFT};border-right:1px solid {LINE};padding:10px;display:flex;flex-direction:column;gap:1px">
<button class="b" style="justify-content:flex-start;height:38px;border-color:transparent;background:transparent;box-shadow:none;padding:0 6px;gap:9px;margin-bottom:6px">
<span style="width:22px;height:22px;border-radius:6px;background:#18181b;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:11px">{initial}</span>
<span style="font-weight:600">{org}</span><span style="margin-left:auto;color:{MUTED}">{ic('chev',14)}</span></button>
<label style="display:flex;align-items:center;gap:8px;height:30px;padding:0 8px;border:1px solid {LINE};border-radius:7px;background:#fff;color:{MUTED};margin-bottom:10px">{ic('search',14)}<input aria-label="Search" placeholder="Search" style="border:0;outline:0;font:inherit;flex:1;min-width:0;background:transparent;color:{INK}"><span class="kbd">⌘K</span></label>
{links}
<div style="font-size:12px;color:{MUTED};padding:14px 8px 4px">Your units</div>
{u}
<div style="margin-top:auto;display:flex;align-items:center;gap:9px;padding:10px 6px 4px;border-top:1px solid {LINE}">
<span class="av" style="width:26px;height:26px">{ini}</span><div style="display:flex;flex-direction:column;line-height:1.3"><span style="font-weight:500">{user}</span><span style="font-size:12px;color:{MUTED}">{role}</span></div>
</div>
</nav>'''

def topbar(crumbs, right):
    c = f'<span aria-hidden="true" style="color:#c4c4cc">/</span>'.join(
        f'<a href="#" style="color:{MUTED}">{x}</a>' if i < len(crumbs) - 1 else f'<span style="font-weight:500">{x}</span>' for i, x in enumerate(crumbs))
    return f'''<header style="min-height:48px;box-sizing:border-box;border-bottom:1px solid {LINE};display:flex;align-items:center;gap:10px;padding:8px 20px;flex-wrap:wrap">
<nav aria-label="Breadcrumb" style="display:flex;gap:8px;align-items:center">{c}</nav>
<div style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap">{right}</div>
</header>'''

def metric(label, value, note, tone=None):
    col = TONE[tone][2] if tone else MUTED
    return f'''<div style="padding:14px 16px;border-right:1px solid {LINE};min-width:0">
<div style="font-size:12px;color:{MUTED}">{label}</div>
<div style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-top:2px">{value}</div>
<div style="font-size:12px;color:{col};margin-top:2px">{note}</div></div>'''

def ai_card(title, body, sources, actions=''):
    s = ''.join(tag(n, c) for n, c in sources)
    a = f'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">{actions}</div>' if actions else ''
    return f'''<section aria-label="{title}" style="border:1px solid {LINE};border-radius:10px;padding:14px 16px;background:linear-gradient(#fff,#fff) padding-box">
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="display:inline-flex;align-items:center;gap:6px;font-weight:600;color:{BLUE}">{ic('spark',14)}{title}</span>
<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;color:{MUTED}">Sources</span>{s}</span></div>
<div style="margin-top:8px;font-size:13.5px;line-height:1.55;max-width:760px">{body}</div>{a}
</section>'''

def dept_track(steps):
    # steps: list of (name, tone)
    out = ''
    for name, tone in steps:
        out += f'<span title="{name}" style="width:18px;height:6px;border-radius:3px;background:{TONE[tone][3]}"></span>'
    return f'<span style="display:inline-flex;gap:3px;align-items:center" role="img" aria-label="{", ".join(n for n, _ in steps)}">{out}</span>'

def frame(title, nav, body, h, logic=None, props=''):
    logic = logic or 'class Component extends DCLogic {\nrenderVals() { return {}; }\n}'
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
{HELMET}
<div style="display:flex;flex-wrap:wrap;min-height:{h}px;background:#fff">
{nav}
<main style="flex:999 1 560px;min-width:0;display:flex;flex-direction:column">
{body}
</main>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":{h}}}}}'>
{logic}
</script>
</body>
</html>
'''

def role_logic(keys):
    l = 'class Component extends DCLogic {\n'
    l += f"constructor(props) {{ super(props); this.state = {{ role: '{keys[0]}' }}; }}\n"
    l += "renderVals() {\nconst r = this.state.role;\nconst on = '#ffffff', onF = '#18181b', off = 'transparent', offF = '#5f5f6b', onS = '0 1px 2px rgba(24,24,27,.08)', offS = 'none';\nreturn {\n"
    for k in keys:
        l += f"is_{k}: r === '{k}', bg_{k}: r === '{k}' ? on : off, fg_{k}: r === '{k}' ? onF : offF, sh_{k}: r === '{k}' ? onS : offS, set_{k}: () => this.setState({{ role: '{k}' }}),\n"
    l += '};\n}\n}'
    return l

def role_switch(roles):
    btn = ''.join(f'<button onClick="{{{{ set_{k} }}}}" aria-pressed="{{{{ is_{k} }}}}" style="font:inherit;font-size:12.5px;height:26px;padding:0 10px;border-radius:6px;border:0;cursor:pointer;background:{{{{bg_{k}}}}};color:{{{{fg_{k}}}}};box-shadow:{{{{sh_{k}}}}}">{lab}</button>' for k, lab in roles)
    return f'<span id="pv" style="font-size:12px;color:{MUTED}">Viewing as</span><div role="group" aria-labelledby="pv" style="display:flex;gap:2px;padding:2px;border-radius:8px;background:#efeff2;flex-wrap:wrap">{btn}</div>'

def write(name, html):
    open(os.path.join(ROOT, name), 'w').write(html)
    print(name, len(html))
