import random, math
random.seed(7)

# ---------- icon symbols (24x24, stroke) ----------
ICONS = {
 "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.8"/><path d="M17 14.2c2.8.3 4.7 2.4 4.7 5.3"/>',
 "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
 "check": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
 "shield": '<path d="M12 3l8 3v5.5c0 4.8-3.2 8.3-8 9.5-4.8-1.2-8-4.7-8-9.5V6z"/><path d="M8.7 12l2.5 2.5 4-5"/>',
 "lock": '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 "qr": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 14h2M14 19h2M18 18h3v3h-3z"/>',
 "award": '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 14l-1.5 7 5-3 5 3-1.5-7"/>',
 "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
 "chart": '<path d="M4 20V11M10 20V4M16 20v-6M22 20H2"/>',
 "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
 "spark": '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v4M17 18h4"/>',
 "clip": '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
 "chat": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
 "cal": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 "heart": '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
 "layout": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
 "db": '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
 "server": '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
 "window": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
 "cloud": '<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6-1A4.5 4.5 0 0 1 17 18z"/>',
 "building": '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
 "flag": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 "pen": '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
 "log": '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
 "image": '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
 "arrow": '<path d="M4 12h15M13 6l6 6-6 6"/>',
}
def ic(name, size="8mm", color="currentColor", sw=1.9, cls=""):
    return (f'<svg class="ic {cls}" viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')

import json, itertools
_uid=itertools.count()
def tandem_inner(fg="#fff"):
    cid=f"tl{next(_uid)}"
    return (f'<defs><clipPath id="{cid}"><circle cx="25" cy="32" r="14.5"/></clipPath></defs>'
            f'<circle cx="25" cy="32" r="14.5" fill="none" stroke="{fg}" stroke-width="4"/>'
            f'<circle cx="39" cy="32" r="14.5" fill="none" stroke="{fg}" stroke-width="4"/>'
            f'<circle cx="39" cy="32" r="14.5" fill="{fg}" clip-path="url(#{cid})"/>')
def mark(size, fg="#fff", tile="#4457df", bare=False):
    bg="" if bare else f'<rect width="64" height="64" rx="15" fill="{tile}"/>'
    return f'<svg viewBox="0 0 64 64" width="{size}" height="{size}">{bg}{tandem_inner(fg)}</svg>'

LOGOS=json.load(open("/home/claude/poster/icons.json"))
def brand(key,size="11mm"):
    d=LOGOS[key]
    return f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="{d["hex"]}"><path d="{d["path"]}"/></svg>'

# ---------- header constellation ----------
pts=[(random.uniform(0,420), random.uniform(0,88)) for _ in range(46)]
pts=[p for p in pts if not (p[0]>335 and p[1]<42)]   # keep area under logo clean
net=""
for i,p in enumerate(pts):
    for q in pts[i+1:]:
        d=math.dist(p,q)
        if d<48: net+=f'<line x1="{p[0]:.1f}" y1="{p[1]:.1f}" x2="{q[0]:.1f}" y2="{q[1]:.1f}" stroke="#4457df" stroke-opacity="{0.16*(1-d/48):.3f}" stroke-width=".5"/>'
for p in pts:
    net+=f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{random.choice([1,1.4,1.9])}" fill="#4457df" fill-opacity=".22"/>'
NET=f'<svg class="net" viewBox="0 0 420 88" width="420mm" height="88mm">{net}</svg>'

