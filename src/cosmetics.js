// Dữ liệu dùng chung cho vật phẩm: loại, mặc định, tiện ích hiển thị.
export const KINDS={boost:'Thẻ hiệu ứng',avatar:'Nhân vật',avatar_frame:'Khung avatar',name_frame:'Khung tên',board:'Sân đấu'};
export const KIND_ORDER=['boost','avatar','avatar_frame','name_frame','board'];
export const BOOST_KINDS={exp:'EXP (điểm Rank khi thắng)',khi:'Khí (lời khi thắng Luyện Khí)'};

// Sân đấu mặc định (gỗ trầm) — vật phẩm "board" chỉ cần ghi đè các trường muốn đổi
export const DEFAULT_BOARD={w1:'#e2b877',w2:'#c58f52',w3:'#d9a868',line:'#4a2c12',text:'#5b3413',vig:'#3a1c05',grain:0.75,
  frame1:'#7a4b23',frame2:'#4e2d12',frame3:'#6b4020',ring:'#a97a3e'};

export const DEFAULT_DATA={
  boost:{boost:'exp',mult:2,minutes:30},
  avatar:{glyph:'🐉',img:'',bg:'#2b5d3a',fg:'#ffffff'},
  avatar_frame:{c1:'#f5d77a',c2:'#b8862d',width:3,glow:'#f5d77a',pulse:false},
  name_frame:{c1:'#ffe08a',c2:'#e0a82e',glow:'#e0a82e',pre:'',post:''},
  board:{...DEFAULT_BOARD}
};

export const frameStyle=t=>{
  t={...DEFAULT_BOARD,...(t||{})};
  return {background:`linear-gradient(135deg,${t.frame1},${t.frame2} 55%,${t.frame3})`,boxShadow:`inset 0 0 0 2px ${t.ring},0 12px 28px #000a`};
};
export const isImg=u=>/^https?:\/\//i.test(u||'');
export const boostText=d=>d?`x${d.mult} ${d.boost==='exp'?'EXP':'Khí'} • ${d.minutes} phút`:'';
export const mmss=s=>{s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);
  return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s%60).padStart(2,'0');};
