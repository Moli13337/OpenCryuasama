// Inspect two known opaque texels infrequently, never a full-board readback.
// Some mobile WebKit failures leave valid contexts with empty cached artwork.
export function createSurfaceHealth({interval=1200}={}){
 let next=0;
 return {
  due(now){return now>=next;},
  check(now,probes,rebuild){
   if(now<next)return false;next=now+interval;
   for(const {context,x,y} of probes){
    if(!context?.getImageData||context.isContextLost?.())continue;
    try{
     if(context.getImageData(Math.floor(x),Math.floor(y),1,1).data[3]===0){rebuild();return true;}
    }catch{/* Context restoration owns unreadable surfaces. */}
   }
   return false;
  },
  reset(){next=0;}
 };
}