# ---------- problem illustration: chaos -> hub ----------
def problem_art():
    s='<svg viewBox="0 0 150 30" width="100%">'
    # spreadsheet
    s+='<rect x="1" y="2" width="38" height="26" rx="2.5" fill="#fff" stroke="#c53030" stroke-width=".8"/>'
    for i in range(1,5): s+=f'<line x1="1" y1="{2+i*5.2}" x2="39" y2="{2+i*5.2}" stroke="#f3b8b8" stroke-width=".5"/>'
    for i in range(1,4): s+=f'<line x1="{1+i*9.5}" y1="2" x2="{1+i*9.5}" y2="28" stroke="#f3b8b8" stroke-width=".5"/>'
    s+='<rect x="1" y="2" width="38" height="5.2" rx="2.5" fill="#fde8e8"/>'
    # chat bubble
    s+='<path d="M46 6h24v13H56l-5 5v-5h-5z" fill="#fff3e0" stroke="#b86200" stroke-width=".8" stroke-linejoin="round"/><path d="M50 10.5h16M50 14.5h10" stroke="#b86200" stroke-width=".8" stroke-linecap="round"/>'
    # tangle
    random.seed(3)
    for _ in range(9):
        x0,y0=75,random.uniform(4,26); 
        s+=f'<path d="M{x0} {y0:.1f} C {x0+12} {random.uniform(0,30):.1f}, {x0+22} {random.uniform(0,30):.1f}, {x0+32} {random.uniform(4,26):.1f}" fill="none" stroke="#c53030" stroke-opacity=".55" stroke-width=".7"/>'
    s+='<path d="M114 15h8" stroke="#111827" stroke-width="1.2" stroke-linecap="round"/><path d="M119.5 12l3 3-3 3" fill="none" stroke="#111827" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'
    s+='<text x="75" y="29.6" font-size="3.3" fill="#c53030" font-weight="700" letter-spacing=".2">TODAY: SCATTERED</text>'
    # tandem rings = the "after"
    s+=f'<g transform="translate(122 -1) scale(.5)">{tandem_inner("#4457df")}</g>'
    return s+'</svg>'

# ---------- roles diagram ----------
def roles_art():
    W,H=216,50
    s=f'<svg viewBox="0 0 {W} {H}" width="100%" height="{H}mm" preserveAspectRatio="xMidYMid meet" font-family="Inter">'
    nodes=[("System Admin","shield",0,2,"#4457df"),("NGO Admin","building",W-60,2,"#1f8a4c"),
           ("Project Coordinator","clip",0,H-24,"#b86200"),("Volunteer","heart",W-60,H-24,"#c53030")]
    cx,cy=W/2,H/2
    for n,i,x,y,c in nodes:
        ex=x+(60 if x==0 else 0); ey=y+11
        s+=f'<path d="M{cx} {cy} L{ex} {ey}" stroke="{c}" stroke-width="1.1" stroke-dasharray="2.4 2" stroke-linecap="round"/>'
    for n,i,x,y,c in nodes:
        s+=f'<rect x="{x}" y="{y}" width="60" height="22" rx="5" fill="#fff" stroke="{c}" stroke-width="1"/>'
        s+=f'<rect x="{x+3.5}" y="{y+3}" width="16" height="16" rx="4" fill="{c}" fill-opacity=".12"/>'
        s+=f'<g transform="translate({x+5.5} {y+5}) scale(.5)" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{ICONS[i]}</g>'
        lines=n.split(" ",1) if len(n)>14 else [n]
        if len(lines)==2:
            s+=f'<text x="{x+23}" y="{y+10}" font-size="5.1" font-weight="700" fill="#111827">{lines[0]}</text><text x="{x+23}" y="{y+16}" font-size="5.1" font-weight="700" fill="#111827">{lines[1]}</text>'
        else:
            s+=f'<text x="{x+23}" y="{y+14}" font-size="5.1" font-weight="700" fill="#111827">{n}</text>'
    s+=f'<circle cx="{cx}" cy="{cy}" r="15" fill="#4457df"/><circle cx="{cx}" cy="{cy}" r="19" fill="none" stroke="#4457df" stroke-opacity=".25" stroke-width="1"/>'
    s+=f'<g transform="translate({cx-8} {cy-11.5}) scale(.25)">{tandem_inner("#fff")}</g>'
    s+=f'<text x="{cx}" y="{cy+8.5}" text-anchor="middle" font-size="3.8" font-weight="700" fill="#fff">RBAC</text>'
    return s+'</svg>'

