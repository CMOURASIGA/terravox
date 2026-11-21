"""Blender 4.3: blender -b -P art/igarape/build.py (run at repository root).
Original TerraVox artwork. Blender X/right, Y/toward portal, Z/up. Units: metres.
"""
import bpy
import json
import math
import random
import sys
from pathlib import Path
from mathutils import Vector
from math import sin, cos, pi

out = Path.cwd() / 'public/assets/forest-v2'
rng = random.Random(49381)
TAU = 2*pi

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def linear(h):
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)

class Surface:
    def __init__(self):
        self.vertices=[]; self.faces=[]; self.colors=[]; self.groups={}
    def ring_mesh(self,rings,color,bone=None,close=True):
        start=len(self.vertices); n=len(rings[0])
        for ring in rings: self.vertices.extend(ring)
        color=linear(color)
        self.colors.extend([color]*(n*len(rings)))
        if bone: self.groups.setdefault(bone,[]).extend(range(start,len(self.vertices)))
        for j in range(len(rings)-1):
            for i in range(n):
                a=start+j*n+i; b=start+j*n+(i+1)%n
                self.faces.append((a,b,b+n,a+n))
        if close:
            self.faces.extend([tuple(reversed(range(start,start+n))),tuple(range(len(self.vertices)-n,len(self.vertices)))])
    def tube(self,points,radii,color,n=9,bone=None):
        rings=[]; points=list(map(Vector,points))
        for j,(p,r) in enumerate(zip(points,radii)):
            axis=(points[min(j+1,len(points)-1)]-points[max(0,j-1)]).normalized()
            ref=Vector((0,1,0)) if abs(axis.y)<.92 else Vector((1,0,0))
            u=axis.cross(ref).normalized(); v=axis.cross(u)
            rings.append([p+r*(u*cos(TAU*i/n)+v*sin(TAU*i/n)) for i in range(n)])
        self.ring_mesh(rings,color,bone)
    def bulb(self,p,size,color,bone=None,n=12):
        x,y,z=p; a,b,c=size
        rings=[]
        for j in range(8):
            lat=-pi*.499+pi*.998*j/7
            rings.append([(x+a*cos(lat)*cos(TAU*i/n),y+b*cos(lat)*sin(TAU*i/n),z+c*sin(lat)) for i in range(n)])
        self.ring_mesh(rings,color,bone)
    def object(self,name,smooth=True):
        mesh=bpy.data.meshes.new(name); mesh.from_pydata(self.vertices,[],self.faces); mesh.update()
        obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj)
        attr=mesh.color_attributes.new(name='Pigment',type='BYTE_COLOR',domain='POINT')
        attr.data.foreach_set('color',[v for color in self.colors for v in color])
        mat=bpy.data.materials.get('Pigment') or bpy.data.materials.new('Pigment')
        mat.use_nodes=True; nodes=mat.node_tree.nodes; bsdf=nodes.get('Principled BSDF')
        paint=nodes.get('Pigment') or nodes.new('ShaderNodeVertexColor'); paint.name='Pigment'; paint.layer_name='Pigment'
        mat.node_tree.links.new(paint.outputs['Color'],bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value=.82
        mesh.materials.append(mat)
        for face in mesh.polygons: face.use_smooth=smooth
        for bone,indices in self.groups.items(): obj.vertex_groups.new(name=bone).add(indices,1,'REPLACE')
        return obj

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(out/(name+'.glb')),export_format='GLB',export_yup=True,export_animation_mode='ACTIONS',export_force_sampling=True)

def height(x,y):
    bank=min(1,max(0,(abs(x)-4)/6))
    return bank*(1.2+.8*sin(.34*x+.12*y)+.6*cos(.31*y))

def trail(y): return 2.35*sin(y*.22)+1.1*sin(y*.34+.8)

