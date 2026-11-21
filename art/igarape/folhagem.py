"""Original spray of leaves, painted at double resolution and reduced for WebGL."""
from pathlib import Path
from PIL import Image, ImageDraw
import random, math
rng=random.Random(12)
im=Image.new('RGBA',(512,512))
draw=ImageDraw.Draw(im)
def branch(x,y,a,length,depth):
    tip=(x+math.cos(a)*length,y+math.sin(a)*length)
    draw.line((x,y,*tip), fill=(115,106,76,255), width=max(2,depth*2))
    if depth:
        for k in range(1,5):
            t=k/5
            branch(x+(tip[0]-x)*t,y+(tip[1]-y)*t,a+(-1)**k*rng.uniform(.45,.85),length*.46,depth-1)
    else:
        for k in range(1,6):
            t=k/5
            px=x+(tip[0]-x)*t; py=y+(tip[1]-y)*t
            b=a+(-1)**k*.85; L=rng.uniform(15,30); w=L*.28
            dx,dy=math.cos(b),math.sin(b)
            g=rng.randint(132,205)
            mid=(px+dx*L*.48,py+dy*L*.48);end=(px+dx*L,py+dy*L)
            draw.polygon([(px,py),(mid[0]-dy*w,mid[1]+dx*w),end,mid],fill=(g-7,g+12,int(g*.72),255))
            draw.polygon([(px,py),(mid[0]+dy*w,mid[1]-dx*w),end,mid],fill=(g+14,g+24,int(g*.75),255))
for a in [-2.15,-1.78,-1.42,-1.05]:branch(251,479,a,270,2)
im.resize((256,256),Image.Resampling.LANCZOS).save(Path(__file__).with_name('folhagem.png'))
