// Hệ thống Khí: 12 Khí = Cấp 1 (Linh Thai Sơ Kỳ). Mỗi bậc kế tiếp cần gấp 8 lần bậc trước.
export const REALMS=['Linh Thai','Ngũ Diệu','Lục Hợp','Thất Tinh','Thiên Nhân','Sinh Tử','Thần Kiều','Trảm Thần Đài','Dao Trì','Ngọc Kinh','Lăng Tiêu','Đế Tọa'];
export const STAGES=['Sơ Kỳ','Trung Kỳ','Đại Kỳ','Hoàn Chỉnh'];
export const BETS=[2,10,50,500,900];
export const BASE=12,RATIO=8,MAX_N=REALMS.length*STAGES.length-1;
export const need=n=>BASE*RATIO**n; // số Khí cần có để đạt bậc n (n=0: 12, n=1: 96, n=2: 768 …)

export function khiInfo(khi){
  khi=Number(khi)||0;
  let n=0;while(n<MAX_N&&khi>=need(n+1))n++;
  const cur=need(n),next=n<MAX_N?need(n+1):null;
  const pct=next?Math.max(0,Math.min(100,(khi-cur)/(next-cur)*100)):100;
  return {n,level:n+1,realm:REALMS[Math.floor(n/4)],stage:STAGES[n%4],name:`${REALMS[Math.floor(n/4)]} ${STAGES[n%4]}`,cur,next,pct,toNext:next?Math.max(0,next-khi):0};
}
export const fmt=n=>Number(n).toLocaleString('vi-VN');

// Rank (điểm Elo) -> danh hiệu
export const TIERS=[[0,'Tân Kỳ'],[1100,'Kỳ Sĩ'],[1300,'Kỳ Sư'],[1500,'Kỳ Tôn'],[1700,'Kỳ Thánh']];
export const tierOf=r=>[...TIERS].reverse().find(([min])=>r>=min)[1];

export const MODES={casual:'Đấu thường',ranked:'Đấu Rank',khi:'Luyện Khí'};
// Tên đầy đủ mọi chế độ (gồm phòng riêng, không ghép trận ngẫu nhiên) dùng cho lịch sử và ván đấu
export const MODE_NAMES={...MODES,room:'Phòng riêng'};
// Mô tả ngắn luật của một phòng riêng: "tính Rank • cược 50 Khí • cược 10 Thy Mây"
export const roomRules=(rated,betKhi,betCoins)=>[rated?'tính Rank (Elo)':'không tính Rank',Number(betKhi)>0?`cược ${fmt(betKhi)} Khí`:null,Number(betCoins)>0?`cược ${fmt(betCoins)} Thy Mây`:null].filter(Boolean).join(' • ');
