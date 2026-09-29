// Phát tiếng gõ quân / ăn quân / chiếu tướng khi có đúng một nước đi mới, và nhạc thắng-thua khi ván kết thúc.
// Dùng chung cho ván offline (GameView) và ván online (OnlineGame): nước của đối thủ tới từ server cũng có tiếng.
import {useEffect,useRef} from 'react';
import {sfx} from './audio.js';

const lostCount=g=>g.lost.red.length+g.lost.black.length;

export function useGameSounds(g,check,outcome){
  const prev=useRef({n:g.past.length,lost:lostCount(g)});
  useEffect(()=>{
    const n=g.past.length,l=lostCount(g),p=prev.current;
    prev.current={n,lost:l};
    if(n!==p.n+1)return;                      // tải lại cả ván, đi lại, ván mới: không phát tiếng
    if(l>p.lost)sfx.capture();else sfx.move();
    if(check&&!g.result)setTimeout(()=>sfx.check(),220);
  },[g]);
  const done=useRef(null);
  useEffect(()=>{
    if(!outcome){done.current=null;return;}
    if(done.current===outcome)return;
    done.current=outcome;
    setTimeout(()=>sfx[outcome==='win'?'win':outcome==='loss'?'lose':'draw'](),350);
  },[outcome]);
}
