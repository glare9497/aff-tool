# Aff Tools

Công cụ cá nhân cho affiliate Shopee / TikTok:

- **Links**: tạo short link `/go/<slug>` trỏ tới link affiliate, đếm click (lọc bot), tạo hàng loạt.
- **Import đơn**: đọc file CSV báo cáo từ Shopee Affiliate / TikTok Shop, gom đơn về đúng link qua Sub ID.
- **Dashboard**: clicks, đơn, hoa hồng (chờ / đã duyệt), CR, EPC theo link, theo kênh, top sản phẩm.
- **Tài khoản**: quản lý Fanpage, Instagram, TikTok (kết nối API hoặc thủ công).
- **Bài đăng**: lên lịch, AI viết caption riêng cho từng tài khoản, tự đăng lên Facebook/Instagram, gửi video vào nháp TikTok, theo dõi trạng thái. Hướng dẫn kết nối: [SOCIAL.md](SOCIAL.md).
- **AI kịch bản**: nhập thông tin sản phẩm → Claude viết kịch bản video không lộ mặt: 3 hook, kịch bản từng cảnh, lời đọc (copy dán vào CapCut), caption + hashtag, danh sách cảnh cần quay, lưu ý tránh vi phạm.

## Chạy local

```bash
npm install
cp .env.example .env.local   # điền ADMIN_PASSWORD, AUTH_SECRET, ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3100
```

Database là file SQLite `data/aff.db`, tự tạo bảng ở lần chạy đầu.

Deploy lên internet (miễn phí): xem [DEPLOY.md](DEPLOY.md).

## Quy ước Sub ID (quan trọng)

Để biết đơn nào đến từ video nào, mỗi link affiliate phải mang **slug** của nó trong Sub ID:

- **Có Shopee Open API** (`SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`): tool tự tạo link với `sub_id1 = kênh`, `sub_id2 = slug`.
- **Chưa có API**: khi tạo link trong trang Shopee Affiliate, điền Sub ID = slug (vd `noichien01`), rồi dán link đó vào ô "Link affiliate".

Slug chỉ gồm a-z, 0-9 vì Shopee không nhận ký tự khác trong Sub ID.

Đơn từ giỏ hàng TikTok không có Sub ID → hiện ở dòng "Chưa gán link" và vẫn được tính vào "Top sản phẩm".

## AI kịch bản

- Cần `ANTHROPIC_API_KEY` (tạo tại https://console.anthropic.com, trả theo lượng dùng).
- Model mặc định `claude-opus-5-5`; đổi bằng biến `CLAUDE_MODEL`.
- Prompt nằm ở `src/lib/script-ai.ts`. Muốn đổi giọng văn hoặc quy tắc thì sửa `SYSTEM` trong file đó.
