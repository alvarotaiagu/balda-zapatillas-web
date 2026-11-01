import numpy as np, sys, os, json
from PIL import Image, ImageDraw
work = sys.argv[1]
TOE = {'fila':[1,0,0],'asics':[0,0,1],'pegasus-trail':[-1,0,0],'reebok-nano':[0,0,1],'nb-997':[0,0,1],
       'converse':[-1,0,0],'ozweego':[1,0,0],'old-skool':[0,0,1],'xt6':[0,0,1]}
UP = {}
def load(s):
    a = np.fromfile(os.path.join(work,s+'.pts'),dtype=np.float32).reshape(-1,6); return a[:,:3].astype(float), np.clip(a[:,3:],0,255).astype(np.uint8)
# Racer: ejes principales
p,_ = load('racer-tr21'); q = p - p.mean(0); w,v = np.linalg.eigh(np.cov(q.T)); v = v[:, ::-1]
print('racer PCA', np.round(v.T,3), np.round(np.sqrt(w[::-1]),4))
racer_sign = [float(x) for x in sys.argv[2].split(',')] if len(sys.argv)>2 else [1,1]
TOE['racer-tr21'] = list(v[:,0]*racer_sign[0]); UP['racer-tr21'] = list(v[:,1]*racer_sign[1])
mats = {}
for s,toe in TOE.items():
    X = np.array(toe,float); X/=np.linalg.norm(X)
    Y = np.array(UP.get(s,[0,1,0]),float); Y -= X*np.dot(X,Y); Y/=np.linalg.norm(Y)
    Z = np.cross(X,Y)
    R = np.stack([X,Y,Z])            # filas: nuevos ejes en coordenadas originales
    mats[s] = R.tolist()
json.dump(mats, open(os.path.join(work,'rot.json'),'w'), indent=1)
order = ['fila','asics','pegasus-trail','reebok-nano','racer-tr21','nb-997','converse','ozweego','old-skool','xt6']
W=300; sheet = Image.new('RGB',(W*5,(W//2+14)*2*2),'white'); d=ImageDraw.Draw(sheet)
for i,s in enumerate(order):
    p,c = load(s); R=np.array(mats[s]); q = p@R.T
    lo,hi = q.min(0),q.max(0); span = hi[0]-lo[0]
    for k,sg in enumerate((1,-1)):   # vista desde +Z (la de la pared) y desde -Z
        x = (q[:,0]-lo[0])/span if sg>0 else (hi[0]-q[:,0])/span
        y = (q[:,1]-lo[1])/span
        img=np.full((W//2,W,3),235,np.uint8); o=np.argsort(q[:,2]*sg)
        xi=np.clip((x*(W-10)+5).astype(int),0,W-1); yi=np.clip((W//2-5-y*(W-10)).astype(int),0,W//2-1)
        for dx in (0,1):
            for dy in (0,1): img[np.clip(yi[o]+dy,0,W//2-1),np.clip(xi[o]+dx,0,W-1)]=c[o]
        r = (i//5)*2+k; sheet.paste(Image.fromarray(img),((i%5)*W, r*(W//2+14)))
        d.text(((i%5)*W+3, r*(W//2+14)+W//2+1), f'{s} {"PARED +Z" if sg>0 else "otro lado"}  h/l={(hi[1]-lo[1])/span:.2f}', fill='black')
sheet.save(os.path.join(work,'..','orientadas.jpg'),quality=88)
