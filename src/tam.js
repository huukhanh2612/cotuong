// Tam đấu: 3 người trên một bàn 13x13. Tọa độ (x: cột, y: hàng), ô là chuỗi "<ghế><loại quân>", ví dụ "0k" = tướng của Đỏ.
// Ghế 0 = Đỏ (dưới, đi lên), 1 = Đen (trên, đi xuống), 2 = Xanh (trái, đi sang phải). Khớp với các hàm _tam_* trong schema.sql.
export const N=13;
export const TAM_BETS=[500,1000,1500];
export const MOVE_SECONDS=120,MAX_PLY=450;
export const SEAT=[
  {name:'Đỏ',ink:'#b3251b',tint:'#c0392b'},
  {name:'Đen',ink:'#1e1a14',tint:'#3a3a3a'},
  {name:'Xanh',ink:'#1c5fbf',tint:'#2f6fd0'}];
// Hệ số lời/lỗ theo hạng, nhân với mức cược: Nhất +1, Nhì 0, Ba -1 (khớp _tam_settle)
export const PAYOUT={1:1,2:0,3:-1};
export const PLACE_NAME={1:'Nhất',2:'Nhì',3:'Ba'};

// Vùng nhà (voi chỉ đi trong vùng này, tốt "qua sông" khi rời khỏi vùng) và cung của từng ghế, theo tọa độ bàn
export const ZONE=[{x0:4,x1:12,y0:8,y1:12},{x0:4,x1:12,y0:0,y1:4},{x0:0,x1:4,y0:2,y1:10}];
export const PALACE=[{x0:7,x1:9,y0:10,y1:12},{x0:7,x1:9,y0:0,y1:2},{x0:0,x1:2,y0:5,y1:7}];

// Góc nhìn: xoay bàn để quân của mình luôn ở phía dưới màn hình (Đỏ giữ nguyên, Đen xoay 180°, Xanh xoay 90° ngược chiều kim đồng hồ)
export const toView=(seat,x,y)=>seat===1?[12-x,12-y]:seat===2?[y,12-x]:[x,y];
export const fromView=(seat,dx,dy)=>seat===1?[12-dx,12-dy]:seat===2?[12-dy,dx]:[dx,dy];

// Tọa độ cục bộ (u: 0..8 theo hàng ngang của đội hình, v: khoảng cách tới hàng cuối của mình)
export const local=(s,x,y)=>s===0?[x-4,12-y]:s===1?[x-4,y]:[y-2,x];
const FWD=[[0,-1],[0,1],[1,0]];
const inBoard=(x,y)=>x>=0&&x<N&&y>=0&&y<N;
const inPalace=(s,x,y)=>{const [u,v]=local(s,x,y);return u>=3&&u<=5&&v>=0&&v<=2;};
const inHome=(s,x,y)=>{const [u,v]=local(s,x,y);return u>=0&&u<=8&&v>=0&&v<=4;};

export const parseBoard=str=>{
  const b=[];
  for(let y=0;y<N;y++){const row=[];for(let x=0;x<N;x++){const c=str.substr((y*N+x)*2,2);row.push(c==='..'||c.length<2?null:c);}b.push(row);}
  return b;
};
export const countPieces=(b,s)=>{let n=0;for(const r of b)for(const c of r)if(c&&+c[0]===s)n++;return n;};
export const totalPieces=b=>b.reduce((n,r)=>n+r.filter(Boolean).length,0);

