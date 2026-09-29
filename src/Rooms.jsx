import React,{useEffect,useRef,useState} from 'react';
import {Copy,Check,DoorOpen,Loader2,Trophy,Wind,Coins,Swords} from 'lucide-react';
import {sb} from './supabase.js';
import {fmt,tierOf,roomRules} from './khi.js';
import {Avatar,PlayerName} from './ui.jsx';
import {copyText,showCode} from './social.js';

const KHI_CHIPS=[0,2,10,50,500,900],COIN_CHIPS=[0,5,10,20,50];
const toInt=v=>Math.max(0,Math.floor(Number(String(v).replace(/[^\d]/g,''))||0));

// preset: {invite: id bạn được mời, inviteName, code: mã phòng cần xem ngay}
export default function Rooms({profile,preset,onBack,onMatch}){
  const [tab,setTab]=useState(preset?.code?'join':'create');
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);

  // ----- Tạo phòng -----
  const [rated,setRated]=useState(false),[betKhi,setBetKhi]=useState('0'),[betCoins,setBetCoins]=useState('0');
  const [friends,setFriends]=useState([]),[invite,setInvite]=useState(preset?.invite||'');
  const [room,setRoom]=useState(null);   // {id,code} khi phòng đang chờ người vào
  const roomRef=useRef(null),startedRef=useRef(false);

  // ----- Vào phòng -----
  const [code,setCode]=useState(preset?.code||''),[info,setInfo]=useState(null);

  const nk=toInt(betKhi),nc=toInt(betCoins);
  const myKhi=Number(profile?.khi||0),myCoins=Number(profile?.coins||0);
  const createErr=nk>myKhi?'Bạn không đủ Khí cho mức cược này.':nc>myCoins?'Bạn không đủ Thy Mây cho mức cược này.':'';

  useEffect(()=>{
    sb.rpc('my_friends').then(({data})=>setFriends((data||[]).filter(f=>f.relation==='friend')));
  },[]);
  useEffect(()=>{roomRef.current=room;},[room]);
  // Rời trang khi phòng còn chờ: đóng phòng để không ai vào nhầm
  useEffect(()=>()=>{if(roomRef.current&&!startedRef.current)sb.rpc('close_room',{p_room:roomRef.current.id}).then(()=>{});},[]);

  // Chủ phòng: giữ phòng sống và chờ người vào (3 giây/lần)
  useEffect(()=>{
    if(!room)return;
    let stop=false;
    const tick=async()=>{
      const {data,error}=await sb.rpc('room_status',{p_room:room.id});
      if(stop)return;
      if(error){setErr(error.message);setRoom(null);return;}
      if(data.status==='playing'&&data.match_id){startedRef.current=true;stop=true;onMatch(data.match_id);}
      else if(data.status==='closed'){setErr('Phòng đã đóng vì không hoạt động.');setRoom(null);}
    };
    tick();const t=setInterval(tick,3000);
    return()=>{stop=true;clearInterval(t);};
  },[room?.id]);

  const createRoom=async()=>{
    setErr('');setBusy(true);
    const {data,error}=await sb.rpc('create_room',{p_rated:rated,p_bet_khi:nk,p_bet_coins:nc,p_invite:invite||null});
    setBusy(false);
    if(error){setErr(error.message);return;}
    setRoom({id:data.id,code:data.code});
  };
  const closeRoom=async()=>{
    const r=room;setRoom(null);
    if(r)await sb.rpc('close_room',{p_room:r.id});
  };
  const copyCode=async()=>{if(await copyText(room.code)){setCopied(true);setTimeout(()=>setCopied(false),1600);}};

  const lookup=async(c=code)=>{
    setErr('');setInfo(null);
    const clean=String(c).replace(/\s/g,'').toUpperCase();
    if(clean.length!==6){setErr('Mã phòng gồm đúng 6 ký tự.');return;}
    setBusy(true);
    const {data,error}=await sb.rpc('room_info',{p_code:clean});
    setBusy(false);
    if(error)setErr(error.message);else setInfo(data);
  };
  useEffect(()=>{if(preset?.code)lookup(preset.code);},[]);   // mở từ lời mời: xem phòng ngay

  const joinRoom=async()=>{
    setErr('');setBusy(true);
    const {data,error}=await sb.rpc('join_room',{p_code:info.code});
    setBusy(false);
    if(error){setErr(error.message);return;}
    onMatch(data);
  };
  const joinErr=!info?'':info.mine?'Đây là phòng của chính bạn.':myKhi<info.bet_khi?`Bạn cần ít nhất ${fmt(info.bet_khi)} Khí.`:myCoins<info.bet_coins?`Bạn cần ít nhất ${fmt(info.bet_coins)} Thy Mây.`:'';

  // ===== Màn chờ của chủ phòng =====
  if(room)return <main className="content lobby">
    <section className="searchcard roomwait"><Loader2 className="spin" size={38}/>
      <h2>Đang chờ đối thủ vào phòng…</h2>
      <p className="muted">{roomRules(rated,nk,nc)}</p>
      <div className="roomcode">{room.code}</div>
      <button className="secondary" onClick={copyCode}>{copied?<><Check size={15}/> Đã chép mã</>:<><Copy size={15}/> Chép mã phòng</>}</button>
      <p className="hint">{invite?`Đã gửi lời mời cho ${friends.find(f=>f.id===invite)?.username||preset?.inviteName||'bạn bè'}. Chỉ người được mời vào được phòng này.`:'Gửi mã này cho bạn để họ vào phòng (tab "Vào phòng"). Giữ trang này mở.'}</p>
      <p className="hint">Khi đối thủ vào, ván bắt đầu ngay và số cược của cả hai bị giữ cho tới khi có kết quả.</p>
      <button className="secondary danger" onClick={closeRoom}>Đóng phòng</button>
    </section></main>;

  return <main className="content lobby">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Phòng riêng</h2>
    <div className="tabs">
      <button className={'tab '+(tab==='create'?'on':'')} onClick={()=>{setTab('create');setErr('');}}>Tạo phòng</button>
      <button className={'tab '+(tab==='join'?'on':'')} onClick={()=>{setTab('join');setErr('');}}>Vào phòng</button>
    </div>

    {tab==='create'&&<section className="panel">
      <div className="modeinfo"><span className="modeicon"><Swords/></span><p>Tự đặt luật: tính điểm Rank (Elo) và/hoặc cược Khí, cược Thy Mây. Mỗi thứ bật tắt độc lập. Mời bạn bè hoặc gửi mã phòng.</p></div>

      <label className="lbl"><Trophy size={13} style={{verticalAlign:'-2px'}}/> Điểm Rank (Elo)</label>
      <label className="check" style={{marginTop:0}}><input type="checkbox" checked={rated} onChange={e=>setRated(e.target.checked)}/>
        <span>Tính thắng/thua vào điểm Rank của cả hai (Rank của bạn: <b>{profile.rating}</b> • {tierOf(profile.rating)})</span></label>

      <label className="lbl"><Wind size={13} style={{verticalAlign:'-2px'}}/> Cược Khí — bạn có {fmt(myKhi)} (0 = không cược)</label>
      <input className="numinput" inputMode="numeric" value={betKhi} onChange={e=>setBetKhi(e.target.value.replace(/[^\d]/g,'').slice(0,10))}/>
      <div className="chips">{KHI_CHIPS.map(v=><button key={v} className={'chip '+(nk===v?'on':'')} disabled={v>myKhi} onClick={()=>setBetKhi(String(v))}>{v===0?'Không':fmt(v)}</button>)}</div>

      <label className="lbl"><Coins size={13} style={{verticalAlign:'-2px'}}/> Cược Thy Mây — bạn có {fmt(myCoins)} (0 = không cược)</label>
      <input className="numinput" inputMode="numeric" value={betCoins} onChange={e=>setBetCoins(e.target.value.replace(/[^\d]/g,'').slice(0,7))}/>
      <div className="chips">{COIN_CHIPS.map(v=><button key={v} className={'chip '+(nc===v?'on':'')} disabled={v>myCoins} onClick={()=>setBetCoins(String(v))}>{v===0?'Không':fmt(v)}</button>)}</div>

      <label className="lbl">Mời bạn bè (tùy chọn)</label>
      <select className="numinput" value={invite} onChange={e=>setInvite(e.target.value)}>
        <option value="">Không mời — ai có mã cũng vào được</option>
        {friends.map(f=><option key={f.id} value={f.id}>{f.username}{f.online?' • online':''}{f.in_match?' • đang đấu':''}</option>)}
        {invite&&!friends.some(f=>f.id===invite)&&<option value={invite}>{preset?.inviteName||'Bạn bè đã chọn'}</option>}
      </select>

      <div className="rulebox"><b>Luật phòng:</b> {roomRules(rated,nk,nc)}.<br/>
        Thắng nhận toàn bộ cược của hai bên, hòa hoàn lại cược. Cả hai phải đủ Khí và Thy Mây khi vào phòng.
        Phòng riêng không có Thy Mây thưởng, không nhân thẻ EXP/Khí và không tính bảng xếp hạng tuần.</div>
      {(createErr||err)&&<p className="warn">{createErr||err}</p>}
      <button className="primary wide" disabled={busy||!!createErr} onClick={createRoom}>{busy?'Đang tạo…':'Tạo phòng'}</button>
    </section>}

    {tab==='join'&&<section className="panel">
      <div className="modeinfo"><span className="modeicon"><DoorOpen/></span><p>Nhập mã phòng 6 ký tự do bạn bè gửi. Bạn sẽ xem được luật cược trước khi quyết định vào.</p></div>
      <label className="lbl">Mã phòng</label>
      <div className="addbar" style={{margin:0}}>
        <input className="numinput codeinput" maxLength={6} value={code} placeholder="VD: K7M2QX" autoCapitalize="characters"
          onChange={e=>{setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));setInfo(null);}} onKeyDown={e=>e.key==='Enter'&&lookup()}/>
        <button className="primary" disabled={busy||code.length!==6} onClick={()=>lookup()}>Xem phòng</button>
      </div>
      {info&&<div className="rulebox" style={{marginTop:14}}>
        <div className="hrow static frow" style={{background:'none',border:0,padding:0,marginBottom:10}}>
          <Avatar p={{username:info.host_name,equipped:info.host_equipped}} size={38}/>
          <span className="hmain"><b><PlayerName p={{username:info.host_name,equipped:info.host_equipped}}/></b><small>ID {showCode(info.host_code)} • Rank {info.host_rating} ({tierOf(info.host_rating)})</small></span></div>
        <b>Luật phòng:</b> {roomRules(info.rated,info.bet_khi,info.bet_coins)}.<br/>
        <small>Bạn có {fmt(myKhi)} Khí • {fmt(myCoins)} Thy Mây. Ván bắt đầu ngay khi bạn vào, màu quân được chọn ngẫu nhiên.</small>
      </div>}
      {(joinErr||err)&&<p className="warn">{joinErr||err}</p>}
      {info&&<button className="primary wide" style={{marginTop:12}} disabled={busy||!!joinErr} onClick={joinRoom}>{busy?'Đang vào…':'Vào phòng & bắt đầu'}</button>}
    </section>}
  </main>;
}
