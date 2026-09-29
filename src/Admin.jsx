import React,{useCallback,useEffect,useState} from 'react';
import {Plus,Pencil,Trash2,Search,ShieldCheck} from 'lucide-react';
import {sb} from './supabase.js';
import {useCatalog,ItemPreview} from './ui.jsx';
import Board from './Board.jsx';
import {fresh} from './engine.js';
import {KINDS,KIND_ORDER,BOOST_KINDS,DEFAULT_DATA,DEFAULT_BOARD,boostText,frameStyle} from './cosmetics.js';
import {fmt,tierOf} from './khi.js';
import {vnd,memoOf} from './bank.js';

const when=t=>t?new Date(t).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const blank=k=>({id:'',kind:k,name:'',description:'',price:50,active:true,sort:100,data:{...DEFAULT_DATA[k]}});
const hex=v=>/^#[0-9a-f]{6}$/i.test(v||'')?v:'#000000';

function Field({label,children}){return <label className="afield"><span>{label}</span>{children}</label>;}
function Color({v,on}){return <input type="color" value={hex(v)} onChange={e=>on(e.target.value)}/>;}

// ---------------- Vật phẩm ----------------
function cleanData(f){
  const d={...f.data};
  if(f.kind==='boost'){d.mult=Number(d.mult);d.minutes=Math.round(Number(d.minutes));}
  if(f.kind==='avatar'){if(!String(d.img||'').trim())delete d.img;else d.img=String(d.img).trim();}
  if(f.kind==='avatar_frame'){d.width=Number(d.width)||3;d.pulse=!!d.pulse;}
  if(f.kind==='board')d.grain=Number(d.grain);
  return d;
}

