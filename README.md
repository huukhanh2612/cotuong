# Cờ Tướng — Giai đoạn 5: ID người chơi, bạn bè, phòng riêng (Elo + cược Khí / Thy Mây)

Đã có từ trước: tài khoản thật (Supabase Auth), ghép trận, đấu thường, đấu Rank (Elo), Luyện Khí (cược Khí), cảnh giới Khí, lịch sử trận có xem lại, ví Thy Mây, cửa hàng, kho đồ, thẻ hiệu ứng, trang Quản trị.
**Mới ở bản này:**
1. **Bảng xếp hạng tuần** xếp theo điểm Khí.
2. **Giao diện theo thiết bị** (điện thoại / máy tính bảng / máy tính) và trang Cài đặt.
3. **Nhạc game**: 3 bản nhạc nền tự sinh, hiệu ứng âm thanh khi đi quân, ăn quân, chiếu tướng, thắng, thua.

> **Nâng cấp từ bản cũ:** chạy lại toàn bộ `supabase/schema.sql` trong SQL Editor (an toàn, không mất dữ liệu cũ), rồi `npm install` và `npm run dev`. Không có thư viện mới cần cài thêm.

## Giai đoạn 5 — ID, bạn bè, phòng riêng
> **Nâng cấp từ giai đoạn 4:** chạy lại toàn bộ `supabase/schema.sql` trong SQL Editor (an toàn, không mất dữ liệu; tài khoản cũ được cấp ID tự động), rồi `npm install` và `npm run dev`. Không có thư viện mới.

**ID người chơi:** mỗi tài khoản có một ID 8 chữ số (ví dụ `4821 7359`), tự cấp khi đăng ký, không đổi được. Xem và chép ở trang **Bạn bè** hoặc trang **Tôi**.

**Kết bạn:** trang **Bạn bè** → nhập ID → *Tìm* → *Kết bạn*. Bên kia thấy lời mời (chấm đỏ trên thanh dưới, dòng trên trang chủ) và bấm *Chấp nhận*. Nếu hai bên cùng mời nhau thì tự thành bạn. Có thể xóa bạn, từ chối, hủy lời mời đã gửi. Giới hạn: 200 bạn, 30 lời mời chờ. Bạn bè có chấm xanh khi đang online (cập nhật ~10 giây), hiện Rank/Khí và trạng thái đang đấu. Sau mỗi ván online có nút **Kết bạn** với đối thủ.

**Phòng riêng** (Trang chủ → *Phòng riêng*, hoặc *Mời đấu* cạnh tên bạn):
- **Tạo phòng** với các tùy chọn độc lập: *Tính Rank (Elo)* bật/tắt, *Cược Khí* (số bất kỳ, 0 = không cược), *Cược Thy Mây* (0 = không cược). Bật cả ba cùng lúc được. Có thể mời một người bạn (chỉ người đó vào được) hoặc để trống rồi gửi **mã phòng 6 ký tự**.
- **Vào phòng**: nhập mã (hoặc bấm *Xem phòng* ở lời mời) → thấy luật cược → *Vào phòng & bắt đầu*. Ván bắt đầu ngay, màu quân ngẫu nhiên.
- **Cọc:** lúc vào phòng server kiểm tra **cả hai** đều đủ Khí/Thy Mây rồi giữ cọc. Thắng nhận cọc của cả hai (lời đúng bằng mức cược), thua mất cọc, hòa hoàn cọc. Xin thua, hết giờ, chiếu bí đều xử theo đúng luật đó (dùng chung `_settle`).
- **Rank:** nếu bật, tính Elo K=32 như Đấu Rank. Lịch sử và màn kết quả hiện Rank ±, Khí ±, Thy Mây ±.
- **Chống lạm dụng:** phòng riêng **không** có Thy Mây thưởng Rank, không có chuỗi thắng, **không nhân thẻ EXP/Khí**, và **không tính bảng xếp hạng tuần** (vì hai tài khoản của cùng một người có thể tự đấu với nhau). Muốn đổi, sửa nhánh `m.mode='room'` trong hàm `_settle`.
- Phòng chờ sống khi chủ phòng còn mở trang chờ; rời trang là phòng tự đóng, quá 120 giây không hoạt động cũng đóng. Mỗi người chỉ có một phòng chờ.
- Nhật ký Thy Mây ghi hai loại giao dịch mới: *Cược phòng riêng* (trừ lúc vào) và *Thưởng phòng riêng* (nhận khi thắng/hòa).

