import React,{useCallback,useEffect,useState} from 'react';
import {Copy,Check,UserPlus,Swords,Trash2,DoorOpen,Search,X} from 'lucide-react';
import {sb} from './supabase.js';
import {fmt,tierOf,roomRules} from './khi.js';
import {Avatar,PlayerName} from './ui.jsx';
import {copyText,showCode} from './social.js';

export default function Friends({profile,onBack,onInvite,onJoinCode}){
  const [list,setList]=useState(null),[invites,setInvites]=useState([]),[err,setErr]=useState(''),[msg,setMsg]=useState('');
  const [code,setCode]=useState(''),[found,setFound]=useState(null),[busy,setBusy]=useState(false),[copied,setCopied]=useState(false);

  const load=useCallback(async()=>{
    const [a,b]=await Promise.all([sb.rpc('my_friends'),sb.rpc('my_room_invites')]);
    if(a.error)setErr(a.error.message);else setList(a.data||[]);
    if(!b.error)setInvites(b.data||[]);
  },[]);
  useEffect(()=>{load();const t=setInterval(load,8000);return()=>clearInterval(t);},[load]);

  // Chạy một thao tác RPC, báo lỗi/thành công, rồi tải lại danh sách
  const run=async(fn,ok)=>{
    setErr('');setMsg('');setBusy(true);
    const {data,error}=await fn();
    setBusy(false);
    if(error){setErr(error.message);return null;}
    if(ok)setMsg(typeof ok==='function'?ok(data):ok);
    await load();
    return data??true;
  };

  const copyId=async()=>{if(await copyText(profile.player_code)){setCopied(true);setTimeout(()=>setCopied(false),1600);}};

  const lookup=async()=>{
    setErr('');setMsg('');setFound(null);
    const c=code.replace(/\D/g,'');
    if(c.length!==8){setErr('ID gồm đúng 8 chữ số.');return;}
    if(c===profile.player_code){setErr('Đây là ID của chính bạn.');return;}
    setBusy(true);
    const {data,error}=await sb.from('profiles').select('id,username,player_code,rating,equipped').eq('player_code',c).maybeSingle();
    setBusy(false);
    if(error)setErr(error.message);
    else if(!data)setErr('Không tìm thấy người chơi có ID này.');
    else setFound(data);
  };
  const sendReq=async()=>{
    const d=await run(()=>sb.rpc('send_friend_request',{p_code:found.player_code}),
      r=>r==='accepted'?`Đã kết bạn với ${found.username}!`:`Đã gửi lời mời tới ${found.username}.`);
    if(d){setFound(null);setCode('');}
  };

  const incoming=(list||[]).filter(f=>f.relation==='incoming');
  const friends=(list||[]).filter(f=>f.relation==='friend');
  const outgoing=(list||[]).filter(f=>f.relation==='outgoing');

  return <main className="content">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle">Bạn bè</h2>

    <section className="panel idcard">
      <small className="eyebrow">ID CỦA BẠN</small>
      <div className="idbig">{showCode(profile.player_code)}</div>
      <p className="hint" style={{margin:'4px 0 10px'}}>Gửi ID này cho bạn để họ tìm và kết bạn với bạn.</p>
      <button className="secondary" onClick={copyId}>{copied?<><Check size={15}/> Đã chép</>:<><Copy size={15}/> Chép ID</>}</button>
    </section>

    <section className="panel" style={{marginTop:14}}>
      <label className="lbl" style={{marginTop:0}}>Thêm bạn bằng ID</label>
      <div className="addbar" style={{margin:0}}>
        <input className="numinput" inputMode="numeric" maxLength={9} value={code} placeholder="Nhập ID 8 chữ số"
          onChange={e=>{setCode(e.target.value.replace(/[^\d ]/g,''));setFound(null);}} onKeyDown={e=>e.key==='Enter'&&lookup()}/>
        <button className="primary" disabled={busy||code.replace(/\D/g,'').length!==8} onClick={lookup}><Search size={15}/> Tìm</button>
      </div>
      {found&&<div className="hrow static frow" style={{marginTop:12}}>
        <Avatar p={found} size={38}/>
        <span className="hmain"><b><PlayerName p={found}/></b><small>ID {showCode(found.player_code)} • Rank {found.rating} ({tierOf(found.rating)})</small></span>
        <button className="primary" disabled={busy} onClick={sendReq}><UserPlus size={15}/> Kết bạn</button></div>}
      {err&&<p className="warn">{err}</p>}
      {msg&&<p className="okmsg">{msg}</p>}
    </section>

    {invites.length>0&&<><h2 className="sectiontitle" style={{marginTop:24}}>Lời mời vào phòng</h2>
      <div className="hlist">{invites.map(v=><div key={v.code} className="hrow static frow">
        <span className="hmain"><b>{v.host_name} mời bạn đấu</b><small>{roomRules(v.rated,v.bet_khi,v.bet_coins)}</small></span>
        <button className="primary" onClick={()=>onJoinCode(v.code)}><DoorOpen size={15}/> Xem phòng</button></div>)}</div></>}

    {incoming.length>0&&<><h2 className="sectiontitle" style={{marginTop:24}}>Lời mời kết bạn ({incoming.length})</h2>
      <div className="hlist">{incoming.map(f=><div key={f.id} className="hrow static frow">
        <Avatar p={f} size={34}/>
        <span className="hmain"><b><PlayerName p={f}/></b><small>ID {showCode(f.player_code)} • Rank {f.rating}</small></span>
        <button className="primary" disabled={busy} onClick={()=>run(()=>sb.rpc('accept_friend',{p_other:f.id}),`Đã kết bạn với ${f.username}.`)}>Chấp nhận</button>
        <button className="secondary" disabled={busy} onClick={()=>run(()=>sb.rpc('remove_friend',{p_other:f.id}))} aria-label="Từ chối"><X size={15}/></button></div>)}</div></>}

    <h2 className="sectiontitle" style={{marginTop:24}}>Danh sách bạn ({friends.length})</h2>
    {!list&&!err&&<p className="muted">Đang tải…</p>}
    {list&&!friends.length&&<p className="muted">Chưa có bạn nào. Hãy nhập ID của bạn bè ở trên để kết bạn.</p>}
    <div className="hlist">{friends.map(f=><div key={f.id} className="hrow static frow">
      <span className={'dot '+(f.online?'on':'')} title={f.online?'Đang online':'Offline'}/>
      <Avatar p={f} size={34}/>
      <span className="hmain"><b><PlayerName p={f}/></b>
        <small>ID {showCode(f.player_code)} • Rank {f.rating} ({tierOf(f.rating)}) • Khí {fmt(f.khi)} • {f.in_match?'Đang đấu':f.online?'Đang online':'Offline'}</small></span>
      <button className="primary" disabled={busy||f.in_match} onClick={()=>onInvite(f)}><Swords size={15}/> Mời đấu</button>
      <button className="secondary danger" disabled={busy} aria-label="Xóa bạn" title="Xóa bạn"
        onClick={()=>{if(confirm(`Xóa ${f.username} khỏi danh sách bạn bè?`))run(()=>sb.rpc('remove_friend',{p_other:f.id}),'Đã xóa bạn.');}}><Trash2 size={15}/></button></div>)}</div>

    {outgoing.length>0&&<><h2 className="sectiontitle" style={{marginTop:24}}>Lời mời đã gửi</h2>
      <div className="hlist">{outgoing.map(f=><div key={f.id} className="hrow static frow">
        <Avatar p={f} size={30}/>
        <span className="hmain"><b><PlayerName p={f}/></b><small>Đang chờ họ chấp nhận</small></span>
        <button className="secondary" disabled={busy} onClick={()=>run(()=>sb.rpc('remove_friend',{p_other:f.id}))}>Hủy</button></div>)}</div></>}
  </main>;
}
