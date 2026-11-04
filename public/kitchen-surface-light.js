// Fill-only overlays on the receiving faces. World coordinates keep the
// lighting attached to the cabinets when the camera turns or a run moves.
const n=v=>Number(v.toFixed(3));
const path=points=>'M'+points.map(p=>n(p.x)+' '+n(p.y)).join('L')+'Z';
const stop=(at,color,opacity)=>'<stop offset="'+at+'" stop-color="'+color+'" stop-opacity="'+opacity+'"/>';
const frontTags=new Set(['door-front','recessed-panel','open-hinged-door','open-hinged-panel','drawer-front','open-drawer-front','pullout-front','island-rear-finish','side','front-rail','fridge-door','freezer-door']);
const metalTags=new Set(['dishwasher-front','oven-control','sink-bowl','sink-rim','faucet','faucet-neck','mixer','control-strip','stainless-door-inset','fridge-door','freezer-door']);

export function roomSurfaceLight(P,g,building,prefix,defs){
  const H=g.room.height,units=new Map(g.units.map(u=>[u.id,u]));
  const roomBounds=building.outer.flatMap(p=>[P.project(p.x,0,p.z),P.project(p.x,H,p.z)]);
  const x=Math.floor(Math.min(...roomBounds.map(p=>p.x)))-40,y=Math.floor(Math.min(...roomBounds.map(p=>p.y)))-40;
  const w=Math.ceil(Math.max(...roomBounds.map(p=>p.x)))-x+40,h=Math.ceil(Math.max(...roomBounds.map(p=>p.y)))-y+40;
  function definition(key,draw){
    if(!defs.has(key)){const id=prefix+'-light-'+defs.size;defs.set(key,{id,html:draw(id)});}
    return 'url(#'+defs.get(key).id+')';
  }
  function gradient(id,a,b,stops){
    return '<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+n(a.x)+'" y1="'+n(a.y)+'" x2="'+n(b.x)+'" y2="'+n(b.y)+'">'+stops+'</linearGradient>';
  }
  const sky=stop(0,'#fffdf6',.18)+stop('.46','#fff',.025)+stop(1,'#645b51',.12);
  const satin=stop(0,'#fff',.16)+stop('.28','#f5f7f6',.02)+stop('.72','#4c5050',.02)+stop(1,'#3c4144',.16);
  const steel=stop(0,'#f9ffff',.58)+stop('.17','#4a5356',.16)+stop('.44','#eef1ef',.45)+stop('.68','#546265',.22)+stop(1,'#f1f3ef',.29);

  function receiver(floor,wall){
    return definition(floor?'floor-contact':'wall-contact-'+wall.id,id=>{
      const start=floor?P.project(0,H,0):P.project(wall.a.x,0,wall.a.z);
      const end=floor?P.project(g.room.width,H,g.room.length):P.project(wall.a.x,H,wall.a.z);
      const grad=id+'-daylight';let content=gradient(grad,start,end,sky)+'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="url(#'+grad+')"/>';
      const casters=g.units.filter(u=>floor?u.bottom<3:u.wall===wall.id&&u.bottom>25);
      const daylight=building.windows.find(win=>win.adjacent==='outdoors')?.inward||[.22,0,.75];
      for(const [spread,opacity] of [[1,.045],[.64,.07],[.33,.12],[.12,.16]]){
        const shapes=[];
        for(const u of casters){
          if(floor){
            const polygon=u.polygon;if(!polygon?.length)continue;
            const center=polygon.reduce((a,p)=>({x:a.x+p.x/polygon.length,z:a.z+p.z/polygon.length}),{x:0,z:0});
            const extension=spread*Math.min(16,u.height*.15);
            shapes.push(path(polygon.map(p=>{const dx=p.x-center.x,dz=p.z-center.z,d=Math.hypot(dx,dz)||1;
              return P.project(p.x+extension*(dx/d+daylight[0]*.6),H,p.z+extension*(dz/d+daylight[2]*.6));})));
          }else{
            const pad=spread*Math.min(17,u.depth*.5),lo=u.u-pad*.45,hi=u.u+u.width+pad*.45;
            const top=H-u.bottom-u.height,bottom=H-u.bottom+pad;
            shapes.push(path([[lo,top],[hi,top],[hi,bottom],[lo,bottom]].map(([station,height])=>P.project(wall.origin.x+station*wall.tangent.x,height,wall.origin.z+station*wall.tangent.z))));
          }
        }
        if(shapes.length)content+='<path d="'+shapes.join('')+'" fill="#302d29" opacity="'+opacity+'"/>';
      }
      return '<pattern id="'+id+'" data-room-light="'+(floor?'floor':'wall')+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" patternUnits="userSpaceOnUse" viewBox="'+[x,y,w,h].join(' ')+'">'+content+'</pattern>';
    });
  }
  return function light(f){
    if(f.tag==='finished-floor'||f.tag==='floor-tile'||f.tag==='floor-grout')return receiver(true);
    if(f.tag==='wall-plaster'||f.tag==='wall-cladding'||f.tag==='backsplash'){
      const wall=building.byId.get(f.wall);if(wall)return receiver(false,wall);
    }
    const u=units.get(f.id);
    if(!u||Math.abs(f.N.y)>.8||!frontTags.has(f.tag)&&!metalTags.has(f.tag))return null;
    const polished=metalTags.has(f.tag)&&!f.frontFinish&&!f.frontColor;
    return definition('skin-'+u.id+'-'+polished,id=>{
      const top=H-u.bottom-u.height,p=u.polygon?.[0]||u.rect;
      const a=P.project(p.x,top,p.z),b=P.project(p.x,top+u.height,p.z);
      return gradient(id,a,b,polished?steel:satin);
    });
  };
}
