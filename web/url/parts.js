import {selectAsset} from './asset-variants-v47.js';
import { skinDefinitions, skinPieces } from './cabinet-skin.js';
import {boardMonitorWindow} from './board-monitor.js';
import {refreshScopedLighting} from './lighting-scope.js';
const NS = 'http://www.w3.org/2000/svg';
const polygonPath = points => `${points.map((p,i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} Z`;
const linePath = points => points.map((p,i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
// This lossless bake matches both shipped layouts. A future changed path uses
// the original vector rail until its artwork is regenerated.
const BAKED_LAUNCH_PATH='M106,1320 L48,1270 L27,1190 L26,955 L26,650 L29,438 L34,365 L59,340 L77,331 L97,321';

/** Shapes are neutral metal; emitted light is an independently colored layer. */
export class LightingRig {
  constructor(host) {
    this.host = host;
    this.zones = { frame: '#66e8b0', accent: '#b491ff', subtitle: '#bfffe1', title: '#92f1c6', push: '#b491ff', warp: '#ad91ff' };
    this.brightness = .8;
    this.mode = 'pulse';
    this.zoneEffects = {};
    this.cue = null;
    this.time = 0;
    this.applied = new Map();
    Object.entries(this.zones).forEach(([zone,color]) => this.setColor(zone,color));
    this.setBrightness(.8);
    this.tick(0);
  }
  setColor(zone, color) {
    if (!Object.hasOwn(this.zones,zone) || !/^#[\da-f]{6}$/i.test(color)) return false;
    this.zones[zone] = color; this.tick(this.time);
    return true;
  }
  setBrightness(value, zone = null) {
    const amount = Math.max(0,Math.min(1,Number(value) || 0));
    if (zone !== null) {
      if (!Object.hasOwn(this.zones,zone)) return;
      (this.zoneEffects[zone] ||= {}).brightness = amount;
    } else this.brightness = amount;
    this.host.style.setProperty('--light-strength',this.brightness);
    this.tick(this.time);
  }
  setMode(mode, zone = null) {
    if (!['steady','pulse','rainbow'].includes(mode)) return;
    if (zone !== null) {
      if (!Object.hasOwn(this.zones,zone)) return;
      (this.zoneEffects[zone] ||= {}).mode = mode;
    } else { this.mode=mode; this.host.dataset.lightMode=mode; }
    this.tick(this.time);
  }
  resetZoneEffects() { this.zoneEffects={}; this.tick(this.time); }
  setCue(cue = null) { this.cue = cue; this.tick(this.time); }
  color(zone) {
    const mode = this.cue?.mode ?? this.zoneEffects[zone]?.mode ?? this.mode;
    const offset = Object.keys(this.zones).indexOf(zone) * 35;
    const time=this.cue?.time ?? this.time;
    return mode === 'rainbow' ? `hsl(${(time * (this.cue?.rainbowSpeed ?? 45) + offset) % 360} 95% 67%)` : (this.cue?.colors?.[zone] ?? this.zones[zone]);
  }
  intensity(zone) {
    const mode = this.cue?.mode ?? this.zoneEffects[zone]?.mode ?? this.mode;
    const time=this.cue?.time ?? this.time;
    const pulse = mode === 'pulse' ? .32 + .68 * (1 + Math.sin(time * Math.PI * (this.cue?.pulseRate ?? .5))) / 2 : 1;
    return (this.cue?.brightness ?? this.brightness) * (this.cue ? 1 : (this.zoneEffects[zone]?.brightness ?? 1)) * pulse;
  }
  tick(seconds) {
    this.time = seconds;
    for (const zone of Object.keys(this.zones)) {
      const values = [[`--${zone}-light`,this.color(zone)],[`--${zone}-intensity`,this.intensity(zone).toFixed(3)]];
      for(const [name,value] of values)if(this.applied.get(name)!==value){
        this.host.style.setProperty(name,value);this.applied.set(name,value);
      }
    }
  }
}

export function renderCabinet(host, data, skin = null) {
  host.classList.toggle('has-skin',Boolean(skin));
  const screen = polygonPath(data.screenPolygon);
  const playfield = polygonPath(data.playfield.outline);
  const launch = linePath(data.launchPath || []);
  const bakedRail=(host.ownerDocument??globalThis.document)?.documentElement?.dataset.qualityPreset==='light'&&launch===BAKED_LAUNCH_PATH;
  const start=data.start;
  const stageArt=data.stage?`<g class="stage-part" aria-label="中央落下口と左右のこぼれ道を持つステージ">
    ${data.stage.floorSegments.map(s=>`<path d="M${s.x1-7} ${s.y1-4}L${s.x2+7} ${s.y2-4}L${s.x2+7} ${s.y2+20}L${s.x1-7} ${s.y1+20}Z" fill="url(#chrome)" stroke="#c7c9b2" stroke-width="2"/><path d="M${s.x1+4} ${s.y1+8}L${s.x2-4} ${s.y2+8}" fill="none" stroke="var(--frame-light)" stroke-width="3" opacity=".6"/>`).join('')}
    <path d="M${data.stage.gap.x1} ${data.stage.gap.y+5}Q${data.stage.x} ${data.stage.gap.y+28} ${data.stage.gap.x2} ${data.stage.gap.y+5}" fill="none" stroke="url(#chrome)" stroke-width="5"/>
  </g>`:'';
  const throughArt=data.through?`<g class="through-part" aria-label="玉の通過で電チューの開放を抽選するスルー">
    <path d="M${data.through.gate.x1-9} ${data.through.y-19}L${data.through.x} ${data.through.y-31}L${data.through.gate.x2+9} ${data.through.y-19}V${data.through.y+21}L${data.through.x} ${data.through.y+32}L${data.through.gate.x1-9} ${data.through.y+21}Z" fill="#22323955" stroke="url(#chrome)" stroke-width="6"/>
    <path d="M${data.through.gate.x1-2} ${data.through.y-15}L${data.through.x} ${data.through.y-24}L${data.through.gate.x2+2} ${data.through.y-15}" fill="none" stroke="var(--accent-light)" stroke-width="3" opacity="var(--through-light,.35)"/>
    <text x="${data.through.x}" y="${data.through.y+49}" text-anchor="middle" fill="#f2e9cd" stroke="#2a3b43" stroke-width="3" paint-order="stroke" font-size="15" letter-spacing="1">スルー</text>
  </g>`:'';
  const outletArt=data.outlet?`<g class="outlet-part" aria-label="外れた玉を回収する中央アウト口">
    <path d="M${data.outlet.gate.x1-10} ${data.outlet.y-22}Q${data.outlet.x} ${data.outlet.y-34} ${data.outlet.gate.x2+10} ${data.outlet.y-22}L${data.outlet.gate.x2+6} ${data.outlet.y+12}H${data.outlet.gate.x1-6}Z" fill="url(#chrome)" stroke="#253742" stroke-width="3"/>
    <path d="M${data.outlet.gate.x1} ${data.outlet.y-17}Q${data.outlet.x} ${data.outlet.y-25} ${data.outlet.gate.x2} ${data.outlet.y-17}V${data.outlet.y+4}H${data.outlet.gate.x1}Z" fill="#02070b"/>
    <path d="M${data.outlet.gate.x1+5} ${data.outlet.y+6}H${data.outlet.gate.x2-5}" stroke="#b2c2c4" stroke-width="2"/>
  </g>`:'';
  // Align the generated chrome spine to the physical rail, with the layered
  // armor underneath it. The same segment supplies its length and angle.
  const deflectors=data.splitterSegments.map(rail=>{
    const dx=rail.x2-rail.x1,dy=rail.y2-rail.y1;
    const sx=2040,sy=-280,sourceLength=Math.hypot(sx,sy),length=Math.hypot(dx,dy);
    const ux=dx/length,uy=dy/length,vx=sx/sourceLength,vy=sy/sourceLength;
    const along=length/sourceLength,depth=along*4;
    const a=along*ux*vx+depth*uy*vy,b=along*uy*vx-depth*ux*vy;
    const c=along*ux*vy-depth*uy*vx,d=along*uy*vy+depth*ux*vx;
    const x=rail.x1-a*100-c*410,y=rail.y1-b*100-d*410;
    return `<image href="${selectAsset('assets/deflector-serpent-v01.png')}" width="2172" height="724" transform="matrix(${a} ${b} ${c} ${d} ${x} ${y})"/>`;
  }).join('');
  let tray = '';
  for(let row=0;row<3;row++) for(let col=0;col<14;col++) {
    const x=285+col*34+(row%2)*13, y=1280+row*19;
    tray+=`<circle cx="${x}" cy="${y}" r="12" fill="url(#steel-ball)" stroke="#131a21" stroke-width="2"/>`;
  }
  const strips = [
    'M42 390 Q21 590 44 762','M45 805 Q29 1001 85 1182',
    'M982 390 Q1003 590 980 762','M979 805 Q995 1001 939 1182',
    'M109 1435 Q119 1482 299 1491','M915 1435 Q905 1482 725 1491',
  ];
  host.innerHTML=`<svg xmlns="${NS}" viewBox="0 0 1024 1536" role="img" aria-label="独立パーツで構成した宗教非法人ゆあ様の筐体">
  <defs>
    ${skin ? skinDefinitions(skin) : ''}
    <clipPath id="screen-body-clip"><path d="${screen}"/></clipPath>
    <linearGradient id="body" x2="1" y2="1"><stop stop-color="#222632"/><stop offset=".38" stop-color="#080b11"/><stop offset=".7" stop-color="#171b25"/><stop offset="1" stop-color="#040509"/></linearGradient>
    <linearGradient id="chrome"><stop stop-color="#202735"/><stop offset=".16" stop-color="#a6acb7"/><stop offset=".3" stop-color="#303a4e"/><stop offset=".47" stop-color="#f6f7f9"/><stop offset=".59" stop-color="#5c6371"/><stop offset=".8" stop-color="#d9d9e2"/><stop offset="1" stop-color="#2a303a"/></linearGradient>
    <linearGradient id="glass" x2=".4" y2="1"><stop stop-color="#2d3341"/><stop offset=".3" stop-color="#111620"/><stop offset="1" stop-color="#0b0f16"/></linearGradient>
    <linearGradient id="title-metal" x2=".15" y2="1"><stop stop-color="#fcfdff"/><stop offset=".29" stop-color="#b4beca"/><stop offset=".47" stop-color="#f9fdff"/><stop offset=".53" stop-color="#68788e"/><stop offset="1" stop-color="#d6e1e9"/></linearGradient>
    <radialGradient id="steel-ball" cx=".3" cy=".25"><stop stop-color="#fff"/><stop offset=".35" stop-color="#e5edf4"/><stop offset=".7" stop-color="#748394"/><stop offset=".92" stop-color="#324554"/><stop offset="1" stop-color="#a8b9c7"/></radialGradient>
    <radialGradient id="push-face"><stop stop-color="#33333f"/><stop offset=".7" stop-color="#121921"/><stop offset="1" stop-color="#05070a"/></radialGradient>
    <filter id="lamp-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
    <pattern id="mesh" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" stroke="#39404a" stroke-width="1"/></pattern>
    <clipPath id="field-clip"><path d="${playfield}"/></clipPath>
    ${bakedRail?'':`<mask id="launch-metal-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536" style="mask-type:luminance"><path d="${launch}" fill="none" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/><path d="${launch}" fill="none" stroke="black" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/></mask>`}
    <linearGradient id="field-pearl" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#acb7b4"/><stop offset=".2" stop-color="#657e80"/><stop offset=".5" stop-color="#c7c7b4"/><stop offset=".74" stop-color="#627880"/><stop offset="1" stop-color="#9fabb1"/></linearGradient>
    <radialGradient id="field-shade"><stop stop-color="#e8dbaf" stop-opacity=".25"/><stop offset=".65" stop-color="#40525e" stop-opacity=".12"/><stop offset="1" stop-color="#172633" stop-opacity=".66"/></radialGradient>
    <pattern id="field-engraving" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M45 8Q75 22 82 45Q65 75 45 82Q15 63 8 45Q26 15 45 8ZM45 18V72M18 45H72" fill="none" stroke="#e1d7b4" stroke-opacity=".12" stroke-width="1.4"/></pattern>
    <pattern id="board-texture" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0H8" stroke="#ced9e0" stroke-opacity=".018"/></pattern>
  </defs>
  <rect x="6" y="6" width="1012" height="1524" rx="82" fill="#030509" stroke="#454c5d" stroke-width="7"/>
  <rect x="19" y="17" width="986" height="1502" rx="73" fill="url(#body)" stroke="url(#chrome)" stroke-width="8"/>
  <path d="${playfield}" fill="url(#field-pearl)" stroke="#42495b" stroke-width="5"/>
  <path d="${playfield}" fill="url(#board-texture)"/>
  <g clip-path="url(#field-clip)" pointer-events="none">
    <image class="playfield-background" href="${selectAsset('assets/playfield-pearl-v01.png')}" x="${data.playfield.bounds.x-2}" y="${data.playfield.bounds.y-2}" width="${data.playfield.bounds.width+4}" height="${data.playfield.bounds.height+4}" preserveAspectRatio="none" opacity=".82"/>
    <path d="${playfield}" fill="url(#field-engraving)"/>
    <path d="${playfield}" fill="url(#field-shade)"/>
    <g fill="none" stroke="#f1e2b7" stroke-opacity=".32">
      <path d="M110 305Q510 170 914 305M117 321Q510 195 907 321" stroke-width="3"/>
      <path d="M95 650Q160 980 425 1202M929 650Q864 980 599 1202" stroke-width="9"/>
      <path d="M90 673Q152 1007 412 1220M934 673Q872 1007 612 1220" stroke-width="2"/>
    </g>
    <g fill="#2b4955" opacity=".3"><path d="M115 375L151 610 80 1010 84 490Z"/><path d="M909 375L873 610 944 1010 940 490Z"/></g>
    <text x="512" y="311" text-anchor="middle" fill="#e1d8ba" opacity=".52" font-size="23" letter-spacing="12" font-family="Georgia,serif">YUA · SANCTUARY</text>
  </g>
  ${skin ? skinPieces(skin) : ''}
  <g class="launch-rail" aria-label="枠の光が透ける発射レール" fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${bakedRail?'<image class="launch-metal-baked" href="assets/optimized-v47/launch-rail-light-cropped-v47.png" x="0" y="292" width="134" height="1056" preserveAspectRatio="none"/>':`<g mask="url(#launch-metal-mask)"><path d="${launch}" stroke="#03070d" stroke-width="48" stroke-opacity=".82"/><path d="${launch}" stroke="url(#chrome)" stroke-width="40" stroke-opacity=".9"/></g>`}
    <path class="launch-glass" d="${launch}" stroke="#101723" stroke-width="32" stroke-opacity=".62"/>
  </g>
  <g class="deflector-ornaments" aria-label="蛇の分節装甲を持つ分岐役物">${deflectors}</g>
  <g class="frame-metal" fill="none" stroke="url(#chrome)" stroke-width="20">${strips.map(d=>`<path d="${d}"/>`).join('')}</g>
  <g class="emissive zone-frame glow" fill="none" stroke="var(--frame-light)" stroke-width="14" filter="url(#lamp-glow)">${strips.map(d=>`<path d="${d}"/>`).join('')}</g>
  <g class="emissive zone-frame core" fill="none" stroke="var(--frame-light)" stroke-width="6">${strips.map(d=>`<path d="${d}"/>`).join('')}</g>
  <g class="lcd-bezel" clip-path="url(#screen-body-clip)"><path d="${screen}" fill="#05070b" stroke="#020406" stroke-width="34" stroke-linejoin="round"/><path d="${screen}" fill="none" stroke="url(#chrome)" stroke-width="21" stroke-linejoin="round"/><path d="${screen}" class="emissive zone-frame glow" fill="none" stroke="var(--frame-light)" stroke-width="9" filter="url(#lamp-glow)"/><path d="${screen}" class="emissive zone-frame core" fill="none" stroke="var(--frame-light)" stroke-width="3"/></g>
  <g class="logo" font-family="Hiragino Mincho ProN,Yu Mincho,serif" text-anchor="middle" font-weight="900">
    <path d="M218 84L294 45 405 31H663L774 56 833 101 792 210 640 230H372L236 205 189 141Z" fill="url(#body)" stroke="url(#chrome)" stroke-width="5"/>
    <path d="M222 106L281 81 303 174 266 202 235 178 204 177 187 146Z" fill="url(#chrome)"/>
    <path d="M802 106L743 81 721 174 758 202 789 178 820 177 837 146Z" fill="url(#chrome)"/>
    <path class="emissive zone-frame" d="M217 143L239 129 254 150 235 167ZM807 143L785 129 770 150 789 167Z" fill="var(--frame-light)"/>
    <text x="512" y="88" font-size="37" letter-spacing="7" fill="#070a0f" stroke="#0a0c13" stroke-width="9">宗教非法人</text>
    <text x="512" y="88" font-size="37" letter-spacing="7" fill="url(#title-metal)">宗教非法人</text>
    <text class="emissive zone-subtitle glow" x="512" y="88" font-size="37" letter-spacing="7" fill="none" stroke="var(--subtitle-light)" stroke-width="5" filter="url(#lamp-glow)">宗教非法人</text>
    <text class="emissive zone-subtitle core" x="512" y="88" font-size="37" letter-spacing="7" fill="var(--subtitle-light)" fill-opacity=".55" stroke="var(--subtitle-light)" stroke-width="1.5">宗教非法人</text>
    <text x="515" y="201" font-size="119" font-style="italic" letter-spacing="2" fill="#080b13" stroke="#080b13" stroke-width="13">ゆあ様</text>
    <text x="512" y="194" font-size="119" font-style="italic" letter-spacing="2" fill="url(#title-metal)" stroke="#c4d2df" stroke-width="1">ゆあ様</text>
    <text class="emissive zone-title glow" x="512" y="194" font-size="119" font-style="italic" letter-spacing="2" fill="none" stroke="var(--title-light)" stroke-width="8" filter="url(#lamp-glow)">ゆあ様</text>
    <text class="emissive zone-title core" x="512" y="194" font-size="119" font-style="italic" letter-spacing="2" fill="var(--title-light)" fill-opacity=".6" stroke="var(--title-light)" stroke-width="2.3">ゆあ様</text>
  </g>
  <g class="port-creatures" aria-label="蛇のワープとカメレオンのおまけ入賞" pointer-events="none">
    <image href="${selectAsset('assets/warp-serpent-v01.png')}" x="${data.warp.entry.x-48}" y="${data.warp.entry.y-48}" width="96" height="88" preserveAspectRatio="none"/>
    <image href="${selectAsset('assets/bonus-chameleon-v01.png')}" x="${data.bonusPocket.x-79}" y="${data.bonusPocket.y-87}" width="145" height="150" preserveAspectRatio="none"/>
  </g>
  ${stageArt}${throughArt}${outletArt}
  <g class="starter-part"><path d="M${start.x-46} ${start.y-4}Q${start.x} ${start.y-27} ${start.x+46} ${start.y-4}L${start.x+34} ${start.y+47}Q${start.x} ${start.y+61} ${start.x-34} ${start.y+47}Z" fill="url(#glass)" stroke="url(#chrome)" stroke-width="6"/><ellipse cx="${start.x}" cy="${start.y+7}" rx="${start.r}" ry="23" fill="#02050a"/><path class="emissive zone-frame core" d="M${start.x-30} ${start.y+43}Q${start.x} ${start.y+52} ${start.x+30} ${start.y+43}" fill="none" stroke="var(--frame-light)" stroke-width="3"/><text x="${start.x}" y="${start.y+77}" fill="#9cabb9" text-anchor="middle" font-size="16" letter-spacing="3">START</text></g>
  <g class="attacker" aria-label="短い扉で開閉する大入賞口">
    <image href="${selectAsset('assets/attacker-serpent-v01.png')}" x="${data.attacker.gate.x1-data.attacker.width*.17}" y="${data.attacker.gate.y-data.attacker.width*.272}" width="${data.attacker.width*1.34}" height="${data.attacker.width*.67}" preserveAspectRatio="none"/>
  </g>
  ${data.denchu?`<g class="denchu-part" aria-label="右打ちのRUSH抽選用電チュー">
    <image href="${selectAsset('assets/attacker-serpent-v01.png')}" x="${data.denchu.gate.x1-data.denchu.width*.17}" y="${data.denchu.gate.y-data.denchu.width*.272}" width="${data.denchu.width*1.34}" height="${data.denchu.width*.67}" preserveAspectRatio="none"/>
    <path d="M${data.denchu.x-32} ${data.denchu.y+22}L${data.denchu.x} ${data.denchu.y+32}L${data.denchu.x+32} ${data.denchu.y+22}" fill="none" stroke="var(--accent-light)" stroke-width="3" opacity="var(--denchu-light,.15)"/>
  </g>`:''}
  <g class="tray"><path d="M197 1270Q512 1227 827 1270L785 1332H237Z" fill="#090c13" stroke="url(#chrome)" stroke-width="8"/>${tray}<path d="M208 1304Q512 1327 816 1304L790 1339H234Z" fill="url(#glass)" stroke="url(#chrome)" stroke-width="5"/></g>
  <g class="push-part"><ellipse cx="512" cy="1394" rx="152" ry="99" fill="#03050a" stroke="url(#chrome)" stroke-width="14"/><ellipse cx="512" cy="1377" rx="122" ry="66" fill="url(#push-face)" stroke="#a1a5b1" stroke-width="5"/><ellipse class="emissive zone-push glow" cx="512" cy="1377" rx="113" ry="58" fill="var(--push-light)" opacity=".48" filter="url(#lamp-glow)"/><ellipse class="emissive zone-push core" cx="512" cy="1377" rx="113" ry="58" fill="none" stroke="var(--push-light)" stroke-width="5"/><text x="512" y="1395" text-anchor="middle" font-family="Georgia,serif" font-size="57" font-style="italic" font-weight="900" fill="url(#title-metal)">PUSH</text></g>
  <g class="handle-part"><circle cx="893" cy="1400" r="70" fill="#060910" stroke="url(#chrome)" stroke-width="12"/><circle cx="893" cy="1400" r="53" fill="url(#glass)" stroke="#657186" stroke-width="3"/><path d="M872 1414L887 1370 909 1374 920 1424" fill="none" stroke="url(#chrome)" stroke-width="14" stroke-linecap="round"/><circle class="emissive zone-frame core" cx="893" cy="1400" r="62" fill="none" stroke="var(--frame-light)" stroke-width="2"/></g>
  <g fill="url(#mesh)" stroke="#4c5261" stroke-width="3"><path d="M66 1337L185 1370 184 1462 104 1449 60 1403Z"/><path d="M839 276L926 312 952 362 952 424 877 388Z"/></g>
  <g fill="url(#chrome)">${[[38,91],[986,91],[89,1240],[935,1240],[53,1490],[971,1490]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="8"/><path d="M${x-4} ${y}h8" stroke="#131823" stroke-width="2"/>`).join('')}</g>
  </svg>`;
  refreshScopedLighting(host);
}

export function positionLCD(element, data) {
  const opening=boardMonitorWindow(data);
  for(const [key,value] of Object.entries({left:opening.x/data.width*100,top:opening.y/data.height*100,width:opening.width/data.width*100,height:opening.height/data.height*100}))element.style.setProperty(`--board-monitor-${key}`,`${value}%`);
  element.style.setProperty('--board-monitor-clip',opening.clip);
  const b = data.screenBoundingBox;
  element.style.left = `${b.x / data.width * 100}%`;
  element.style.top = `${b.y / data.height * 100}%`;
  element.style.width = `${b.width / data.width * 100}%`;
  element.style.height = `${b.height / data.height * 100}%`;
  // The physical polygon is the OUTSIDE of the metal bezel. The glass sits
  // just inside it, leaving visible neutral metal without painting over balls.
  const cx=b.x+b.width/2, cy=b.y+b.height/2;
  const scale=1-18/Math.min(b.width,b.height);
  const glass=data.screenPolygon.map(p=>({x:cx+(p.x-cx)*scale,y:cy+(p.y-cy)*scale}));
  element.style.clipPath = `polygon(${glass.map(p => `${(p.x-b.x)/b.width*100}% ${(p.y-b.y)/b.height*100}%`).join(',')})`;
}
