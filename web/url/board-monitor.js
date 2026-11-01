import {CABINET_WINDOW} from './cabinet-skin.js';

// Intersect the playfield outline with the cabinet opening, so expanded scenes
// cover the pins without covering the header, edge materials or handle panel.
export function boardMonitorWindow(data){
 const b=CABINET_WINDOW;
 let polygon=data.playfield.outline.map(point=>({...point}));
 for(const [axis,edge,sign] of [['x',b.x,1],['x',b.x+b.width,-1],['y',b.y,1],['y',b.y+b.height,-1]]){
   const input=polygon;polygon=[];
   for(let i=0;i<input.length;i++){
     const current=input[i],previous=input[(i+input.length-1)%input.length];
     const inside=(current[axis]-edge)*sign>=0,wasInside=(previous[axis]-edge)*sign>=0;
     if(inside!==wasInside){const t=(edge-previous[axis])/(current[axis]-previous[axis]);polygon.push({x:previous.x+(current.x-previous.x)*t,y:previous.y+(current.y-previous.y)*t});}
     if(inside)polygon.push(current);
   }
 }
 return {...b,polygon,clip:`polygon(${polygon.map(p=>`${(p.x-b.x)/b.width*100}% ${(p.y-b.y)/b.height*100}%`).join(',')})`};
}
