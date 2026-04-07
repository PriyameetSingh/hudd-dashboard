import { cookies } from "next/headers";

type SessionUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
};

const COOKIE_NAME = "hudd_mock_user";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const payload = cookieStore.get(COOKIE_NAME)?.value;
  if (!payload) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(payload)) as SessionUser;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}
