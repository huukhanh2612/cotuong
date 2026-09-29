// Thông tin nhận tiền nạp Thy Mây. Muốn đổi tài khoản: sửa BANK và thay ảnh public/qr-nap.jpg.
export const BANK={bank:'VietinBank',branch:'CN Long An - PGD Đức Hòa Nam',name:'PHAN HUU KHANH',account:'103879274024',qr:'/qr.jpg'};
export const TOPUP={min:10000,max:1000000,step:10000,presets:[10000,20000,50000,100000,200000,500000,1000000]};
// Phải khớp hàm _topup_coins trong supabase/schema.sql (server mới là nơi quyết định số Thy Mây thật sự nhận).
export const topupCoins=a=>Math.floor(a/10000)*5+Math.floor(a/20000);
export const vnd=n=>Number(n).toLocaleString('vi-VN')+'đ';
export const memoOf=id=>'NAP'+id;
