import React from 'react';
import {DEFAULT_BOARD} from './cosmetics.js';
import {N,SEAT,ZONE,PALACE,toView,fromView} from './tam.js';
import {names} from './Board.jsx';

const S=44,M=34,R=18,W=M*2+(N-1)*S;
const PX=d=>M+d*S;

const Piece=({c,px,py})=>{
  const s=+c[0],t=c[1],ink=SEAT[s].ink,ch=names[s===0?t.toUpperCase():t];
  return <g transform={`translate(${px},${py})`} style={{pointerEvents:'none'}}>
    <circle cx="2" cy="3" r={R} fill="#000" opacity=".5" filter="url(#tblur)"/>
    <circle r={R} fill="url(#tbox)" stroke="#4e3115" strokeWidth="1.5"/>
    <circle r={R-3} fill="none" stroke="#8a5f2e" strokeWidth=".7" opacity=".7"/>
    <circle r={R-5} fill="none" stroke={ink} strokeWidth="1.6"/>
    <text y=".8" dy=".36em" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fff" opacity=".55" fontFamily="'Noto Serif TC','KaiTi','STKaiti',serif">{ch}</text>
    <text dy=".36em" textAnchor="middle" fontSize="20" fontWeight="900" fill={ink} fontFamily="'Noto Serif TC','KaiTi','STKaiti',serif">{ch}</text>
  </g>;
};

// Hình chữ nhật (theo tọa độ bàn) sau khi xoay theo góc nhìn
const rectView=(seat,r,pad=S/2)=>{
  const a=toView(seat,r.x0,r.y0),b=toView(seat,r.x1,r.y1);
  const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
  return {x:PX(x0)-pad,y:PX(y0)-pad,w:(x1-x0)*S+2*pad,h:(y1-y0)*S+2*pad};
};

export default function TamBoard({board,seat=0,sel,targets=[],onPick,last,theme,turnSeat}){
  const T={...DEFAULT_BOARD,...(theme||{})};
  const lines=[];
  for(let i=0;i<N;i++){
    lines.push(<line key={'h'+i} x1={PX(0)} x2={PX(N-1)} y1={PX(i)} y2={PX(i)}/>,<line key={'v'+i} x1={PX(i)} x2={PX(i)} y1={PX(0)} y2={PX(N-1)}/>);
  }
  const diag=PALACE.flatMap((p,s)=>{
    const a=toView(seat,p.x0,p.y0),b=toView(seat,p.x1,p.y1),c=toView(seat,p.x0,p.y1),d=toView(seat,p.x1,p.y0);
    return [<line key={'pa'+s} x1={PX(a[0])} y1={PX(a[1])} x2={PX(b[0])} y2={PX(b[1])}/>,<line key={'pb'+s} x1={PX(c[0])} y1={PX(c[1])} x2={PX(d[0])} y2={PX(d[1])}/>];
  });
  const pos=(x,y)=>{const [dx,dy]=toView(seat,x,y);return [PX(dx),PX(dy)];};
  const cells=[];
  for(let dy=0;dy<N;dy++)for(let dx=0;dx<N;dx++)cells.push([dx,dy]);
  return <svg viewBox={`0 0 ${W} ${W}`} className="xqsvg" role="img" aria-label="Bàn cờ Tam đấu">
    <defs>
      <linearGradient id="twood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={T.w1}/><stop offset=".5" stopColor={T.w2}/><stop offset="1" stopColor={T.w3}/></linearGradient>
      <filter id="tgrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.24" numOctaves="4" seed="11"/><feColorMatrix values="0 0 0 0 .34  0 0 0 0 .18  0 0 0 0 .05  0 0 0 -1.5 1.08"/></filter>
      <filter id="tblur"><feGaussianBlur stdDeviation="2"/></filter>
      <radialGradient id="tbox" cx=".35" cy=".28" r=".85"><stop offset="0" stopColor="#f8e6bd"/><stop offset=".55" stopColor="#e3c48b"/><stop offset="1" stopColor="#b8864a"/></radialGradient>
      <radialGradient id="tvig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0"/><stop offset="1" stopColor={T.vig} stopOpacity=".45"/></radialGradient>
    </defs>
    <rect width={W} height={W} fill="url(#twood)"/>
    <rect width={W} height={W} filter="url(#tgrain)" opacity={T.grain}/>
    <rect width={W} height={W} fill="url(#tvig)"/>
    <rect x="6" y="6" width={W-12} height={W-12} fill="none" stroke={T.line} strokeWidth="2.4"/>
    <rect x="11" y="11" width={W-22} height={W-22} fill="none" stroke={T.line} strokeWidth=".8"/>
    {ZONE.map((z,s)=>{const r=rectView(seat,z);return <rect key={'z'+s} x={r.x} y={r.y} width={r.w} height={r.h} rx="6" fill={SEAT[s].tint} opacity={turnSeat===s?.2:.1}/>;})}
    <g stroke={T.line} strokeWidth="1.3">{lines}{diag}</g>
    {last&&last.length===5&&[[last[1],last[2]],[last[3],last[4]]].map(([x,y],i)=>{const [px,py]=pos(x,y);
      return <g key={'l'+i} transform={`translate(${px},${py})`} style={{pointerEvents:'none'}}>
        {i===0?<rect x={-R} y={-R} width={2*R} height={2*R} rx="5" fill="#ffe08a" opacity=".3" stroke="#a5721f" strokeDasharray="3 3"/>
        :<circle r={R+3} fill="none" stroke="#e0a82e" strokeWidth="2.4" opacity=".9"/>}</g>;})}
    {board.map((row,y)=>row.map((c,x)=>{if(!c)return null;const [px,py]=pos(x,y);return <Piece key={x+'-'+y} c={c} px={px} py={py}/>;}))}
    {sel&&(()=>{const [px,py]=pos(sel[0],sel[1]);return <circle cx={px} cy={py} r={R+4} fill="none" stroke="#ffd35c" strokeWidth="3" className="pulse" style={{pointerEvents:'none'}}/>;})()}
    {targets.map(([x,y])=>{const [px,py]=pos(x,y);return board[y][x]
      ?<circle key={'t'+x+'-'+y} cx={px} cy={py} r={R+3} fill="none" stroke="#c0271b" strokeWidth="3" strokeDasharray="6 4" style={{pointerEvents:'none'}}/>
      :<circle key={'t'+x+'-'+y} cx={px} cy={py} r="6" fill="#2f6b3a" opacity=".85" style={{pointerEvents:'none'}}/>;})}
    {cells.map(([dx,dy])=><rect key={'c'+dx+'-'+dy} x={PX(dx)-S/2} y={PX(dy)-S/2} width={S} height={S} fill="transparent" style={{cursor:'pointer'}}
      onClick={()=>{const [x,y]=fromView(seat,dx,dy);onPick&&onPick(x,y);}}/>)}
  </svg>;
}
