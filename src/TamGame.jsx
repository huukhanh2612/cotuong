import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Flag} from 'lucide-react';
import {sb} from './supabase.js';
import TamBoard from './TamBoard.jsx';
import {parseBoard,movesFrom,countPieces,totalPieces,botPickTam,SEAT,PLACE_NAME,MAX_PLY} from './tam.js';
import {botDelay} from './bot.js';
import {useAudio,setAudio,sfx} from './audio.js';
import {fmt} from './khi.js';
import {Avatar,PlayerName,useCatalog} from './ui.jsx';
import {frameStyle} from './cosmetics.js';

const sign=n=>(n>0?'+':'')+fmt(n);

export default function TamGame({matchId,userId,onExit,onAgain}){
  const [m,setM]=useState(null),[who,setWho]=useState({}),[sel,setSel]=useState(null),[err,setErr]=useState(''),[now,setNow]=useState(Date.now()),[botRetry,setBotRetry]=useState(0),[botMsg,setBotMsg]=useState('');
  const aud=useAudio();
  const {byId}=useCatalog();
  const busy=useRef(false),lastClaim=useRef(0),prev=useRef(null),doneSnd=useRef(false);

  const load=useCallback(async()=>{
    const {data,error}=await sb.from('tam_matches').select('*').eq('id',matchId).single();
    if(error){setErr(error.message);return;}
    setM(data);
  },[matchId]);
  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    if(!m||who.loaded)return;
    sb.from('profiles').select('id,username,rating,khi,equipped,player_code,is_bot').in('id',m.players).then(({data})=>{
      const o={loaded:true};(data||[]).forEach(p=>o[p.id]=p);setWho(o);});
  },[m,who.loaded]);

  useEffect(()=>{
    const ch=sb.channel('tam-'+matchId)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tam_matches',filter:`id=eq.${matchId}`},p=>setM(p.new))
      .subscribe();
    const poll=setInterval(()=>{if(!m||m.status==='playing')load();},3000);
    const clock=setInterval(()=>setNow(Date.now()),1000);
    return()=>{sb.removeChannel(ch);clearInterval(poll);clearInterval(clock);};
  },[matchId,load,m?.status]);

  const board=useMemo(()=>m?parseBoard(m.board):null,[m?.board]);
  const seat=m?m.players.indexOf(userId):0;
  const playing=m?.status==='playing';
  const alive=m?m.places[seat]===0:false;
  const myTurn=!!m&&playing&&alive&&m.turn===seat;
  const targets=useMemo(()=>sel&&board&&board[sel[1]][sel[0]]?movesFrom(board,sel[0],sel[1]):[],[sel,board]);

  // Âm thanh: nước đi mới (có ăn quân hay không) và kết quả
  useEffect(()=>{
    if(!m||!board)return;
    const cur={ply:m.ply,n:totalPieces(board)},p=prev.current;prev.current=cur;
    if(p&&cur.ply>p.ply){if(cur.n<p.n)sfx.capture();else sfx.move();}
    if(p&&cur.ply>p.ply)setSel(null);
  },[m?.ply,board]);
  useEffect(()=>{
    if(!m||m.status!=='finished'||doneSnd.current)return;
    doneSnd.current=true;
    const pl=m.places[seat];
    setTimeout(()=>sfx[m.draw?'draw':pl===1?'win':pl===3?'lose':'draw'](),350);
  },[m?.status]);

  // Hết giờ: ai trong trận cũng gọi được, server tự kiểm tra hạn
  const secs=m?Math.max(0,Math.ceil((new Date(m.deadline).getTime()-now)/1000)):0;
  useEffect(()=>{
    if(!playing||secs>0||Date.now()-lastClaim.current<4000)return;
    // Tới lượt bot thì chờ quá hạn thêm 25 giây mới xử (bình thường bot đi trong vài giây)
    if(who[m.players[m.turn]]?.is_bot&&Date.now()-new Date(m.deadline).getTime()<25000)return;
    lastClaim.current=Date.now();
    sb.rpc('tam_claim_timeout',{p_match:matchId}).then(()=>load());
  },[secs,playing,matchId,load,now]);

  // Bot đi quân: trình duyệt của mỗi người chơi trong ván (kể cả người đã bị loại) tính nước cho bot đang tới lượt rồi gửi lên.
  // Nếu hai người cùng gửi thì server chỉ nhận một, lỗi "lệch nước" bị bỏ qua.
  useEffect(()=>{
    if(!m||!board||m.status!=='playing'||!who.loaded||!who[m.players[m.turn]]?.is_bot)return;
    const ply=m.ply,turn=m.turn,places=m.places,bd=board;
    let dead=false;
    setBotMsg('Bot đang nghĩ…');
    const t=setTimeout(async()=>{
      try{
        const mv=botPickTam(bd,turn,places);
        if(!mv){setBotMsg('Bot không còn nước đi.');return;}
        if(dead)return;
        const {error}=await sb.rpc('tam_bot_move',{p_match:matchId,p_ply:ply,p_fx:mv[0][0],p_fy:mv[0][1],p_tx:mv[1][0],p_ty:mv[1][1]});
        if(dead)return;
        load();
        if(error){
          console.error('tam_bot_move lỗi:',error);
          if(/Lệch|lệch|Trận đã|Chưa đến lượt/.test(error.message))setBotMsg('');   // người khác đã đi thay bot rồi
          else{setBotMsg('Bot gặp lỗi: '+error.message+' (tự thử lại sau 2 giây)');setTimeout(()=>setBotRetry(x=>x+1),2000);}
        }else setBotMsg('');
      }catch(e){console.error('bot lỗi:',e);setBotMsg('Bot gặp lỗi: '+(e?.message||e));}
    },botDelay()+Math.floor(Math.random()*500));
    return()=>{dead=true;clearTimeout(t);};
  },[m?.ply,m?.turn,m?.status,who.loaded,matchId,botRetry]);

  const play=async(f,t)=>{
    if(busy.current)return;busy.current=true;setSel(null);setErr('');
    const {error}=await sb.rpc('tam_move',{p_match:matchId,p_ply:m.ply,p_fx:f[0],p_fy:f[1],p_tx:t[0],p_ty:t[1]});
    busy.current=false;
    if(error)setErr(error.message);
    load();
  };
  const pick=(x,y)=>{
    if(!myTurn||busy.current)return;
    if(sel&&targets.some(t=>t[0]===x&&t[1]===y))return play(sel,[x,y]);
    const c=board[y][x];
    if(c&&+c[0]===seat){setSel([x,y]);sfx.select();}else setSel(null);
  };
  const resign=async()=>{
    if(!playing||!alive||!confirm('Xin thua sẽ bị loại khỏi ván và mất cược nếu xếp hạng Ba. Bạn chắc chắn?'))return;
    const {error}=await sb.rpc('tam_resign',{p_match:matchId});
    if(error)setErr(error.message);else load();
  };

  if(!m||!board)return <main className="gamepage"><p className="muted">{err||'Đang tải ván đấu…'}</p></main>;
  if(seat<0)return <main className="gamepage"><p className="muted">Bạn không thuộc trận này.</p><button className="secondary" onClick={onExit}>Trang chủ</button></main>;

  const me=who[userId],theme=byId[me?.equipped?.board]?.data;
  const finished=m.status==='finished';
  const myPlace=m.places[seat],kd=Number(m.kds[seat]||0);
  const turnName=SEAT[m.turn].name;
  const status=finished?(m.draw?'Hòa cờ':`Bạn về hạng ${PLACE_NAME[myPlace]}`)
    :!alive?`Bạn đã bị loại (hạng ${PLACE_NAME[myPlace]}), đang xem tiếp`
    :myTurn?'Đến lượt bạn':`Chờ ${turnName}…`;
  const order=[0,1,2];

  return <main className="gamepage tam">
    <div className="gamehead"><button className="back" onClick={onExit}>← Trang chủ</button>
      <div><b>Tam đấu • cược {fmt(m.bet)} Khí</b><small>Bạn cầm quân {SEAT[seat].name} • nước {m.ply}/{MAX_PLY}</small><small>{status}</small></div>
      <button className="iconbtn" onClick={()=>setAudio({sfxOn:!aud.sfxOn})} title="Hiệu ứng âm thanh">{aud.sfxOn?'♪':'✕'}</button></div>
    <div className="boardwrap">
      <div className="tamplayers">{order.map(s=>{const p=who[m.players[s]],out=m.places[s]!==0,turn=playing&&!out&&m.turn===s;
        return <div key={s} className={'tamp'+(turn?' turn':'')+(out?' out':'')} style={{borderColor:turn?SEAT[s].tint:undefined}}>
          <Avatar p={p} size={26}/>
          <div><b><i className="dot" style={{background:SEAT[s].tint}}/><PlayerName p={p} fallback="…"/>{s===seat?' (bạn)':''}</b>
            <small>{SEAT[s].name}{p?.is_bot?' • Bot':''} • {out?`Hạng ${PLACE_NAME[m.places[s]]}`:`${countPieces(board,s)} quân`}{turn?' • Đang đi':''}</small></div></div>;})}</div>
      <div className="boardframe" style={frameStyle(theme)}>
        <TamBoard board={board} seat={seat} sel={sel} targets={targets} onPick={pick} last={m.last_move} theme={theme} turnSeat={playing?m.turn:-1}/>
        {finished&&<div className="overlay"><div className="resultcard"><span className="seal big">{m.draw?'和':myPlace===1?'勝':myPlace===2?'次':'敗'}</span>
          <h2>{m.draw?'Hòa cờ':`Hạng ${PLACE_NAME[myPlace]}`}</h2><p>{m.reason}</p>
          <p><b>Khí {sign(kd)}</b></p>
          <div className="tamfinal">{[...order].sort((a,b)=>(m.places[a]||9)-(m.places[b]||9)).map(s=><span key={s}>{m.draw?'':PLACE_NAME[m.places[s]]+': '}<b style={{color:SEAT[s].ink}}>{who[m.players[s]]?.username||SEAT[s].name}</b> ({sign(Number(m.kds[s]||0))})</span>)}</div>
          <div className="rowbtn"><button className="primary" onClick={onAgain}>Chơi tiếp</button><button className="secondary darkbtn" onClick={onExit}>Trang chủ</button></div></div></div>}
      </div>
    </div>
    {playing&&<div className={'clock '+(secs<=20&&m.turn===seat?'low':'')}>{myTurn?'Thời gian của bạn':`Thời gian của ${turnName}`}: <b>{Math.floor(secs/60)}:{String(secs%60).padStart(2,'0')}</b></div>}
    {err&&<p className="warn" style={{textAlign:'center'}}>{err}</p>}
    {playing&&who.loaded&&who[m.players[m.turn]]?.is_bot&&<p className="hint" style={{textAlign:'center'}}>{botMsg||'Đang chờ bot…'} <button className="secondary" onClick={()=>setBotRetry(x=>x+1)}>Gọi bot đi</button></p>}
    <div className="gameactions"><button className="secondary" onClick={resign} disabled={!playing||!alive}><Flag size={16}/> Xin thua</button></div>
    <p className="hint">Mỗi nước đi có 120 giây. Hết giờ sẽ bị loại. Không có luật chiếu tướng: ăn tướng là loại người đó. Nhất +{fmt(m.bet)} Khí, Nhì hòa vốn, Ba −{fmt(m.bet)} Khí.</p>
  </main>;
}
