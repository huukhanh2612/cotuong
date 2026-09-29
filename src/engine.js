// Luật cờ tướng: nước đi, chiếu, chiếu bí, hết nước (bị vây), hòa, và AI alpha-beta.
export const initial=()=>[
 ['r','n','b','a','k','a','b','n','r'],
 Array(9).fill(null),
 [null,'c',null,null,null,null,null,'c',null],
 ['p',null,'p',null,'p',null,'p',null,'p'],
 Array(9).fill(null),Array(9).fill(null),
 ['P',null,'P',null,'P',null,'P',null,'P'],
 [null,'C',null,null,null,null,null,'C',null],
 Array(9).fill(null),
 ['R','N','B','A','K','A','B','N','R']
];
export const isRed=p=>!!p&&p===p.toUpperCase();
const inside=(x,y)=>x>=0&&x<9&&y>=0&&y<10;
const between=(b,x1,y1,x2,y2)=>{const dx=Math.sign(x2-x1),dy=Math.sign(y2-y1);let x=x1+dx,y=y1+dy,n=0;while(x!==x2||y!==y2){if(b[y][x])n++;x+=dx;y+=dy;}return n;};

// Nước đi hình học hợp lệ (chưa xét bị chiếu)
export function valid(b,[x,y],[tx,ty],turn){
 if(!inside(tx,ty)||(x===tx&&y===ty))return false;
 const p=b[y][x],t=b[ty][tx];
 if(!p||isRed(p)!==turn||(t&&isRed(t)===turn))return false;
 const dx=tx-x,dy=ty-y,ax=Math.abs(dx),ay=Math.abs(dy),l=p.toLowerCase(),red=isRed(p);
 const straight=dx===0||dy===0;
 if(l==='r')return straight&&between(b,x,y,tx,ty)===0;
 if(l==='c')return straight&&between(b,x,y,tx,ty)===(t?1:0);
 if(l==='n')return (ax===1&&ay===2&&!b[y+Math.sign(dy)][x])||(ax===2&&ay===1&&!b[y][x+Math.sign(dx)]);
 if(l==='b')return ax===2&&ay===2&&!b[y+dy/2][x+dx/2]&&(red?ty>=5:ty<=4);
 if(l==='a')return ax===1&&ay===1&&tx>=3&&tx<=5&&(red?ty>=7:ty<=2);
 if(l==='k')return (ax+ay===1&&tx>=3&&tx<=5&&(red?ty>=7:ty<=2))||(dx===0&&t?.toLowerCase()==='k'&&between(b,x,y,tx,ty)===0);
 if(l==='p'){const f=red?-1:1;if(dx===0&&dy===f)return true;return (red?y<=4:y>=5)&&ay===0&&ax===1;}
 return false;
}
const cands=(b,x,y)=>{const l=b[y][x].toLowerCase(),o=[],add=(a,c)=>inside(a,c)&&o.push([a,c]);
 const sg=[[1,1],[1,-1],[-1,1],[-1,-1]];
 if(l==='r'||l==='c'||l==='k'){if(l!=='k')for(let i=0;i<9;i++)add(i,y);for(let j=0;j<10;j++)add(x,j);if(l==='k'){add(x+1,y);add(x-1,y);}}
 else if(l==='n')[[1,2],[2,1]].forEach(([a,c])=>sg.forEach(([s,t])=>add(x+a*s,y+c*t)));
 else if(l==='b')sg.forEach(([s,t])=>add(x+2*s,y+2*t));
 else if(l==='a')sg.forEach(([s,t])=>add(x+s,y+t));
 else if(l==='p'){add(x,y+1);add(x,y-1);add(x+1,y);add(x-1,y);}
 return o;};
export function pseudoMoves(b,red){const m=[];
 for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(p&&isRed(p)===red)for(const t of cands(b,x,y))if(valid(b,[x,y],t,red))m.push([[x,y],t]);}
 return m;}
