import React from 'react';
import {isRed} from './engine.js';
import {DEFAULT_BOARD} from './cosmetics.js';
import {sfx} from './audio.js';

export const names={K:'帥',A:'仕',B:'相',N:'傌',R:'俥',C:'炮',P:'兵',k:'將',a:'士',b:'象',n:'馬',r:'車',c:'砲',p:'卒'};
const S=58,M=44,R=25,W=M*2+8*S,H=M*2+9*S,X=x=>M+x*S,Y=y=>M+y*S;
const redNum='九八七六五四三二一';

export const tock=()=>sfx.move(); // giữ tên cũ cho các file khác; âm thanh thật nằm trong audio.js

const Piece=({p,px,py})=>{
  const red=isRed(p),col=red?'#b3251b':'#1e1a14';
  return <g transform={`translate(${px},${py})`} style={{pointerEvents:'none'}}>
    <circle cx="2" cy="4" r={R} fill="#000" opacity=".5" filter="url(#blur)"/>
    <circle r={R} fill="url(#boxwood)" stroke="#4e3115" strokeWidth="1.6"/>
    <circle r={R-3} fill="none" stroke="#8a5f2e" strokeWidth=".8" opacity=".7"/>
    <circle r={R-6} fill="none" stroke={col} strokeWidth="1.5"/>
    <text y=".8" dy=".36em" textAnchor="middle" fontSize="27" fontWeight="900" fill="#fff" opacity=".55" fontFamily="'Noto Serif TC','KaiTi','STKaiti',serif">{names[p]}</text>
    <text dy=".36em" textAnchor="middle" fontSize="27" fontWeight="900" fill={col} fontFamily="'Noto Serif TC','KaiTi','STKaiti',serif">{names[p]}</text>
  </g>;
};

const mark=(px,py,key,X,Y,line)=>{
  const a=6,l=10,out=[];
  for(const dx of[-1,1])for(const dy of[-1,1]){
    if((px===0&&dx<0)||(px===8&&dx>0))continue;
    const cx=X(px),cy=Y(py);
    out.push(<path key={key+dx+dy} d={`M${cx+dx*a},${cy+dy*(a+l)}V${cy+dy*a}H${cx+dx*(a+l)}`} fill="none" stroke={line} strokeWidth="1.3"/>);
  }
  return out;
};

