import struct, json, sys, numpy as np, collections
def load(p):
    d=open(p,'rb').read(); off=12; js=b=None
    while off<len(d):
        cl,ct=struct.unpack('<II',d[off:off+8]); c=d[off+8:off+8+cl]
        if ct==0x4E4F534A: js=json.loads(c)
        elif ct==0x004E4942: b=c
        off+=8+cl
    return js,b
CT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def acc(j,b,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]
    n=NC[a['type']]; dt=CT[a['componentType']]; sz=np.dtype(dt).itemsize
    st=bv.get('byteStride',n*sz); off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    arr=np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=off,strides=(st,sz)) if st!=n*sz else np.frombuffer(b,dtype=dt,count=a['count']*n,offset=off).reshape(-1,n)
    return arr
def local(n):
    if 'matrix' in n: return np.array(n['matrix']).reshape(4,4).T
    T=np.eye(4)
    if 'scale' in n: T=np.diag(list(n['scale'])+[1])@T
    if 'rotation' in n:
        x,y,z,w=n['rotation']
        R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
        M=np.eye(4);M[:3,:3]=R;T=M@T
    if 'translation' in n:
        M=np.eye(4);M[:3,3]=n['translation'];T=M@T
    return T
def flatten(j,b):
    """returns list of dict(name,mat,pos(N,3),idx(M,3),uv)"""
    out=[]
    def walk(i,P):
        n=j['nodes'][i]; W=P@local(n)
        if 'mesh' in n:
            for pr in j['meshes'][n['mesh']]['primitives']:
                pos=acc(j,b,pr['attributes']['POSITION']).astype(np.float64)
                h=np.c_[pos,np.ones(len(pos))]@W.T
                idx=acc(j,b,pr['indices']).astype(np.int64).reshape(-1,3) if 'indices' in pr else np.arange(len(pos)).reshape(-1,3)
                nrm=acc(j,b,pr['attributes']['NORMAL']).astype(np.float64) if 'NORMAL' in pr['attributes'] else None
                if nrm is not None: nrm=nrm@np.linalg.inv(W[:3,:3]).T
                out.append(dict(name=n.get('name',''),mat=pr.get('material',-1),pos=h[:,:3],idx=idx,nrm=nrm))
        for c in n.get('children',[]): walk(c,W)
    for r in j['scenes'][j.get('scene',0)]['nodes']: walk(r,np.eye(4))
    return out
if __name__=='__main__':
    for p in sys.argv[1:]:
        j,b=load(p); prims=flatten(j,b)
        allp=np.vstack([q['pos'] for q in prims]); tri=sum(len(q['idx']) for q in prims)
        print('='*70);print(p.split('/')[-1]);print('prims',len(prims),'tris',tri,'verts',len(allp))
        print('bbox min',allp.min(0).round(3),'max',allp.max(0).round(3),'size',(allp.max(0)-allp.min(0)).round(3))
        bym=collections.defaultdict(lambda:[0,0]);
        for q in prims: bym[j['materials'][q['mat']]['name']][0]+=len(q['idx']);bym[j['materials'][q['mat']]['name']][1]+=1
        for k,v in bym.items(): print('  mat %-12s tris %6d prims %d'%(k,*v))
        nm=collections.Counter(q['name'].split('.')[0].rstrip('_0123456789') for q in prims)
        print('  names:',dict(nm.most_common(40)))
