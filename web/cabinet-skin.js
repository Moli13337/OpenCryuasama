// Material masks are baked before distribution. Runtime only selects URLs;
// no source decode, ImageData arrays, scratch canvases, or data URLs are built.
import {CABINET_SKIN_ASSETS} from './cabinet-skin-assets-v42.js';
export const CABINET_WINDOW=Object.freeze({x:64,y:260,width:896,height:1060});
let skinPromise;

// Kept as the build/test sizing contract; runtime assets already have this size.
export function cabinetTextureSize(width,height,lowLoad=false){
  const scale=lowLoad?Math.min(1,512/width):1;
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export function loadCabinetSkin(){
  const preset=globalThis.document?.documentElement?.dataset.qualityPreset==='light'?'light':'auto';
  if(!skinPromise){
    const source=CABINET_SKIN_ASSETS[preset];
    // Low-load CSS omits these recolor overlays. Remove their URL references
    // before the host pre-decodes every piece, so hidden masks cost no fetch,
    // decoded bitmap, SVG image, or mask surface. Preserve the painted bases
    // and exact geometry; the independent sharp lamp cores remain in parts.js.
    const skin=preset==='light'?{
      ...source,lightingDisabled:true,
      pieces:source.pieces.map(piece=>({...piece,masks:{}})),
    }:source;
    skinPromise=Promise.resolve(skin);
  }
  return skinPromise;
}

export function skinDefinitions(skin) {
  return skin.pieces.map(piece=>{
    const [, ,w,h]=piece.crop;
    return `${Object.entries(piece.masks).map(([zone,url])=>`<mask id="skin-${piece.name}-${zone}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha"><image href="${url}" width="${w}" height="${h}"/></mask>`).join('')}
    <g id="skin-${piece.name}-material"><image class="skin-unlit" href="${piece.base}" width="${w}" height="${h}"/>
    ${Object.keys(piece.masks).map(zone=>`<g class="emissive zone-${zone} skin-light" data-light-zone="${zone}" style="mix-blend-mode:screen"><rect width="${w}" height="${h}" fill="var(--${zone}-light)" mask="url(#skin-${piece.name}-${zone}-mask)"/></g>`).join('')}</g>`;
  }).join('');
}

// The four sections are positioned independently. Physical geometry is never
// inferred from the source image, and no source artwork covers the ball layer.
export function skinPieces(skin) {
  return skin.pieces.map(({name,x,y,width,height,crop})=>`<svg class="skin-piece ${name}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 ${crop[2]} ${crop[3]}" preserveAspectRatio="none" overflow="hidden"><use href="#skin-${name}-material"/></svg>`).join('');
}