export default function Board({g,sel,targets,onPick,check,flip=false,theme}){
  const T={...DEFAULT_BOARD,...(theme||{})};
  const X=x=>M+(flip?8-x:x)*S,Y=y=>M+(flip?9-y:y)*S;
  const lines=[];
  for(let y=0;y<10;y++)lines.push(<line key={'h'+y} x1={X(0)} x2={X(8)} y1={Y(y)} y2={Y(y)}/>);
  for(let x=0;x<9;x++){
    if(x===0||x===8)lines.push(<line key={'v'+x} x1={X(x)} x2={X(x)} y1={Y(0)} y2={Y(9)}/>);
    else lines.push(<line key={'va'+x} x1={X(x)} x2={X(x)} y1={Y(0)} y2={Y(4)}/>,<line key={'vb'+x} x1={X(x)} x2={X(x)} y1={Y(5)} y2={Y(9)}/>);
  }
  const marks=[[1,2],[7,2],[1,7],[7,7],...[0,2,4,6,8].flatMap(x=>[[x,3],[x,6]])];
  const kp=(()=>{const k=g.turn?'K':'k';for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(g.board[y][x]===k)return[x,y];})();
  const tset=new Set(targets.map(t=>t.join(',')));
  return <svg viewBox={`0 0 ${W} ${H}`} className="xqsvg" role="img" aria-label="Bàn cờ tướng">
    <defs>
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={T.w1}/><stop offset=".5" stopColor={T.w2}/><stop offset="1" stopColor={T.w3}/></linearGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.24" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .34  0 0 0 0 .18  0 0 0 0 .05  0 0 0 -1.5 1.08"/></filter>
      <filter id="blur"><feGaussianBlur stdDeviation="2.2"/></filter>
      <radialGradient id="boxwood" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="#f8e6bd"/><stop offset=".55" stop-color="#e3c48b"/><stop offset="1" stop-color="#b8864a"/></radialGradient>
      <radialGradient id="chk"><stop offset="0" stop-color="#ff2a1a" stop-opacity=".85"/><stop offset="1" stop-color="#ff2a1a" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor={T.vig} stopOpacity=".45"/></radialGradient>
    </defs>
    <rect width={W} height={H} fill="url(#wood)"/>
    <rect width={W} height={H} filter="url(#grain)" opacity={T.grain}/>
    <rect width={W} height={H} fill="url(#vig)"/>
    <rect x="8" y="8" width={W-16} height={H-16} fill="none" stroke={T.line} strokeWidth="2.5"/>
    <rect x="13" y="13" width={W-26} height={H-26} fill="none" stroke={T.line} strokeWidth=".8"/>
    <rect x={X(0)-5} y={Y(0)-5} width={8*S+10} height={9*S+10} fill="none" stroke={T.line} strokeWidth="2.2"/>
    <g stroke={T.line} strokeWidth="1.4">{lines}
      <line x1={X(3)} y1={Y(0)} x2={X(5)} y2={Y(2)}/><line x1={X(5)} y1={Y(0)} x2={X(3)} y2={Y(2)}/>
      <line x1={X(3)} y1={Y(7)} x2={X(5)} y2={Y(9)}/><line x1={X(5)} y1={Y(7)} x2={X(3)} y2={Y(9)}/></g>
    {marks.map(([x,y])=>mark(x,y,`m${x}${y}`,X,Y,T.line))}
    <g fontFamily="'Noto Serif TC','KaiTi',serif" fontWeight="900" fontSize="27" fill={T.text} opacity=".85" textAnchor="middle">
      <text x={X(1.5)} y={Y(4.5)} dy=".35em" letterSpacing="14">楚河</text><text x={X(6.5)} y={Y(4.5)} dy=".35em" letterSpacing="14">漢界</text></g>
    <g fontSize="13" fill={T.text} textAnchor="middle" fontFamily="'Noto Serif TC',serif">
      {Array.from({length:9},(_,x)=><React.Fragment key={x}><text x={X(x)} y="30">{flip?redNum[x]:x+1}</text><text x={X(x)} y={H-19}>{flip?x+1:redNum[x]}</text></React.Fragment>)}</g>
    {g.last&&g.last.map((p,i)=><g key={i} transform={`translate(${X(p[0])},${Y(p[1])})`} style={{pointerEvents:'none'}}>
      {i===0?<rect x={-R} y={-R} width={2*R} height={2*R} rx="5" fill="#ffe08a" opacity=".3" stroke="#a5721f" strokeDasharray="3 3"/>
      :<circle r={R+4} fill="none" stroke="#e0a82e" strokeWidth="2.5" opacity=".9"/>}</g>)}
    {check&&kp&&<circle cx={X(kp[0])} cy={Y(kp[1])} r={R+16} fill="url(#chk)" style={{pointerEvents:'none'}}/>}
    {g.board.map((row,y)=>row.map((p,x)=>p&&<Piece key={x+'-'+y} p={p} px={X(x)} py={Y(y)}/>))}
    {sel&&<circle cx={X(sel[0])} cy={Y(sel[1])} r={R+5} fill="none" stroke="#ffd35c" strokeWidth="3" className="pulse" style={{pointerEvents:'none'}}/>}
    {targets.map(([x,y])=>g.board[y][x]
      ?<circle key={'t'+x+y} cx={X(x)} cy={Y(y)} r={R+3} fill="none" stroke="#c0271b" strokeWidth="3" strokeDasharray="6 4" style={{pointerEvents:'none'}}/>
      :<circle key={'t'+x+y} cx={X(x)} cy={Y(y)} r="7" fill="#2f6b3a" opacity=".85" style={{pointerEvents:'none'}}/>)}
    {g.board.map((row,y)=>row.map((_,x)=><rect key={'c'+x+y} x={X(x)-S/2} y={Y(y)-S/2} width={S} height={S} fill="transparent" style={{cursor:'pointer'}} onClick={()=>{onPick(x,y);}}/>))}
  </svg>;
}

