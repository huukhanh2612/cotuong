import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Flag} from 'lucide-react';
import {sb} from './supabase.js';
import {isRed,legalMoves,inCheck,fresh,applyMove} from './engine.js';
import Board,{names} from './Board.jsx';
import {useGameSounds} from './useGameSounds.js';
import {useAudio,setAudio,sfx} from './audio.js';
import {MODE_NAMES,roomRules,fmt,tierOf} from './khi.js';
import {Avatar,PlayerName,useCatalog} from './ui.jsx';
import {frameStyle} from './cosmetics.js';

const sign=n=>(n>0?'+':'')+fmt(n);

export default function OnlineGame({matchId,userId,onExit,onHistory}){
  const [m,setM]=useState(null),[g,setG]=useState(fresh),[sel,setSel]=useState(null),[err,setErr]=useState(''),[who,setWho]=useState({}),[now,setNow]=useState(Date.now()),[fr,setFr]=useState('');
  const aud=useAudio();
  const {byId}=useCatalog();
  const busy=useRef(false),reported=useRef(false),lastClaim=useRef(0);

  // Đồng bộ danh sách nước đi từ server vào trạng thái ván (bỏ qua nước đã có)
  const sync=useCallback((moves,force)=>setG(cur=>{
    let x=force||cur.past.length>moves.length&&!busy.current?fresh():cur;
    for(let i=x.past.length;i<moves.length;i++){const v=moves[i];x=applyMove(x,[v.fx,v.fy],[v.tx,v.ty]);}
    return x;
  }),[]);

  const load=useCallback(async(force)=>{
    const [a,b]=await Promise.all([
      sb.from('matches').select('*').eq('id',matchId).single(),
      sb.from('match_moves').select('ply,fx,fy,tx,ty').eq('match_id',matchId).order('ply')]);
    if(a.error){setErr(a.error.message);return;}
    setM(a.data);sync(b.data||[],force);
  },[matchId,sync]);

  useEffect(()=>{load(true);},[load]);
  useEffect(()=>{ // tên & điểm hai bên
    if(!m||who.loaded)return;
    sb.from('profiles').select('id,username,rating,equipped,player_code').in('id',[m.red_id,m.black_id]).then(({data})=>{
      const o={loaded:true};(data||[]).forEach(p=>o[p.id]=p);setWho(o);});
  },[m,who.loaded]);

  useEffect(()=>{ // realtime + dự phòng thăm dò 3 giây
    const ch=sb.channel('match-'+matchId)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'match_moves',filter:`match_id=eq.${matchId}`},()=>load())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>setM(p.new))
      .subscribe();
    const poll=setInterval(()=>{if(!m||m.status==='playing')load();},3000);
    const clock=setInterval(()=>setNow(Date.now()),1000);
    return()=>{sb.removeChannel(ch);clearInterval(poll);clearInterval(clock);};
  },[matchId,load,m?.status]);

  const myColor=m?(m.red_id===userId?'red':'black'):'red';
  const playing=m?.status==='playing';
  const turnColor=g.turn?'red':'black';
  const myTurn=playing&&!g.result&&turnColor===myColor;
  const legal=useMemo(()=>legalMoves(g.board,g.turn),[g.board,g.turn]);
  const check=!g.result&&inCheck(g.board,g.turn);
  const targets=sel?legal.filter(([f])=>f[0]===sel[0]&&f[1]===sel[1]).map(t=>t[1]):[];

  const outcome=m&&m.status==='finished'?(!m.winner?'draw':m.winner===myColor?'win':'loss'):null;
  useGameSounds(g,check,outcome);

  // Bên vừa đi nước cuối báo kết thúc theo luật (chiếu bí, hết nước, hòa)
  useEffect(()=>{
    if(!g.result||!playing||reported.current)return;
    const mover=g.past.length%2===1?'red':'black';
    if(mover!==myColor)return;
    reported.current=true;
    sb.rpc('finish_match',{p_match:matchId,p_result:g.result.winner?'win':'draw',p_reason:g.result.why}).then(({error})=>{if(error){reported.current=false;setErr(error.message);}else load();});
  },[g.result,playing,myColor,matchId,load]);

  // Hết giờ: bên nào cũng có thể gọi, server tự kiểm tra hạn
  const secs=m?Math.max(0,Math.ceil((new Date(m.deadline).getTime()-now)/1000)):0;
  useEffect(()=>{
    if(!playing||g.result||secs>0||Date.now()-lastClaim.current<4000)return;
    lastClaim.current=Date.now();
    sb.rpc('claim_timeout',{p_match:matchId}).then(()=>load());
  },[secs,playing,g.result,matchId,load]);

  const play=async(f,t)=>{
    const ply=g.past.length;busy.current=true;setSel(null);setErr('');
    setG(v=>applyMove(v,f,t));
    const {error}=await sb.rpc('make_move',{p_match:matchId,p_ply:ply,p_fx:f[0],p_fy:f[1],p_tx:t[0],p_ty:t[1]});
    busy.current=false;
    if(error){setErr(error.message);load(true);}
  };
  const pick=(x,y)=>{
    if(!myTurn)return;
    if(sel&&targets.some(t=>t[0]===x&&t[1]===y))return play(sel,[x,y]);
    const p=g.board[y][x];if(p&&isRed(p)===g.turn){setSel([x,y]);sfx.select();}else setSel(null);
  };
  const resign=async()=>{
    if(!playing||!confirm('Bạn chắc chắn muốn xin thua?'))return;
    const {error}=await sb.rpc('resign_match',{p_match:matchId});
    if(error)setErr(error.message);else load();
  };

  if(!m)return <main className="gamepage"><p className="muted">{err||'Đang tải ván đấu…'}</p></main>;

  const me=who[userId],theme=byId[me?.equipped?.board]?.data,oppId=myColor==='red'?m.black_id:m.red_id,opp=who[oppId];
  const finished=m.status==='finished';
  const won=finished&&m.winner===myColor,draw=finished&&!m.winner;
  const rDelta=myColor==='red'?m.red_rating_delta:m.black_rating_delta,kDelta=myColor==='red'?m.red_khi_delta:m.black_khi_delta;
  const cDelta=myColor==='red'?m.red_coin_delta:m.black_coin_delta,myStreak=myColor==='red'?m.red_streak:m.black_streak;
  const status=finished?(draw?'Hòa cờ':won?'Bạn thắng':'Bạn thua')
    :check?`⚠ Chiếu tướng! ${myTurn?'Đến lượt bạn':'Đối thủ đang đi'}`:myTurn?'Đến lượt bạn':'Chờ đối thủ…';
  const label=c=>c==='red'?'Đỏ':'Đen';
  const Tray=({list})=><div className="tray">{list.map((p,i)=><span key={i} className={'mini '+(isRed(p)?'r':'b')}>{names[p]}</span>)}</div>;
  const Side=({color,p,lost})=><div className="player"><Avatar p={p} size={30} className={color==='red'?'red':''}/>
    <div><b><PlayerName p={p} fallback="…"/>{color===myColor?' (bạn)':''}</b><small>{label(color)} • Rank {p?.rating??'—'} ({tierOf(p?.rating??0)}) {playing&&!g.result&&turnColor===color?'• Đang đi':''}</small></div><Tray list={lost}/></div>;
  const oppColor=myColor==='red'?'black':'red';
  // Kết bạn với đối thủ ngay sau ván (dùng ID của họ)
  const addFriend=async()=>{
    const code=opp?.player_code;if(!code)return;setFr('Đang gửi…');
    const {data,error}=await sb.rpc('send_friend_request',{p_code:code});
    setFr(error?error.message:data==='accepted'?'Hai bạn đã là bạn bè!':'Đã gửi lời mời kết bạn');
  };

  return <main className="gamepage">
    <div className="gamehead"><button className="back" onClick={onExit}>← Trang chủ</button>
      <div><b>{MODE_NAMES[m.mode]}{m.mode==='khi'?` • cược ${fmt(m.bet)} Khí`:''}</b>{m.mode==='room'&&<small>{roomRules(m.rated,m.bet,m.bet_coins)}</small>}<small className={check?'warn':''}>{status}</small></div>
      <button className="iconbtn" onClick={()=>setAudio({sfxOn:!aud.sfxOn})} title="Hiệu ứng âm thanh">{aud.sfxOn?'♪':'✕'}</button></div>
    <div className="boardwrap">
      <Side color={oppColor} p={opp} lost={g.lost[oppColor==='red'?'red':'black']}/>
      <div className="boardframe" style={frameStyle(theme)}><Board g={g} sel={sel} targets={targets} onPick={pick} check={check} flip={myColor==='black'} theme={theme}/>
        {finished&&<div className="overlay"><div className="resultcard"><span className="seal big">{draw?'和':won?'勝':'敗'}</span>
          <h2>{draw?'Hòa cờ':won?'Bạn thắng':'Bạn thua'}</h2><p>{m.reason}</p>
          {(m.mode==='ranked'||m.rated)&&<p><b>Rank {sign(rDelta)}</b></p>}
          {m.mode==='ranked'&&cDelta>0&&<p><b>Thy Mây +{cDelta}</b>{won&&myStreak>=3?` • 🔥 chuỗi thắng ${myStreak} (x2)`:''}</p>}
          {m.mode==='ranked'&&cDelta===0&&<p>Ván dưới 6 nước nên không nhận Thy Mây.</p>}
          {(m.mode==='khi'||(m.mode==='room'&&m.bet>0))&&<p><b>Khí {sign(Number(kDelta))}</b></p>}
          {m.mode==='room'&&m.bet_coins>0&&<p><b>Thy Mây {sign(cDelta)}</b></p>}
          {fr&&<p>{fr}</p>}
          <div className="rowbtn"><button className="primary" onClick={onExit}>Trang chủ</button><button className="secondary darkbtn" onClick={onHistory}>Lịch sử</button>{opp?.player_code&&<button className="secondary darkbtn" disabled={!!fr} onClick={addFriend}>Kết bạn</button>}</div></div></div>}</div>
      <Side color={myColor} p={me} lost={g.lost[myColor==='red'?'red':'black']}/>
    </div>
    {playing&&<div className={'clock '+(secs<=20?'low':'')}>{myTurn?'Thời gian của bạn':'Thời gian đối thủ'}: <b>{Math.floor(secs/60)}:{String(secs%60).padStart(2,'0')}</b></div>}
    {err&&<p className="warn" style={{textAlign:'center'}}>{err}</p>}
    <div className="gameactions"><button className="secondary" onClick={resign} disabled={!playing}><Flag size={16}/> Xin thua</button></div>
    <p className="hint">Mỗi nước đi có 150 giây. Hết giờ sẽ bị xử thua. Ván online không có đi lại.</p>
  </main>;
}
