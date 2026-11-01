export function isIOSDevice({userAgent='',platform='',maxTouchPoints=0}={}){
 return /iPad|iPhone|iPod/.test(userAgent)||(platform==='MacIntel'&&maxTouchPoints>1);
}
export function saveEnvironment({view=globalThis.window,navigator=view?.navigator}={}){
 let embedded=false;try{embedded=view.self!==view.top;}catch{embedded=true;}
 return {ios:isIOSDevice(navigator),embedded,standalone:Boolean(navigator?.standalone||view?.matchMedia?.('(display-mode: standalone)').matches)};
}
// This is an explicit escape from an embedded storage partition, never an
// automatic navigation or reset. Existing records are moved with the normal
// export/import flow and are not sent to another service.
export function addSaveEnvironmentGuide(root,{view=root?.ownerDocument?.defaultView}={}){
 if(!root)return null;const environment=saveEnvironment({view});
 if(!environment.ios||!environment.embedded)return null;
 const section=root.ownerDocument.createElement('section');section.className='session-transfer save-environment';
 section.innerHTML='<h3>iPhone・ホーム画面で遊ぶとき</h3><p>この埋め込み画面では、アプリを閉じると自動保存が残らない場合があります。終了前に「続きの記録を保存」か引き継ぎコードで、記録を手元に残してください。</p><p>ゲームを別画面で開くと、埋め込み画面とは別の保存場所になります。今の続きは、記録を保存してから別画面で読み込んでください。</p>';
 const link=root.ownerDocument.createElement('a');link.textContent='このゲームだけを別画面で開く ↗';link.target='_blank';link.rel='noopener noreferrer';
 const url=new URL(view.location.href);url.hash='';url.searchParams.delete('debug');url.searchParams.delete('operator');link.href=url.href;section.append(link);root.append(section);return section;
}
