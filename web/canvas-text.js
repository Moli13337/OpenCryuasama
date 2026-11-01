// Rasterize stable labels outside the live board context. Assigning canvas.font
// on the attached board can synchronously flush inherited DOM styles each frame.
export function createCanvasTextCache({limit=96,makeCanvas=()=>typeof OffscreenCanvas==='function'?new OffscreenCanvas(1,1):document.createElement('canvas')}={}){
  const sprites=new Map();
  function draw(context,text,x,y,{font='20px sans-serif',fill='#e9ddbf',stroke='',lineWidth=0}={}){
    text=String(text);const key=JSON.stringify([text,font,fill,stroke,lineWidth]);
    let entry=sprites.get(key);
    if(!entry){
      const canvas=makeCanvas(),ctx=canvas.getContext('2d');
      if(!ctx)return;
      ctx.font=font;ctx.textAlign='center';
      const metrics=ctx.measureText(text),size=Number(font.match(/([\d.]+)px/)?.[1])||20,pad=Math.ceil(lineWidth+3);
      const left=Math.max(metrics.width/2,metrics.actualBoundingBoxLeft||0),right=Math.max(metrics.width/2,metrics.actualBoundingBoxRight||0);
      const ascent=Math.ceil(Math.max(size,metrics.actualBoundingBoxAscent||0)),descent=Math.ceil(Math.max(size*.4,metrics.actualBoundingBoxDescent||0));
      canvas.width=Math.max(1,Math.ceil(left+right+pad*2));canvas.height=ascent+descent+pad*2;
      const anchor=left+pad,baseline=ascent+pad;
      ctx.font=font;ctx.textAlign='center';ctx.textBaseline='alphabetic';
      if(stroke&&lineWidth){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.strokeText(text,anchor,baseline);}
      ctx.fillStyle=fill;ctx.fillText(text,anchor,baseline);
      entry={canvas,anchor,baseline};sprites.set(key,entry);
      if(sprites.size>limit){const oldest=sprites.keys().next().value,old=sprites.get(oldest);sprites.delete(oldest);old.canvas.width=old.canvas.height=1;}
    }else{sprites.delete(key);sprites.set(key,entry);}
    context.drawImage(entry.canvas,x-entry.anchor,y-entry.baseline);
  }
  return {draw,get size(){return sprites.size;},clear(){for(const {canvas} of sprites.values())canvas.width=canvas.height=1;sprites.clear();}};
}
