import React,{useEffect,useRef,useState} from 'react';
import {Loader2,Users} from 'lucide-react';
import {sb} from './supabase.js';
import {fmt,khiInfo} from './khi.js';
import {TAM_BETS,PLACE_NAME,SEAT} from './tam.js';
import {BOT_WAIT_SECONDS} from './bot.js';
import BotCheck from './BotCheck.jsx';

const when=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const sign=n=>(n>0?'+':'')+fmt(n);

export default function TamLobby({profile,onMatch,onBack}){
  const [bet,setBet]=useState(null),[searching,setSearching]=useState(false),[secs,setSecs]=useState(0),[waiting,setWaiting]=useState(1),[err,setErr]=useState(''),[hist,setHist]=useState(null);
  const inflight=useRef(false);
  const canBet=b=>Number(profile?.khi||0)>=b;
  const k=khiInfo(profile?.khi||0);

  useEffect(()=>{sb.rpc('my_tam_history',{p_limit:8}).then(({data})=>setHist(data||[]));},[]);

  useEffect(()=>{
    if(!searching)return;
    let stop=false;const t0=Date.now();
    const tick=async()=>{
      if(inflight.current||stop)return;inflight.current=true;
      const {data,error}=await sb.rpc('find_tam',{p_bet:bet});
      inflight.current=false;if(stop)return;
      if(error){setErr(error.message);setSearching(false);return;}
      if(data?.match){stop=true;onMatch(data.match);return;}
      if(data?.waiting)setWaiting(data.waiting);
    };
    tick();
    const poll=setInterval(tick,2000),late=setTimeout(tick,BOT_WAIT_SECONDS*1000+300),clock=setInterval(()=>setSecs(Math.floor((Date.now()-t0)/1000)),500);
    return()=>{stop=true;clearInterval(poll);clearTimeout(late);clearInterval(clock);sb.rpc('cancel_tam').then(()=>{});};
  },[searching]);

  const start=()=>{setErr('');setSecs(0);setWaiting(1);setSearching(true);};

  if(searching)return <main className="content lobby">
    <section className="searchcard"><Loader2 className="spin" size={38}/>
      <h2>Đang tìm đối thủ…</h2>
      <p className="muted">Tam đấu • cược {fmt(bet)} Khí</p>
      <div className="tamdots">{[0,1,2].map(i=><span key={i} className={i<waiting?'on':''}><Users size={18}/></span>)}</div>
      <p className="muted">Đã có <b>{Math.min(waiting,3)}/3</b> người</p>
      <div className="timer">{String(Math.floor(secs/60)).padStart(2,'0')}:{String(secs%60).padStart(2,'0')}</div>
      <p className="hint">Giữ trang này mở. Đủ 3 người cùng mức cược, ván đấu sẽ tự bắt đầu. Sau {BOT_WAIT_SECONDS} giây chưa đủ người, ghế trống sẽ do bot đảm nhận.</p>
      <button className="secondary" onClick={()=>setSearching(false)}>Hủy ghép trận</button>
      <BotCheck/>
    </section></main>;

  return <main className="content lobby">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Tam đấu</h2>
    <section className="panel">
      <div className="modeinfo"><span className="modeicon"><Users/></span><p>Ba kỳ thủ cùng đấu trên <b>một bàn cờ</b>: Đỏ, Đen và Xanh. Ăn tướng ai thì người đó bị loại. Người cuối cùng còn tướng là <b>Nhất</b>.</p></div>
      <p className="muted">Khí hiện có: <b>{fmt(profile?.khi||0)}</b> • Cấp {k.level} — {k.name}</p>
      <label className="lbl">Chọn mức cược</label>
      <div className="bets tam3">{TAM_BETS.map(b=><button key={b} disabled={!canBet(b)} className={'bet '+(bet===b?'on':'')} onClick={()=>setBet(b)}><b>{fmt(b)}</b><small>Khí</small></button>)}</div>
      {!canBet(TAM_BETS[0])&&<p className="warn">Bạn cần tối thiểu {fmt(TAM_BETS[0])} Khí để vào Tam đấu.</p>}
      {bet&&<div className="tampay">
        <div><small>NHẤT</small><b className="up">{sign(bet)}</b></div>
        <div><small>NHÌ</small><b>0</b></div>
        <div><small>BA</small><b className="down">{sign(-bet)}</b></div></div>}
      {err&&<p className="warn">{err}</p>}
      <button className="primary wide" disabled={!bet} onClick={start}>Tìm 2 đối thủ</button>
    </section>

    <section className="panel" style={{marginTop:14}}>
      <h3 className="igroup">Luật chơi</h3>
      <ul className="tamrules">
        <li>Bàn 13×13. Đỏ ở dưới, Đen ở trên, Xanh ở bên trái. Ghế được chia ngẫu nhiên, lượt đi xoay vòng <b>Đỏ → Đen → Xanh</b>.</li>
        <li>Quân đi như cờ tướng thường. Tốt đi thẳng về phía trước, qua sông (rời hàng thứ 5 của mình) mới được đi ngang. Voi chỉ đi trong vùng nhà của mình.</li>
        <li><b>Không có luật chiếu tướng.</b> Ăn được tướng của ai là loại người đó, toàn bộ quân của họ rời bàn.</li>
        <li>Xin thua hoặc hết giờ ({120} giây mỗi nước) cũng bị loại. Người bị loại trước xếp hạng Ba, người thứ hai xếp Nhì.</li>
        <li>Cược Khí bị giữ lúc vào trận. <b>Nhất</b> nhận lại cược và lời đúng bằng mức cược, <b>Nhì</b> nhận lại cược, <b>Ba</b> mất cược.</li>
        <li>Quá 450 nước mà chưa có người thắng thì hòa, hoàn cược cho cả ba.</li>
      </ul>
    </section>

    <h2 className="sectiontitle" style={{marginTop:22}}>Ván gần đây</h2>
    {!hist&&<p className="muted">Đang tải…</p>}
    {hist&&!hist.length&&<p className="muted">Bạn chưa chơi ván Tam đấu nào.</p>}
    <div className="hlist">{(hist||[]).map(h=><div key={h.id} className="hrow static">
      <span className="hmain"><b>{h.draw?'Hòa':'Hạng '+PLACE_NAME[h.place]} • cược {fmt(h.bet)} Khí</b><small>{when(h.created_at)} • {h.ply} nước • {h.reason}</small></span>
      <span className={'res '+(h.draw||Number(h.khi_delta)===0?'draw':Number(h.khi_delta)>0?'win':'loss')}>{sign(Number(h.khi_delta))} Khí</span></div>)}</div>
  </main>;
}
