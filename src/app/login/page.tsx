import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, checkPassword, sessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  if (!checkPassword(String(formData.get("password") ?? ""))) redirect("/login?error=1");
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/");
}

// Always rendered per request: reads cookies, search params and live data
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-semibold">Aff Tools</h1>
      <form action={login} className="card space-y-3">
        <input name="password" type="password" placeholder="Mật khẩu" className="input" autoFocus required />
        {error && <p className="text-sm text-red-600">Sai mật khẩu (hoặc chưa đặt ADMIN_PASSWORD trong .env.local)</p>}
        <button className="btn w-full">Đăng nhập</button>
      </form>
    </main>
  );
}
