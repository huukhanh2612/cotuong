import React,{useEffect,useRef,useState} from 'react';
import {Swords,Trophy,Wind,Loader2} from 'lucide-react';
import {sb} from './supabase.js';
import {BETS,MODES,khiInfo,fmt,tierOf} from './khi.js';
import {BOT_WAIT_SECONDS} from './bot.js';
import BotCheck from './BotCheck.jsx';

const INFO={
  casual:{icon:<Swords/>,text:'Ván giao hữu, không ảnh hưởng điểm Rank hay Khí.'},
  ranked:{icon:<Trophy/>,text:'Thắng/thua thay đổi điểm Rank (Elo). Mỗi trận nhận 1 Thy Mây, thắng liên tiếp từ 3 trận nhận x2. Ghép với người có điểm gần bạn.'},
  khi:{icon:<Wind/>,text:'Đem Khí ra cược. Thắng nhận số Khí bằng mức cược, thua mất số Khí đó.'}
};

export default function Lobby({profile,initialMode='casual',onMatch,onBack}){
  const [mode,setMode]=useState(initialMode),[bet,setBet]=useState(null),[searching,setSearching]=useState(false),[secs,setSecs]=useState(0),[err,setErr]=useState('');
  const canBet=b=>Number(profile?.khi||0)>=b;
  const ready=mode!=='khi'||bet!==null;
  const inflight=useRef(false);

  useEffect(()=>{
    if(!searching)return;
    let stop=false;const t0=Date.now();
    const tick=async()=>{
      if(inflight.current||stop)return;inflight.current=true;
      const {data,error}=await sb.rpc('find_match',{p_mode:mode,p_bet:mode==='khi'?bet:0});
      inflight.current=false;if(stop)return;
      if(error){setErr(error.message);setSearching(false);return;}
      if(data){stop=true;onMatch(data);}
    };
    tick();
    // Thăm dò 2 giây/lần + 1 lần nữa ngay sau mốc 8 giây để server ghép bot đúng lúc
    const poll=setInterval(tick,2000),late=setTimeout(tick,BOT_WAIT_SECONDS*1000+300),clock=setInterval(()=>setSecs(Math.floor((Date.now()-t0)/1000)),500);
    return()=>{stop=true;clearInterval(poll);clearTimeout(late);clearInterval(clock);sb.rpc('cancel_queue').then(()=>{});};
  },[searching]);

  const start=()=>{setErr('');setSecs(0);setSearching(true);};
  const k=khiInfo(profile?.khi||0);

  if(searching)return <main className="content lobby">
    <section className="searchcard"><Loader2 className="spin" size={38}/>
      <h2>Đang tìm đối thủ…</h2>
      <p className="muted">{MODES[mode]}{mode==='khi'?` • cược ${fmt(bet)} Khí`:''}{mode==='ranked'?` • Rank ${profile.rating} (${tierOf(profile.rating)})`:''}</p>
      <div className="timer">{String(Math.floor(secs/60)).padStart(2,'0')}:{String(secs%60).padStart(2,'0')}</div>
      <p className="hint">Giữ trang này mở. Khi có người cùng chế độ, ván đấu sẽ tự bắt đầu. Nếu sau {BOT_WAIT_SECONDS} giây chưa có người, bạn sẽ được ghép với bot (cùng mức cược).</p>
      <button className="secondary" onClick={()=>setSearching(false)}>Hủy ghép trận</button>
      {profile?.is_admin&&<BotCheck/>}
    </section></main>;

  return <main className="content lobby">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Ghép trận</h2>
    <div className="tabs">{Object.keys(MODES).map(m=><button key={m} className={'tab '+(mode===m?'on':'')} onClick={()=>{setMode(m);setBet(null);setErr('');}}>{MODES[m]}</button>)}</div>
    <section className="panel">
      <div className="modeinfo"><span className="modeicon">{INFO[mode].icon}</span><p>{INFO[mode].text}</p></div>
      {mode==='ranked'&&<p className="muted">Điểm Rank của bạn: <b>{profile.rating}</b> • {tierOf(profile.rating)}</p>}
      {mode==='khi'&&<>
        <p className="muted">Khí hiện có: <b>{fmt(profile.khi)}</b> • Cấp {k.level} — {k.name}</p>
        <label className="lbl">Chọn mức cược</label>
        <div className="bets">{BETS.map(b=><button key={b} disabled={!canBet(b)} className={'bet '+(bet===b?'on':'')} onClick={()=>setBet(b)}><b>{fmt(b)}</b><small>Khí</small></button>)}</div>
        {!canBet(BETS[0])&&<p className="warn">Bạn không đủ Khí để cược (tối thiểu {BETS[0]}). Hãy chơi đấu thường hoặc Rank.</p>}
      </>}
      {err&&<p className="warn">{err}</p>}
      <button className="primary wide" disabled={!ready} onClick={start}>Tìm đối thủ</button>
      {profile?.is_admin&&<BotCheck/>}
    </section>
  </main>;
}
