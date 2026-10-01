// Cấu hình bot (ghép trận khi không có người chơi).
// Server ghép bot sau 8 giây chờ (hằng số bot_wait_seconds trong hàm find_match, schema.sql).
// Bot dùng lại AI trong engine.js: level 1 = yếu, 2 = vừa, 3 = mạnh (chậm hơn, có thể giật trên điện thoại cũ).
export const BOT_LEVEL=2;
export const BOT_WAIT_SECONDS=8;                                   // chỉ dùng để hiện thông báo, phải khớp với schema.sql
export const botDelay=()=>700+Math.floor(Math.random()*1300);      // bot "suy nghĩ" 0.7–2 giây cho giống người
export const BOT_BUILD='bot-v3 (01/10/2026)';                       // hiện trong nút "Kiểm tra bot" để biết trình duyệt đang chạy bản nào
// Nhận diện bot: cột is_bot, hoặc tên bắt đầu bằng 🤖 (dự phòng; nếu DB chưa đánh dấu is_bot thì server sẽ báo lỗi rõ ràng thay vì im lặng)
export const isBotProfile=p=>!!p&&(p.is_bot===true||/^🤖/.test(p.username||''));
