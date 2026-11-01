import numpy as np, sys, os
from PIL import Image, ImageDraw
W = 220
work = sys.argv[1]; slugs = sys.argv[2].split(',')
# vista: (eje horizontal, eje vertical, eje profundidad, signo hacia cámara, nombre)
V = [(0,1,2,+1,'+Z (x→,y↑)'),(0,1,2,-1,'-Z'),(2,1,0,+1,'+X (z→,y↑)'),(2,1,0,-1,'-X'),(0,2,1,+1,'+Y (x→,z↑)'),(0,2,1,-1,'-Y')]
sheet = Image.new('RGB',(W*6, (W+14)*len(slugs)),'white'); d = ImageDraw.Draw(sheet)
for r,s in enumerate(slugs):
    a = np.fromfile(os.path.join(work,s+'.pts'),dtype=np.float32).reshape(-1,6)
    p, c = a[:,:3], np.clip(a[:,3:],0,255).astype(np.uint8)
    lo, hi = p.min(0), p.max(0); span = (hi-lo).max()
    for k,(h,v,z,sg,name) in enumerate(V):
        hh = (p[:,h]-lo[h])/span; vv = (p[:,v]-lo[v])/span; dep = p[:,z]*sg
        if sg<0: hh = (hi[h]-p[:,h])/span   # mirar desde el otro lado invierte el horizontal
        x = (hh*(W-10)+5).astype(int); y = (W-5-vv*(W-10)).astype(int)
        img = np.full((W,W,3),235,np.uint8); zb = np.full((W,W),-1e9)
        o = np.argsort(dep)
        for dx in (0,1):
            for dy in (0,1):
                xi = np.clip(x[o]+dx,0,W-1); yi = np.clip(y[o]+dy,0,W-1)
                img[yi,xi] = c[o]   # orden de menor a mayor profundidad: el más cercano pinta el último
        sheet.paste(Image.fromarray(img),(k*W, r*(W+14)))
        d.text((k*W+3, r*(W+14)+W+1), f'{s} {name}', fill='black')
sheet.save(sys.argv[3], quality=88)
