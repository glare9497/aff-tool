# Deploy miễn phí: Vercel + Turso

Sau khi deploy, short link có dạng `https://<tên>.vercel.app/go/noichien01`, dán được vào bio TikTok / bài Facebook.
Tổng chi phí: 0đ (gói free của cả hai). Domain riêng là tuỳ chọn.

## Bước 1: Tạo database trên Turso (~3 phút)

1. Vào https://turso.tech → **Sign up** (đăng nhập bằng GitHub hoặc Google).
2. **Create Database** → đặt tên `aff` → chọn location gần Việt Nam nhất (Singapore / `aws-ap-southeast-1` nếu có).
3. Mở database vừa tạo:
   - Copy **URL** dạng `libsql://aff-<tên>.turso.io` → đây là `DATABASE_URL`.
   - Bấm **Create Token** (quyền Read & Write) → copy → đây là `DATABASE_AUTH_TOKEN`.

Không cần tạo bảng, app tự tạo ở lần chạy đầu.

## Bước 2: Deploy lên Vercel (~5 phút)

Chạy trong thư mục `aff-tools`:

```bash
npx vercel login        # đăng nhập bằng trình duyệt (tạo tài khoản Hobby miễn phí nếu chưa có)
npx vercel link         # tạo project mới, chấp nhận các lựa chọn mặc định
```

Khai báo biến môi trường (mỗi lệnh sẽ hỏi giá trị, dán vào rồi Enter):

```bash
npx vercel env add DATABASE_URL production
npx vercel env add DATABASE_AUTH_TOKEN production
npx vercel env add ADMIN_PASSWORD production
npx vercel env add AUTH_SECRET production
npx vercel env add ANTHROPIC_API_KEY production
```

- `ADMIN_PASSWORD`: nên đặt mật khẩu dài hơn bản local, vì giờ app nằm trên internet.
- `AUTH_SECRET`: chuỗi ngẫu nhiên, tạo bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- (Tuỳ chọn) `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, `PUBLIC_BASE_URL`, `CLAUDE_MODEL`.
- Đăng bài tự động (xem [SOCIAL.md](SOCIAL.md)): `META_APP_ID`, `META_APP_SECRET`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `CRON_SECRET`, và **bắt buộc R2 khi đăng ảnh/video**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

Deploy:

```bash
npx vercel --prod
```

Lệnh in ra URL production. Mở URL đó, đăng nhập bằng `ADMIN_PASSWORD` là xong.

Mỗi lần sửa code muốn cập nhật, chỉ cần chạy lại `npx vercel --prod`.

## Bước 3 (tuỳ chọn): Domain riêng

Domain riêng (~250k/năm) trông uy tín hơn `vercel.app` khi đặt ở bio.
Vercel → Project → **Settings → Domains** → thêm domain → trỏ DNS theo hướng dẫn → đặt `PUBLIC_BASE_URL=https://domain-cua-ban` → `npx vercel --prod`.

## Lưu ý

- Dữ liệu local (`data/aff.db`) **không** tự chuyển lên Turso. Nên deploy sớm và dùng bản online làm bản chính.
- Function chạy ở Singapore (`vercel.json`) cho gần Việt Nam và gần database.