Dữ liệu mới: bảng `friendships`, `rooms`; cột `profiles.player_code`, `profiles.last_seen`, `matches.bet_coins/rated/room_id`; chế độ `room` trong `matches.mode`. Bảng chỉ ghi được qua hàm phía server (`send_friend_request`, `accept_friend`, `remove_friend`, `create_room`, `join_room`, `room_status`, `close_room`, ...). Mã mới: `src/Friends.jsx`, `src/Rooms.jsx`, `src/social.js`.

**Chưa kiểm tra:** giai đoạn 5 chưa được chạy thử trên trình duyệt hay Supabase thật. Nếu SQL hoặc giao diện báo lỗi, gửi nguyên thông báo lỗi để sửa.

## Bảng xếp hạng tuần (điểm Khí)
- Vào từ trang chủ, mục **Bảng xếp hạng tuần** (trên điện thoại còn có nút **Xếp hạng** ở thanh dưới). Có hai tab: **Tuần này** và **Tuần trước**.
- **Điểm tuần = Khí lời ròng trong các ván Luyện Khí của tuần**: thắng cộng số Khí lời, thua trừ số Khí cược, hòa không đổi. Thẻ x2/x4 Khí được tính (vì Khí lời đã nhân thẻ).
- Bảng tự cập nhật: mỗi khi có ván Luyện Khí kết thúc, server cộng điểm ngay; trang bảng tự tải lại mỗi 15 giây và khi bạn quay lại thẻ trình duyệt.
- **Tuần chạy từ 00:00 Thứ Hai đến hết Chủ Nhật, giờ Việt Nam.** Sang tuần mới bảng tự về 0 (không cần cron); tuần cũ vẫn xem được ở tab Tuần trước. Có đồng hồ đếm ngược đến lúc chốt bảng.
- Bằng điểm thì ai thắng nhiều hơn đứng trên, rồi ít trận hơn, rồi tài khoản lập sớm hơn.
- Hiển thị top 50, và luôn kèm dòng của bạn nếu bạn nằm ngoài top 50. Avatar, khung avatar, khung tên đang trang bị được hiển thị.
- **Chống lạm dụng:** ván Luyện Khí dưới **6 nước** không tính vào bảng tuần (đổi ở hằng số `week_min_plies` trong hàm `_settle`; đặt 0 nếu muốn tắt). Khí do Quản trị chỉnh tay không tính vào bảng tuần.
- Dữ liệu nằm ở bảng `weekly_khi` (không ai sửa được từ trình duyệt), đọc qua hàm `weekly_leaderboard(p_offset, p_limit)`.
- Bảng chỉ tính từ lúc bạn chạy schema mới; các ván Luyện Khí cũ không được tính ngược.

## Giao diện theo thiết bị
- **Lần đầu vào trang** hiện hộp chọn: *Điện thoại / Máy tính bảng / Máy tính / Tự động*. Đổi lại bất cứ lúc nào ở biểu tượng **bánh răng** trên thanh trên cùng.
- **Điện thoại:** bàn cờ tràn màn hình, nút bấm to (tối thiểu 46px), ô nhập cỡ 16px (iOS không tự phóng to), thanh điều hướng cố định phía dưới (Trang chủ, Đấu, Xếp hạng, Cửa hàng, Tôi), hộp cài đặt trượt từ dưới lên, tránh tai thỏ/thanh home (safe-area), xoay ngang thì bàn cờ tự co theo chiều cao màn hình, kéo trang không làm tải lại giữa ván.
- **Máy tính bảng:** bố cục vừa, nút cỡ trung. **Máy tính:** bố cục rộng như trước.
- Cài đặt thêm: **cỡ chữ và nút** (Nhỏ/Vừa/Lớn) và **giảm hiệu ứng chuyển động** (tiết kiệm pin). Lựa chọn được lưu trên trình duyệt của từng người.
- Chế độ Tự động nhận theo bề rộng màn hình và kiểu con trỏ (cảm ứng/chuột).

