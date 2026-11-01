# Imagen PROVISIONAL del plan B (puntos proyectados con la cámara de ?captura). Se sustituye por la captura real.
import numpy as np, json, sys, os, math
from PIL import Image, ImageDraw, ImageFilter
work, out = sys.argv[1], sys.argv[2]
rot = json.load(open(os.path.join(work,'rot.json')))
W,H = 4000,2000; A = W/H
PASO=0.38; FILAS=[0.19,-0.21]; ANCHO=0.33; GROSOR=0.012; FONDO=0.17; ZZ=0.088
T = math.tan(math.radians(14))
d = max(0.9/2/T, 2.15/2/(T*A))*1.12
eye = np.array([0,0.095,d]); tgt = np.array([0,0.075,0])
f = (tgt-eye); f/=np.linalg.norm(f); r = np.cross(f,[0,1,0]); r/=np.linalg.norm(r); u = np.cross(r,f)
def proj(P):
    P = np.atleast_2d(P)-eye
    x,y,z = P@r, P@u, P@f
    return np.stack([(x/(z*T*A)*0.5+0.5)*W, (0.5-y/(z*T)*0.5)*H],1), z
orden = ['fila','asics','pegasus-trail','reebok-nano','racer-tr21','nb-997','converse','ozweego','old-skool','xt6']
med = json.load(open(sys.argv[3]))
# pared: luz del foco
yy,xx = np.mgrid[0:H,0:W]
dist = np.sqrt(((xx-W*0.52)/(W*0.62))**2 + ((yy-H*0.36)/(H*0.85))**2)
v = np.clip(1-dist,0,1)**1.6
base = np.array([18,16,17.0]); luz = np.array([62,56,57.0])
img = (base + (luz-base)*v[...,None])
rng = np.random.default_rng(3); img += rng.normal(0,1.6,(H,W,1))
im = Image.fromarray(np.clip(img,0,255).astype(np.uint8))
# sombras suaves detrás de cada zapatilla
sombra = Image.new('L',(W,H),0); ds = ImageDraw.Draw(sombra)
def bahia(i): return ((i%5)-2)*PASO, FILAS[i//5]
for i,s in enumerate(orden):
    x,y = bahia(i); a = med[s]['alto']
    (p0,),_ = proj([x-0.15, y+a*0.9, 0.0]); (p1,),_ = proj([x+0.13, y-0.02, 0.0])
    ds.ellipse([p0[0]+30, p0[1]+40, p1[0]+30, p1[1]+50], fill=120)
sombra = sombra.filter(ImageFilter.GaussianBlur(40))
im = Image.composite(Image.new('RGB',(W,H),(10,9,9)), im, sombra.point(lambda q: q*0.55))
dr = ImageDraw.Draw(im,'RGBA')
zonas = []
for i,s in enumerate(orden):
    x,y = bahia(i); a = med[s]['alto']
    # balda: cara de arriba y canto
    top = proj(np.array([[x-ANCHO/2,y,0],[x+ANCHO/2,y,0],[x+ANCHO/2,y,FONDO],[x-ANCHO/2,y,FONDO]]))[0]
    front = proj(np.array([[x-ANCHO/2,y,FONDO],[x+ANCHO/2,y,FONDO],[x+ANCHO/2,y-GROSOR,FONDO],[x-ANCHO/2,y-GROSOR,FONDO]]))[0]
    dr.polygon([tuple(p) for p in top], fill=(220,215,210,26))
    dr.polygon([tuple(p) for p in front], fill=(120,80,60,120))
    dr.line([tuple(front[0]),tuple(front[1])], fill=(255,240,230,120), width=2)
    # zapatilla
    a6 = np.fromfile(os.path.join(work,s+'.pts'),dtype=np.float32).reshape(-1,6)
    p = a6[:,:3].astype(float)@np.array(rot[s]).T; c = np.clip(a6[:,3:],0,255)
    lo,hi = p.min(0),p.max(0); k = 0.30/(hi[0]-lo[0])
    p = (p-[(lo[0]+hi[0])/2, lo[1], (lo[2]+hi[2])/2])*k + [x,y,ZZ]
    sp, z = proj(p)
    # sombreado sencillo: más oscuro abajo, como con el foco arriba
    rel = (p[:,1]-y)/max(1e-6,a); c = c*(0.62+0.38*np.clip(rel,0,1))[:,None]
    o = np.argsort(-z)   # lejos primero
    sp, c = sp[o], c[o]
    arr = np.array(im)
    for dx in range(-2,3):
        for dy in range(-2,3):
            if dx*dx+dy*dy>5: continue
            xi = np.clip(sp[:,0].astype(int)+dx,0,W-1); yi = np.clip(sp[:,1].astype(int)+dy,0,H-1)
            arr[yi,xi] = c.astype(np.uint8)
    im = Image.fromarray(arr); dr = ImageDraw.Draw(im,'RGBA')
    # rectángulo del hueco: mismas esquinas que escena.js
    cs = np.array([[xx_,yy_,zz_] for xx_ in (x-ANCHO/2,x+ANCHO/2) for yy_ in (y-GROSOR-0.01,y+a+0.01) for zz_ in (0,FONDO)])
    q,_ = proj(cs); x0,y0 = q.min(0); x1,y1 = q.max(0)
    zonas.append(dict(slug=s, x=round(x0/W,5), y=round(y0/H,5), w=round((x1-x0)/W,5), h=round((y1-y0)/H,5)))
im = im.filter(ImageFilter.GaussianBlur(0.8))
im.save(os.path.join(out,'pared.webp'), quality=82, method=6)
json.dump(dict(ancho=W, alto=H, zonas=zonas, provisional=True), open(os.path.join(out,'pared.json'),'w'), indent=1)
print('ok', os.path.getsize(os.path.join(out,'pared.webp'))//1024, 'KB')
