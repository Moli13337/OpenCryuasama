// Cabinet light values change frequently. Keep their inheritance inside the
// cabinet instead of invalidating unrelated reach/PV descendants of machine.
const LIGHT_PROPERTY=/^--(?:frame|accent|subtitle|title|push|warp)-(?:light|intensity)$/;
const INTENSITY_PROPERTY=/^--(frame|accent|subtitle|title|push|warp)-intensity$/;
const cabinetScopes=new WeakMap();

// Rebind synchronously after renderCabinet replaces the SVG. LightingRig skips
// identical values, so waiting for its next tick would leave new lamps at .8.
export function refreshScopedLighting(cabinet){cabinetScopes.get(cabinet)?.();}

export function createScopedLightingHost(host,{
  cabinet=host?.querySelector?.('#cabinet-parts'),
  push=host?.querySelector?.('#physical-push'),
  handle=host?.querySelector?.('#handle')
}={}){
  if(!host?.style||!cabinet?.style)return host;
  const directIntensity=typeof cabinet.querySelectorAll==='function';
  const intensities=new Map(),lamps=new Map();
  const applyIntensity=(zone,{value,priority})=>{
    for(const lamp of lamps.get(zone)||[])lamp.style.setProperty('opacity',value,priority);
  };
  if(directIntensity){
    cabinetScopes.set(cabinet,()=>{
      lamps.clear();
      for(const zone of ['frame','accent','subtitle','title','push','warp']){
        lamps.set(zone,Array.from(cabinet.querySelectorAll(`.emissive.zone-${zone}`)));
        if(intensities.has(zone))applyIntensity(zone,intensities.get(zone));
      }
    });
    refreshScopedLighting(cabinet);
  }
  const destinations=name=>{
    if(!LIGHT_PROPERTY.test(name)&&name!=='--light-strength')return [host];
    const targets=[cabinet];
    if(name==='--push-light'&&push?.style)targets.push(push);
    if(name==='--frame-light'&&handle?.style)targets.push(handle);
    return targets;
  };
  return {
    dataset:host.dataset,
    style:{
      setProperty(name,value,priority=''){
        const zone=directIntensity&&INTENSITY_PROPERTY.exec(name)?.[1];
        if(zone){
          const entry={value:String(value),priority};intensities.set(zone,entry);
          applyIntensity(zone,entry);return;
        }
        for(const target of destinations(name))target.style.setProperty(name,value,priority);
      },
      getPropertyValue(name){
        const zone=directIntensity&&INTENSITY_PROPERTY.exec(name)?.[1];
        return zone?intensities.get(zone)?.value||'':destinations(name)[0].style.getPropertyValue(name);
      },
      removeProperty(name){
        const zone=directIntensity&&INTENSITY_PROPERTY.exec(name)?.[1];
        if(zone){
          const previous=intensities.get(zone)?.value||'';intensities.delete(zone);
          for(const lamp of lamps.get(zone)||[])lamp.style.removeProperty('opacity');
          return previous;
        }
        let previous='';
        for(const target of destinations(name)){
          const value=target.style.removeProperty(name);if(!previous)previous=value;
        }
        return previous;
      }
    }
  };
}