function ItemForm({item,onDone,onCancel}){
  const [f,setF]=useState(item),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const isNew=!item.id;
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setD=(k,v)=>setF(x=>({...x,data:{...x.data,[k]:v}}));
  const d=f.data;
  const pv={...f,data:cleanData(f)};
  const save=async()=>{
    setErr('');setBusy(true);
    const {error}=await sb.rpc('admin_save_item',{p_id:f.id||null,p_kind:f.kind,p_name:f.name.trim(),p_desc:f.description.trim(),
      p_price:Math.round(Number(f.price)||0),p_data:cleanData(f),p_active:!!f.active,p_sort:Math.round(Number(f.sort)||100)});
    setBusy(false);
    if(error)setErr(error.message);else onDone();
  };
  const del=async()=>{
    if(!confirm(`Xóa vĩnh viễn "${f.name}"?`))return;
    setBusy(true);const {error}=await sb.rpc('admin_delete_item',{p_id:f.id});setBusy(false);
    if(error)setErr(error.message);else onDone();
  };
  return <section className="panel adminform">
    <h3 className="igroup" style={{marginTop:0}}>{isNew?'Thêm vật phẩm mới':`Sửa: ${item.name}`}</h3>
    <div className="formgrid">
      <div className="formcol">
        <Field label="Loại vật phẩm"><select value={f.kind} disabled={!isNew} onChange={e=>setF(x=>({...x,kind:e.target.value,data:{...DEFAULT_DATA[e.target.value]}}))}>
          {KIND_ORDER.map(k=><option key={k} value={k}>{KINDS[k]}</option>)}</select></Field>
        <Field label="Tên"><input value={f.name} maxLength={40} onChange={e=>set('name',e.target.value)} placeholder="Ví dụ: Khung Rồng Vàng"/></Field>
        <Field label="Mô tả"><input value={f.description} maxLength={120} onChange={e=>set('description',e.target.value)} placeholder="Một câu ngắn"/></Field>
        <div className="row2"><Field label="Giá (Thy Mây)"><input type="number" min="0" value={f.price} onChange={e=>set('price',e.target.value)}/></Field>
          <Field label="Thứ tự hiển thị"><input type="number" value={f.sort} onChange={e=>set('sort',e.target.value)}/></Field></div>
        <label className="check"><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/> Đang bán trong cửa hàng</label>

        {f.kind==='boost'&&<>
          <Field label="Hiệu ứng lên"><select value={d.boost} onChange={e=>setD('boost',e.target.value)}>{Object.entries(BOOST_KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
          <div className="row2"><Field label="Hệ số nhân"><input type="number" min="1" max="100" step="0.5" value={d.mult} onChange={e=>setD('mult',e.target.value)}/></Field>
            <Field label="Thời gian (phút)"><input type="number" min="1" max="10080" value={d.minutes} onChange={e=>setD('minutes',e.target.value)}/></Field></div>
        </>}
        {f.kind==='avatar'&&<>
          <Field label="Biểu tượng (emoji hoặc 1-2 chữ)"><input value={d.glyph||''} maxLength={4} onChange={e=>setD('glyph',e.target.value)}/></Field>
          <Field label="Hoặc link ảnh (http/https, để trống nếu dùng biểu tượng)"><input value={d.img||''} onChange={e=>setD('img',e.target.value)} placeholder="https://..."/></Field>
          <div className="row2"><Field label="Màu nền"><Color v={d.bg} on={v=>setD('bg',v)}/></Field><Field label="Màu chữ"><Color v={d.fg} on={v=>setD('fg',v)}/></Field></div>
        </>}
        {f.kind==='avatar_frame'&&<>
          <div className="row2"><Field label="Màu 1"><Color v={d.c1} on={v=>setD('c1',v)}/></Field><Field label="Màu 2"><Color v={d.c2} on={v=>setD('c2',v)}/></Field></div>
          <div className="row2"><Field label="Màu phát sáng"><Color v={d.glow} on={v=>setD('glow',v)}/></Field>
            <Field label={`Độ dày (${d.width}px)`}><input type="range" min="2" max="8" value={d.width} onChange={e=>setD('width',e.target.value)}/></Field></div>
          <label className="check"><input type="checkbox" checked={!!d.pulse} onChange={e=>setD('pulse',e.target.checked)}/> Nhấp nháy phát sáng</label>
        </>}
        {f.kind==='name_frame'&&<>
          <div className="row2"><Field label="Màu 1"><Color v={d.c1} on={v=>setD('c1',v)}/></Field><Field label="Màu 2"><Color v={d.c2} on={v=>setD('c2',v)}/></Field></div>
          <Field label="Màu phát sáng"><Color v={d.glow} on={v=>setD('glow',v)}/></Field>
          <div className="row2"><Field label="Ký hiệu đầu tên"><input value={d.pre||''} maxLength={4} onChange={e=>setD('pre',e.target.value)} placeholder="✦ "/></Field>
            <Field label="Ký hiệu cuối tên"><input value={d.post||''} maxLength={4} onChange={e=>setD('post',e.target.value)} placeholder=" ✦"/></Field></div>
        </>}
        {f.kind==='board'&&<>
          <div className="row3"><Field label="Nền 1"><Color v={d.w1} on={v=>setD('w1',v)}/></Field><Field label="Nền 2"><Color v={d.w2} on={v=>setD('w2',v)}/></Field><Field label="Nền 3"><Color v={d.w3} on={v=>setD('w3',v)}/></Field></div>
          <div className="row3"><Field label="Đường kẻ"><Color v={d.line} on={v=>setD('line',v)}/></Field><Field label="Chữ sông"><Color v={d.text} on={v=>setD('text',v)}/></Field><Field label="Bóng viền"><Color v={d.vig} on={v=>setD('vig',v)}/></Field></div>
          <div className="row3"><Field label="Khung 1"><Color v={d.frame1} on={v=>setD('frame1',v)}/></Field><Field label="Khung 2"><Color v={d.frame2} on={v=>setD('frame2',v)}/></Field><Field label="Khung 3"><Color v={d.frame3} on={v=>setD('frame3',v)}/></Field></div>
          <div className="row2"><Field label="Viền sáng khung"><Color v={d.ring} on={v=>setD('ring',v)}/></Field>
            <Field label={`Vân gỗ (${Number(d.grain).toFixed(2)})`}><input type="range" min="0" max="1" step="0.05" value={d.grain} onChange={e=>setD('grain',e.target.value)}/></Field></div>
          <button className="secondary" type="button" onClick={()=>setF(x=>({...x,data:{...DEFAULT_BOARD}}))}>Đặt lại màu mặc định</button>
        </>}
      </div>
      <div className="formcol previewcol">
        <small className="lbl">Xem trước</small>
        <div className="previewbox"><ItemPreview kind={pv.kind} data={pv.data}/></div>
        {pv.kind==='boost'&&<small className="itag">{boostText(pv.data)}</small>}
        {pv.kind==='board'&&<div className="boardframe" style={{...frameStyle(pv.data),maxWidth:230,marginTop:10}}><Board g={fresh()} sel={null} targets={[]} onPick={()=>{}} check={false} theme={pv.data}/></div>}
      </div>
    </div>
    {err&&<p className="warn">{err}</p>}
    <div className="rowbtn" style={{justifyContent:'flex-start',marginTop:14}}>
      <button className="primary" disabled={busy||f.name.trim().length<2} onClick={save}>{isNew?'Thêm vào cửa hàng':'Lưu thay đổi'}</button>
      <button className="secondary" onClick={onCancel}>Hủy</button>
      {!isNew&&<button className="secondary danger" disabled={busy} onClick={del}><Trash2 size={14}/> Xóa</button>}
    </div>
  </section>;
}

function ItemsTab(){
  const {all,reload}=useCatalog();
  const [edit,setEdit]=useState(null),[newKind,setNewKind]=useState('avatar_frame');
  if(edit)return <ItemForm key={edit.id||'new'} item={edit} onCancel={()=>setEdit(null)} onDone={async()=>{await reload();setEdit(null);}}/>;
  const list=[...all].sort((a,b)=>KIND_ORDER.indexOf(a.kind)-KIND_ORDER.indexOf(b.kind)||a.sort-b.sort||a.price-b.price);
  return <>
    <div className="addbar"><select value={newKind} onChange={e=>setNewKind(e.target.value)}>{KIND_ORDER.map(k=><option key={k} value={k}>{KINDS[k]}</option>)}</select>
      <button className="primary" onClick={()=>setEdit(blank(newKind))}><Plus size={15}/> Thêm vật phẩm</button></div>
    <div className="hlist">{list.map(it=><div key={it.id} className="hrow static aitem">
      <div className="aprev"><ItemPreview kind={it.kind} data={it.data}/></div>
      <span className="hmain"><b>{it.name} {!it.active&&<span className="res draw">Đang ẩn</span>}</b>
        <small>{KINDS[it.kind]} • {fmt(it.price)} Thy Mây{it.kind==='boost'?' • '+boostText(it.data):''}</small></span>
      <button className="secondary" onClick={()=>setEdit({id:it.id,kind:it.kind,name:it.name,description:it.description||'',price:it.price,active:it.active,sort:it.sort,data:{...DEFAULT_DATA[it.kind],...it.data}})}><Pencil size={14}/> Sửa</button></div>)}
      {!list.length&&<p className="muted">Chưa có vật phẩm nào.</p>}</div>
  </>;
}

// ---------------- Người chơi ----------------
function PlayerEditor({p,onChanged,onClose}){
  const {all,byId}=useCatalog();
  const [vals,setVals]=useState({rating:'',khi:'',coins:''}),[msg,setMsg]=useState(null),[items,setItems]=useState([]),[gItem,setGItem]=useState(''),[gQty,setGQty]=useState(1),[busy,setBusy]=useState(false);
  const loadItems=useCallback(async()=>{const {data}=await sb.rpc('admin_player_items',{p_user:p.id});setItems(data||[]);},[p.id]);
  useEffect(()=>{loadItems();},[loadItems]);
  const run=async(fn,ok)=>{setBusy(true);setMsg(null);const {error}=await fn();setBusy(false);
    if(error){setMsg({t:'err',s:error.message});return;}setMsg({t:'ok',s:ok});onChanged();loadItems();};
  const adjust=(field,mode)=>{const v=Number(vals[field]);
    if(vals[field]===''||!isFinite(v)){setMsg({t:'err',s:'Hãy nhập một con số.'});return;}
    run(()=>sb.rpc('admin_adjust',{p_user:p.id,p_field:field,p_mode:mode,p_value:v}),mode==='set'?'Đã đặt giá trị.':'Đã cộng/trừ.');};
  const F=[['rating','Rank',p.rating],['khi','Khí',fmt(p.khi)],['coins','Thy Mây',fmt(p.coins)]];
  return <section className="panel adminform">
    <div className="shophead"><h3 className="igroup" style={{margin:0}}>{p.username} <small className="muted">{p.email}</small></h3><button className="secondary" onClick={onClose}>Đóng</button></div>
    <p className="muted">Rank {p.rating} ({tierOf(p.rating)}) • Khí {fmt(p.khi)} • Thy Mây {fmt(p.coins)} • Chuỗi thắng {p.win_streak} • {p.wins}T {p.losses}B {p.draws}H</p>
    {F.map(([k,l,cur])=><div key={k} className="adjrow"><b>{l}</b><small>hiện có {cur}</small>
      <input type="number" value={vals[k]} onChange={e=>setVals(v=>({...v,[k]:e.target.value}))} placeholder="số"/>
      <button className="secondary" disabled={busy} onClick={()=>adjust(k,'set')}>Đặt thành</button>
      <button className="secondary" disabled={busy} onClick={()=>adjust(k,'add')}>Cộng / trừ</button></div>)}
    <small className="hint">"Cộng / trừ": nhập số âm để trừ. Kết quả không xuống dưới 0.</small>
    <h3 className="igroup">Vật phẩm của người chơi</h3>
    <div className="adjrow"><select value={gItem} onChange={e=>setGItem(e.target.value)}><option value="">— chọn vật phẩm để tặng —</option>
      {all.map(i=><option key={i.id} value={i.id}>{KINDS[i.kind]}: {i.name}</option>)}</select>
      {byId[gItem]?.kind==='boost'&&<input type="number" min="1" max="99" value={gQty} onChange={e=>setGQty(e.target.value)} style={{width:70}}/>}
      <button className="primary" disabled={busy||!gItem} onClick={()=>run(()=>sb.rpc('admin_grant_item',{p_user:p.id,p_item:gItem,p_qty:Math.round(Number(gQty)||1)}),'Đã tặng vật phẩm.')}>Tặng</button></div>
    {!items.length&&<p className="muted">Chưa sở hữu vật phẩm nào.</p>}
    <div className="hlist">{items.map(r=>{const it=byId[r.item_id];return <div key={r.item_id} className="hrow static">
      <span className="hmain"><b>{it?.name||r.item_id}</b><small>{it?KINDS[it.kind]:''}{it?.kind==='boost'?` • số lượng ${r.qty}`:''}</small></span>
      <button className="secondary danger" disabled={busy} onClick={()=>confirm('Thu hồi vật phẩm này?')&&run(()=>sb.rpc('admin_revoke_item',{p_user:p.id,p_item:r.item_id}),'Đã thu hồi.')}>Thu hồi</button></div>;})}</div>
    {msg&&<p className={msg.t==='err'?'warn':'okmsg'}>{msg.s}</p>}
  </section>;
}

function PlayersTab(){
  const [q,setQ]=useState(''),[rows,setRows]=useState(null),[err,setErr]=useState(''),[sel,setSel]=useState(null);
  const search=useCallback(async(s)=>{
    const {data,error}=await sb.rpc('admin_list_players',{p_search:s,p_limit:60});
    if(error){setErr(error.message);return;}
    setErr('');setRows(data||[]);setSel(cur=>cur?((data||[]).find(r=>r.id===cur.id)||cur):cur);
  },[]);
  useEffect(()=>{search('');},[search]);
  if(sel)return <PlayerEditor key={sel.id} p={sel} onChanged={()=>search(q)} onClose={()=>setSel(null)}/>;
  return <>
    <div className="addbar"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search(q)} placeholder="Tìm theo tên hoặc email"/>
      <button className="primary" onClick={()=>search(q)}><Search size={15}/> Tìm</button></div>
    {err&&<p className="warn">{err}</p>}{!rows&&!err&&<p className="muted">Đang tải…</p>}
    <div className="hlist">{(rows||[]).map(r=><button key={r.id} className="hrow" onClick={()=>setSel(r)}>
      <span className="hmain"><b>{r.username} {r.is_admin&&<span className="res win">Admin</span>}</b><small>{r.email}</small></span>
      <span className="hdelta"><small>Rank {r.rating} • Khí {fmt(r.khi)}</small><small>Thy Mây {fmt(r.coins)} • {r.wins}T {r.losses}B {r.draws}H</small></span></button>)}
      {rows&&!rows.length&&<p className="muted">Không tìm thấy người chơi nào.</p>}</div>
  </>;
}

// ---------------- Nhật ký ----------------
const summarize=r=>{const d=r.detail||{};
  if(r.action==='adjust')return `${d.name}: ${d.field==='rating'?'Rank':d.field==='khi'?'Khí':'Thy Mây'} ${d.mode==='set'?'đặt thành':'cộng'} ${d.value} (${d.before} → ${d.after})`;
  if(r.action==='grant_item')return `Tặng "${d.item}" x${d.qty} cho ${d.name}`;
  if(r.action==='revoke_item')return `Thu hồi "${d.item}" của ${d.name}`;
  if(r.action==='save_item')return `Lưu vật phẩm "${d.name}" (${d.price} Thy Mây${d.active?'':', đang ẩn'})`;
  if(r.action==='delete_item')return `Xóa vật phẩm "${d.name}"`;
  if(r.action==='topup_approve')return `Duyệt nạp ${vnd(d.amount)} (NAP${d.order}) → +${d.coins} Thy Mây cho ${d.name}`;
  if(r.action==='topup_reject')return `Từ chối nạp ${vnd(d.amount)} (NAP${d.order}) của ${d.name}${d.note?': '+d.note:''}`;
  return r.action;};
function LogTab(){
  const [rows,setRows]=useState(null);
  useEffect(()=>{sb.from('admin_log').select('*').order('created_at',{ascending:false}).limit(80).then(({data})=>setRows(data||[]));},[]);
  return <div className="hlist">{!rows&&<p className="muted">Đang tải…</p>}{rows&&!rows.length&&<p className="muted">Chưa có thao tác nào.</p>}
    {(rows||[]).map(r=><div key={r.id} className="hrow static"><span className="hmain"><b>{summarize(r)}</b><small>{when(r.created_at)}</small></span></div>)}</div>;
}

// ---------------- Nạp tiền ----------------
function TopupTab({onChanged}){
  const [filter,setFilter]=useState('pending'),[rows,setRows]=useState(null),[err,setErr]=useState(''),[busy,setBusy]=useState(0);
  const load=useCallback(async()=>{
    const {data,error}=await sb.rpc('admin_list_topups',{p_status:filter,p_limit:100});
    if(error){setErr(error.message);return;}setErr('');setRows(data||[]);
  },[filter]);
  useEffect(()=>{setRows(null);load();const t=setInterval(load,15000);return()=>clearInterval(t);},[load]);
  const act=async(o,kind)=>{
    let note=null;
    if(kind==='approve'){if(!confirm(`Xác nhận ĐÃ NHẬN ${vnd(o.amount)} từ ${o.username} (nội dung ${memoOf(o.id)})?\nSẽ cộng ${fmt(o.coins)} Thy Mây và không hoàn tác được.`))return;}
    else{note=prompt(`Từ chối lệnh ${vnd(o.amount)} của ${o.username}. Lý do (có thể để trống):`);if(note===null)return;}
    setBusy(o.id);setErr('');
    const {error}=kind==='approve'?await sb.rpc('admin_approve_topup',{p_id:o.id}):await sb.rpc('admin_reject_topup',{p_id:o.id,p_note:note});
    setBusy(0);if(error)setErr(error.message);load();onChanged&&onChanged();
  };
  const ST={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối',cancelled:'Người chơi hủy'};
  return <>
    <div className="addbar"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">Đang chờ duyệt</option><option value="all">Tất cả</option><option value="approved">Đã duyệt</option><option value="rejected">Đã từ chối</option></select>
      <button className="secondary" onClick={load}>Tải lại</button></div>
    <small className="hint">Đối chiếu số tiền và nội dung <b>NAP + mã lệnh</b> trong app ngân hàng, chỉ bấm Duyệt khi tiền đã về tài khoản. Lệnh chỉ duyệt được một lần.</small>
    {err&&<p className="warn">{err}</p>}{!rows&&!err&&<p className="muted">Đang tải…</p>}
    <div className="hlist" style={{marginTop:10}}>{(rows||[]).map(o=><div key={o.id} className="tuorder"><div className="hrow static">
      <span className="hmain"><b>{vnd(o.amount)} → {fmt(o.coins)} Thy Mây <span className="res draw">{memoOf(o.id)}</span></b><small>{o.username} • {o.email} • {when(o.created_at)}</small>{o.status!=='pending'&&<small>{ST[o.status]} {when(o.decided_at)}{o.note?' • '+o.note:''}</small>}</span>
      {o.status==='pending'&&<span className="rowbtn" style={{margin:0}}><button className="primary" disabled={busy===o.id} onClick={()=>act(o,'approve')}>Duyệt</button><button className="secondary danger" disabled={busy===o.id} onClick={()=>act(o,'reject')}>Từ chối</button></span>}
    </div></div>)}
    {rows&&!rows.length&&<p className="muted">{filter==='pending'?'Không có lệnh nào đang chờ duyệt.':'Không có lệnh nào.'}</p>}</div>
  </>;
}

export default function Admin({profile,onBack}){
  const [tab,setTab]=useState('items'),[pend,setPend]=useState(0);
  const countPend=useCallback(async()=>{const {data}=await sb.rpc('admin_list_topups',{p_status:'pending',p_limit:300});setPend((data||[]).length);},[]);
  useEffect(()=>{if(!profile?.is_admin)return;countPend();const t=setInterval(countPend,20000);return()=>clearInterval(t);},[profile?.is_admin,countPend]);
  if(!profile?.is_admin)return <main className="content"><button className="back" onClick={onBack}>← Trang chủ</button><p className="warn">Bạn không có quyền quản trị.</p></main>;
  return <main className="content">
    <button className="back" onClick={onBack}>← Trang chủ</button>
    <h2 className="sectiontitle"><ShieldCheck size={22} style={{verticalAlign:'-4px'}}/> Quản trị</h2>
    <div className="tabs">{[['items','Vật phẩm'],['players','Người chơi'],['topup','Nạp tiền'+(pend?` (${pend})`:'')],['log','Nhật ký']].map(([k,v])=><button key={k} className={'tab '+(tab===k?'on':'')} onClick={()=>setTab(k)}>{v}</button>)}</div>
    {tab==='items'?<ItemsTab/>:tab==='players'?<PlayersTab/>:tab==='topup'?<TopupTab onChanged={countPend}/>:<LogTab/>}
  </main>;
}