## Nhạc game
- **3 bản nhạc nền** (tự sinh bằng WebAudio, không cần file mp3, không lo bản quyền): *Sơn Thủy* (đàn tranh), *Thiền Trà* (sáo trúc, chuông gió), *Kỳ Đài* (trống trận). Chế độ **Tự động**: ở sảnh phát Sơn Thủy, vào ván đấu chuyển sang Kỳ Đài.
- **Hiệu ứng âm thanh:** gõ quân, ăn quân (nặng hơn), chọn quân, chiếu tướng, nhạc thắng, thua, hòa, và tiếng tích nhẹ khi bấm nút. Nước đi của đối thủ trong ván online cũng có tiếng.
- Bật/tắt nhanh bằng nút loa trên thanh trên cùng; chọn bản nhạc, chỉnh âm lượng nhạc và hiệu ứng riêng trong **Cài đặt**.
- Trình duyệt chỉ cho phát tiếng sau lần chạm/bấm đầu tiên, nên nhạc sẽ bắt đầu ngay khi bạn chạm vào trang. Nhạc tự tạm dừng khi bạn chuyển sang thẻ/ứng dụng khác.
- Muốn dùng file nhạc thật: mã nhạc nằm gọn trong `src/audio.js` (hàm `startTrack`), có thể thay bằng thẻ `<audio>`.

## Nạp Thy Mây (chuyển khoản, admin duyệt thủ công)
**Người chơi:** Ví tài nguyên → **Nạp Thy Mây** (hoặc ô "Nạp Thy Mây" ở trang chủ). Chọn mức nạp → **Tạo lệnh nạp** → app hiện mã QR, số tài khoản và nội dung chuyển khoản `NAP<mã lệnh>` (có nút Chép). Chuyển khoản xong chờ admin duyệt; trang tự cập nhật mỗi 10 giây, duyệt xong Thy Mây vào ví ngay. Lệnh chờ duyệt có thể hủy; mỗi người tối đa **3 lệnh chờ** cùng lúc.

**Bảng quy đổi:** 10.000đ = 5 Thy Mây, 20.000đ = 11 Thy Mây. Với số tiền khác, công thức là *5 Thy Mây mỗi 10.000đ, cộng thêm 1 cho mỗi 20.000đ*: 30k = 16, 40k = 22, 50k = 27, 100k = 55, 1 triệu = 550. Mức nạp phải là **bội số của 10.000đ, tối đa 1.000.000đ mỗi lệnh**. Muốn đổi: sửa hàm `_topup_coins` và hằng số `c_min / c_max / c_step / c_pending` trong hàm `create_topup` (schema.sql), rồi sửa `src/bank.js` cho khớp. Số Thy Mây được chốt lúc tạo lệnh nên đổi bảng giá không ảnh hưởng lệnh cũ.

**Admin:** Quản trị → tab **Nạp tiền** (có số lệnh đang chờ ngay trên tab, tự tải lại mỗi 15 giây). Mỗi lệnh có tên người chơi, email, số tiền, mã `NAP…`. Đối chiếu sao kê ngân hàng rồi bấm **Duyệt** (cộng Thy Mây, ghi vào lịch sử giao dịch của người chơi và Nhật ký admin) hoặc **Từ chối** (có thể ghi lý do người chơi sẽ thấy). Server khóa dòng khi duyệt nên **một lệnh không bao giờ được cộng hai lần**, kể cả bấm dồn hay hai admin cùng bấm.

**Đổi tài khoản nhận tiền:** sửa `BANK` trong `src/bank.js` và thay ảnh `public/qr-nap.jpg`.

> Lưu ý: game không tự biết tiền đã về. Việc duyệt hoàn toàn dựa vào việc bạn đối chiếu sao kê, nên chỉ bấm Duyệt khi đã thấy tiền vào tài khoản.

## 1. Tạo dự án Supabase
1. Vào https://supabase.com, tạo project mới.
2. **SQL Editor → New query**, dán toàn bộ `supabase/schema.sql`, bấm **Run**. (Chạy lại nhiều lần vẫn an toàn; vật phẩm bạn đã sửa/thêm trong game không bị ghi đè.)
3. **Authentication → Providers → Email**: khi test nên tắt **Confirm email** để đăng ký xong vào chơi được ngay.
4. **Project Settings → API**: lấy `Project URL` và `anon public key`.
5. Kiểm tra **Database → Replication**: bảng `matches` và `match_moves` phải nằm trong publication `supabase_realtime` (schema đã tự thêm). Nếu không bật, game vẫn chạy nhờ thăm dò 3 giây/lần nhưng chậm hơn.

## 2. Chạy trên máy
```
copy .env.example .env      (Windows)   |   cp .env.example .env
# điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env
npm install
npm run dev
```
Test ghép trận: mở 2 cửa sổ trình duyệt (một cửa sổ ẩn danh), đăng ký 2 tài khoản khác nhau, cùng chọn một chế độ (và cùng mức cược nếu là Luyện Khí).

