import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Coins,Timer} from 'lucide-react';
import {sb} from './supabase.js';
import {useCatalog,ItemPreview} from './ui.jsx';
import {KINDS,KIND_ORDER,boostText,mmss} from './cosmetics.js';
import {fmt} from './khi.js';

const byOrder=(a,b)=>(a.sort-b.sort)||(a.price-b.price);

export default function Shop({profile,refresh,onBack,initialTab='shop',goWallet}){
  const {all,byId}=useCatalog();
  const [tab,setTab]=useState(initialTab),[cat,setCat]=useState('boost'),[inv,setInv]=useState([]),[boosts,setBoosts]=useState([]);
  const [msg,setMsg]=useState(null),[busy,setBusy]=useState(''),[now,setNow]=useState(Date.now());
  const eq=profile.equipped||{},coins=Number(profile.coins||0);

  const load=useCallback(async()=>{
    const [a,b]=await Promise.all([sb.from('user_items').select('item_id,qty').gt('qty',0),sb.from('active_boosts').select('*')]);
    setInv(a.data||[]);setBoosts(b.data||[]);
  },[]);
  useEffect(()=>{load();const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[load]);

  const qty=useMemo(()=>Object.fromEntries(inv.map(r=>[r.item_id,r.qty])),[inv]);
  const activeOf=k=>boosts.find(b=>b.boost_kind===k&&new Date(b.expires_at).getTime()>now);

  const act=async(key,fn,ok)=>{
    setBusy(key);setMsg(null);
    const {error}=await fn();
    setBusy('');
    if(error){setMsg({t:'err',s:error.message});return;}
    setMsg({t:'ok',s:ok});
    await Promise.all([load(),refresh()]);
  };
  const buy=it=>{if(!confirm(`Mua "${it.name}" với ${fmt(it.price)} Thy Mây?`))return;
    act('b'+it.id,()=>sb.rpc('buy_item',{p_item:it.id}),`Đã mua "${it.name}".`);};
  const equip=it=>act('e'+it.id,()=>sb.rpc('equip_item',{p_item:it.id}),`Đã trang bị "${it.name}".`);
  const unequip=it=>act('u'+it.id,()=>sb.rpc('unequip_slot',{p_slot:it.kind}),`Đã tháo "${it.name}".`);
  const useCard=it=>act('c'+it.id,()=>sb.rpc('use_boost',{p_item:it.id}),`Đã kích hoạt "${it.name}".`);

  const shopItems=all.filter(i=>i.active&&i.kind===cat).sort(byOrder);
  const owned=inv.map(r=>({...byId[r.item_id],qty:r.qty})).filter(x=>x.id);

  const Card=({it,mode})=>{
    const isBoost=it.kind==='boost',q=qty[it.id]||0,has=!isBoost&&q>0,on=eq[it.kind]===it.id,short=it.price-coins;
    const cardBusy=busy.endsWith(it.id);
    return <div className={'icard'+(on?' on':'')}>
      <div className="iprev"><ItemPreview kind={it.kind} data={it.data}/></div>
      <b className="iname">{it.name}</b>
      <small className="idesc">{it.description}</small>
      {isBoost&&<small className="itag">{boostText(it.data)}</small>}
      {mode==='shop'?<>
        <div className="iprice"><Coins size={14}/> {fmt(it.price)}{isBoost&&q>0&&<span className="ownedq">đang có {q}</span>}</div>
        {has?<button className="secondary" disabled>Đã sở hữu</button>
          :<button className="primary" disabled={cardBusy||short>0} onClick={()=>buy(it)}>{short>0?`Thiếu ${fmt(short)} Thy Mây`:'Mua'}</button>}
      </>:isBoost?<>
        <div className="iprice">Số lượng: <b>{it.qty}</b></div>
        <button className="primary" disabled={cardBusy||!!activeOf(it.data?.boost)} onClick={()=>useCard(it)}>{activeOf(it.data?.boost)?'Đang có thẻ cùng loại':'Dùng thẻ'}</button>
      </>:<>
        <div className="iprice">{on?'Đang trang bị':'Đã sở hữu'}</div>
        {on?<button className="secondary" disabled={cardBusy} onClick={()=>unequip(it)}>Tháo</button>
          :<button className="primary" disabled={cardBusy} onClick={()=>equip(it)}>Trang bị</button>}
      </>}
    </div>;
  };

  const ActiveBoosts=()=>{
    const list=boosts.filter(b=>new Date(b.expires_at).getTime()>now);
    if(!list.length)return null;
    return <div className="activeboosts">{list.map(b=><div key={b.boost_kind} className="abadge"><Timer size={15}/>
      <span>Thẻ x{Number(b.mult)} {b.boost_kind==='exp'?'EXP':'Khí'}</span><b>{mmss((new Date(b.expires_at).getTime()-now)/1000)}</b></div>)}</div>;
  };

  return <main className="content shop">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <div className="shophead"><h2 className="sectiontitle" style={{margin:0}}>{tab==='shop'?'Cửa hàng':'Kho đồ'}</h2>
      <button className="coinchip" onClick={goWallet} title="Xem ví"><Coins size={15}/> {fmt(coins)} Thy Mây</button></div>
    <div className="tabs"><button className={'tab '+(tab==='shop'?'on':'')} onClick={()=>{setTab('shop');setMsg(null);}}>Cửa hàng</button>
      <button className={'tab '+(tab==='inv'?'on':'')} onClick={()=>{setTab('inv');setMsg(null);}}>Kho đồ</button></div>
    <ActiveBoosts/>
    {msg&&<p className={msg.t==='err'?'warn':'okmsg'}>{msg.s}</p>}
    {tab==='shop'?<>
      <div className="tabs wrap">{KIND_ORDER.map(k=><button key={k} className={'tab '+(cat===k?'on':'')} onClick={()=>setCat(k)}>{KINDS[k]}</button>)}</div>
      {!shopItems.length&&<p className="muted">Mục này chưa có vật phẩm nào.</p>}
      <div className="igrid">{shopItems.map(it=><Card key={it.id} it={it} mode="shop"/>)}</div>
      <p className="hint">Kiếm Thy Mây: mỗi trận Đấu Rank nhận 1 Thy Mây; thắng liên tiếp từ 3 trận trở lên, mỗi trận thắng nhận x2. (Trận Rank cần từ 6 nước trở lên mới tính.)</p>
    </>:<>
      {!owned.length&&<p className="muted">Kho đồ trống. Hãy ghé cửa hàng để mua vật phẩm.</p>}
      {KIND_ORDER.map(k=>{const list=owned.filter(o=>o.kind===k).sort(byOrder);if(!list.length)return null;
        return <section key={k}><h3 className="igroup">{KINDS[k]}</h3><div className="igrid">{list.map(it=><Card key={it.id} it={it} mode="inv"/>)}</div></section>;})}
    </>}
  </main>;
}
