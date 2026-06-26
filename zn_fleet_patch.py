# -*- coding: utf-8 -*-
import os, sys, shutil, subprocess, tempfile
ROOT = os.getcwd()
ip = os.path.join(ROOT, 'index.html')
lp = os.path.join(ROOT, 'js', 'zn_module_loader.js')
idx = open(ip, encoding='utf-8').read()
ldr = open(lp, encoding='utf-8').read()

# A) loader REGISTRY
a_old = "pulse:         { url: '/js/modules/pulse.js',          global: 'renderPulse' }"
a_new = a_old + ",\n    fleetlive:     { url: '/js/modules/fleet-live.js',    global: 'renderFleetLive' }"
assert ldr.count(a_old) == 1, "A anchor not unique"
ldr = ldr.replace(a_old, a_new)

# B) __ZN_LAZY stub
b_old = "renderPulse:'pulse' };"
b_new = "renderPulse:'pulse', renderFleetLive:'fleetlive' };"
assert idx.count(b_old) == 1, "B anchor not unique"
idx = idx.replace(b_old, b_new)

# C) router renderers map
c_old = "alerts:renderAlerts,pulse:renderPulse,"
c_new = "alerts:renderAlerts,pulse:renderPulse,fleetlive:renderFleetLive,"
assert idx.count(c_old) == 1, "C anchor not unique"
idx = idx.replace(c_old, c_new)

# D) sidebar nav-item
d_old = '<div class="nav-item" data-page="users"><i data-lucide="user-cog" size="18"></i> Χρήστες / Δικαιώματα</div>'
d_new = d_old + '\n  <div class="nav-item" data-page="fleetlive"><i data-lucide="map-pin" size="18"></i> Live Διανομές</div>'
assert idx.count(d_old) == 1, "D anchor not unique"
idx = idx.replace(d_old, d_new)

# E) search index
e_old = "{page:'users',           label:'Χρήστες Δικαιώματα Ρόλοι',           icon:'\U0001f464'},"
e_new = e_old + "\n    {page:'fleetlive',       label:'Live Διανομές Tracking Χάρτης Πωλητές', icon:'\U0001f6f5'},"
assert idx.count(e_old) == 1, "E anchor not unique"
idx = idx.replace(e_old, e_new)

open(ip, 'w', encoding='utf-8').write(idx)
open(lp, 'w', encoding='utf-8').write(ldr)

# node --check: module (as .mjs), loader, and every inline <script> in index.html
def ck(path, mod=False):
    t = path + ('.mjs' if mod else '')
    if mod: shutil.copyfile(path, t)
    r = subprocess.run(['node','--check',t], capture_output=True, text=True)
    if mod: os.remove(t)
    if r.returncode: sys.stderr.write("SYNTAX FAIL %s\n%s\n" % (path, r.stderr)); sys.exit(1)

ck(os.path.join(ROOT,'js','modules','fleet-live.js'), mod=True)
ck(lp)

html = open(ip, encoding='utf-8').read(); low = html.lower(); i=0; n=0
while True:
    j = low.find('<script', i)
    if j == -1: break
    gt = html.find('>', j); end = low.find('</script>', gt+1)
    if gt==-1 or end==-1: break
    attrs = html[j+7:gt]; body = html[gt+1:end]; i = end+9
    if 'src=' in attrs.lower() or not body.strip(): continue
    n+=1
    tf=tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8'); tf.write(body); tf.close()
    r=subprocess.run(['node','--check',tf.name],capture_output=True,text=True); os.remove(tf.name)
    if r.returncode: sys.stderr.write("INLINE #%d FAIL\n%s\n"%(n,r.stderr)); sys.exit(1)
print("OK: fleet-live module wired (REGISTRY + lazy stub + router + nav + search); module+loader+%d inline scripts pass" % n)
