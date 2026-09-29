import React,{useEffect,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,SkipBack,SkipForward,Play,Pause} from 'lucide-react';
import {sb} from './supabase.js';
import {fresh,applyMove} from './engine.js';
import Board from './Board.jsx';
import {MODES,MODE_NAMES,fmt} from './khi.js';
import {useCatalog} from './ui.jsx';
import {frameStyle} from './cosmetics.js';

const RES={win:['Thắng','win'],loss:['Thua','loss'],draw:['Hòa','draw']};
const sign=n=>(n>0?'+':'')+fmt(n);
const when=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';

export function Replay({item,onBack,equipped}){
  const {byId}=useCatalog();const theme=byId[equipped?.board]?.data;
  const [moves,setMoves]=useState(null),[i,setI]=useState(0),[auto,setAuto]=useState(false);
  useEffect(()=>{sb.from('match_moves').select('ply,fx,fy,tx,ty').eq('match_id',item.id).order('ply').then(({data})=>{setMoves(data||[]);setI((data||[]).length);});},[item.id]);
  const states=useMemo(()=>{
    if(!moves)return [fresh()];
    const out=[fresh()];let g=out[0];
    for(const v of moves){g=applyMove(g,[v.fx,v.fy],[v.tx,v.ty]);out.push(g);}
    return out;
  },[moves]);
  const last=states.length-1;
  useEffect(()=>{
    if(!auto)return;
    if(i>=last){setAuto(false);return;}
    const id=setTimeout(()=>setI(x=>x+1),900);return()=>clearTimeout(id);
  },[auto,i,last]);
  const g=states[Math.min(i,last)];
  const [txt,cls]=RES[item.result];
  return <main className="gamepage">
    <div className="gamehead"><button className="back" onClick={onBack}>← Lịch sử</button>
      <div><b>Xem lại: vs {item.opponent}</b><small>{MODE_NAMES[item.mode]} • <span className={'res '+cls}>{txt}</span> • {item.reason}</small></div><span/></div>
    <div className="boardwrap"><div className="boardframe" style={frameStyle(theme)}>
      <Board g={g} sel={null} targets={[]} onPick={()=>{}} check={false} flip={item.my_color==='black'} theme={theme}/></div></div>
    <p className="hint" style={{textAlign:'center'}}>{moves?`Nước ${Math.min(i,last)} / ${last}`:'Đang tải…'}</p>
    <div className="gameactions">
      <button className="secondary" onClick={()=>{setAuto(false);setI(0);}}><SkipBack size={16}/></button>
      <button className="secondary" onClick={()=>{setAuto(false);setI(x=>Math.max(0,x-1));}}><ChevronLeft size={16}/></button>
      <button className="secondary" onClick={()=>setAuto(a=>!a)}>{auto?<Pause size={16}/>:<Play size={16}/>}</button>
      <button className="secondary" onClick={()=>{setAuto(false);setI(x=>Math.min(last,x+1));}}><ChevronRight size={16}/></button>
      <button className="secondary" onClick={()=>{setAuto(false);setI(last);}}><SkipForward size={16}/></button>
    </div>
  </main>;
}

export default function History({onBack,equipped}){
  const [rows,setRows]=useState(null),[err,setErr]=useState(''),[open,setOpen]=useState(null),[filter,setFilter]=useState('all');
  useEffect(()=>{sb.rpc('my_history',{p_limit:100}).then(({data,error})=>{if(error)setErr(error.message);else setRows(data||[]);});},[]);
  if(open)return <Replay item={open} equipped={equipped} onBack={()=>setOpen(null)}/>;
  const list=(rows||[]).filter(r=>filter==='all'||r.mode===filter);
  return <main className="content">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Lịch sử trận đấu</h2>
    <div className="tabs">{[['all','Tất cả'],...Object.entries(MODE_NAMES)].map(([k,v])=><button key={k} className={'tab '+(filter===k?'on':'')} onClick={()=>setFilter(k)}>{v}</button>)}</div>
    {err&&<p className="warn">{err}</p>}
    {!rows&&!err&&<p className="muted">Đang tải…</p>}
    {rows&&!list.length&&<p className="muted">Chưa có trận nào.</p>}
    <div className="hlist">{list.map(r=>{const [txt,cls]=RES[r.result];return <button key={r.id} className="hrow" onClick={()=>setOpen(r)}>
      <span className={'res '+cls}>{txt}</span>
      <span className="hmain"><b>vs {r.opponent}</b><small>{MODE_NAMES[r.mode]}{r.mode==='khi'?` • cược ${fmt(r.bet)}`:''}{r.mode==='room'&&r.rated?' • Rank':''}{r.mode==='room'&&r.bet>0?` • cược ${fmt(r.bet)} Khí`:''}{r.mode==='room'&&r.bet_coins>0?` • cược ${fmt(r.bet_coins)} Thy Mây`:''} • {r.plies} nước • {r.reason}</small></span>
      <span className="hdelta">{r.rated&&<b className={r.rating_delta>0?'up':r.rating_delta<0?'down':''}>{sign(r.rating_delta)} Rank</b>}{(r.mode==='khi'||(r.mode==='room'&&r.bet>0))&&<b className={Number(r.khi_delta)>0?'up':Number(r.khi_delta)<0?'down':''}>{sign(Number(r.khi_delta))} Khí</b>}{(r.mode==='ranked'&&r.coin_delta>0||r.mode==='room'&&r.bet_coins>0)&&<small className={r.coin_delta>0?'up':r.coin_delta<0?'down':''}>{sign(r.coin_delta)} Thy Mây</small>}<small>{when(r.ended_at)}</small></span>
      <ChevronRight size={16}/></button>;})}</div>
  </main>;
}
