import {validateSession,createSessionStore} from './session-store.js';
import {packSessionCode,unpackSessionCode} from './session-codec.js';

export const TRANSFER_FORMAT='yua-pachinko-save';
export const MAX_TRANSFER_BYTES=2_000_000;

export function encodeSessionTransfer(payload,savedAt=Date.now()){
  const valid=validateSession(payload);
  if(!valid.ok)return valid;
  if(!Number.isSafeInteger(savedAt)||savedAt<0)return {ok:false,reason:'invalid-date'};
  const text=JSON.stringify({format:TRANSFER_FORMAT,version:1,savedAt,payload:valid.payload});
  return text.length<=MAX_TRANSFER_BYTES?{ok:true,text}:{ok:false,reason:'too-large'};
}

export function decodeSessionTransfer(text){
  if(typeof text!=='string'||text.length>MAX_TRANSFER_BYTES)return {ok:false,reason:'too-large'};
  try{
    const data=JSON.parse(text);
    if(data?.format===TRANSFER_FORMAT){
      if(data.version!==1||!Number.isSafeInteger(data.savedAt)||data.savedAt<0||
        Object.keys(data).some(key=>!['format','version','savedAt','payload'].includes(key)))return {ok:false,reason:'invalid-transfer'};
      return validateSession(data.payload);
    }
    // The unchanged v1 storage envelope can also be recovered from older builds.
    if(data?.schema===1){
      const loaded=createSessionStore({getItem:()=>text,setItem:()=>{throw Error('read only');}}).load();
      return loaded.ok?{ok:true,payload:loaded.payload}:loaded;
    }
    return validateSession(data);
  }catch{return {ok:false,reason:'invalid-transfer'};}
}

export async function encodeSessionCode(payload,savedAt=Date.now(),options){
  const encoded=encodeSessionTransfer(payload,savedAt);
  return encoded.ok?packSessionCode(encoded.text,options):encoded;
}
export async function decodeSessionCode(text,options){
  const decoded=await unpackSessionCode(text,options);
  return decoded.ok?decodeSessionTransfer(decoded.text):decoded;
}