## 3. Vercel
Import repo, thêm hai biến môi trường `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, rồi Deploy.

## 4. Tài khoản Admin
1. Đăng ký một tài khoản bình thường trong game (ví dụ `admin@gmail.com`).
2. Mở `supabase/schema.sql`, tìm dòng `v_email constant text:='admin@example.com'` (gần cuối phần "TÀI KHOẢN ADMIN") và đổi thành email vừa đăng ký.
3. Chạy lại file trong SQL Editor (hoặc chỉ dán riêng khối `do $$ ... $$` đó).
4. Đăng nhập lại: trang chủ có thêm mục **Quản trị**.

Quyền admin được kiểm tra ở phía server (mọi hàm `admin_*` đều từ chối người không phải admin), không ai tự cấp quyền cho mình được từ trình duyệt.

Trang Quản trị có 3 tab:
- **Vật phẩm**: thêm vật phẩm mới (chọn loại, tên, giá, màu sắc, có xem trước trực tiếp), sửa giá/mô tả, ẩn khỏi cửa hàng, xóa (chỉ xóa được khi chưa ai sở hữu, nếu đã có người mua hãy ẩn).
- **Người chơi**: tìm theo tên/email, chỉnh **Rank / Khí / Thy Mây** (đặt thành hoặc cộng/trừ), tặng hoặc thu hồi vật phẩm.
- **Nhật ký**: mọi thao tác của admin đều được ghi lại.

## Thy Mây, Shop và thẻ hiệu ứng
**Kiếm Thy Mây:** mỗi trận Đấu Rank nhận 1 Thy Mây. Thắng liên tiếp từ 3 trận Rank trở lên: mỗi trận thắng nhận x2 (2 Thy Mây). Thua reset chuỗi về 0, hòa giữ nguyên chuỗi. Đấu thường và Luyện Khí không có Thy Mây.
Chống cày: trận Rank phải có từ **6 nước** trở lên mới được tính Thy Mây (đổi ở hằng số `coin_min_plies` trong hàm `_settle`; đặt 0 nếu muốn tắt).

**Thẻ hiệu ứng** (mua rồi vào Kho đồ bấm "Dùng thẻ", chạy đúng thời gian ghi trên thẻ, theo đồng hồ server):
- Thẻ **EXP**: nhân điểm Rank mà người *thắng* nhận được (người thua không bị trừ nhiều hơn).
- Thẻ **Khí**: nhân số Khí lời của người *thắng* ở Luyện Khí (người thua vẫn chỉ mất đúng mức cược).
- Mỗi loại chỉ chạy một thẻ một lúc; đang có thẻ cùng loại thì không dùng thẻ mới được.

**Vật phẩm trang trí** mua một lần dùng mãi, trang bị/tháo trong Kho đồ. Đối thủ nhìn thấy avatar, khung avatar và khung tên của bạn trong ván; sân đấu là của chính bạn (bên bạn thấy sân bạn đã trang bị).

**Giá mẫu** (sửa trong tab Vật phẩm): thẻ 20–60, avatar 60–150, khung avatar 80–200, khung tên 60–120, sân đấu 150–250 Thy Mây.

## Vật phẩm lưu thế nào (cột `data` của bảng `shop_items`)
Vật phẩm là dữ liệu, thêm mới không cần sửa code. Các trường:
- `boost`: `{"boost":"exp"|"khi","mult":2,"minutes":30}`
- `avatar`: `{"glyph":"🐉","bg":"#1f5a3a","fg":"#ffffff"}` hoặc `{"img":"https://..."}`
- `avatar_frame`: `{"c1":"#..","c2":"#..","width":3,"glow":"#..","pulse":true}`
- `name_frame`: `{"c1":"#..","c2":"#..","glow":"#..","pre":"✦ ","post":" ✦"}`
- `board`: `w1,w2,w3` (nền), `line` (đường kẻ), `text` (chữ sông), `vig` (bóng viền), `grain` (vân gỗ 0–1), `frame1..3` và `ring` (khung)

## Luật hệ thống
**Khí**: mới đăng ký có 12 Khí = Cấp 1 (Linh Thai Sơ Kỳ). Bậc thứ n cần tổng cộng `12 × 8^n` Khí:
Sơ Kỳ 12 → Trung Kỳ 96 → Đại Kỳ 768 → Hoàn Chỉnh 6.144 → Ngũ Diệu Sơ Kỳ 49.152 → … (12 cảnh giới × 4 bậc = 48 cấp).
Cấp độ tính từ Khí hiện có nên thua cược thì có thể tụt bậc.

**Luyện Khí**: chọn 1 trong 5 mức cược 2 / 10 / 50 / 500 / 900 (chỉ chọn được mức bạn đủ Khí). Hai người cùng mức cược được ghép với nhau. Khi vào trận, mỗi người bị giữ cọc; thắng nhận lại cọc của mình cộng cọc của đối thủ (lời đúng bằng mức cược), thua mất cọc, hòa được hoàn cọc.

**Rank**: bắt đầu 1000 điểm, tính Elo hệ số K=32. Danh hiệu: Tân Kỳ (<1100), Kỳ Sĩ, Kỳ Sư (1300), Kỳ Tôn (1500), Kỳ Thánh (1700+). Ghép trận Rank ưu tiên người có điểm gần nhau (±100, mở rộng thêm 10 điểm mỗi giây chờ).

**Thời gian**: 150 giây mỗi nước; hết giờ bị xử thua (server tự kiểm tra). Có thể xin thua. Nếu tải lại trang giữa ván, game tự đưa bạn về ván đang chơi.

## Cấu trúc mã
- `supabase/schema.sql` — bảng, RLS, hàm ghép trận / đi quân / tính điểm / lịch sử / shop / admin / vật phẩm mẫu
- `src/khi.js` — cảnh giới Khí, mức cược, danh hiệu Rank
- `src/engine.js` — luật cờ, AI, trạng thái ván (dùng chung offline và online)
- `src/Board.jsx` — bàn cờ SVG (có lật bàn cho bên Đen)
- `src/Lobby.jsx`, `src/OnlineGame.jsx`, `src/History.jsx` — ghép trận, ván online, lịch sử + xem lại
- `src/Shop.jsx` (cửa hàng + kho đồ), `src/Wallet.jsx` (ví), `src/TopUp.jsx` + `src/bank.js` (nạp Thy Mây), `src/Admin.jsx` (quản trị)
- `src/cosmetics.js`, `src/ui.jsx` — dữ liệu và thành phần hiển thị vật phẩm (avatar, khung, sân đấu)
- `src/Leaderboard.jsx` — bảng xếp hạng tuần
- `src/Friends.jsx`, `src/Rooms.jsx`, `src/social.js` — ID, bạn bè, phòng riêng
- `src/prefs.js`, `src/SettingsPanel.jsx` — chọn thiết bị, cỡ chữ, hộp Cài đặt
- `src/audio.js`, `src/useGameSounds.js` — nhạc nền, hiệu ứng âm thanh, gắn tiếng vào ván cờ

## Giới hạn đã biết
- Bản này **chưa được chạy thử trên trình duyệt thật hay Supabase thật**. Đã kiểm tra: `vite build` biên dịch thành công, và toàn bộ `schema.sql` chạy sạch hai lần liên tiếp trên PostgreSQL giả lập Supabase, kèm thử một ván Luyện Khí cho ra đúng bảng xếp hạng. Chưa kiểm tra: giao diện trên máy thật và nghe nhạc. Nếu có lỗi, hãy gửi nguyên thông báo lỗi để sửa.
- Hai tài khoản của cùng một người có thể tự đấu Luyện Khí để đẩy điểm bảng tuần (đã chặn ván dưới 6 nước, chưa chặn triệt để). Muốn chặt hơn: không tính khi đối thủ trùng lặp nhiều lần trong tuần.
- Hai tài khoản của cùng một người có thể tự đấu Rank để cày Thy Mây (đã chặn ván dưới 6 nước, nhưng chưa chặn triệt để). Muốn chặt hơn: giới hạn số Thy Mây mỗi ngày hoặc không tính khi đối thủ trùng nhiều lần.
- Server kiểm tra lượt đi, thứ tự, hết giờ và tính điểm, **nhưng chưa kiểm tra luật đi quân** (việc đó do client). Người dùng rành kỹ thuật có thể gửi nước đi sai luật. Muốn chặt hơn: đưa `engine.js` vào Supabase Edge Function để xác thực từng nước.
- Bên vừa đi nước cuối tự báo chiếu bí/hòa. Nếu bên đó thoát ngay, ván sẽ kết thúc bằng hết giờ.
- Người chơi hết Khí (dưới 2) sẽ không vào được Luyện Khí; vẫn chơi được đấu thường và Rank.
