const products = [
  { id:'OB0015', name:'Amlodipine 10 mg', stockBase:42, location:'BLKG-1-5', units:[
    { id:'OB0015-STRIP', label:'Strip', conversion:1, price:4000 },
    { id:'OB0015-BOX', label:'Box (10 Strip)', conversion:10, price:35000 }
  ]},
  { id:'OB0016', name:'Amoxilin tab', stockBase:44, location:'BLKG-1-5', units:[
    { id:'OB0016-STRIP', label:'Strip', conversion:1, price:7000 },
    { id:'OB0016-BOX', label:'Box (10 Strip)', conversion:10, price:65000 }
  ]}
];

const API_URL = globalThis.ANA_FARMA_V2_API || '';
const QUEUE_KEY = 'ana-farma-v2-offline-queue';
const state = { cart:[], offline:false, queue:loadQueue() };
const $ = id => document.getElementById(id);
const rupiah = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);

function loadQueue(){
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function saveQueue(){ localStorage.setItem(QUEUE_KEY, JSON.stringify(state.queue)); }
function selectedProduct(){ return products.find(p=>p.id===$('productSelect').value); }
function selectedUnit(){ const p=selectedProduct(); return p?.units.find(u=>u.id===$('unitSelect').value); }
function renderProducts(){
  $('productSelect').innerHTML = products.map(p=>`<option value="${p.id}">${p.name} — stok ${p.stockBase} strip</option>`).join('');
  renderUnits();
}
function renderUnits(){
  const p=selectedProduct();
  $('unitSelect').innerHTML=(p?.units||[]).map(u=>`<option value="${u.id}">${u.label}</option>`).join('');
  renderPrice();
}
function renderPrice(){ const u=selectedUnit(); $('unitPrice').textContent=rupiah(u?.price||0); }
function validateLine(){
  const p=selectedProduct(), u=selectedUnit(), qty=Number($('qtyInput').value);
  if(!p||!u||!Number.isInteger(qty)||qty<1) return 'Produk, satuan, dan jumlah harus valid.';
  if(qty*u.conversion>p.stockBase) return `Stok tidak cukup. Dibutuhkan ${qty*u.conversion} strip, tersedia ${p.stockBase}.`;
  return '';
}
function renderCart(){
  $('cartBody').innerHTML=state.cart.map(x=>`<tr><td>${x.name}</td><td>${x.unit}</td><td>${x.qty}</td><td>${rupiah(x.price)}</td><td>${rupiah(x.total)}</td></tr>`).join('');
  $('cartTotal').textContent=rupiah(state.cart.reduce((s,x)=>s+x.total,0));
}
async function commitRequest(request){
  if(!API_URL) return { simulated:true };
  const response = await fetch(API_URL, {
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action:'createTransaksiV2', request})
  });
  if(!response.ok) throw new Error(`API HTTP ${response.status}`);
  const payload = await response.json();
  if(payload?.ok === false || payload?.success === false) throw new Error(payload.message || payload.error || 'API menolak transaksi.');
  return payload;
}
async function checkout(){
  const total=state.cart.reduce((s,x)=>s+x.total,0), paid=Number($('paymentInput').value);
  if(!state.cart.length){showResult('result','Keranjang masih kosong.','error');return;}
  if(!Number.isFinite(paid)||paid<total){showResult('result',`Pembayaran kurang ${rupiah(total-paid)}.`,'error');return;}
  const request={requestId:crypto.randomUUID(),lines:structuredClone(state.cart),total,paid,createdAt:new Date().toISOString()};
  if(state.offline){
    state.queue.push(request); saveQueue(); renderQueue();
    showResult('result','Transaksi disimpan ke offline queue; stok belum dianggap terjual sampai sync berhasil.','ok');
  } else if(!API_URL){
    showResult('result','VALIDASI UI berhasil. Belum ada API V2 terpasang, sehingga transaksi TIDAK ditulis ke database.','ok');
  } else {
    try {
      await commitRequest(request);
      showResult('result',`Transaksi berhasil dikirim ke API V2. Total ${rupiah(total)}; kembalian ${rupiah(paid-total)}.`,'ok');
    } catch(error) {
      state.queue.push(request); saveQueue(); renderQueue();
      showResult('result',`API gagal: ${error.message}. Transaksi dipertahankan di offline queue; stok belum dianggap terjual.`,'error');
      return;
    }
  }
  state.cart=[];renderCart();
}
function showResult(id,text,cls=''){ $(id).className=`result ${cls}`;$(id).textContent=text; }
function renderQueue(){ $('queueResult').textContent=`Queue: ${state.queue.length}`; }
function toggleOffline(){state.offline=!state.offline;$('offlineBadge').textContent=state.offline?'OFFLINE':'ONLINE';$('toggleOfflineBtn').textContent=state.offline?'Kembali online':'Simulasikan offline';}
async function sync(){
  if(state.offline){showResult('queueResult','Tidak dapat sync saat offline.','error');return;}
  if(!state.queue.length){renderQueue();return;}
  if(!API_URL){showResult('queueResult','API V2 belum dikonfigurasi; queue dipertahankan dan TIDAK dihapus.','error');return;}
  const pending=[...state.queue];
  for(let i=0;i<pending.length;i++){
    try {
      await commitRequest(pending[i]);
    } catch(error) {
      state.queue=pending.slice(i);
      saveQueue();
      renderQueue();
      showResult('queueResult',`Sync berhenti pada request ${i+1}/${pending.length}: ${error.message}. Request yang belum di-acknowledge dipertahankan.`,'error');
      return;
    }
  }
  state.queue=[];
  saveQueue();
  renderQueue();
  showResult('queueResult',`${pending.length} request berhasil dikirim dan di-acknowledge API V2.`,'ok');
}
function validateMaster(){
  const strip=Number($('stripPrice').value),box=Number($('boxPrice').value);
  if(strip<=0||box<=0){showResult('masterResult','Harga harus lebih besar dari nol.','error');return;}
  showResult('masterResult',`Valid. Strip ${rupiah(strip)} dan Box ${rupiah(box)} adalah harga independen; conversion Box tetap 10 Strip.`,'ok');
}
function addLine(){
  const error=validateLine();
  if(error){ $('validation').className='validation error'; $('validation').textContent=error; return; }
  const p=selectedProduct(),u=selectedUnit(),qty=Number($('qtyInput').value);
  state.cart.push({productId:p.id,unitId:u.id,name:p.name,unit:u.label,qty,conversion:u.conversion,price:u.price,total:qty*u.price});
  $('validation').className='validation ok'; $('validation').textContent='Baris penjualan valid dan ditambahkan.';
  renderCart();
}

$('productSelect').addEventListener('change',renderUnits);
$('unitSelect').addEventListener('change',renderPrice);
$('addBtn').addEventListener('click',addLine);
$('checkoutBtn').addEventListener('click',checkout);
$('toggleOfflineBtn').addEventListener('click',toggleOffline);
$('syncBtn').addEventListener('click',sync);
$('validateMasterBtn').addEventListener('click',validateMaster);
renderProducts();renderCart();renderQueue();$('trustBadge').textContent=API_URL?'MASTER: API CONFIGURED':'MASTER: HARNESS ONLY';
