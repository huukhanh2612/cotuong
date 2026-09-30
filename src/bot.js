// Cấu hình bot (ghép trận khi không có người chơi).
// Server ghép bot sau 8 giây chờ (hằng số bot_wait_seconds trong hàm find_match, schema.sql).
// Bot dùng lại AI trong engine.js: level 1 = yếu, 2 = vừa, 3 = mạnh (chậm hơn, có thể giật trên điện thoại cũ).
export const BOT_LEVEL=2;
export const BOT_WAIT_SECONDS=8;                                   // chỉ dùng để hiện thông báo, phải khớp với schema.sql
export const botDelay=()=>700+Math.floor(Math.random()*1300);      // bot "suy nghĩ" 0.7–2 giây cho giống người
