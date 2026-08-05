#!/usr/bin/env python3
"""Bake the flat proving frame: terrain contours, rivers, doors -> one HTML file."""
import json, math, random, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'public/table-scene.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'docs/frames/flat-proving-frame.html')
TEMPLATE_PATH = os.path.join(ROOT, 'tools/flat-map-template.html')

d = json.load(open(SRC))
grid = d['relief']['grid']
SIDE = int(round(len(grid) ** 0.5))
MAP = 1000.0  # internal map coordinate space

# ---------- downsample 300 -> 75 and smooth ----------
N = 75
K = SIDE // N
f = [[0.0]*N for _ in range(N)]
for r in range(N):
    for c in range(N):
        s = 0.0
        for dr in range(K):
            base = (r*K+dr)*SIDE + c*K
            for dc in range(K):
                s += grid[base+dc]
        f[r][c] = s/(K*K)
# 3x3 smooth, two passes
for _ in range(2):
    g2 = [[0.0]*N for _ in range(N)]
    for r in range(N):
        for c in range(N):
            s=0.0; n=0
            for dr in (-1,0,1):
                for dc in (-1,0,1):
                    rr,cc = r+dr,c+dc
                    if 0<=rr<N and 0<=cc<N: s+=f[rr][cc]; n+=1
            g2[r][c]=s/n
    f=g2

# pad with low border so all iso-regions close
PADV = min(min(row) for row in f) - 100
P = N+2
pf = [[PADV]*P for _ in range(P)]
for r in range(N):
    for c in range(N):
        pf[r+1][c+1] = f[r][c]

CELL = MAP*K/SIDE            # map units per downsampled cell = 13.333
def gx(c): return (c-1)*CELL + CELL/2   # padded col index -> map x
def gy(r): return (r-1)*CELL + CELL/2

CASES = {1:[('left','bottom')],2:[('bottom','right')],3:[('left','right')],
         4:[('top','right')],5:[('left','top'),('bottom','right')],6:[('top','bottom')],
         7:[('left','top')],8:[('top','left')],9:[('top','bottom')],
         10:[('top','right'),('bottom','left')],11:[('top','right')],
         12:[('right','left')],13:[('right','bottom')],14:[('bottom','left')]}

def key(p): return (round(p[0],4), round(p[1],4))

def marching(t):
    segs=[]
    for r in range(P-1):
        for c in range(P-1):
            tl=pf[r][c]; tr=pf[r][c+1]; br=pf[r+1][c+1]; bl=pf[r+1][c]
            idx=(8 if tl>=t else 0)|(4 if tr>=t else 0)|(2 if br>=t else 0)|(1 if bl>=t else 0)
            if idx in (0,15): continue
            pts={}
            def ip(a,b,pa,pb):
                dd=(t-a)/(b-a)
                return (pa[0]+(pb[0]-pa[0])*dd, pa[1]+(pb[1]-pa[1])*dd)
            ctl=(gx(c),gy(r)); ctr=(gx(c+1),gy(r)); cbr=(gx(c+1),gy(r+1)); cbl=(gx(c),gy(r+1))
            if (tl>=t)!=(tr>=t): pts['top']=ip(tl,tr,ctl,ctr)
            if (tr>=t)!=(br>=t): pts['right']=ip(tr,br,ctr,cbr)
            if (bl>=t)!=(br>=t): pts['bottom']=ip(bl,br,cbl,cbr)
            if (tl>=t)!=(bl>=t): pts['left']=ip(tl,bl,ctl,cbl)
            for a,b in CASES[idx]:
                if a in pts and b in pts:
                    segs.append((pts[a],pts[b]))
    # chain into loops
    adj=defaultdict(list)
    for i,(a,b) in enumerate(segs):
        adj[key(a)].append(i); adj[key(b)].append(i)
    used=[False]*len(segs); loops=[]
    for i in range(len(segs)):
        if used[i]: continue
        a,b=segs[i]; used[i]=True; loop=[a,b]; cur=b
        while key(cur)!=key(a):
            nxt=None
            for j in adj[key(cur)]:
                if used[j]: continue
                p,q=segs[j]
                if key(p)==key(cur): nxt=q
                elif key(q)==key(cur): nxt=p
                else: continue
                used[j]=True; break
            if nxt is None: break
            loop.append(nxt); cur=nxt
        loops.append(loop)
    return loops

