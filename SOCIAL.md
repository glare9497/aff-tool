# Kết nối Facebook, Instagram, TikTok và kho lưu media

Tool vẫn dùng được khi **chưa kết nối gì**: thêm tài khoản thủ công ở trang **Tài khoản**, tool lên lịch, nhắc bạn đăng, bạn đăng tay rồi bấm "Đánh dấu đã đăng".
Kết nối API để tool **tự đăng**.

Sau khi sửa `.env.local`, luôn tắt rồi chạy lại `npm run dev`.

| Nền tảng | Tự động tới đâu | Cần |
|---|---|---|
| Facebook Page | Đăng chữ / ảnh / video + bình luận đầu chứa link, hẹn giờ | Meta App |
| Instagram | Đăng ảnh / Reels, hẹn giờ | Meta App + Cloudflare R2 |
| TikTok | Gửi video vào **hộp nháp**; bạn gắn giỏ hàng và bấm đăng trong app | TikTok App (cần đã deploy, vì TikTok chỉ nhận redirect `https`) |

---

## 1. Meta App (Facebook Page + Instagram), khoảng 10 phút

1. Vào https://developers.facebook.com → đăng nhập bằng Facebook **đang làm quản trị viên các Page** → **My Apps → Create App**.
2. Chọn use case cho phép **quản lý Page** (tên có thể là "Manage everything on your Page" hoặc tương tự), loại app **Business**. Đặt tên tuỳ ý.
3. Trong app, thêm sản phẩm **Facebook Login** (hoặc "Facebook Login for Business") → **Settings** → mục **Valid OAuth Redirect URIs** thêm:
   - `http://localhost:3100/api/connect/meta/callback`
   - Khi deploy: `https://<tên-app>.vercel.app/api/connect/meta/callback`
4. **App settings → Basic**: copy **App ID** và **App Secret** vào `.env.local`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```
   Cùng trang đó, ô **Privacy Policy URL** điền `https://<tên-app>.vercel.app/legal/privacy` (khi đã deploy).
5. Giữ app ở chế độ **Development**. Bạn là admin của app nên dùng được với Page của chính mình mà không cần Meta duyệt (App Review chỉ cần khi cho người ngoài dùng).
6. **Instagram**: chuyển tài khoản Instagram sang **Professional (Business hoặc Creator)**, rồi **liên kết với Facebook Page** (Instagram → Cài đặt → Trung tâm tài khoản, hoặc Meta Business Suite).
7. Trong tool: **Tài khoản → Kết nối Facebook** → chọn **tất cả Page** và cấp đủ quyền. Tool tự nhập các Page và Instagram đã liên kết.

Quyền tool xin: `pages_show_list, pages_read_engagement, pages_manage_posts, instagram_basic, instagram_content_publish, business_management`.

Thêm Page mới sau này: bấm **Kết nối Facebook** lại; Page cũ được cập nhật, không bị trùng.

## 2. Cloudflare R2 (lưu ảnh/video), khoảng 10 phút, free 10GB

Instagram lấy ảnh/video **qua link công khai**, nên cần R2. Facebook và TikTok dùng được cả khi lưu trên máy, nhưng **khi deploy lên Vercel thì bắt buộc R2** (Vercel không lưu file).

1. https://dash.cloudflare.com → **R2** → bật R2 (có thể phải nhập thẻ, gói free không bị trừ tiền) → **Create bucket** tên `aff-media`.
2. Bucket → **Settings → Public access → R2.dev subdomain → Allow** → copy URL dạng `https://pub-xxxx.r2.dev`.
3. Bucket → **Settings → CORS policy** → dán:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3100", "https://<tên-app>.vercel.app"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. R2 → **Manage R2 API Tokens → Create API token** → quyền **Object Read & Write**, giới hạn bucket `aff-media` → copy **Access Key ID**, **Secret Access Key**. **Account ID** nằm ở trang R2 tổng quan.
5. `.env.local`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET=aff-media
   R2_PUBLIC_URL=https://pub-xxxx.r2.dev
   ```

## 3. TikTok Developer App, khoảng 15 phút (sau khi deploy)

1. https://developers.tiktok.com → đăng ký tài khoản developer → **Manage apps → Connect an app**.
2. Điền thông tin app: tên, icon, mô tả ("Công cụ cá nhân để tải video lên bản nháp TikTok của tôi"),
   - **Terms of Service URL**: `https://<tên-app>.vercel.app/legal/terms`
   - **Privacy Policy URL**: `https://<tên-app>.vercel.app/legal/privacy`
3. **Add products**: **Login Kit** và **Content Posting API**. Trong Content Posting API dùng chế độ **Upload** (gửi vào nháp), không cần Direct Post.
4. Scopes: `user.info.basic`, `video.upload`.
5. Login Kit → **Redirect URI**: `https://<tên-app>.vercel.app/api/connect/tiktok/callback`.
6. Dùng **Sandbox**: thêm tài khoản TikTok của bạn vào **Target users**. Nếu Sandbox không cho upload, bấm **Submit for review** và mô tả đúng mục đích (công cụ cá nhân, chỉ upload vào nháp).
7. Copy **Client key** và **Client secret** vào biến môi trường (Vercel) `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` → deploy lại → **Tài khoản → Kết nối TikTok**.

Video vào **hộp thư / bản nháp** trong app TikTok. Bạn mở bản nháp, **gắn sản phẩm (giỏ hàng)**, dán caption (copy trong tool) rồi đăng. Theo những gì tôi tìm được, API không gắn được sản phẩm TikTok Shop.

## 4. Hẹn giờ đăng

- **Chạy local** (`npm run dev` / `npm start`): tool tự kiểm tra mỗi phút và đăng bài đến giờ. Máy phải đang bật và app đang chạy.
- **Đã deploy lên Vercel**: dùng https://cron-job.org (miễn phí) gọi tool mỗi 5 phút:
  1. Đặt `CRON_SECRET` (chuỗi ngẫu nhiên) trong biến môi trường Vercel.
  2. cron-job.org → **Create cronjob** → URL `https://<tên-app>.vercel.app/api/cron?key=<CRON_SECRET>` → mỗi 5 phút.

## Lưu ý tránh bị khoá tài khoản

- Dùng nút **AI viết caption riêng** để mỗi trang có caption khác nhau. Đừng đăng nội dung y hệt lên nhiều trang.
- Để **giãn cách** 10–30 phút giữa các tài khoản.
- Facebook: để link Shopee ở **bình luận đầu** thay vì trong bài.
- Đừng đăng dồn hàng chục bài một lúc trên tài khoản mới.
