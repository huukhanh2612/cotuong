import React,{useEffect,useMemo,useState} from 'react';
import {RotateCcw,Undo2,Flag} from 'lucide-react';
import {isRed,legalMoves,inCheck,bestMove,fresh,applyMove} from './engine.js';

import Board,{names} from './Board.jsx';
import {useGameSounds} from './useGameSounds.js';
import {useAudio,setAudio,sfx} from './audio.js';
import {useCatalog} from './ui.jsx';
import {frameStyle} from './cosmetics.js';
export default function GameView({mode,onExit,equipped}){
  const {byId}=useCatalog();const theme=byId[equipped?.board]?.data;
  const [g,setG]=useState(fresh),[sel,setSel]=useState(null),[level,setLevel]=useState(2);
  const aud=useAudio();
  const legal=useMemo(()=>legalMoves(g.board,g.turn),[g.board,g.turn]);
  const check=!g.result&&inCheck(g.board,g.turn);
  const outcome=!g.result?null:!g.result.winner?'draw':mode==='bot'?(g.result.winner==='Đỏ'?'win':'loss'):'win';
  useGameSounds(g,check,outcome);
  const targets=sel?legal.filter(([f])=>f[0]===sel[0]&&f[1]===sel[1]).map(m=>m[1]):[];
  const botTurn=mode==='bot'&&!g.turn;
  const play=(f,t)=>{setG(v=>applyMove(v,f,t));setSel(null);};

  useEffect(()=>{
    if(!botTurn||g.result)return;
    const id=setTimeout(()=>{const m=bestMove(g.board,false,level);if(m)play(m[0],m[1]);},400);
    return()=>clearTimeout(id);
  },[g,botTurn,level]);

  const pick=(x,y)=>{
    if(g.result||botTurn)return;
    if(sel&&targets.some(t=>t[0]===x&&t[1]===y))return play(sel,[x,y]);
    const p=g.board[y][x];
    if(p&&isRed(p)===g.turn){setSel([x,y]);sfx.select();}else setSel(null);
  };
  const undo=()=>{const n=mode==='bot'&&g.past.length>=2&&g.turn?2:1;if(g.past.length<n)return;
    setG(v=>({...v.past[v.past.length-n],past:v.past.slice(0,v.past.length-n)}));setSel(null);};
  const reset=()=>{setG(fresh());setSel(null);};
  const resign=()=>{if(g.result)return;const me=mode==='bot'?true:g.turn;setG(v=>({...v,result:{winner:me?'Đen':'Đỏ',why:`${me?'Đỏ':'Đen'} xin thua`}}));};

  const status=g.result?(g.result.winner?`${g.result.winner} thắng — ${g.result.why}`:g.result.why)
    :check?`⚠ Chiếu tướng! Đến lượt ${g.turn?'Đỏ':'Đen'}`:botTurn?'Máy đang suy nghĩ…':`Đến lượt ${g.turn?'Đỏ':'Đen'}`;
  const Tray=({list})=><div className="tray">{list.map((p,i)=><span key={i} className={'mini '+(isRed(p)?'r':'b')}>{names[p]}</span>)}</div>;

  return <main className="gamepage">
    <div className="gamehead"><button className="back" onClick={onExit}>← Trang chủ</button>
      <div><b>{mode==='bot'?'Luyện tập với máy':'Đối luyện hai người'}</b><small className={check?'warn':''}>{status}</small></div>
      <button className="iconbtn" onClick={()=>setAudio({sfxOn:!aud.sfxOn})} title="Hiệu ứng âm thanh">{aud.sfxOn?'♪':'✕'}</button></div>
    <div className="boardwrap">
      <div className="player"><span className="avatar">{mode==='bot'?'AI':'Đ'}</span><div><b>{mode==='bot'?'Máy':'Đen'}</b><small>{!g.turn?'Đang đi':'Chờ lượt'}</small></div><Tray list={g.lost.black}/></div>
      <div className="boardframe" style={frameStyle(theme)}><Board g={g} sel={sel} targets={targets} onPick={pick} check={check} theme={theme}/>
        {g.result&&<div className="overlay"><div className="resultcard"><span className="seal big">{g.result.winner?'勝':'和'}</span>
          <h2>{g.result.winner?`${g.result.winner} thắng`:'Hòa cờ'}</h2><p>{g.result.why}</p>
          <button className="primary" onClick={reset}>Ván mới</button></div></div>}</div>
      <div className="player"><span className="avatar red">K</span><div><b>{mode==='bot'?'Bạn':'Đỏ'}</b><small>{g.turn?'Đang đi':'Chờ lượt'}</small></div><Tray list={g.lost.red}/></div>
    </div>
    {mode==='bot'&&<div className="levels">{[['Dễ',1],['Vừa',2],['Khó',3]].map(([n,l])=><button key={l} className={'secondary '+(level===l?'on':'')} onClick={()=>setLevel(l)}>{n}</button>)}</div>}
    <div className="gameactions"><button className="secondary" onClick={undo} disabled={!g.past.length}><Undo2 size={16}/> Đi lại</button>
      <button className="secondary" onClick={resign} disabled={!!g.result}><Flag size={16}/> Xin thua</button>
      <button className="secondary" onClick={reset}><RotateCcw size={16}/> Ván mới</button></div>
    <p className="hint">Luật: không được để tướng bị chiếu; hai tướng không được đối mặt; hết nước đi hợp lệ (chiếu bí hoặc bị vây) là thua; lặp thế 3 lần hoặc 60 nước không ăn quân là hòa.</p>
  </main>;
}