def rdp(pts, eps):
    if len(pts)<3: return pts
    def d2seg(p,a,b):
        ax,ay=a; bx,by=b; px,py=p
        dx,dy=bx-ax,by-ay
        L2=dx*dx+dy*dy
        if L2==0: return (px-ax)**2+(py-ay)**2
        t=max(0,min(1,((px-ax)*dx+(py-ay)*dy)/L2))
        qx,qy=ax+t*dx,ay+t*dy
        return (px-qx)**2+(py-qy)**2
    def rec(lo,hi,keep):
        if hi<=lo+1: return
        mx=-1; mi=-1
        for i in range(lo+1,hi):
            dd=d2seg(pts[i],pts[lo],pts[hi])
            if dd>mx: mx=dd; mi=i
        if mx>eps*eps:
            keep.add(mi); rec(lo,mi,keep); rec(mi,hi,keep)
    keep={0,len(pts)-1}
    rec(0,len(pts)-1,keep)
    return [pts[i] for i in sorted(keep)]

def loop_perim(pts):
    s=0
    for i in range(len(pts)):
        a=pts[i]; b=pts[(i+1)%len(pts)]
        s+=math.hypot(b[0]-a[0],b[1]-a[1])
    return s

def catmull_path(pts, closed=True):
    # pts: list of (x,y); returns smooth cubic path
    n=len(pts)
    if n<3:
        return ''
    def P(i): return pts[i%n]
    out=[f"M{P(0)[0]:.1f} {P(0)[1]:.1f}"]
    rng = range(n) if closed else range(n-1)
    for i in rng:
        p0=P(i-1); p1=P(i); p2=P(i+1); p3=P(i+2)
        c1=(p1[0]+(p2[0]-p0[0])/6.0, p1[1]+(p2[1]-p0[1])/6.0)
        c2=(p2[0]-(p3[0]-p1[0])/6.0, p2[1]-(p3[1]-p1[1])/6.0)
        out.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}")
    if closed: out.append('Z')
    return ''.join(out)

# ---------- bands ----------
# The levels used to be six hardcoded metre values from the retired real-world
# elevation range. On invented land those numbers are meaningless — most of them
# landed above the realm's highest ground and drew nothing. Levels are derived
# from the data now: where there is a sea, the first level IS sea level, so the
# lowest band's outline is literally the coastline; the rest are quantiles of
# the LAND only, which keeps every band carrying roughly equal area whatever
# shape the realm turns out to be.
SEA = d.get('seaLevel')
_flat = sorted(v for row in f for v in row if SEA is None or v > SEA)
def _q(t):
    if not _flat: return 0.0
    return _flat[min(len(_flat) - 1, max(0, int(t * len(_flat))))]
if SEA is None:
    LEVELS = [_q(t) for t in (0.10, 0.32, 0.52, 0.70, 0.85, 0.95)]
else:
    LEVELS = [SEA] + [_q(t) for t in (0.22, 0.44, 0.64, 0.81, 0.93)]
# strictly increasing, or marching squares draws the same ring twice
for _i in range(1, len(LEVELS)):
    if LEVELS[_i] <= LEVELS[_i - 1]:
        LEVELS[_i] = LEVELS[_i - 1] + 1e-3
print('levels: ' + ', '.join('%.0f' % L for L in LEVELS), file=sys.stderr)

# Water is `night` darkened — the palette's cool half, the same family the
# rivers already use. With a sea the base rect IS the water, and the first band
# lays all the land on top of it.
BASE_FILL = '#1B2536' if SEA is not None else '#2D4634'
BAND_COLORS = ['#2D4634', '#2F4A2E', '#3C5433', '#4C5F3A', '#5F6B41', '#7C7C4C', '#968D5E']
band_paths=[]
for t in LEVELS:
    loops = marching(t)
    parts=[]
    for lp in loops:
        if len(lp)<4: continue
        # loop endpoints duplicate: drop closing dup if same
        if key(lp[0])==key(lp[-1]): lp=lp[:-1]
        if loop_perim(lp)<45: continue
        sp = rdp(lp, 2.2)
        if len(sp)<3: continue
        parts.append(catmull_path(sp))
    band_paths.append(''.join(parts))

