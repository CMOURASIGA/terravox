"""Blender 4.3: blender -b -P art/igarape/build.py (run at repository root).
Original TerraVox artwork. Blender X/right, Y/toward portal, Z/up. Units: metres.
"""
import bpy
import json
import math
import random
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

def trail(y): return 1.4*sin(y*.18)

def leaf_sprays(crowns):
    leaves=Surface(); rand=random.Random(474); uv=[(0,0),(1,0),(1,1),(0,1)]
    for (x,y,z),tint in crowns:
        for i in range(15):
            a=TAU*i/15+rand.uniform(-.2,.2); dx,dy=cos(a),sin(a)
            r=rand.uniform(1.6,2.6); h=z+rand.uniform(-.9,.85); w=rand.uniform(.64,1.25)
            p=Vector((x+r*dx,y+r*dy,h)); right=Vector((-dy*w,dx*w,0))
            top=Vector((dx*.65,dy*.65,rand.uniform(.75,1.5)))
            start=len(leaves.vertices)
            leaves.vertices.extend([p-right,p+right,p+right+top,p-right+top])
            leaves.faces.append(tuple(start+k for k in range(4)))
            leaves.colors.extend([linear(tint)]*4)
    obj=leaves.object('Ramos_de_folhas')
    mesh=obj.data; layer=mesh.uv_layers.new(name='Folhas')
    for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index%4]
    mat=obj.data.materials[0].copy();mat.name='Folhas_recortadas';obj.data.materials[0]=mat
    tree=mat.node_tree; shader=tree.nodes.get('Principled BSDF'); tex=tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(Path.cwd()/'art/igarape/folhagem.png'))
    mix=tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1
    tree.links.new(tree.nodes['Pigment'].outputs['Color'],mix.inputs[1]);tree.links.new(tex.outputs['Color'],mix.inputs[2])
    tree.links.new(mix.outputs[0],shader.inputs['Base Color'])
    clip=tree.nodes.new('ShaderNodeMath');clip.operation='GREATER_THAN';clip.inputs[1].default_value=.42
    tree.links.new(tex.outputs['Alpha'],clip.inputs[0]);tree.links.new(clip.outputs[0],shader.inputs['Alpha'])
    mat.use_backface_culling=False

def environment():
    reset(); s=Surface(); obstacles=[]; crowns=[]; vines=Surface(); ornaments=random.Random(29)
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
            foliage.bulb(tip,(2.8,2.5,1.35),tint,n=9);crowns.append((tip,tint))
            if k%2==0:
                tx,ty,tz=tip
                vines.tube([(tx,ty,tz),(tx+.22,ty,tz-1.5),(tx+.13,ty-.12,tz-2.5),(tx-.2,ty,tz-3.3)],[.06,.055,.037,.009],'496044',5)
    for i in range(620):
        y=rng.uniform(-19,36);x=rng.choice([-1,1])*rng.uniform(3.8,23);z=height(x,y)
        if i%4==0:
            r=rng.uniform(.3,1.35);obstacles.append([round(x,3),round(-y,3),round(r*.85,3)]);stones.bulb((x,y,z+.16*r),(r,r*.72,r*.58),'647668',n=8)
        else:
            for j in range(6):
                a=j*TAU/6+i; L=rng.uniform(.5,1.4);dx,dy=cos(a),sin(a);w=.14*L
                pts=[(x,y,z),(x+dx*.52*L-dy*w,y+dy*.52*L+dx*w,z+.55*L),(x+dx*L,y+dy*L,z+.38*L),(x+dx*.52*L+dy*w,y+dy*.52*L-dx*w,z+.55*L),(x+dx*.52*L,y+dy*.52*L,z+.64*L)]
                start=len(understory.vertices);understory.vertices.extend(pts);understory.colors.extend([linear(rng.choice(['568052','75a05c','398669','809652']))]*5)
                for k in range(4):understory.faces.append((start+(k+1)%4,start+k,start+4))
    leaf_sprays(crowns); vines.object('Cipos');bark.object('Troncos_e_sapopemas');foliage.object('Copas');stones.object('Seixos');understory.object('Bromelias')
    hills=Surface()
    for i in range(16):
        hills.bulb((i*8-61,46+rng.uniform(0,8),-2),(9,9,rng.uniform(6,17)),rng.choice(['466a69','557677','647f74']),n=10)
    hills.object('Serra_azul');export('environment')
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
    s.bulb((0,0,0),(.24,.43,.23),'70dacc');s.bulb((0,-.29,.17),(.23,.24,.23),'a5f3ce')
    s.tube([(0,-.43,.15),(0,-.74,.14)],[.09,.008],'d3a956')
    for x in [-.15,.15]:s.bulb((x,-.445,.2),(.042,.036,.047),'192e35')
    body=s.object('Beija_luz')
    for side in [-1,1]:
        w=Surface()
        for k in range(5):
            w.tube([(0,0,0),(side*(.26+k*.04),.09*k,.15),(side*(.67-k*.045),.13*k,.28)],[.075,.105,.006],['348b92','43ada6','6dccc2','92e3c8','e9c773'][k])
        obj=w.object('Asa');obj.location=(side*.15,0,.09);obj.rotation_mode='XYZ'
        for frame,angle in [(1,-.49),(5,.75),(9,-.49)]:
            obj.rotation_euler.y=side*angle;obj.keyframe_insert(data_path='rotation_euler',frame=frame)
        action=obj.animation_data.action;track=obj.animation_data.nla_tracks.new();track.name='idle';track.strips.new('idle',1,action);obj.animation_data.action=None
    bpy.ops.export_scene.gltf(filepath=str(out/'spirit.glb'),export_animation_mode='NLA_TRACKS')

