import React,{useCallback,useEffect,useState} from 'react';
import {Wind,Loader2,Clock} from 'lucide-react';
import {sb} from './supabase.js';
import {khiInfo,fmt} from './khi.js';
import {Avatar,PlayerName} from './ui.jsx';

const MEDAL=['🥇','🥈','🥉'];
const sign=n=>(n>0?'+':'')+fmt(n);
const dmy=d=>d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
const pad2=n=>String(n).padStart(2,'0');
function left(ms){
  if(ms<=0)return 'Đang chốt bảng…';
  const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return (d?`${d} ngày `:'')+`${pad2(h)}:${pad2(m)}:${pad2(s%60)}`;
}

export default function Leaderboard({onBack,onPlay}){
  const [off,setOff]=useState(0),[rows,setRows]=useState(null),[err,setErr]=useState(''),[now,setNow]=useState(Date.now());

  const load=useCallback(async()=>{
    const {data,error}=await sb.rpc('weekly_leaderboard',{p_offset:off,p_limit:50});
    if(error){setErr(error.message);setRows([]);return;}
    setErr('');setRows(data||[]);
  },[off]);

  // Tự cập nhật: tải lại mỗi 15 giây và khi quay lại thẻ trình duyệt
  useEffect(()=>{
    setRows(null);load();
    const poll=setInterval(()=>{if(!document.hidden)load();},15000);
    const vis=()=>{if(!document.hidden)load();};
    document.addEventListener('visibilitychange',vis);
    return()=>{clearInterval(poll);document.removeEventListener('visibilitychange',vis);};
  },[load]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);

  const first=rows&&rows[0];
  const start=first?new Date(first.wk_start+'T00:00:00'):null;
  const end=first?new Date(first.wk_end):null;
  const range=start?`${dmy(start)} – ${dmy(new Date(start.getTime()+6*86400000))}`:'';
  const me=rows&&rows.find(r=>r.is_me);

  return <main className="content lbpage">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <div className="shophead"><h2 className="sectiontitle" style={{margin:0}}>Bảng xếp hạng tuần</h2></div>
    <div className="tabs"><button className={'tab '+(off===0?'on':'')} onClick={()=>setOff(0)}>Tuần này</button><button className={'tab '+(off===1?'on':'')} onClick={()=>setOff(1)}>Tuần trước</button></div>

    <section className="panel lbinfo">
      <div className="modeinfo"><span className="modeicon"><Wind/></span>
        <p>Xếp theo <b>điểm Khí</b> lời ròng trong Luyện Khí. Thắng cộng Khí, thua trừ Khí. Ván dưới 6 nước không tính.</p></div>
      {range&&<p className="muted lbrange">Tuần {range} (giờ Việt Nam){off===0&&end&&<> • <Clock size={12} style={{verticalAlign:'-2px'}}/> chốt bảng sau <b>{left(end.getTime()-now)}</b></>}</p>}
    </section>

    {me&&<div className="lbme"><span>Hạng của bạn: <b>#{me.pos}</b></span><span className={Number(me.gained)>=0?'up':'down'}><b>{sign(Number(me.gained))}</b> Khí</span></div>}

    {rows===null?<p className="muted" style={{textAlign:'center',margin:'40px 0'}}><Loader2 className="spin" size={22}/></p>
    :err?<p className="warn">{err}{/weekly_leaderboard|function/i.test(err)&&' — hãy chạy lại supabase/schema.sql (giai đoạn 4).'}</p>
    :rows.length===0?<section className="searchcard" style={{marginTop:20}}><h2>Chưa có ai lên bảng</h2>
      <p className="muted">{off===0?'Tuần này chưa có ván Luyện Khí nào. Hãy là người đầu tiên!':'Tuần trước không có ván Luyện Khí nào được tính.'}</p>
      {off===0&&onPlay&&<button className="primary" onClick={onPlay}>Vào Luyện Khí</button>}</section>
    :<div className="hlist">{rows.map((r,i)=>{
      const k=khiInfo(r.khi),gap=i>0&&r.pos-rows[i-1].pos>1,g=Number(r.gained),p={username:r.username,equipped:r.equipped};
      return <React.Fragment key={r.player_id}>
        {gap&&<div className="lbgap">• • •</div>}
        <div className={'hrow static lbrow '+(r.is_me?'me ':'')+(r.pos<=3?'top top'+r.pos:'')}>
          <span className="lbpos">{r.pos<=3?<span className="medal">{MEDAL[r.pos-1]}</span>:r.pos}</span>
          <Avatar p={p} size={36}/>
          <div className="hmain"><b><PlayerName p={p}/>{r.is_me?' (bạn)':''}</b><small>{k.name} • {r.games} trận • {r.wins} thắng</small></div>
          <div className="hdelta"><b className={g>=0?'up':'down'}>{sign(g)}</b><small>Khí tuần</small></div>
        </div></React.Fragment>;})}</div>}
    <p className="hint" style={{marginTop:14}}>Thẻ x2/x4 Khí được tính vào điểm tuần. Điểm tuần chỉ tính từ các ván Luyện Khí, không tính Khí do quản trị chỉnh.</p>
  </main>;
}