# coverage report
import sys
tot=N*N
for t in LEVELS:
    cov=sum(1 for row in f for v in row if v>=t)
    print(f"level {t:.0f}: {100*cov/tot:.1f}% above", file=sys.stderr)

# ---------- hachures ----------
rng = random.Random(7)
hach=[]
step=2
for r in range(2,N-2,step):
    for c in range(2,N-2,step):
        dzdx = (f[r][c+1]-f[r][c-1])/(2*CELL)   # m per map-unit
        dzdy = (f[r+1][c]-f[r-1][c])/(2*CELL)
        slope = math.hypot(dzdx,dzdy)
        if slope < 0.26: continue
        if SEA is not None and f[r][c] <= SEA: continue   # no hillside shading at sea
        if rng.random() < 0.25: continue
        # downhill direction
        dx,dy = -dzdx,-dzdy
        L=math.hypot(dx,dy); dx/=L; dy/=L
        x = gx(c+1)+rng.uniform(-5,5); y = gy(r+1)+rng.uniform(-5,5)
        ln = min(16, 6+slope*22) * rng.uniform(0.8,1.15)
        # slight jitter of angle
        a=math.atan2(dy,dx)+rng.uniform(-0.18,0.18)
        x2=x+math.cos(a)*ln; y2=y+math.sin(a)*ln
        hach.append(f"M{x:.0f} {y:.0f}L{x2:.0f} {y2:.0f}")
hach_path=''.join(hach)
print(f"hachures: {len(hach)}", file=sys.stderr)

# ---------- rivers ----------
def resample(pts, n):
    # pts list of (x,y); arc-length resample
    dists=[0.0]
    for i in range(1,len(pts)):
        dists.append(dists[-1]+math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]))
    total=dists[-1]
    out=[]
    j=0
    for i in range(n):
        target=total*i/(n-1)
        while j<len(dists)-2 and dists[j+1]<target: j+=1
        seg=dists[j+1]-dists[j]
        t=0 if seg==0 else (target-dists[j])/seg
        out.append((pts[j][0]+(pts[j+1][0]-pts[j][0])*t, pts[j][1]+(pts[j+1][1]-pts[j][1])*t))
    return out

def smooth_pts(pts, passes=2):
    for _ in range(passes):
        out=[pts[0]]
        for i in range(1,len(pts)-1):
            out.append(((pts[i-1][0]+2*pts[i][0]+pts[i+1][0])/4.0,
                        (pts[i-1][1]+2*pts[i][1]+pts[i+1][1])/4.0))
        out.append(pts[-1])
        pts=out
    return pts

river_polys=[]; river_cores=[]
rrng = random.Random(3)
for rv in d['rivers']:
    pts=[(p['u']*MAP,p['v']*MAP) for p in rv['pts']]
    pts=smooth_pts(resample(pts,160),3)
    n=len(pts)
    left=[]; right=[]
    for i in range(n):
        t=i/(n-1)
        w = (2.2 + 10.4*(t**1.3)) / 2.0   # half width, tapering downstream
        a = pts[max(0,i-1)]; b = pts[min(n-1,i+1)]
        dx,dy=b[0]-a[0],b[1]-a[1]
        L=math.hypot(dx,dy) or 1.0
        nx,ny=-dy/L,dx/L
        # tiny meander wobble
        wob = math.sin(t*40+ pts[i][0]*0.01)*0.35
        left.append((pts[i][0]+nx*(w+wob), pts[i][1]+ny*(w+wob)))
        right.append((pts[i][0]-nx*(w-wob), pts[i][1]-ny*(w-wob)))
    poly = 'M'+ 'L'.join(f"{x:.1f} {y:.1f}" for x,y in left) + 'L' + 'L'.join(f"{x:.1f} {y:.1f}" for x,y in reversed(right)) + 'Z'
    river_polys.append(poly)
    core = 'M'+ 'L'.join(f"{x:.1f} {y:.1f}" for x,y in pts[int(n*0.12):])
    river_cores.append(core)

# ---------- copses: little tree clusters to give the lowland some life ----------
def elev_at(x,y):
    c=max(0,min(N-1,int(x/CELL))); r=max(0,min(N-1,int(y/CELL)))
    return f[r][c]

river_center_pts=[]
for rv in d['rivers']:
    pts=[(p['u']*MAP,p['v']*MAP) for p in rv['pts']]
    river_center_pts.extend(resample(pts,80))
