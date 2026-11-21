"""Bake the trail, scattered leaves and canopy shade in metre coordinates."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
N=1536
rng=np.random.default_rng(3171)
def field(size):
    base=Image.fromarray(rng.integers(0,256,(size,size),dtype='uint8'))
    return np.asarray(base.resize((N,N),Image.Resampling.BICUBIC),dtype='float32')/255
x=np.linspace(-37,37,N,dtype='float32')[None,:]
z=np.linspace(-51,27,N,dtype='float32')[:,None]
fine=field(450); broad=field(37); spots=field(160)
edge=abs(x+2.35*np.sin(z*.22)-1.1*np.sin(-z*.34+.8))+.65*(spots-.5)+.65*(broad-.5)
blend=np.clip((2.6-edge)/.9,0,1)[...,None]
earth=np.array([153,116,78],dtype='float32')
grass=np.array([74,98,64],dtype='float32')
color=(grass+(earth-grass)*blend)*(.77+.22*broad+.23*fine+.10*spots)[...,None]
shade=Image.new('L',(N,N),255);d=ImageDraw.Draw(shade)
def pixel(x,z):return (int((x+37)*N/74),int((z+51)*N/78))
for cx,cz,r in json.loads(Path('src/lib/forest-obstacles.json').read_text())[:85]:
    u,v=pixel(cx,cz);end=pixel(cx+4.5,cz+2.6)
    d.line((u,v,*end),fill=162,width=int(r*N/65))
    for k in range(6):
        dx,dy=rng.normal(0,18,2);u=end[0]+dx;v=end[1]+dy
        d.ellipse((u-24,v-13,u+24,v+13),fill=185)
shadow=np.asarray(shade.filter(ImageFilter.GaussianBlur(3)),dtype='float32')/255
color*= (.36+.64*shadow*(.89+.11*spots))[...,None]
im=Image.fromarray(np.clip(color,0,255).astype('uint8'))
d=ImageDraw.Draw(im,'RGBA')
for i in range(18000):
    u,v=rng.integers(0,N,2);a=rng.uniform(0,6.28);l=rng.uniform(1.2,4)
    dx,dy=np.cos(a)*l,np.sin(a)*l
    d.polygon([(u-dx,v-dy),(u-dy*.36,v+dx*.36),(u+dx,v+dy),(u+dy*.36,v-dx*.36)],fill=(169,145,86,95))
im.save('public/assets/forest-v2/solo.webp',quality=87)
