import React,{useState} from 'react';
import {sb} from './supabase.js';
import {BOT_BUILD} from './bot.js';

const NIL='00000000-0000-0000-0000-000000000000';
const MISSING=/could not find|schema cache|does not exist|PGRST202|404/i;

// Nút "Kiểm tra bot": kiểm tra nhanh bản giao diện đang chạy, tài khoản bot và các hàm bot trên Supabase.
// Các lệnh gọi thử dùng ID trận giả nên không làm thay đổi dữ liệu.
export default function BotCheck(){
  const [rows,setRows]=useState(null),[busy,setBusy]=useState(false);
  const run=async()=>{
    setBusy(true);setRows(null);const out=[];const add=(ok,t)=>out.push({ok,t});
    try{
      add(true,'Bản giao diện đang chạy: '+BOT_BUILD);
      const r=await sb.from('profiles').select('id',{count:'exact',head:true}).eq('is_bot',true);
      if(r.error)add(false,'Không đọc được cột is_bot: '+r.error.message+' → chạy lại toàn bộ supabase/schema.sql');
      else if(!r.count)add(false,'Chưa có tài khoản bot nào (is_bot=true) → chạy lại toàn bộ supabase/schema.sql');
      else add(true,'Có '+r.count+' tài khoản bot');
      for(const [fn,args] of [
        ['bot_move',{p_match:NIL,p_ply:0,p_fx:0,p_fy:0,p_tx:0,p_ty:1}],
        ['tam_bot_move',{p_match:NIL,p_ply:0,p_fx:0,p_fy:0,p_tx:0,p_ty:1}]]){
        const {error}=await sb.rpc(fn,args);
        const msg=error?.message||'';
        if(error&&(MISSING.test(msg)||error.code==='PGRST202'))add(false,'Hàm '+fn+' chưa có hoặc chưa được nạp → chạy lại schema.sql, rồi chạy thêm: notify pgrst, \'reload schema\';');
        else if(error&&/permission denied/i.test(msg))add(false,'Hàm '+fn+' chưa được cấp quyền → chạy lại toàn bộ schema.sql');
        else add(true,'Hàm '+fn+' có và gọi được');
      }
    }catch(e){add(false,'Lỗi khi kiểm tra: '+(e?.message||e));}
    setRows(out);setBusy(false);
  };
  return <div style={{marginTop:14,textAlign:'center'}}>
    <button className="secondary" onClick={run} disabled={busy}>{busy?'Đang kiểm tra…':'Kiểm tra bot'}</button>
    {rows&&<div className="hint" style={{textAlign:'left',marginTop:8}}>{rows.map((r,i)=><div key={i}>{r.ok?'✅':'❌'} {r.t}</div>)}</div>}
  </div>;
}
