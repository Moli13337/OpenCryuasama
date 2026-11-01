// Prevent accidental dragging/copying of game art; keep text-entry fields usable.
export function protectGameMedia(root=document){
 const editable=node=>Boolean(node?.closest?.('input,textarea,[contenteditable="true"]'));
 const stop=event=>{if(!editable(event.target))event.preventDefault();};
 for(const type of ['dragstart','selectstart','copy','cut','contextmenu'])root.addEventListener(type,stop,true);
 for(const image of root.querySelectorAll('img'))image.draggable=false;
 return ()=>{for(const type of ['dragstart','selectstart','copy','cut','contextmenu'])root.removeEventListener(type,stop,true);};
}
