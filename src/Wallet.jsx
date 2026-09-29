import React,{useEffect,useState} from 'react';
import {Coins,Wind,Trophy,Flame,Timer} from 'lucide-react';
import {sb} from './supabase.js';
import {khiInfo,fmt,tierOf} from './khi.js';
import {mmss} from './cosmetics.js';

const REASON={ranked:'Trận Rank',room_bet:'Cược phòng riêng',room_payout:'Thưởng phòng riêng',purchase:'Mua vật phẩm',topup:'Nạp Thy Mây',admin:'Quản trị viên'};
const when=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';

export default function Wallet({profile,onBack,goShop,goTopUp}){
  const [log,setLog]=useState(null),[boosts,setBoosts]=useState([]),[now,setNow]=useState(Date.now());
  useEffect(()=>{
    sb.from('coin_log').select('*').order('created_at',{ascending:false}).limit(60).then(({data})=>setLog(data||[]));
    sb.from('active_boosts').select('*').then(({data})=>setBoosts(data||[]));
    const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);
  },[]);
  const k=khiInfo(profile.khi),streak=profile.win_streak||0;
  const live=boosts.filter(b=>new Date(b.expires_at).getTime()>now);
  return <main className="content">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Ví tài nguyên</h2>
    <div className="wallet3">
      <div className="wcard gold"><Coins/><small>THY MÂY</small><b>{fmt(profile.coins||0)}</b><span>Tiền tệ mua vật phẩm</span></div>
      <div className="wcard"><Wind/><small>KHÍ</small><b>{fmt(profile.khi)}</b><span>Cấp {k.level} • {k.name}</span></div>
      <div className="wcard"><Trophy/><small>RANK</small><b>{profile.rating}</b><span>{tierOf(profile.rating)}</span></div>
    </div>
    <section className="panel" style={{marginTop:14}}>
      <div className="modeinfo"><span className="modeicon"><Flame/></span>
        <p>Chuỗi thắng Rank: <b>{streak}</b>. {streak>=3?'Đang nhận x2 Thy Mây mỗi trận thắng! Thua sẽ mất chuỗi.':`Thắng thêm ${3-streak} trận Rank liên tiếp để nhận x2 Thy Mây.`}</p></div>
      {live.length>0&&<div className="activeboosts" style={{marginTop:12}}>{live.map(b=><div key={b.boost_kind} className="abadge"><Timer size={15}/>
        <span>Thẻ x{Number(b.mult)} {b.boost_kind==='exp'?'EXP':'Khí'}</span><b>{mmss((new Date(b.expires_at).getTime()-now)/1000)}</b></div>)}</div>}
      <p className="hint" style={{marginTop:12}}>Mỗi trận Đấu Rank nhận 1 Thy Mây (trận cần từ 6 nước trở lên). Thắng liên tiếp từ 3 trận, mỗi trận thắng nhận 2.</p>
      <div className="rowbtn"><button className="primary" onClick={goTopUp}>Nạp Thy Mây</button><button className="secondary" onClick={goShop}>Tới cửa hàng</button></div>
    </section>
    <h2 className="sectiontitle" style={{marginTop:26}}>Lịch sử giao dịch</h2>
    {!log&&<p className="muted">Đang tải…</p>}
    {log&&!log.length&&<p className="muted">Chưa có giao dịch nào.</p>}
    <div className="hlist">{(log||[]).map(r=><div key={r.id} className="hrow static">
      <span className="hmain"><b>{REASON[r.reason]||r.reason}</b><small>{r.note||''}</small></span>
      <span className="hdelta"><b className={r.delta>0?'up':'down'}>{r.delta>0?'+':''}{fmt(r.delta)}</b><small>Số dư {fmt(r.balance)} • {when(r.created_at)}</small></span></div>)}</div>
  </main>;
}
