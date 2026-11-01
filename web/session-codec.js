// Self-contained portable codes. No network lookup or game data is omitted.
export const SESSION_CODE_PREFIX='YUA1:';
export const MAX_CODE_BYTES=2_000_000;
const fail=reason=>({ok:false,reason});

async function collectBounded(stream,limit){
  const reader=stream.getReader(),chunks=[];let length=0;
  try{
    for(;;){
      const {value,done}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>limit){void reader.cancel().catch(()=>{});throw new RangeError('too-large');}
      chunks.push(value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return bytes;
  }finally{reader.releaseLock();}
}
function toBase64(bytes){
  let text='';for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fromBase64(text){
  if(!text||!/^[A-Za-z0-9_-]+$/.test(text)||text.length%4===1)throw Error('invalid-code');
  const binary=atob(text.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function compressedInput(bytes){
  // Bound each compressed input chunk too: a tiny compressed chunk can expand
  // greatly before the native decoder yields control to our output-size check.
  let offset=0;
  return new ReadableStream({pull(controller){
    if(offset===bytes.length){controller.close();return;}
    const end=Math.min(bytes.length,offset+256);controller.enqueue(bytes.subarray(offset,end));offset=end;
  }},{highWaterMark:0});
}
export async function packSessionCode(text,{Compression=globalThis.CompressionStream}={}){
  if(typeof text!=='string'||text.length>MAX_CODE_BYTES)return fail('too-large');
  const fallback={ok:true,text,compressed:false};
  if(typeof Compression!=='function')return fallback;
  try{
    const bytes=new TextEncoder().encode(text);if(bytes.length>MAX_CODE_BYTES)return fail('too-large');
    const zipped=await collectBounded(new Blob([bytes]).stream().pipeThrough(new Compression('gzip')),MAX_CODE_BYTES);
    const code=SESSION_CODE_PREFIX+toBase64(zipped);
    return code.length<text.length?{ok:true,text:code,compressed:true}:fallback;
  }catch{return fallback;}
}
export async function unpackSessionCode(text,{Decompression=globalThis.DecompressionStream}={}){
  if(typeof text!=='string'||text.length>MAX_CODE_BYTES)return fail('too-large');
  if(!text.startsWith(SESSION_CODE_PREFIX))return {ok:true,text,compressed:false};
  if(typeof Decompression!=='function')return fail('compression-unavailable');
  try{
    const bytes=fromBase64(text.slice(SESSION_CODE_PREFIX.length));
    if(bytes.length<18||bytes[0]!==31||bytes[1]!==139)throw Error('invalid-code');
    if(new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(bytes.length-4,true)>MAX_CODE_BYTES)return fail('too-large');
    const decoded=await collectBounded(compressedInput(bytes).pipeThrough(new Decompression('gzip')),MAX_CODE_BYTES);
    return {ok:true,text:new TextDecoder('utf-8',{fatal:true}).decode(decoded),compressed:true};
  }catch(error){return fail(error instanceof RangeError&&error.message==='too-large'?'too-large':'invalid-code');}
}