def botanical_layers(crowns, ground):
    """Curved, intersecting leaf sprays retain parallax from both sides of the path."""
    rand=random.Random(4017)
    cards=Surface()
    uvs=[]
    def frond(p,angle,width,height,lean,tile,tint):
        right=Vector((cos(angle),sin(angle),0))
        forward=Vector((-sin(angle),cos(angle),0))
        base=len(cards.vertices)
        for v in (0,.5,1):
            for u in (0,.5,1):
                cards.vertices.append(p+right*(u-.5)*width+Vector((0,0,v*height))+
                                      forward*(lean*v*v+.16*width*sin(pi*u)*sin(pi*v)))
                cards.colors.append(linear(tint))
                uvs.append(((tile%2+.012+.976*u)/2,((1-tile//2)+.012+.976*v)/2))
        for row in (0,1):
            for col in (0,1):
                a=base+row*3+col;cards.faces.append((a,a+1,a+4,a+3))
    for j,((x,y,z),tint) in enumerate(crowns):
        tile=1 if tint in ['c17a95','a66891','d898a3'] else 0
        for k in range(8):
            a=TAU*k/8+rand.uniform(-.35,.35);r=rand.uniform(.35,2.)
            frond(Vector((x+r*cos(a),y+r*sin(a),z-rand.uniform(.8,1.6))),a,
                  rand.uniform(2.6,4.2),rand.uniform(2.0,3.6),rand.uniform(.25,1),tile,
                  rand.choice(['bac69d','d5d9b3','a4b799','c8ceaa']))
    for i,(x,y,z) in enumerate(ground):
        tile=3 if i%11==0 else 2
        for k in range(3 if tile==3 else 5):
            a=k*2.4+rand.uniform(-.6,.6)+i
            size=rand.uniform(.72,1.45)
            frond(Vector((x+.07*cos(a),y+.07*sin(a),z-.04)),a,
                  size*(.76 if tile==2 else .65),size*(.85 if tile==2 else 1.2),
                  size*(.74 if tile==2 else .22),tile,rand.choice(['d8dbb1','adb88e','c6cea6']))
    obj=cards.object('Dossel_e_subbosque')
    mesh=obj.data;uv=mesh.uv_layers.new(name='Botanica')
    for loop in mesh.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
    mat=bpy.data.materials.new('Botanica_recortada');mat.use_nodes=True
    mesh.materials[0]=mat
    tree=mat.node_tree; bsdf=tree.nodes.get('Principled BSDF')
    tex=tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(Path.cwd()/'art/igarape/botanica.png'))
    tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    clip=tree.nodes.new('ShaderNodeMath');clip.operation='GREATER_THAN';clip.inputs[1].default_value=.34
    tree.links.new(tex.outputs['Alpha'],clip.inputs[0]);tree.links.new(clip.outputs[0],bsdf.inputs['Alpha'])
    mat.use_backface_culling=False

def environment():
    reset(); s=Surface(); obstacles=[]; crowns=[]; ground=[]; vines=Surface(); ornaments=random.Random(29)
    # Ground strips share vertices and continuous pigment variation, including the footpath.
    for j in range(78):
        y=j-27
        for i in range(74):
            x=i-37
            col=rng.choice(['92754e','987f56','a48b60']) if abs(x+.5-trail(y))<2.3 else rng.choice(['426147','456449','48674a','45634a'])
            s.ring_mesh([[(a,b,height(a,b)) for a,b in [(x,y),(x+1,y),(x+1,y+1),(x,y+1)]]],col,close=False)
            k=len(s.vertices);s.faces.append((k-4,k-3,k-2,k-1))
    s.object('Terra_e_trilha')
    foliage=Surface(); bark=Surface(); stones=Surface(); understory=Surface()
    for i in range(85):
        x=rng.choice([-1,1])*rng.uniform(5.6,30); y=rng.uniform(-19,42)
        z=height(x,y)-.2; h=rng.uniform(6,15); r=h*.046
        obstacles.append([round(x,3),round(-y,3),round(r*1.6,3)])
        bend=rng.uniform(-1.8,1.8); crown=(x+bend,y,z+h)
        bark.tube([(x,y,z),(x+.2*bend,y,z+1),(x-.3*bend,y+.3,z+h*.46),crown],[r*1.9,r,r*.76,r*.35],'594e42')
        for k in range(4):
            a=k*TAU/4+rng.random(); dx,dy=cos(a),sin(a)
            bark.tube([(x+dx*2,y+dy*2,z),(x+dx*.7,y+dy*.7,z+.45),(x,y,z+2.3)],[.07,r*.55,r*.42],'665742',6)
            tip=(x+bend+dx*2.4,y+dy*2.4,z+h+rng.uniform(-1,1))
            bark.tube([(x,y,z+h*.55),(x+dx*1.4,y+dy*1.4,z+h*.78),tip],[r*.58,r*.38,.09],'675a46',7)
            tint=rng.choice(['35674f','508052','618955','46794e','778d50'])
            if i%9==2:tint=ornaments.choice(['c17a95','a66891','d898a3'])
            if i%13==4:tint=ornaments.choice(['b99955','c89e4e'])
            crowns.append((tip,tint))
            if k%2==0:
                tx,ty,tz=tip
                vines.tube([(tx,ty,tz),(tx+.22,ty,tz-1.5),(tx+.13,ty-.12,tz-2.5),(tx-.2,ty,tz-3.3)],[.06,.055,.037,.009],'496044',5)
    for i in range(620):
        y=rng.uniform(-19,36);x=rng.choice([-1,1])*rng.uniform(3.8,23);z=height(x,y)
        if i%4==0:
            r=rng.uniform(.3,1.35);obstacles.append([round(x,3),round(-y,3),round(r*.85,3)]);stones.bulb((x,y,z+.16*r),(r,r*.72,r*.58),'647668',n=8)
        else:
            ground.append((x,y,z))
    # Understory skirts follow the meander, with room around the player spawn and gate.
    for i in range(145):
        y=ornaments.uniform(-17,35);x=trail(y)+ornaments.choice([-1,1])*ornaments.uniform(2.25,4.6)
        if abs(y-24)>2.8:ground.append((x,y,height(x,y)))
    botanical_layers(crowns,ground);vines.object('Cipos')
    bark.object('Troncos_e_sapopemas');stones.object('Seixos')
    export('environment')
    obstacles.extend([[-2.25,-24,.7],[2.25,-24,.7]])
    Path('src/lib/forest-obstacles.json').write_text(json.dumps(obstacles,separators=(',',':'))+'\n')

def portal():
    reset();s=Surface(); vines=Surface()
    for j in range(21):
        a=-.34*pi+j*(1.68*pi/21); b=a+1.64*pi/21
        pts=[(2.6*cos(t),0,2.15+2.65*sin(t)) for t in [a,(a+b)/2,b]]
        s.tube(pts,[.47,.51,.48],'687969' if j%3 else '87947c',7)
        vines.tube([(x,-.44,z) for x,y,z in pts],[.048,.065,.05],'e4be69',6)
    for side in [-1,1]:
        for j in range(5):
            x=side*(2.1+.23*j);s.bulb((x,0,.12),(.75,.7,.48),'63755f')
    s.object('Cantaria');vines.object('Incrustacoes_de_ouro');export('portal')

def spirit():
    reset();s=Surface()
    def feather(surface,root,tip,width,color):
        root=Vector(root);tip=Vector(tip);axis=tip-root
        lateral=Vector((-axis.y,axis.x,0)).normalized()
        if lateral.length<.001:lateral=Vector((1,0,0))
        rings=[]
        for t in [0,.2,.47,.72,.91,1]:
            mid=root+axis*t+Vector((0,0,.033*sin(pi*t)))
            w=width*(.015+sin(pi*t)**.72)
            rings.append([mid+lateral*w,mid+Vector((0,0,w*.28)),mid-lateral*w,mid-Vector((0,0,w*.12))])
        surface.ring_mesh(rings,color)
    s.bulb((0,.015,.01),(.14,.28,.125),'247f80',n=22)
    s.bulb((0,-.16,.093),(.126,.13,.128),'348f86',n=22)
    s.bulb((0,-.2,.044),(.10,.11,.083),'61bda5',n=18)
    s.tube([(0,-.268,.095),(0,-.39,.115),(0,-.57,.12)],[.028,.016,.001],'483b37',12)
    for side in [-1,1]:
        s.bulb((side*.100,-.219,.121),(.028,.034,.029),'162d36',n=16)
        s.bulb((side*.123,-.232,.135),(.008,.01,.008),'fff4c9')
        for k in range(5):
            feather(s,(side*.026,-.04,.12),(side*(.06+.02*k),.24-.035*k,.06),.034,'437d83')
        feather(s,(side*.029,.20,.02),(side*.105,.53,-.105),.046,'226477')
        feather(s,(side*.018,.20,.02),(side*.049,.59,-.12),.034,'579e94')
    s.object('Beija_luz')
    for side in [-1,1]:
        w=Surface()
        for k in range(9):
            feather(w,(0,.006*k,0),(side*(.49-.029*k),.10+.031*k,.118-.013*k),
                    .037,['357987','3d8793','469caa','70b7b0'][k%4])
        obj=w.object('Asa');obj.location=(side*.087,-.026,.089);obj.rotation_mode='XYZ'
        for frame,angle in [(1,-.7),(4,.9),(7,-.7)]:
            obj.rotation_euler.y=side*angle;obj.keyframe_insert(data_path='rotation_euler',frame=frame)
        action=obj.animation_data.action;track=obj.animation_data.nla_tracks.new();track.name='idle';track.strips.new('idle',1,action);obj.animation_data.action=None
    bpy.ops.export_scene.gltf(filepath=str(out/'spirit.glb'),export_animation_mode='NLA_TRACKS')

def explorer():
    reset(); s=Surface(); bones={'Torso':((0,0,.94),(0,0,1.54),None),'Head':((0,0,1.54),(0,0,1.98),'Torso')}
    def garment(levels, color, bone='Torso', folds=.015, count=48):
        rings=[]
        for z,w,d,offset in levels:
            ring=[]
            for i in range(count):
                a=TAU*i/count
                pleat=1+folds*(sin(7*a+.6*z)+.45*cos(13*a))
                ring.append((w*pleat*cos(a),offset+d*pleat*sin(a),z))
            rings.append(ring)
        s.ring_mesh(rings,color,bone)
    # Fine rings let the forehead, cheekbones, bridge and lips turn in profile.
    profile=[(1.475,.038,.063),(1.51,.102,.111),(1.56,.14,.142),
             (1.62,.173,.16),(1.69,.187,.167),(1.77,.184,.168),
             (1.84,.165,.15),(1.9,.11,.11),(1.929,.004,.006)]
    rings=[]
    for j in range(65):
        z=1.475+.454*j/64
        k=next((i for i in range(1,len(profile)) if profile[i][0]>=z),len(profile)-1)
        lo,hi=profile[k-1],profile[k];t=(z-lo[0])/(hi[0]-lo[0])
        w=lo[1]*(1-t)+hi[1]*t;depth=lo[2]*(1-t)+hi[2]*t
        ring=[]
        for i in range(80):
            a=TAU*i/80;x=w*cos(a);front=max(0,-sin(a))
            nose=.038*math.exp(-(x/.031)**2-((z-1.65)/.052)**2)
            lips=.012*math.exp(-(x/.051)**2-((z-1.585)/.014)**2)
            ring.append((x,depth*sin(a)-(nose+lips)*front,z))
        rings.append(ring)
    s.ring_mesh(rings,'ffffff','Head');face_end=len(s.faces)
    s.tube([(0,0,1.34),(0,0,1.55)],[.077,.065],'af765f',16,'Torso')
    for side in [-1,1]:
        s.bulb((side*.181,.003,1.657),(.028,.032,.052),'b78470','Head',16)
        s.bulb((side*.19,.004,1.608),(.014,.012,.021),'dfad5e','Head')
    # Hair shell wraps the back and sweeps down to the nape. The painted
    # hairline at the forehead and the strands at the temples meet this shell.
    hair=[]
    for j in range(18):
        row=[]
        for i in range(64):
            a=TAU*i/64;bottom=.12+.83*max(0,-sin(a))+.10*cos(a)
            lat=bottom+(pi/2-bottom)*j/18
            row.append((.204*cos(lat)*cos(a),.019+.177*cos(lat)*sin(a),1.681+.269*sin(lat)))
        hair.append(row)
    s.ring_mesh(hair,'413332','Head')
    for i in range(22):
        a=.10+i*pi/23;points=[]
        for j in range(9):
            t=j/8;lat=1.38-(1.48+.32*sin(a))*t
            phi=a+.25*sin(pi*t)
            points.append((.201*cos(lat)*cos(phi),.023+.184*cos(lat)*sin(phi),1.68+.269*sin(lat)))
        s.tube(points,[.014,.019,.026,.029,.03,.029,.025,.021,.008],
               ['493837','5b423b','3c3032'][i%3],9,'Head')
    for i in range(7):
        x=.128+.021*sin(i*2.5);y=.143+.014*i;z=1.72-.056*i
        s.bulb((x,y,z),(.066-.004*i,.064-.004*i,.07),'493439' if i%2 else '593e40','Head',15)
    s.bulb((.119,.223,1.372),(.039,.038,.019),'e4b35f','Head',14)
    garment([(.725,.287,.193,0),(.76,.281,.19,0),(.87,.252,.174,0),
             (.94,.204,.151,0),(1.07,.155,.116,0),(1.22,.20,.134,0),
             (1.33,.203,.119,0),(1.375,.093,.075,0)],'917051',folds=.024)
    garment([(.724,.293,.198,0),(.741,.291,.197,0)],'bf945b',folds=.024)
    garment([(.904,.236,.172,0),(.947,.218,.163,0)],'643e2e',folds=.008)
    # Linen mantle follows the shoulders, alternating woven bands at the hem.
    cloak_start=len(s.faces)
    cape=[]
    for j in range(15):
        v=j/14;row=[]
        for i in range(64):
            a=TAU*i/64
            back=(1+sin(a))/2
            hem=1.12-.43*back-.05*cos(a)+.025*sin(6*a)
            z=hem+(1.43-hem)*v
            pleat=.018*sin(9*a+.65*v)*(1-v)
            width=.105+.246*(1-v**4)+pleat
            depth=.091+(.132+.078*back)*(1-v**3)+pleat
            row.append((width*cos(a),.018+depth*sin(a),z))
        cape.append(row)
    s.ring_mesh(cape,'ffffff','Torso')
    cloak_end=len(s.faces)
    garment([(1.374,.157,.13,.008),(1.397,.139,.121,.008),
             (1.433,.114,.103,.008),(1.449,.095,.087,.008)],'456960',folds=.02)
    s.tube([(-.158,-.11,1.36),(0,-.158,1.19),(.17,-.099,.97),(.17,.109,.96),
            (0,.211,1.17),(-.16,.141,1.36)],[.023]*6,'79472e',10,'Torso')
    s.bulb((.17,.08,.935),(.111,.071,.113),'965d3c','Torso',18)
    s.bulb((.177,.138,.959),(.102,.028,.055),'bc8651','Torso',18)
    # Rolled maps and a brass compass worn on the hip.
    for i in range(2):
        s.tube([(.14+i*.038,.13,.94),(.20+i*.035,.15,1.085)],[.02,.02],'ddbc88',10,'Torso')
    s.bulb((.173,.16,.934),(.033,.012,.034),'e8bd71','Torso',18)
    for side,suffix in [(-1,'L'),(1,'R')]:
        arm='Arm'+suffix;leg='Leg'+suffix;shin='Shin'+suffix;x=.126*side
        bones[arm]=((side*.255,0,1.36),(side*.30,0,.94),'Torso')
        bones[leg]=((x,0,.96),(x,0,.56),'Torso');bones[shin]=((x,0,.56),(x,0,.14),leg)
        s.tube([(x,0,.96),(x,0,.75),(x,0,.53)],[.116,.106,.086],'35444c',10,leg)
        s.tube([(x,0,.56),(x,.015,.34),(x,0,.13)],[.093,.114,.09],'704634',10,shin)
        s.bulb((x,-.054,.105),(.125,.187,.104),'583d35',shin)
        s.bulb((side*.24,.002,1.313),(.086,.095,.082),'47716b',arm,18)
        s.tube([(side*.24,0,1.327),(side*.293,.003,1.22),(side*.304,.006,1.126),
                (side*.30,-.03,1.025)],[.085,.079,.066,.048],'51746c',16,arm)
        s.tube([(side*.304,.005,1.13),(side*.301,-.031,1.012)],[.069,.052],'6e4c3d',16,arm)
        for h in range(3):
            z=1.032+.031*h
            s.tube([(side*.303,-.02+.007*h,z),(side*.303,-.02+.007*h,z+.007)],
                   [.056+.005*h,.057+.005*h],'bc9a69',14,arm)
        s.bulb((side*.31,-.025,.964),(.050,.045,.067),'af7359',arm,16)
        for j in range(4):
            s.bulb((side*(.273+j*.021),-.038,.906),(.012,.021,.031),'b87b60',arm)
        s.tube([(x,.011,.38),(x,0,.41)],[.113,.114],'c5945c',12,shin)
    model=s.object('Cartografa_Iara')
    uv=model.data.uv_layers.new(name='Cartografia')
    for material_name,filename in [('Face','rosto.jpg'),('Manto','tecido.jpg')]:
        mat=bpy.data.materials.new(material_name);mat.use_nodes=True
        tex=mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image=bpy.data.images.load(str(Path.cwd()/'art/igarape'/filename))
        mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
        mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.85
        model.data.materials.append(mat)
    for poly in model.data.polygons:
        is_face=poly.index<face_end
        is_cape=cloak_start<=poly.index<cloak_end
        if not is_face and not is_cape:continue
        poly.material_index=1 if is_face else 2
        for li in poly.loop_indices:
            vi=model.data.loops[li].vertex_index
            x,y,z=model.data.vertices[vi].co
            if is_face:
                uv.data[li].uv=(.5+x/.43,(z-1.473)/.461)
            else:
                # Planar repeats on both panels avoid a visible seam across the back.
                a=math.atan2((y-.018)/.19,x/.31);back=(1+sin(a))/2
                hem=1.12-.43*back-.05*cos(a)+.025*sin(6*a)
                uv.data[li].uv=(.5+x/.74,max(0,min(1,(z-hem)/(1.43-hem))))
    armature=bpy.data.armatures.new('Esqueleto'); rig=bpy.data.objects.new('Iara',armature);bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
    for name,(head,tail,parent) in bones.items():
        b=armature.edit_bones.new(name);b.head=head;b.tail=tail
        if parent:b.parent=armature.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');model.parent=rig;mod=model.modifiers.new('Esqueleto','ARMATURE');mod.object=rig
    rig.animation_data_create()
    for clip,length,stride in [('Idle',48,0),('Walking',24,.53),('Run',16,.89),('Turn',18,0),('Interact',30,0)]:
        action=bpy.data.actions.new(clip);rig.animation_data.action=action
        for i in range(9):
            phase=i*pi/4; frame=1+round(length*i/8)
            for name in bones:
                p=rig.pose.bones[name];p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
                wave=sin(phase)*(1 if name.endswith('L') else -1)
                if name.startswith('Leg'):p.rotation_euler.x=wave*stride
                if name.startswith('Shin'):p.rotation_euler.x=-max(0,wave)*stride*.82
                if name.startswith('Arm'):p.rotation_euler.x=-wave*stride*.85
                if name=='ArmR' and clip=='Interact':p.rotation_euler.x=-1.25*sin(phase/2)
                if name=='Head':p.rotation_euler.y=(.51 if clip=='Turn' else .035)*sin(phase)
                if name=='Torso':p.location.y=.014*(1-cos(phase*(2 if stride else 1)))
                p.keyframe_insert(data_path='rotation_euler',frame=frame)
                if name=='Torso':p.keyframe_insert(data_path='location',frame=frame)
        track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
    rig.animation_data.action=None;export('explorer')

builders={'environment':environment,'portal':portal,'spirit':spirit,'explorer':explorer}
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else builders
for asset in selected:
    builders[asset]()
