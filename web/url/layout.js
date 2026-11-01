// One geometry source for native drawing, moving parts, and collisions.
export const BOARD_WIDTH = 1024;
export const BOARD_HEIGHT = 1536;

const point = (x, y) => ({ x, y });
const segment = (x1, y1, x2, y2, type, radius = 4) => ({ x1, y1, x2, y2, type, radius });
const distanceToSegment = (p,s) => {
  const dx=s.x2-s.x1,dy=s.y2-s.y1;
  const t=Math.max(0,Math.min(1,((p.x-s.x1)*dx+(p.y-s.y1)*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p.x-s.x1-t*dx,p.y-s.y1-t*dy);
};
function polygonClearance(p,polygon) {
  let inside=false,distance=Infinity;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    distance=Math.min(distance,distanceToSegment(p,{x1:a.x,y1:a.y,x2:b.x,y2:b.y}));
  }
  return inside?-distance:distance;
}

export function createLayout(mode = 'wide') {
  const id = mode === 'large' ? 'large' : 'wide';
  const screenBoundingBox = id === 'large'
    ? { x: 265, y: 350, width: 525, height: 620 }
    : { x: 285, y: 350, width: 485, height: 620 };
  // The upper-left bevel must descend continuously toward the side lane.
  // An inward-facing V here formed a physical bowl that could retain balls.
  const fractions = [[.12,0],[.84,.06],[1,.10],[1,.40],[.99,.60],[.98,.85],[.86,1],[.13,1],[0,.88],[0,.18],[.035,.07]];
  const screenPolygon = fractions.map(([x,y]) => point(screenBoundingBox.x + x * screenBoundingBox.width, screenBoundingBox.y + y * screenBoundingBox.height));
  const outline = [point(100,208),point(924,208),point(976,280),point(976,1250),point(564,1312),point(564,1352),point(460,1352),point(460,1312),point(48,1250),point(48,280)];
  const outerWalls = outline.flatMap((p,i) => {
    const next = outline[(i+1)%outline.length];
    if(p.y===1352&&next.y===1352)return [];
    // A real opening connects the left launch channel to the upper playfield.
    if(p.x===48&&next.x===48)return [segment(48,p.y,48,386,'outer',4),segment(48,328,48,next.y,'outer',4)];
    return [segment(p.x,p.y,next.x,next.y,'outer',4)];
  });
  const outlet={x:512,y:1336,width:104,gate:{x1:460,x2:564,y:1336},
    rails:outerWalls.filter(wall=>wall.y1>=1230&&wall.y2>=1230)};
  const launchPath = [point(106,1320),point(48,1270),point(27,1190),point(26,955),point(26,650),point(29,438),point(34,365),point(59,340),point(77,331),point(97,321)];
  const segmentLengths=launchPath.slice(1).map((p,i)=>Math.hypot(p.x-launchPath[i].x,p.y-launchPath[i].y));
  const end=launchPath.at(-1),beforeEnd=launchPath.at(-2),endLength=segmentLengths.at(-1);
  const launch = { path: launchPath, start: launchPath[0], exit: end, duration: 1.15, railRadius: 3,
    segmentLengths,totalLength:segmentLengths.reduce((sum,value)=>sum+value,0),
    exitDirection:{x:(end.x-beforeEnd.x)/endLength,y:(end.y-beforeEnd.y)/endLength} };
  const dividerX = 171;
  const warpX = screenBoundingBox.x-31;
  const splitterSegments = [segment(205,390,screenBoundingBox.x+60,365,'splitter')];
  const dividerSegments = [segment(dividerX,500,dividerX,548,'divider'),segment(dividerX,582,dividerX,628,'divider')];
  const routeGate = { y: 524, splitX: dividerX, x1: 48, x2: screenBoundingBox.x };
  const bEntrance={y:506,leftPeg:{x:screenBoundingBox.x-75,y:506,r:6,type:'branch'},rightPeg:{x:screenBoundingBox.x-20,y:506,r:6,type:'branch'},width:43};
  // Sloping mounts close the tiny pockets behind the two inlet pins. Balls
  // striking a mount roll to either side instead of wedging against a wall.
  bEntrance.supports=[segment(dividerX,468,bEntrance.leftPeg.x,506,'inlet-mount',6),segment(bEntrance.rightPeg.x,506,screenBoundingBox.x,468,'inlet-mount',6)];
  dividerSegments.push(...bEntrance.supports);
  const routeChannels = {
    dividerX, startY: 500, mergeY: 628, endY: 980, dividerSegments,
    A: { label: '外側 A', labelPoint: point(100,545), destination: 'wheel', bounds: { x: 48, y: 500, width: dividerX-48, height: 400 } },
    B: { label: '内側 B', labelPoint: point((dividerX+screenBoundingBox.x)/2,545), destination: 'warp-or-spill', entrance:bEntrance,bounds: { x: dividerX, y: 500, width: screenBoundingBox.x-dividerX, height: 400 } },
  };
  const wheel = { x: 175, y: 825, r: 25, hubRadius: 7, bladeRadius: 3, blades: 3, angle: Math.PI/6, omega: 0 };
  const stage={x:512,y:1026,width:186,entry:{x:442,y:1002},gap:{x1:486,x2:538,y:1026},
    floorSegments:[segment(419,1033,486,1025,'stage',3),segment(538,1025,605,1033,'stage',3)],
    bounds:{x:406,y:988,width:212,height:62},friction:.8};
  const warp = {
    entry: { x: warpX, y: 885, r: 16 }, exit: stage.entry,
    path: [point(warpX,885),point(355,926),point(421,985),point(442,1002)],
    duration: .8,
  };
  const start = { x: 512, y: 1100, r: 30 };
  const hesoGate = { y: 1085, leftPegX: 476, rightPegX: 548, pegRadius: 6.5, x1: 482.5, x2: 541.5 };
  const bonusPocket = { x: 310, y: 1230, r: 25, award: 3, gateY: 1215 };
  const attacker={x:845,y:1210,width:144,height:52,gate:{x1:773,x2:917,y:1210},open:false,openness:0,
    wings:[segment(747,1176,773,1210,'attacker-wing',5),segment(935,1176,917,1210,'attacker-wing',5)],
    closedSegment:segment(773,1210,917,1210,'attacker-closed',6),
    round:0,totalRounds:0,count:0,countLimit:5,award:10,elapsed:0,timeLimit:12,payout:0};
  const denchu={x:865,y:1030,width:76,height:42,gate:{x1:827,x2:903,y:1030},open:false,openness:0,
    wings:[segment(813,1006,827,1030,'denchu-wing',4),segment(917,1006,903,1030,'denchu-wing',4)],
    closedSegment:segment(827,1030,903,1030,'denchu-closed',5),elapsed:0,openRemaining:0,award:1};
  const through={x:865,y:920,width:92,height:50,gate:{x1:819,x2:911,y:920},odds:.8,drawDuration:.65,openDuration:2.6};
  const rails = [];
  const pegs = [];
  // The two upper pins let launch jitter produce real rebounds toward either
  // side before the route is measured. The route itself is never randomized.
  pegs.push({x:166,y:431,r:6,type:'branch'},{x:218,y:458,r:6,type:'branch'});
  pegs.push(bEntrance.leftPeg,bEntrance.rightPeg);
  pegs.push({x:dividerX,y:565,r:6,type:'branch'});
  // The A channel remains mechanically separate from the B collector.
  for (let row=0;row<5;row++) {
    const spread = 22-row*.5;
    pegs.push({ x:wheel.x-spread,y:666+row*27,r:6,type:'hakama' },{ x:wheel.x+spread,y:666+row*27,r:6,type:'hakama' });
  }
  pegs.push({ x:148,y:790,r:6,type:'branch' },{ x:202,y:790,r:6,type:'branch' });
  for(const [x,y] of [[103,605],[99,646],[95,690],[113,726],[91,770],[95,811]])pegs.push({x,y,r:6,type:'yoroi'});
  pegs.push({x:screenBoundingBox.x-56,y:864,r:6,type:'warp-guide'});
  // Separate spill pins below the wheel preserve a lower route when the
  // small warp opening is missed; these do not form a sealed funnel.
  for(const [x,y] of [[129,877],[170,900],[209,922],[247,943]])pegs.push({x,y,r:5.5,type:'michi'});
  for (const [x,y] of [[90,913],[129,933],[168,954],[208,975],[249,995],[290,1015],[330,1035],[370,1051],[418,1071]]) {
    pegs.push({ x,y,r:5.5,type:'michi' });
  }
  pegs.push(
    { x:458,y:1075,r:6.5,type:'jump' },{ x:566,y:1075,r:6.5,type:'jump' },
    { x:hesoGate.leftPegX,y:hesoGate.y,r:hesoGate.pegRadius,type:'heso' },
    { x:hesoGate.rightPegX,y:hesoGate.y,r:hesoGate.pegRadius,type:'heso' },
  );
  for (const [x,y] of [[225,1126],[270,1146],[350,1155],[405,1158],[713,1200],[873,1020],[905,1090]]) {
    pegs.push({ x,y,r:6,type:'normal' });
  }
  // Add useful outer-field and lower-pocket groups with a full ball channel
  // between neighbouring pins. This also reserves the moving receiver sweep.
  const candidates=[[250,1220],[230,1270],[284,1276],[353,1274],[375,1204],[403,1228]];
  for(const y of [550,595,640,685,730,775,820,865,910,955,1000,1045,1090,1135,1180,1225,1270])for(const x of [95,143,191,239])candidates.push([x,y]);
  let additions=0;
  for(const [x,y] of candidates){
    if(additions>=28)break;
    const candidate={x,y,r:6,type:y>1180?'pocket-guide':y<900?'yoroi':'field'};
    if(polygonClearance(candidate,screenPolygon)<34)continue;
    if(pegs.some(peg=>Math.hypot(x-peg.x,y-peg.y)<44))continue;
    if([...outerWalls,...rails,...splitterSegments,...dividerSegments,...attacker.wings].some(rail=>distanceToSegment(candidate,rail)<candidate.r+13+rail.radius+8))continue;
    if(Math.hypot(x-wheel.x,y-wheel.y)<wheel.r+candidate.r+26+4)continue;
    if(Math.hypot(x-warp.entry.x,y-warp.entry.y)<warp.entry.r+candidate.r+13+8)continue;
    if(Math.hypot(x-bonusPocket.x,y-bonusPocket.y)<bonusPocket.r+candidate.r+13+5)continue;
    if(Math.hypot(x-start.x,y-start.y)<start.r+candidate.r+26)continue;
    pegs.push(candidate);additions++;
  }
  // Mirror the real left pins into the right playfield. Keep space for a full
  // ball between a new pin and the LCD / rails, and retain existing heso pairs.
  for(const original of pegs.filter(peg=>peg.x<BOARD_WIDTH/2)){
    const mirrored={...original,x:BOARD_WIDTH-original.x,mirrored:true,mirrorOf:{x:original.x,y:original.y,type:original.type}};
    if(polygonClearance(mirrored,screenPolygon)<mirrored.r+28)continue;
    if(pegs.some(peg=>Math.hypot(peg.x-mirrored.x,peg.y-mirrored.y)<peg.r+mirrored.r+16))continue;
    if([...rails,...outerWalls].some(rail=>distanceToSegment(mirrored,rail)<mirrored.r+26+rail.radius+2))continue;
    if(Math.hypot(mirrored.x-start.x,mirrored.y-start.y)<start.r+mirrored.r+25)continue;
    if(Math.hypot(mirrored.x-warp.exit.x,mirrored.y-warp.exit.y)<mirrored.r+45)continue;
    if(Math.hypot(mirrored.x-bonusPocket.x,mirrored.y-bonusPocket.y)<bonusPocket.r+mirrored.r+15)continue;
    pegs.push(mirrored);
  }
  // Reserve each moving mouth and its receiving wings. A closed receiver is
  // recessed, so missed balls keep falling toward the next pocket or out.
  for(let i=pegs.length-1;i>=0;i--){
    const peg=pegs[i];
    if([attacker,denchu].some(part=>
      (Math.abs(peg.x-part.x)<part.width/2+30&&peg.y>part.y-55&&peg.y<part.y+35)
      ||part.wings.some(wing=>distanceToSegment(peg,wing)<peg.r+26+wing.radius+3)))pegs.splice(i,1);
  }
  // Leave a clear descent above the bonus attacker. These two staggered
  // lower pins deflected right-play balls away from its otherwise open mouth.
  // Keep the mouth, wings, normal heso and upstream right pins unchanged.
  for(let i=pegs.length-1;i>=0;i--){
    const p=pegs[i];
    if((p.x===799&&p.y===1126)||(p.x===881&&p.y===1135))pegs.splice(i,1);
  }
  // The former central receiver is now an ordinary spill field. These pins
  // divide missed heso balls into lower exits without forming a sealed shelf.
  for(const [x,y] of [[432,1224],[485,1245],[539,1245],[592,1224],[460,1174],[564,1174]])pegs.push({x,y,r:6,type:'field'});
  // Replace the redundant left-out pile with a sloping, permeable road toward
  // the chameleon pocket. Gaps still let balls fall through to the out floor.
  for(let i=pegs.length-1;i>=0;i--)if(pegs[i].x<255&&pegs[i].y>1100)pegs.splice(i,1);
  for(const [x,y] of [[90,1106],[129,1125],[168,1144],[207,1163],[id==='wide'?250:246,1182]])pegs.push({x,y,r:5.5,type:'bonus-road'});
  // Short collector floor segments must not trap a full-size ball against
  // former bottom-row pins. These rows now end before the collection slope.
  for(let i=pegs.length-1;i>=0;i--)if(outlet.rails.some(rail=>distanceToSegment(pegs[i],rail)<pegs[i].r+26+rail.radius+4))pegs.splice(i,1);
  // Interrupt the long fall down B's inner side with real rebound pins.
  // The wide frame already had five sparse pins here: replace that group
  // with eight evenly spaced pins (net +3). The large frame gains four.
  // Apply this after mirroring so the right reward field stays unchanged.
  if(id==='wide')for(let i=pegs.length-1;i>=0;i--){
    const peg=pegs[i];
    if(peg.type==='yoroi'&&peg.x===239&&peg.y>=550&&peg.y<=820)pegs.splice(i,1);
  }
  const bSideX=id==='large'?232:239;
  const bSideRows=id==='large'?[580,633,680,815]:[550,588,626,664,702,740,778,816];
  for(const y of bSideRows)pegs.push({x:bSideX,y,r:5,type:'b-guide'});
  for(const peg of pegs)if(peg.mirrored&&!pegs.some(original=>original.x===peg.mirrorOf.x&&original.y===peg.mirrorOf.y&&original.type===peg.mirrorOf.type)){
    // The right reward route retains useful pins after the independent left
    // out route changes; they are no longer a pair of mirrored mechanisms.
    delete peg.mirrored;delete peg.mirrorOf;
  }
  return {
    id, width:BOARD_WIDTH, height:BOARD_HEIGHT,
    playfield:{ outline, bounds:{ x:48,y:208,width:928,height:1144 } }, outerWalls,
    screenPolygon,screenBoundingBox,screen:{ polygon:screenPolygon,bounds:screenBoundingBox },
    launchPath,launch,pegs,rails,splitterSegments,routeGate,routeChannels,wheel,warp,stage,through,outlet,start,hesoGate,bonusPocket,attacker,denchu,
    colliders:{ screenPolygon,outerWalls,rails:[...rails,...stage.floorSegments,...splitterSegments,...dividerSegments],pegs },
  };
}