door_pts=[(x['u']*MAP,x['v']*MAP) for x in d['doors']]
kn_pts=[(k['u']*MAP,k['v']*MAP) for k in d['knights']]

crng = random.Random(21)
copses=[]; tries=0
def near(pts,x,y,r):
    rr=r*r
    return any((px-x)**2+(py-y)**2<rr for px,py in pts)
while len(copses)<46 and tries<6000:
    tries+=1
    x=crng.uniform(30,970); y=crng.uniform(30,970)
    if elev_at(x,y) > LEVELS[-2]: continue          # no woods on the bare tops
    if SEA is not None and elev_at(x,y) <= SEA: continue   # and none in the water
    if near(door_pts,x,y,36): continue
    if near(kn_pts,x,y,48): continue
    if near(river_center_pts,x,y,24): continue
    if near(copses,x,y,58): continue
    copses.append((x,y))

copse_svg=[]
for x,y in copses:
    nb=crng.randint(3,6)
    blobs=[]
    for i in range(nb):
        bx=crng.uniform(-9,9); by=crng.uniform(-4,4)
        r=crng.uniform(3.8,6.4)
        blobs.append((bx,by,r))
    blobs.sort(key=lambda b:b[1])
    spread=max(abs(b[0]) for b in blobs)+6
    parts=[f'<g transform="translate({x:.0f} {y:.0f})">']
    # One sun, upper-left, and a shadow no longer than the thing casting it: a
    # copse is low, so it throws a SHORT shadow. It used to throw a longer one
    # than a three-storey house, which is what made the pieces read weightless.
    parts.append(f'<ellipse cx="2.6" cy="2.0" rx="{spread+1:.0f}" ry="{(spread+1)*0.34:.1f}" fill="#17251A" opacity="0.26"/>')
    for bx,by,r in blobs:
        parts.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{r:.1f}" fill="#2A4128" stroke="#1B2E1B" stroke-opacity="0.5" stroke-width="0.6"/>')
        parts.append(f'<circle cx="{bx-r*0.32:.1f}" cy="{by-r*0.36:.1f}" r="{r*0.52:.1f}" fill="#44603A" opacity="0.85"/>')
    parts.append('</g>')
    copse_svg.append(''.join(parts))
print(f"copses: {len(copses)}", file=sys.stderr)

# ---------- the surveyed ground: parcels under the holdings ----------
#
# Edwin's direction, 2026-07-29: deterministic, discrete modularity — a finite
# kit on SUBDIVIDED ground. The pieces stand on a lattice now (parcels.ts,
# modularParcels), so the ground says so: each fellowship's block is drawn as
# the parcels it actually occupies, with a road margin around it.
#
# Only HELD land is surveyed. The rest of the realm stays open ground, which is
# true rather than decorative — the emptiness is where nothing is held.
PITCH_X = 0.019 * MAP
PITCH_Y = 0.0175 * MAP
blocks = defaultdict(list)
for _dr in d['doors']:
    pc = _dr.get('parcel')
    if pc and pc.get('block', -1) >= 0:
        blocks[pc['block']].append((_dr['u']*MAP, _dr['v']*MAP, pc['col'], pc['row']))

parcel_svg = []
for b, items in sorted(blocks.items()):
    xs = [i[0] for i in items]; ys = [i[1] for i in items]
    cols = max(i[2] for i in items) + 1
    rows = max(i[3] for i in items) + 1
    x0 = min(xs) - PITCH_X/2; y0 = min(ys) - PITCH_Y/2
    w = cols*PITCH_X; h = rows*PITCH_Y
    # the block's ground — a shade of the field, so it reads as cleared land
    parcel_svg.append(
        f'<rect x="{x0-2.5:.1f}" y="{y0-2.5:.1f}" width="{w+5:.1f}" height="{h+5:.1f}" rx="2" '
        f'fill="#4C5F3A" fill-opacity="0.85" stroke="#1B2E1B" stroke-opacity="0.8" stroke-width="1.6"/>')
    # the parcels themselves — one faint line per boundary, nothing more
    for c in range(1, cols):
        parcel_svg.append(f'<path d="M{x0+c*PITCH_X:.1f} {y0:.1f}V{y0+h:.1f}" stroke="#1B2E1B" stroke-opacity="0.75" stroke-width="0.9"/>')
    for r in range(1, rows):
        parcel_svg.append(f'<path d="M{x0:.1f} {y0+r*PITCH_Y:.1f}H{x0+w:.1f}" stroke="#1B2E1B" stroke-opacity="0.75" stroke-width="0.9"/>')
