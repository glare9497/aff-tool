export const metadata = { title: "Điều khoản sử dụng" };

// Public page required by Meta / TikTok developer apps.
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 text-sm">
      <h1 className="text-xl font-semibold">Điều khoản sử dụng</h1>
      <p>
        Ứng dụng này là công cụ cá nhân, không cung cấp cho người dùng bên ngoài. Người sử dụng duy nhất là chủ sở hữu các tài
        khoản Facebook Page, Instagram và TikTok được kết nối.
      </p>
      <p>
        Mọi nội dung được đăng đều do chủ tài khoản tạo và chịu trách nhiệm, đồng thời phải tuân thủ điều khoản và tiêu chuẩn cộng
        đồng của từng nền tảng.
      </p>
      <p>Ứng dụng chỉ đăng nội dung khi chủ tài khoản yêu cầu, và không thực hiện hành động nào khác trên tài khoản.</p>
    </article>
  );
}
