import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Coins,Copy,Check,Clock,CircleCheck,CircleX,Ban,ChevronRight} from 'lucide-react';
import {sb} from './supabase.js';
import {fmt} from './khi.js';
import {BANK,TOPUP,topupCoins,vnd,memoOf} from './bank.js';

const when=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const ST={pending:['Chờ duyệt','draw',<Clock size={13}/>],approved:['Đã cộng Thy Mây','win',<CircleCheck size={13}/>],rejected:['Bị từ chối','loss',<CircleX size={13}/>],cancelled:['Đã hủy','draw',<Ban size={13}/>]};

function CopyRow({label,value,shown}){
  const [ok,setOk]=useState(false);
  const copy=async()=>{
    try{await navigator.clipboard.writeText(String(value));}
    catch{const t=document.createElement('textarea');t.value=String(value);document.body.appendChild(t);t.select();try{document.execCommand('copy');}catch{}t.remove();}
    setOk(true);setTimeout(()=>setOk(false),1500);
  };
  return <div className="tuline"><span><small>{label}</small><b>{shown||value}</b></span>
    <button className="secondary" onClick={copy}>{ok?<Check size={14}/>:<Copy size={14}/>} {ok?'Đã chép':'Chép'}</button></div>;
}

function Transfer({o}){
  return <div className="tubox">
    <p className="hint" style={{padding:0}}>Mở app ngân hàng, quét mã QR (hoặc nhập tay) và chuyển <b>đúng số tiền</b> với <b>đúng nội dung</b> bên dưới. Chuyển xong, chờ admin duyệt thủ công là Thy Mây được cộng vào ví.</p>
    <div className="tugrid">
      <img className="tuqr" src={BANK.qr} alt="Mã QR nhận tiền"/>
      <div className="tuinfo">
        <CopyRow label="Ngân hàng" value={BANK.bank} shown={`${BANK.bank} • ${BANK.branch}`}/>
        <CopyRow label="Chủ tài khoản" value={BANK.name}/>
        <CopyRow label="Số tài khoản" value={BANK.account}/>
        <CopyRow label="Số tiền" value={o.amount} shown={vnd(o.amount)}/>
        <CopyRow label="Nội dung chuyển khoản" value={memoOf(o.id)}/>
      </div>
    </div>
    <p className="hint" style={{padding:0}}>Bạn sẽ nhận <b>{fmt(o.coins)} Thy Mây</b>. Nếu quên ghi nội dung hoặc chuyển sai số tiền, hãy báo admin kèm ảnh chụp giao dịch.</p>
  </div>;
}