export function setupSessionTransfer({session,root=document.getElementById('help'),
  confirmImport=message=>globalThis.confirm(message),onImported=()=>location.reload(),download}={}){
  if(!session||!root)return null;
  if(root.querySelector('[data-session-transfer]'))return null;
  const doc=root.ownerDocument,view=doc.defaultView;
  const section=doc.createElement('section');section.className='session-transfer';section.dataset.sessionTransfer='';
  section.innerHTML='<h3>遊技の続き・引き継ぎ</h3><p>保存できる環境では遊技の続きを自動保存します。ホーム画面から遊ぶ場合や、更新・別の端末へ移る前に記録を保存しておくと、持ち玉・レリック・抽選の続きを引き継げます。</p><div class="session-transfer__actions"><button type="button" data-save-export>続きの記録を保存</button><label class="session-transfer__file">記録ファイルを選ぶ<input type="file" accept=".json,application/json" data-save-file></label></div><details class="session-transfer__codes"><summary>引き継ぎコードで持ち出す・読み込む</summary><p>ファイルを保存できない場合も、コードをコピーしてメモなどに保管できます。</p><button type="button" data-save-show-code>引き継ぎコードを表示</button><div data-save-code-output hidden><label>保存するコード<textarea data-save-export-code readonly spellcheck="false" rows="3"></textarea></label><button type="button" data-save-select-code>コードをすべて選択</button><p>選択したコードをコピーして保管してください。</p></div><label>保存したコードを貼り付ける<textarea data-save-code-input spellcheck="false" rows="3" maxlength="2000000"></textarea></label><button type="button" data-save-read-code>貼り付けたコードを確認</button></details><p class="session-transfer__status" data-save-status role="status" aria-live="polite"></p><div class="session-transfer__preview" data-save-preview hidden><p data-save-summary></p><button type="button" data-save-import>現在の続きを置き換えて読み込む</button><button type="button" data-save-cancel>やめる</button></div>';
  root.append(section);
  const $=selector=>section.querySelector(selector),status=$('[data-save-status]'),input=$('[data-save-file]'),preview=$('[data-save-preview]');
  let pending=null,busy=false,selection=0;
  const say=text=>{status.textContent=text;};
  function captureExport(){
    if(busy)return null;
    const result=session.exportSnapshot();
    if(!result.ok){say('記録を保存できませんでした。遊技の続きから再開して、もう一度お試しください。');return null;}
    const encoded=encodeSessionTransfer(result.payload);
    if(!encoded.ok){say('記録を確認できませんでした。現在の遊技は変更していません。');return null;}
    return encoded.text;
  }
  async function previewText(text,turn){
    pending=null;preview.hidden=true;
    const result=await decodeSessionCode(text);
    if(turn!==selection||busy)return;
    if(!result.ok){say(result.reason==='compression-unavailable'?'このブラウザでは短縮コードを読み込めません。記録ファイルか以前の長いコードをご利用ください。':'記録を確認できませんでした。現在の遊技は変更していません。');return;}
    pending=result.payload;
    const state=pending.engine,count=Object.values(state.relics.purchases).reduce((sum,value)=>sum+value,0);
    $('[data-save-summary]').textContent=`読み込む記録：持ち玉 ${state.stock.toLocaleString()}玉 ／ 回転 ${state.stats.spins.toLocaleString()}回 ／ レリック購入 ${count.toLocaleString()}回`;
    preview.hidden=false;say('読み込むと、今の続きはこの記録に置き換わります。');
  }
  const saveFile=download||((text,name)=>{
    const url=view.URL.createObjectURL(new view.Blob([text],{type:'application/json'}));
    const link=doc.createElement('a');link.href=url;link.download=name;doc.body.append(link);link.click();link.remove();
    view.setTimeout(()=>view.URL.revokeObjectURL(url),60_000);
  });
  $('[data-save-export]').addEventListener('click',()=>{
    const text=captureExport();if(!text)return;
    try{saveFile(text,`ゆあ様パチンコ-続き-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);say('記録ファイルを保存します。保存できない場合は「引き継ぎコード」をご利用ください。');}
    catch{say('ファイルを保存できませんでした。この画面からもう一度お試しください。');}
  });
  $('[data-save-show-code]').addEventListener('click',async()=>{
    const button=$('[data-save-show-code]');if(button.disabled)return;
    const text=captureExport();if(!text)return;
    const turn=selection;button.disabled=true;say('コードをまとめています。');
    try{
      const encoded=await packSessionCode(text);if(turn!==selection||busy)return;
      if(!encoded.ok){say('コードを作れませんでした。記録ファイルをご利用ください。');return;}
      $('[data-save-export-code]').value=encoded.text;$('[data-save-code-output]').hidden=false;
      say(`${encoded.compressed?'短縮コード':'コード'}（${encoded.text.length.toLocaleString()}文字）をすべてコピーして保管してください。`);
    }finally{button.disabled=false;}
  });
  $('[data-save-select-code]').addEventListener('click',()=>{const code=$('[data-save-export-code]');code.focus();code.select();code.setSelectionRange(0,code.value.length);});
  $('[data-save-read-code]').addEventListener('click',()=>{if(busy)return;const turn=++selection;previewText($('[data-save-code-input]').value.trim(),turn);});
  input.addEventListener('change',async()=>{
    const turn=++selection;pending=null;preview.hidden=true;say('');
    const file=input.files?.[0];if(!file)return;
    if(file.size>MAX_TRANSFER_BYTES){say('このファイルは読み込めません。続きの記録ファイルを選んでください。');return;}
    try{
      const text=await file.text();if(turn!==selection)return;await previewText(text,turn);
    }catch{if(turn===selection)say('ファイルを開けませんでした。現在の遊技は変更していません。');}
  });
  $('[data-save-cancel]').addEventListener('click',()=>{if(busy)return;selection++;pending=null;preview.hidden=true;input.value='';say('読み込みをやめました。現在の遊技は変更していません。');});
  $('[data-save-import]').addEventListener('click',()=>{
    if(busy||!pending)return;
    if(!confirmImport(`現在の遊技の続きを、持ち玉 ${pending.engine.stock.toLocaleString()}玉の記録に置き換えます。よろしいですか？`))return;
    busy=true;
    const result=session.importSnapshot(pending);
    if(!result.ok){busy=false;say('読み込めませんでした。現在の記録は残しています。画面の保存案内をご確認ください。');return;}
    preview.hidden=true;say('記録を読み込みました。画面を開き直します。');onImported();
  });
  return {root:section};
}