# ---------- journey ----------
J=[("Recruit","users","#4457df"),("Match","spark","#7c3aed"),("Assign","clip","#b86200"),("Communicate","chat","#0ea5e9"),("Participate","heart","#c53030"),("Track","chart","#1f8a4c"),("Evaluate","award","#4457df")]
def journey():
    h='<div class="journey">'
    for i,(n,k,c) in enumerate(J):
        h+=f'<div class="jstep"><div class="jcirc" style="background:{c}">{ic(k,"10mm","#fff",1.8)}</div><div class="jlab">{n}</div></div>'
        if i<len(J)-1: h+=f'<div class="jarr">{ic("arrow","9mm","#9ca3af",2)}</div>'
    return h+'</div>'

def li(items, color):
    return "".join(f'<li style="--c:{color}">{t}</li>' for t in items)

stat=lambda n,l,c,i: f'<div class="stat" style="--c:{c}"><div class="si">{ic(i,"9mm",c,2)}</div><div class="sn">{n}</div><div class="sl">{l}</div></div>'

ach=[("lock","Secure login","JWT access token (15 min) + httpOnly refresh cookie; roles enforced server-side","#4457df"),
     ("users","Portals on live data","Volunteer, NGO, coordinator and admin pages wired to the real API","#c53030"),
     ("building","Admin + password reset","Approve organisations, suspend users, reset passwords by email","#1f8a4c"),
     ("qr","Attendance backend","Rotating QR check-in/out, automatic hours, contributions and feedback","#b86200"),
     ("mail","Email + notifications","Brevo emails, in-app bell, 24 h reminders; live test email sent","#0ea5e9"),
     ("log","Audit log + tests","Every change logged; 87 automated tests; live on Vercel with Neon","#7c3aed")]
ach_html="".join(f'<div class="ach" style="--c:{c}"><div class="ai">{ic(i,"9mm",c,2)}</div><div><b>{t}</b><span>{d}</span></div></div>' for i,t,d,c in ach)

fut=[("qr","Sprint 3 front end","QR scan, attendance, feedback, notification bell","#4457df"),
     ("cloud","Staging + production","Tailscale Funnel staging, then Docker production","#0ea5e9"),
     ("award","Digital certificates","with a public verification code","#b86200"),
     ("shield","Hardening","rate limiting on login and password reset","#1f8a4c"),
     ("spark","AI matching engine","keyword vs semantic vs hybrid, explained to coordinators","#7c3aed"),
     ("search","Research NGO types","per supervisor feedback; evaluate AI accuracy","#c53030")]
fut_html="".join(f'<div class="fut" style="--c:{c}"><div class="ai">{ic(i,"9mm",c,2)}</div><div><b>{t}</b><span>{d}</span></div></div>' for i,t,d,c in fut)

arch=[(["figma"],"Figma","wireframes",1),
      (["nextjs","react","tailwind"],"Next.js 16 + React 19","Tailwind CSS frontend",1.75),
      (["fastapi"],"FastAPI","backend + JWT",1),
      (["neon","postgres"],"Neon PostgreSQL","database",1.35),
      (["vercel"],"Vercel","deployment",1)]
arch_html=""
for i,(ks,t,d,w) in enumerate(arch):
    logos="".join(brand(k,"11mm") for k in ks)
    arch_html+=f'<div class="anode" style="flex:{w}"><div class="alogos">{logos}</div><b>{t}</b><span>{d}</span></div>'
    if i<len(arch)-1: arch_html+=f'<div class="aar">{ic("arrow","6mm","#4457df",2.4)}</div>'

sprints=[("1","Sprint 1","Weeks 1–8","Prototype","Requirements, wireframes and system design","#4457df"),
         ("2","Sprint 2","Weeks 9–11","Real backend + full UI","Backend + UI: login, role-based access, profiles, projects, applications","#1f8a4c"),
         ("3","Sprint 3","Week 12 onwards","QR + AI","QR attendance and hours, certificates, AI matching engine","#7c3aed")]
