// Mirror explicit presentation states without querying layout/computed styles.
// A stopped/hidden reel still receives time and outcome updates, just no paint.
export function reelsAreVisible({bonus=false,prayerIntro=false,fizzleDigits=false,promiseIntro=false,shatter=false,layered=false,reels='normal',focus='normal',beam=false}={}){
 if(bonus||promiseIntro||shatter||(prayerIntro&&!fizzleDigits))return false;
 if(focus==='center'||beam)return true;
 return !(layered&&reels==='hidden');
}