def explorer():
    reset(); s=Surface(); bones={'Torso':((0,0,.94),(0,0,1.54),None),'Head':((0,0,1.54),(0,0,1.98),'Torso')}
    s.bulb((0,0,1.17),(.27,.18,.34),'316d70','Torso')
    s.bulb((0,0,1.69),(.255,.22,.285),'a46a4f','Head')
    s.bulb((0,.055,1.78),(.276,.228,.23),'352e34','Head')
    for side in [-1,1]:
        s.bulb((side*.097,-.196,1.7),(.034,.021,.042),'302e32','Head')
        s.bulb((side*.098,-.213,1.71),(.01,.009,.011),'f6dab2','Head')
    # Expedition hood, brim, contrasting band and a curved plume.
    s.bulb((0,.025,1.94),(.31,.27,.18),'377c7a','Head')
    s.bulb((0,-.015,1.90),(.42,.36,.049),'d7aa63','Head')
    s.tube([(.19,.06,1.98),(.30,.08,2.16),(.34,.12,2.29)],[.065,.067,.004],'ea9161',8,'Head')
    for j,(z,r,col) in enumerate([(1.35,.31,'bd663d'),(1.31,.335,'e6ad62'),(1.28,.347,'934933')]):
        s.bulb((0,0,z),(r,.21,.085),col,'Torso')
    s.bulb((0,.195,1.15),(.215,.124,.24),'7d5039','Torso')
    s.bulb((0,.28,1.25),(.214,.075,.123),'c48a50','Torso')
    s.bulb((0,.349,1.2),(.038,.012,.043),'e7c679','Torso')
    for side,suffix in [(-1,'L'),(1,'R')]:
        arm='Arm'+suffix;leg='Leg'+suffix;shin='Shin'+suffix;x=.142*side
        bones[arm]=((side*.255,0,1.36),(side*.30,0,.94),'Torso')
        bones[leg]=((x,0,.96),(x,0,.56),'Torso');bones[shin]=((x,0,.56),(x,0,.14),leg)
        s.tube([(x,0,.96),(x,0,.75),(x,0,.53)],[.133,.122,.095],'36485a',10,leg)
        s.tube([(x,0,.56),(x,.015,.34),(x,0,.13)],[.093,.114,.09],'704634',10,shin)
        s.bulb((x,-.054,.105),(.125,.187,.104),'583d35',shin)
        s.tube([(side*.25,0,1.37),(side*.32,0,1.16),(side*.31,-.01,1.00)],[.11,.089,.068],'357574',10,arm)
        s.bulb((side*.31,-.01,.96),(.077,.076,.101),'ac7152',arm)
    model=s.object('Cartografa_Iara')
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

environment();portal();spirit();explorer()