export function move(b,f,t){const n=b.map(r=>[...r]);n[t[1]][t[0]]=n[f[1]][f[0]];n[f[1]][f[0]]=null;return n;}
const kingPos=(b,red)=>{const k=red?'K':'k';for(let y=0;y<10;y++)for(let x=0;x<9;x++)if(b[y][x]===k)return[x,y];return null;};
export function inCheck(b,red){const k=kingPos(b,red);if(!k)return true;
 for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(p&&isRed(p)!==red&&valid(b,[x,y],k,!red))return true;}return false;}
// Nước đi hợp lệ hoàn toàn: không để tướng bị chiếu, không để hai tướng đối mặt
export const legalMoves=(b,red)=>pseudoMoves(b,red).filter(([f,t])=>!inCheck(move(b,f,t),red));
export const boardKey=(b,turn)=>b.map(r=>r.map(p=>p||'.').join('')).join('/')+(turn?'R':'B');

// ---- AI ----
const V={r:900,c:450,n:400,b:200,a:200,p:100,k:10000};
function evalB(b){let s=0;for(let y=0;y<10;y++)for(let x=0;x<9;x++){const p=b[y][x];if(!p)continue;const l=p.toLowerCase(),red=isRed(p);let v=V[l];
 if(l==='p'&&(red?y<=4:y>=5))v+=100+(red?4-y:y-5)*12;
 if('rcn'.includes(l))v+=(4-Math.abs(x-4))*6;
 s+=red?v:-v;}return s;}
function search(b,d,al,be,red){
 if(d===0)return red?evalB(b):-evalB(b);
 const ms=pseudoMoves(b,red).sort((a,c)=>(b[c[1][1]][c[1][0]]?1:0)-(b[a[1][1]][a[1][0]]?1:0));
 let best=-Infinity;
 for(const [f,t] of ms){const cap=b[t[1]][t[0]];if(cap&&cap.toLowerCase()==='k')return 20000+d;
  const v=-search(move(b,f,t),d-1,-be,-al,!red);if(v>best)best=v;if(v>al)al=v;if(al>=be)break;}
 return best===-Infinity?-20000:best;}
export function bestMove(b,red,level=2){
 const ms=legalMoves(b,red);if(!ms.length)return null;
 let best=null,bv=-Infinity;
 for(const m of ms){const v=-search(move(b,m[0],m[1]),level-1,-Infinity,Infinity,!red)+(level===1?Math.random()*250:Math.random()*8);
  if(v>bv){bv=v;best=m;}}
 return best;}

// ---- Trạng thái ván đấu (dùng chung cho đấu máy, hai người, online và xem lại) ----
export const fresh=()=>{const b=initial();return {board:b,turn:true,last:null,quiet:0,keys:[boardKey(b,true)],result:null,lost:{red:[],black:[]},past:[]};};
const snap=g=>({...g,past:undefined});
export function applyMove(g,f,t){
  if(g.result)return g;
  const cap=g.board[t[1]][t[0]],board=move(g.board,f,t),turn=!g.turn;
  const keys=[...g.keys,boardKey(board,turn)],quiet=cap?0:g.quiet+1;
  const lost={red:[...g.lost.red],black:[...g.lost.black]};
  if(cap)(isRed(cap)?lost.red:lost.black).push(cap);
  let result=null;
  const chk=inCheck(board,turn);
  if(!legalMoves(board,turn).length)
    result={winner:g.turn?'Đỏ':'Đen',why:chk?'Chiếu bí':'Hết nước đi (bị vây tướng)'};
  else if(keys.filter(k=>k===keys[keys.length-1]).length>=3)result={winner:null,why:'Hòa do lặp lại thế cờ 3 lần'};
  else if(quiet>=120)result={winner:null,why:'Hòa do 60 nước không ăn quân'};
  return {board,turn,last:[f,t],quiet,keys,result,lost,past:[...g.past,snap(g)]};
}
