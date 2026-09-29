import React,{createContext,useContext} from 'react';
import {DEFAULT_BOARD,isImg} from './cosmetics.js';

// Danh mục vật phẩm toàn cục (App nạp từ bảng shop_items)
export const CatalogCtx=createContext({all:[],byId:{},reload:()=>{}});
export const useCatalog=()=>useContext(CatalogCtx);

export function AvatarView({letter='K',avatar,frame,size=30,className=''}){
  const img=avatar&&isImg(avatar.img);
  const st={width:size,height:size,fontSize:Math.round(size*(avatar?.glyph&&!img?0.56:0.42)),overflow:'hidden',lineHeight:1,flexShrink:0};
  if(avatar&&!img){st.background=avatar.bg||'#7d2922';st.color=avatar.fg||'#ffffff';}
  const core=<span className={'avatar '+className} style={st}>{img?<img src={avatar.img} alt="" className="avimg"/>:(avatar?.glyph||letter)}</span>;
  if(!frame)return core;
  const w=Math.min(8,Math.max(1,Number(frame.width)||3));
  return <span className={'avring'+(frame.pulse?' ringpulse':'')} style={{padding:w,background:`linear-gradient(135deg,${frame.c1},${frame.c2})`,
    boxShadow:frame.glow?`0 0 ${6+w*2}px ${frame.glow}`:undefined,'--glow':frame.glow||'transparent'}}>{core}</span>;
}

// Avatar của một hồ sơ (tự tra vật phẩm đang trang bị)
export function Avatar({p,size=30,className=''}){
  const {byId}=useCatalog();const e=p?.equipped||{};
  return <AvatarView letter={(p?.username||'?')[0].toUpperCase()} avatar={byId[e.avatar]?.data} frame={byId[e.avatar_frame]?.data} size={size} className={className}/>;
}

export function NameView({name,frame}){
  if(!frame)return <>{name}</>;
  return <span className="fname" style={{backgroundImage:`linear-gradient(90deg,${frame.c1},${frame.c2})`,
    filter:frame.glow?`drop-shadow(0 0 4px ${frame.glow})`:undefined}}>{frame.pre||''}{name}{frame.post||''}</span>;
}
export function PlayerName({p,fallback=''}){
  const {byId}=useCatalog();
  return <NameView name={p?.username||fallback} frame={byId[p?.equipped?.name_frame]?.data}/>;
}

export function BoardSwatch({t,h=64}){
  t={...DEFAULT_BOARD,...(t||{})};
  return <div className="swatch" style={{height:h,background:`linear-gradient(135deg,${t.w1},${t.w2} 50%,${t.w3})`,borderColor:t.frame2,boxShadow:`inset 0 0 0 3px ${t.frame1}`}}>
    <i style={{backgroundImage:`linear-gradient(${t.line} 1px,transparent 1px),linear-gradient(90deg,${t.line} 1px,transparent 1px)`}}/></div>;
}

// Hình xem trước của một vật phẩm (dùng trong Shop, Kho đồ và Admin)
export function ItemPreview({kind,data}){
  const d=data||{};
  if(kind==='avatar')return <AvatarView avatar={d} size={62} letter="A"/>;
  if(kind==='avatar_frame')return <AvatarView frame={d} size={54} letter="K"/>;
  if(kind==='name_frame')return <span className="namepreview"><NameView name="Kỳ Thủ" frame={d}/></span>;
  if(kind==='board')return <BoardSwatch t={d}/>;
  if(kind==='boost')return <div className={'boostbadge '+(d.boost||'')}><b>x{d.mult}</b><small>{d.boost==='exp'?'EXP':'KHÍ'}</small></div>;
  return null;
}