sp_html=""
for n,t,w,name,d,c in sprints:
    sp_html+=(f'<div class="tarr">{ic("arrow","6mm","#b86200",2.4)}</div>' if n!="1" else "")+f'<div class="sprint" style="--c:{c}"><div class="sdot">{n}</div><div class="sbody"><div class="st">{name}<em>{w}</em></div><div class="sd">{d}</div></div></div>'

HTML=f'''<!doctype html><html><head><meta charset="utf-8"><title>UG_CS_14_poster</title>
<style>
@page{{size:420mm 594mm;margin:0}}
*{{box-sizing:border-box}}
html,body{{margin:0;padding:0}}
body{{width:420mm;height:594mm;position:relative;overflow:hidden;font-family:Inter,sans-serif;color:#111827;
  background:#f3f5fb;background-image:radial-gradient(#d9deef 0.45mm,transparent 0.5mm);background-size:7mm 7mm}}
.ic{{flex:none;display:block}}
header{{position:absolute;left:0;top:0;width:420mm;height:81mm;background:linear-gradient(120deg,#e6eaff 0%,#f4f6ff 62%,#fff 100%);border-bottom:1.2mm solid #4457df}}
.net{{position:absolute;left:0;top:0}}
.logo{{position:absolute;right:16mm;top:10mm;width:50mm;height:auto;display:block}}
.brand{{position:absolute;left:16mm;top:9mm;display:flex;align-items:center;gap:8mm}}
.title{{font-size:31mm;font-weight:800;letter-spacing:-1.1mm;line-height:1;white-space:nowrap}}
.title span{{color:#4457df}}
.tag{{position:absolute;left:16mm;top:44.5mm;font-size:11.5mm;font-weight:700;color:#4457df;letter-spacing:-.2mm}}
.team{{position:absolute;left:16mm;top:63mm;font-size:6.6mm;color:#374151;display:flex;gap:4mm;align-items:center}}
.team b{{color:#111827}}
.team .pill{{background:#fff;border:.5mm solid #c9d1fb;border-radius:20mm;padding:1.2mm 4.5mm;font-weight:600}}
main{{position:absolute;left:16mm;right:16mm;top:87mm;bottom:14mm;display:flex;flex-direction:column;gap:6mm}}
.row{{display:flex;gap:6mm;min-height:0}}
.card{{background:#fff;border:.7mm solid var(--c);border-radius:6mm;padding:6.5mm 8mm;position:relative;min-height:0;flex:1;display:flex;flex-direction:column}}
.card h2{{margin:0 0 4.5mm;font-size:10.5mm;font-weight:800;letter-spacing:.2mm;display:flex;align-items:center;gap:4mm;color:#111827;white-space:nowrap}}
.card h2 .n{{background:var(--c);color:#fff;border-radius:3.2mm;width:15mm;height:15mm;display:flex;align-items:center;justify-content:center;font-size:8.5mm;font-weight:800;letter-spacing:0}}
.card h2 small{{font-size:5.4mm;font-weight:600;color:#6b7280;letter-spacing:0;margin-left:auto;white-space:normal;text-align:right}}
ul{{margin:0;padding:0;list-style:none}}
li{{position:relative;padding-left:7mm;font-size:6.5mm;line-height:1.3;margin-bottom:2.4mm}}
li:before{{content:"";position:absolute;left:0;top:2.1mm;width:3mm;height:3mm;border-radius:50%;background:var(--c)}}
li b{{font-weight:700}}
.lead{{font-size:7.1mm;font-weight:700;line-height:1.2;margin:0 0 2mm;color:#111827}}
.lead em{{font-style:normal;color:#4457df}}
.callout{{background:#eef1fe;border-left:1.6mm solid #4457df;border-radius:2mm;padding:3mm 5mm;font-size:6.3mm;line-height:1.28;margin:0 0 3mm}}
.arch{{display:flex;align-items:stretch;gap:1.5mm;margin-top:auto}}
.alogos{{display:flex;gap:3mm;align-items:center;height:11mm}}
.anode{{background:#f6f7fb;border:.4mm solid #dbe0f5;border-radius:3.5mm;padding:2.6mm 1.5mm;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.6mm}}
.anode b{{font-size:5.4mm;font-weight:800;line-height:1.1}}
.anode span{{font-size:4.3mm;color:#6b7280;line-height:1.15}}
.aar{{display:flex;align-items:center}}
.plans{{align-items:center;flex-direction:row;gap:7mm;padding:4mm 8mm}}
.plans h2{{margin:0;flex:none}}
.tl{{display:flex;align-items:stretch;gap:3mm;flex:1}}
.sprint{{flex:1;display:flex;gap:4mm;align-items:flex-start;background:color-mix(in srgb,var(--c) 7%,#fff);border:.5mm solid color-mix(in srgb,var(--c) 30%,#fff);border-radius:4mm;padding:3.5mm 4mm}}
.sdot{{flex:none;width:12mm;height:12mm;border-radius:50%;background:var(--c);color:#fff;font-weight:800;font-size:7mm;display:flex;align-items:center;justify-content:center}}
.st{{font-size:6.4mm;line-height:1.2;font-weight:800}}
.st em{{display:block;width:fit-content;margin-top:1.2mm;font-style:normal;background:color-mix(in srgb,var(--c) 16%,#fff);color:var(--c);font-weight:700;font-size:4.6mm;padding:.5mm 2.6mm;border-radius:10mm;white-space:nowrap}}
.sd{{font-size:5.3mm;line-height:1.22;color:#374151;margin-top:1mm}}
.tarr{{display:flex;align-items:center}}
.stats{{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-bottom:4.5mm}}
.stat{{background:color-mix(in srgb,var(--c) 9%,#fff);border:.5mm solid color-mix(in srgb,var(--c) 35%,#fff);border-radius:4mm;padding:2.6mm 3mm;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:3mm;align-items:center}}
.stat .si{{grid-row:1/3}}
.sn{{font-size:12mm;font-weight:800;line-height:1;color:var(--c)}}
.sl{{font-size:4.9mm;font-weight:600;color:#374151;white-space:nowrap}}
.achg{{display:grid;grid-template-columns:1fr 1fr;gap:3.2mm 5mm;flex:1;align-content:space-between}}
.ach,.fut{{display:flex;gap:3.5mm;align-items:flex-start}}
.ai{{flex:none;width:13mm;height:13mm;border-radius:3.5mm;background:color-mix(in srgb,var(--c) 12%,#fff);display:flex;align-items:center;justify-content:center}}
.ach b,.fut b{{display:block;font-size:6.1mm;font-weight:800;line-height:1.15}}
.ach span,.fut span{{display:block;font-size:5.3mm;line-height:1.25;color:#374151;margin-top:.5mm}}
.futg{{display:flex;flex-direction:column;justify-content:space-between;flex:1;gap:2mm}}
.band{{background:#fff;border:.7mm solid #4457df;border-radius:6mm;padding:3.5mm 8mm 4mm;flex:none}}
.band h3{{margin:0 0 2mm;font-size:5.4mm;letter-spacing:.8mm;color:#4457df;font-weight:800;text-transform:uppercase;text-align:center}}
.journey{{display:flex;align-items:center;justify-content:space-between}}
.jstep{{display:flex;flex-direction:column;align-items:center;gap:1.2mm;width:38mm}}
.jcirc{{width:17mm;height:17mm;border-radius:50%;display:flex;align-items:center;justify-content:center}}
.jlab{{font-weight:800;font-size:5.6mm}}
.jarr{{margin-top:-6mm}}
.teaser{{margin-top:auto;display:flex;gap:4mm;align-items:center;background:#eef1fe;border-radius:4mm;padding:4mm 5mm;font-size:6.2mm;line-height:1.25;font-weight:600;color:#1f2a8a}}
footer{{flex:none;display:flex;align-items:center;gap:8mm;background:linear-gradient(100deg,#2b3aa8,#4457df 55%,#6d7df0);color:#fff;border-radius:6mm;padding:3mm 10mm;height:24mm}}
footer .big{{font-size:14mm;font-weight:800;letter-spacing:-.4mm;white-space:nowrap}}
footer .big span{{color:#ffd166}}
footer .r{{margin-left:auto;text-align:right;font-size:5.6mm;line-height:1.35;opacity:.95}}
footer .r b{{font-size:6.2mm}}
</style></head><body>
<header>{NET}
 <div class="brand">{mark("34mm")}<div class="title">Tandem</div></div>
 <div class="tag">Community Volunteer &amp; NGO Management Platform</div>
 <div class="team"><span><b>COS40005</b> Computing Technology Project A</span><span class="pill"><b>Group&nbsp;14</b></span><span class="pill">Vishvaaraj Jegaraj</span><span class="pill">Trishanth Thanendran</span><span class="pill">Nigel Wong</span></div>
 <img class="logo" src="swinburne.png" alt="Swinburne University of Technology">
</header>
<main>
 <div class="row" style="flex:196">
  <section class="card" style="--c:#c53030;width:150mm;flex:none"><h2><span class="n">01</span>PROBLEM</h2>{problem_art()}
    <ul style="margin-top:6mm">{li(["Volunteers run on <b>spreadsheets, forms and chat groups</b>","Hard to <b>match</b> the right volunteer to the right activity","Attendance, hours and contributions are <b>hard to prove</b>","<b>No data</b> on participation, retention or skills shortages","Existing tools serve one organisation, <b>not many NGOs</b>"],"#c53030")}</ul>
    <div class="teaser">{mark("15mm")}<span>One platform that takes volunteers from first sign-up to proven impact.</span></div></section>
  <section class="card" style="--c:#4457df"><h2><span class="n">02</span>APPROACH TO SOLVE</h2>
   <p class="lead">One centralised <em>multi-NGO</em> web platform for every role.</p>
   {roles_art()}
   <ul style="margin-top:3mm">{li(["<b>AI recommends, humans decide:</b> Keyword, Semantic and Hybrid scoring on skills, availability, location, experience and interests","<b>Design-first:</b> Figma wireframes drive the build; privacy by design (PDPA 2010)"],"#4457df")}</ul>
   <div class="callout"><b>Research question:</b> how much do semantic and hybrid matching improve accuracy over keyword matching?</div>
   <div class="arch">{arch_html}</div>
  </section>
 </div>
 <section class="card plans" style="--c:#b86200;flex:52"><h2><span class="n">03</span>PLANS</h2><div class="tl">{sp_html}</div></section>
 <div class="row" style="flex:152">
  <section class="card" style="--c:#1f8a4c;flex:1.3"><h2><span class="n">04</span>PROGRESS SO FAR<small>Sprint 2 complete · Sprint 3 backend done</small></h2>
   <div class="stats">{stat("S2","sprint complete","#1f8a4c","check")}{stat("71","API endpoints","#b86200","server")}{stat("87","tests passed","#4457df","shield")}{stat("4","user roles","#7c3aed","users")}</div>
   <div class="achg">{ach_html}</div></section>
  <section class="card" style="--c:#7c3aed;flex:1"><h2><span class="n">05</span>FUTURE PLANS</h2><div class="futg">{fut_html}</div></section>
 </div>
 <div class="band"><h3>The volunteer journey</h3>{journey()}</div>
 <footer>{mark("18mm",fg="#4457df",tile="#fff")}<div class="big">Volunteers &amp; NGOs, <span>in tandem.</span></div>
  <div class="r"><b>cos-40005-fyp-1.vercel.app</b><br>COS40005 · Group 14</div></footer>
</main></body></html>'''
open("/home/claude/poster/poster.html","w").write(HTML)
print("built")