// Các ô đến hợp lệ của quân tại (x,y). Không có luật chiếu tướng: ăn được tướng là loại chủ nhân của tướng.
export function movesFrom(b,x,y){
  const cell=b[y][x];if(!cell)return [];
  const s=+cell[0],t=cell[1],out=[];
  const enemy=(a,c)=>b[c][a]&&+b[c][a][0]!==s;
  const add=(a,c)=>{if(inBoard(a,c)&&!(b[c][a]&&+b[c][a][0]===s))out.push([a,c]);};
  const D4=[[1,0],[-1,0],[0,1],[0,-1]],DG=[[1,1],[1,-1],[-1,1],[-1,-1]];
  if(t==='r'){
    for(const [dx,dy] of D4){let a=x+dx,c=y+dy;
      while(inBoard(a,c)){if(b[c][a]){if(enemy(a,c))out.push([a,c]);break;}out.push([a,c]);a+=dx;c+=dy;}}
  }else if(t==='c'){
    for(const [dx,dy] of D4){let a=x+dx,c=y+dy;
      while(inBoard(a,c)&&!b[c][a]){out.push([a,c]);a+=dx;c+=dy;}
      if(!inBoard(a,c))continue;
      a+=dx;c+=dy;                                   // bỏ qua đúng một quân làm ngòi
      while(inBoard(a,c)&&!b[c][a]){a+=dx;c+=dy;}
      if(inBoard(a,c)&&enemy(a,c))out.push([a,c]);}
  }else if(t==='n'){
    for(const [a,c] of [[1,2],[2,1]])for(const [sx,sy] of DG){
      const dx=a*sx,dy=c*sy,lx=x+(Math.abs(dx)===2?sx:0),ly=y+(Math.abs(dy)===2?sy:0);
      if(inBoard(lx,ly)&&!b[ly][lx])add(x+dx,y+dy);}
  }else if(t==='b'){
    for(const [sx,sy] of DG){const ex=x+sx,ey=y+sy,tx=x+2*sx,ty=y+2*sy;
      if(inBoard(tx,ty)&&!b[ey][ex]&&inHome(s,tx,ty))add(tx,ty);}
  }else if(t==='a'){
    for(const [sx,sy] of DG)if(inPalace(s,x+sx,y+sy))add(x+sx,y+sy);
  }else if(t==='k'){
    for(const [dx,dy] of D4)if(inPalace(s,x+dx,y+dy))add(x+dx,y+dy);
  }else if(t==='p'){
    const [fx,fy]=FWD[s];add(x+fx,y+fy);
    if(local(s,x,y)[1]>=5)for(const [dx,dy] of (fx?[[0,1],[0,-1]]:[[1,0],[-1,0]]))add(x+dx,y+dy);   // qua sông mới được đi ngang
  }
  return out;
}

// ---- Bot Tam đấu ----
// AI đơn giản (nhìn trước 1 nước): ăn tướng nếu được; tránh để tướng mình bị ăn ngay; thích ăn quân giá trị, tránh đưa quân vào ô bị ăn,
// cứu quân đang bị đe dọa, và tiến dần về phía tướng đối thủ. Có chút ngẫu nhiên để các ván không giống nhau.
const VAL={r:9,c:4.5,n:4,b:2,a:2,p:1,k:1000};
const applyLocal=(b,f,t)=>{const n=b.map(r=>r.slice());n[t[1]][t[0]]=n[f[1]][f[0]];n[f[1]][f[0]]=null;return n;};
// Các ô mà một quân của ghế `seat` đứng đó sẽ bị ăn ngay bởi đối thủ còn sống (đối thủ = ghế khác, chưa bị loại)
function attacked(b,seat,places){
  const set=new Set();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const c=b[y][x];if(!c)continue;const s=+c[0];
    if(s===seat||places[s]!==0)continue;
    for(const [a,d] of movesFrom(b,x,y))if(b[d][a]&&+b[d][a][0]===seat)set.add(a+','+d);
  }
  return set;
}
const findKing=(b,seat)=>{for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(b[y][x]===seat+'k')return [x,y];return null;};
const nearestEnemyKingDist=(b,seat,places,x,y)=>{
  let best=99;
  for(let s=0;s<3;s++){if(s===seat||places[s]!==0)continue;const k=findKing(b,s);if(k)best=Math.min(best,Math.abs(k[0]-x)+Math.abs(k[1]-y));}
  return best;
};
// Trả về [[fx,fy],[tx,ty]] hoặc null nếu không còn nước đi.
export function botPickTam(board,seat,places){
  const cur=attacked(board,seat,places);
  const moves=[];
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const c=board[y][x];if(!c||+c[0]!==seat)continue;
    for(const t of movesFrom(board,x,y))moves.push([[x,y],t]);
  }
  if(!moves.length)return null;
  let best=null,bs=-Infinity,safeBest=null,safeScore=-Infinity;
  for(const [f,t] of moves){
    const mover=board[f[1]][f[0]],cap=board[t[1]][t[0]];
    if(cap&&cap[1]==='k')return [f,t];                       // ăn được tướng: loại đối thủ ngay
    const nb=applyLocal(board,f,t),att=attacked(nb,seat,places);
    const myKing=findKing(nb,seat);
    const kingDanger=myKing&&att.has(myKing[0]+','+myKing[1]);
    let sc=cap?VAL[cap[1]]:0;
    if(att.has(t[0]+','+t[1]))sc-=VAL[mover[1]]*0.9;          // quân vừa đi có thể bị ăn
    if(cur.has(f[0]+','+f[1]))sc+=VAL[mover[1]]*0.8;          // cứu quân đang bị đe dọa
    sc+=0.05*(nearestEnemyKingDist(board,seat,places,f[0],f[1])-nearestEnemyKingDist(nb,seat,places,t[0],t[1]));
    sc+=Math.random()*0.35;
    if(kingDanger)sc-=500;                                    // tuyệt đối tránh để tướng bị ăn ngay
    if(sc>bs){bs=sc;best=[f,t];}
  }
  return best;
}