export default function TopUp({profile,refresh,onBack}){
  const [amount,setAmount]=useState(20000),[custom,setCustom]=useState(''),[orders,setOrders]=useState(null),[openId,setOpenId]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const seen=useRef(null);
  const val=custom!==''?Number(custom):amount;
  const valid=Number.isInteger(val)&&val>=TOPUP.min&&val<=TOPUP.max&&val%TOPUP.step===0;

  const load=useCallback(async()=>{
    const {data}=await sb.from('topup_orders').select('*').order('created_at',{ascending:false}).limit(30);
    const list=data||[];setOrders(list);
    // Có lệnh vừa được duyệt -> tải lại ví
    const approved=list.filter(o=>o.status==='approved').map(o=>o.id).join(',');
    if(seen.current!==null&&seen.current!==approved)refresh&&refresh();
    seen.current=approved;
  },[refresh]);
  useEffect(()=>{load();const t=setInterval(load,10000);const vis=()=>{if(!document.hidden)load();};document.addEventListener('visibilitychange',vis);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',vis);};},[load]);

  const create=async()=>{
    setErr('');setBusy(true);
    const {data,error}=await sb.rpc('create_topup',{p_amount:val});
    setBusy(false);
    if(error){setErr(error.message);return;}
    await load();setOpenId(data);
  };
  const cancel=async o=>{
    if(!confirm(`Hủy lệnh nạp ${vnd(o.amount)}? Nếu bạn đã chuyển khoản rồi thì đừng hủy, hãy chờ admin duyệt.`))return;
    setErr('');const {error}=await sb.rpc('cancel_topup',{p_id:o.id});
    if(error)setErr(error.message);else{if(openId===o.id)setOpenId(null);load();}
  };
  const pending=(orders||[]).filter(o=>o.status==='pending');

  return <main className="content">
    <button className="back" onClick={onBack}>← Ví tài nguyên</button>
    <h2 className="sectiontitle">Nạp Thy Mây</h2>
    <section className="panel">
      <div className="modeinfo"><span className="modeicon"><Coins/></span><p>Số dư hiện tại: <b>{fmt(profile?.coins??0)} Thy Mây</b>. Nạp bằng chuyển khoản ngân hàng, admin duyệt thủ công.</p></div>
      <h3 className="igroup">Chọn mức nạp</h3>
      <div className="tuchips">{TOPUP.presets.map(a=><button key={a} className={'tuchip'+(custom===''&&amount===a?' on':'')} onClick={()=>{setAmount(a);setCustom('');}}>
        <b>{a>=1000000?'1 triệu':(a/1000)+'K'}</b><small>{fmt(topupCoins(a))} Thy Mây</small></button>)}</div>
      <div className="tucustom"><label>Hoặc nhập số tiền khác (bội số của 10.000đ, tối đa 1.000.000đ)</label>
        <input type="number" inputMode="numeric" min={TOPUP.min} max={TOPUP.max} step={TOPUP.step} value={custom} placeholder="Ví dụ: 30000" onChange={e=>setCustom(e.target.value)}/></div>
      <p className="tusum">{valid?<>Nạp <b>{vnd(val)}</b> → nhận <b>{fmt(topupCoins(val))} Thy Mây</b></>:<span className="muted">Số tiền phải là bội số của 10.000đ, từ 10.000đ đến 1.000.000đ.</span>}</p>
      {err&&<p className="warn">{err}</p>}
      <button className="primary wide" style={{marginTop:8}} disabled={!valid||busy||pending.length>=3} onClick={create}>Tạo lệnh nạp <ChevronRight size={16}/></button>
      {pending.length>=3&&<p className="hint">Bạn đang có 3 lệnh chờ duyệt, hãy chờ duyệt hoặc hủy bớt trước khi tạo lệnh mới.</p>}
    </section>

    <h2 className="sectiontitle" style={{marginTop:26}}>Lệnh nạp của bạn</h2>
    {!orders&&<p className="muted">Đang tải…</p>}
    {orders&&!orders.length&&<p className="muted">Chưa có lệnh nạp nào.</p>}
    <div className="hlist">{(orders||[]).map(o=>{const [txt,cls,ic]=ST[o.status]||[o.status,'draw',null];const open=openId===o.id&&o.status==='pending';
      return <div key={o.id} className="tuorder">
        <div className="hrow static">
          <span className="hmain"><b>{vnd(o.amount)} → {fmt(o.coins)} Thy Mây</b><small>Mã {memoOf(o.id)} • {when(o.created_at)}{o.note?` • ${o.note}`:''}</small></span>
          <span className={'res '+cls} style={{display:'inline-flex',gap:5,alignItems:'center'}}>{ic}{txt}</span>
        </div>
        {o.status==='pending'&&<div className="rowbtn" style={{margin:'6px 0 2px'}}>
          <button className="secondary" onClick={()=>setOpenId(open?null:o.id)}>{open?'Ẩn thông tin':'Thông tin chuyển khoản'}</button>
          <button className="secondary danger" onClick={()=>cancel(o)}>Hủy lệnh</button></div>}
        {open&&<Transfer o={o}/>}
      </div>;})}</div>
  </main>;
}
