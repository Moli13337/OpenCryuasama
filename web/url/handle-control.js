/** Pointer capture keeps the handle held while dragging outside its small hit area. */
export function bindHandle(handle,{getPower,setPower,setFiring,unlock=()=>{},canStart=()=>true,travel=()=>180,onCaptureLost=()=>{}}={}){
  let pointer=null,originY=0,originPower=0,dragDistance=180;
  const release=reason=>{
    if(pointer===null)return;
    const id=pointer;pointer=null;
    handle.classList.remove('dragging');
    if(typeof id==='number'&&handle.hasPointerCapture?.(id))handle.releasePointerCapture(id);
    setFiring(false,reason);
  };
  handle.addEventListener('pointerdown',event=>{
    if(pointer!==null||event.button!==0||!canStart())return;
    event.preventDefault();pointer=event.pointerId;originY=event.clientY;originPower=getPower();
    dragDistance=Math.max(80,travel());handle.setPointerCapture(pointer);
    handle.classList.add('dragging');unlock();setFiring(true,'handle-down');
  });
  const move=event=>{
    if(pointer!==event.pointerId)return;
    if(event.pointerType==='mouse'&&event.buttons===0){release('handle-release');return;}
    event.preventDefault();
    setPower(Math.round(Math.max(0,Math.min(100,originPower+(originY-event.clientY)*100/dragDistance))));
  };
  handle.addEventListener('pointermove',move);
  for(const target of new Set([handle,handle.ownerDocument].filter(Boolean))){
    if(target!==handle)target.addEventListener('pointermove',move);
    for(const eventName of ['pointerup','pointercancel'])target.addEventListener(eventName,event=>{
      if(pointer===event.pointerId)release(`handle-${eventName}`);
    });
  }
  // Capture can move during an embedded-browser focus/compositor change.
  // That alone is not a physical release: document events finish the gesture.
  handle.addEventListener('lostpointercapture',event=>{if(pointer===event.pointerId)onCaptureLost();});
  handle.addEventListener('contextmenu',event=>event.preventDefault());
  handle.addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();setPower(Math.max(0,Math.min(100,getPower()+(event.key==='ArrowUp'?5:-5))));}
    if((event.key===' '||event.key==='Enter')&&!event.repeat&&pointer===null&&canStart()){
      event.preventDefault();pointer='keyboard';handle.classList.add('dragging');unlock();setFiring(true,'handle-keydown');
    }
  });
  handle.addEventListener('keyup',event=>{if((event.key===' '||event.key==='Enter')&&pointer==='keyboard'){event.preventDefault();release('handle-keyup');}});
  handle.addEventListener('blur',()=>{if(pointer==='keyboard')release('handle-keyblur');});
  return {release,get held(){return pointer!==null;}};
}
