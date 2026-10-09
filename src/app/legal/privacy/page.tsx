export const metadata = { title: "Chính sách quyền riêng tư" };

// Public page required by Meta / TikTok developer apps.
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-3 text-sm">
      <h1 className="text-xl font-semibold">Chính sách quyền riêng tư</h1>
      <p>
        Ứng dụng này là công cụ nội bộ, chỉ được chủ sở hữu sử dụng để quản lý và đăng nội dung lên các tài khoản mạng xã hội
        của chính mình.
      </p>
      <p>
        Dữ liệu được lưu: tên và mã định danh tài khoản, mã truy cập (access token) do Facebook, Instagram hoặc TikTok cấp khi
        chủ tài khoản đồng ý kết nối, và nội dung bài đăng do chủ tài khoản tạo. Mã truy cập được mã hoá khi lưu trữ.
      </p>
      <p>Dữ liệu không được bán, chia sẻ hay chuyển cho bên thứ ba, và chỉ được dùng để đăng nội dung theo yêu cầu của chủ tài khoản.</p>
      <p>
        Chủ tài khoản có thể ngắt kết nối bất cứ lúc nào bằng cách xoá tài khoản trong ứng dụng hoặc thu hồi quyền trong phần cài
        đặt của Facebook / TikTok; dữ liệu liên quan sẽ bị xoá.
      </p>
    </article>
  );
}
