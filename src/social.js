// Tiện ích dùng chung cho phần bạn bè / phòng riêng
export async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true;}
  catch{
    const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity='0';
    document.body.appendChild(a);a.select();let ok=false;
    try{ok=document.execCommand('copy');}catch{}
    a.remove();return ok;
  }
}
// Chia ID 8 chữ số thành 2 nhóm cho dễ đọc: 1234 5678
export const showCode=c=>c?String(c).replace(/(\d{4})(\d{4})/,'$1 $2'):'—';