print(f"parcel blocks: {len(blocks)}", file=sys.stderr)

# ---------- doors & knights ----------
doors = sorted(d['doors'], key=lambda x: x['v'])  # north first: near pieces draw last and win the hit test
door_js = json.dumps([
    [round(x['u']*MAP,1), round(x['v']*MAP,1), x['kind'][0], x['state'],
     round(x['size'],3), round(x['lean'],4), x['street'], round(x['tone'],3)]
    for x in doors], separators=(',',':'))
knight_js = json.dumps([
    [round(k['u']*MAP,1), round(k['v']*MAP,1), k['name'], round(k['lean'],4)]
    for k in d['knights']], separators=(',',':'))

# ---------- map transform ----------
W,H = 1600,1000
ROT = -8.5
th = math.radians(ROT)
us=[x['u']*MAP for x in doors]; vs=[x['v']*MAP for x in doors]
m=30  # margin around door bbox in map units
bx0,bx1 = min(us)-m, max(us)+m
by0,by1 = min(vs)-m, max(vs)+m
corners=[(bx0,by0),(bx1,by0),(bx1,by1),(bx0,by1)]
rot=[(x*math.cos(th)-y*math.sin(th), x*math.sin(th)+y*math.cos(th)) for x,y in corners]
rw = max(p[0] for p in rot)-min(p[0] for p in rot)
rh = max(p[1] for p in rot)-min(p[1] for p in rot)
fw,fh = W-70, H-30
s = min(fw/rw, fh/rh)
cx,cy = (bx0+bx1)/2.0,(by0+by1)/2.0
tx,ty = W/2.0+30, H/2.0-8
transform = f"translate({tx:.1f} {ty:.1f}) rotate({ROT}) scale({s:.4f}) translate({-cx:.1f} {-cy:.1f})"
print(f"scale {s:.3f}", file=sys.stderr)

# ---------- template ----------
band_svg = []
for i,p in enumerate(band_paths):
    band_svg.append(f'<path d="{p}" fill="{BAND_COLORS[i+1]}" fill-rule="evenodd"/>')
contour_svg = []
for i,p in enumerate(band_paths):
    contour_svg.append(f'<path d="{p}" fill="none" stroke="#1D311D" stroke-opacity="0.45" stroke-width="1.25"/>')

river_svg=[]
for i,poly in enumerate(river_polys):
    river_svg.append(f'<path d="{poly}" transform="translate(1.6 2)" fill="#17251A" fill-opacity="0.55"/>')
for i,poly in enumerate(river_polys):
    river_svg.append(f'<path d="{poly}" fill="#22304A"/>')
for i,core in enumerate(river_cores):
    river_svg.append(f'<path d="{core}" fill="none" stroke="#41567C" stroke-opacity="0.55" stroke-width="1.6" transform="translate(-0.7 -0.8)"/>')

html = open(TEMPLATE_PATH).read()
html = html.replace('@@TRANSFORM@@', transform)
html = html.replace('@@BASEFILL@@', BASE_FILL)
html = html.replace('@@BANDS@@', '\n'.join(band_svg))
html = html.replace('@@CONTOURS@@', '\n'.join(contour_svg))
html = html.replace('@@HACHURES@@', hach_path)
html = html.replace('@@RIVERS@@', '\n'.join(river_svg))
html = html.replace('@@COPSES@@', '\n'.join(copse_svg))
html = html.replace('@@PARCELS@@', '\n'.join(parcel_svg))
html = html.replace('@@DOORS@@', door_js)
# the parcel address per door, in the SAME order as DOORS, so the inspector can
# name a holding's fellowship and its place within it without re-deriving either
parcel_js = json.dumps([x.get('parcel') for x in doors], separators=(',', ':'))
html = html.replace('@@PARCELS_JS@@', parcel_js)
html = html.replace('@@KNIGHTS@@', knight_js)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT,'w').write(html)
print(f"wrote {OUT} ({len(html)} bytes)", file=sys.stderr)
