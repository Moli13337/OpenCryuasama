// One selection per new session; restoring a save preserves the captured setting.
export const SETTING_WEIGHTS=Object.freeze([35,25,18,12,7,3]);
export function selectMachineSetting(roll){
 if(!Number.isFinite(roll)||roll<0||roll>=1)throw new RangeError('Setting roll must be in [0, 1)');
 let boundary=0;
 for(let i=0;i<SETTING_WEIGHTS.length;i++){boundary+=SETTING_WEIGHTS[i]/100;if(roll<boundary)return i+1;}
 return 6;
}
export function sessionAccess(search,distribution=false){
 const params=new URLSearchParams(search),debug=!distribution&&params.get('debug')==='1';
 return {debug,operator:!distribution&&(debug||params.get('operator')==='1')};
}
