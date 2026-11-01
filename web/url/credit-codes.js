// Local trial replenishment only. These public codes are not payment tokens.
export const CREDIT_CODES = Object.freeze({
  'YUA-1000':1000, 'YUA-3000':3000, 'YUA-5000':5000, 'YUA-10000':10000,
});

export function createCreditLedger(){return {version:1,used:[]};}

export function validateCreditLedger(value){
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||
    Object.keys(value).sort().join(',')!=='used,version'||value.version!==1||!Array.isArray(value.used)||
    value.used.length>4||Object.keys(value.used).length!==value.used.length)return false;
  return value.used.every(code=>typeof code==='string'&&Object.hasOwn(CREDIT_CODES,code))&&
    new Set(value.used).size===value.used.length;
}

export function normalizeCreditCode(input){
  return typeof input==='string'&&input.length<=80?input.trim().toUpperCase():'';
}

export function redeemCreditCode(engine,ledger,input){
  if(!validateCreditLedger(ledger))return {ok:false,reason:'invalid-ledger'};
  const code=normalizeCreditCode(input);
  if(!Object.hasOwn(CREDIT_CODES,code))return {ok:false,reason:'invalid-code'};
  if(ledger.used.includes(code))return {ok:false,reason:'already-used',code};
  const amount=CREDIT_CODES[code];
  if(!engine||typeof engine.changeStock!=='function'||!Number.isSafeInteger(engine.stock)||engine.stock<0||
    !Number.isSafeInteger(engine.stock+amount))return {ok:false,reason:'stock-limit',code};
  const before=engine.stock;
  // Mark first: stock-change listeners may immediately persist the entire
  // session, and a synchronous double-click must never see an unused code.
  ledger.used.push(code);
  let result;
  try{result=engine.changeStock(amount,'credit-code');}
  catch(error){
    // Never unwind a credit that actually reached the balance, even if an
    // unrelated UI listener threw after the stock mutation.
    if(engine.stock===before+amount)return {ok:true,code,amount,stock:engine.stock,ledger,warning:'listener-error'};
    ledger.used.pop();
    return {ok:false,reason:'credit-error',code};
  }
  if(result?.ok&&engine.stock===before+amount)return {ok:true,code,amount,stock:engine.stock,ledger};
  if(engine.stock===before+amount)return {ok:true,code,amount,stock:engine.stock,ledger,warning:'unexpected-stock-result'};
  ledger.used.pop();
  return {ok:false,reason:result?.reason||'credit-error',code};
}
