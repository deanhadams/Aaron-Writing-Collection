import { logout } from "@/lib/auth/actions";
import { getCurrentSession } from "@/lib/auth/current-session";

export async function UserMenu() {
  const session = await getCurrentSession();
  if (!session) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span>{session.name}</span>
      <form action={logout}>
        <button
          type="submit"
          className="whitespace-nowrap rounded-lg border border-line px-3 py-1.5 font-medium text-primary transition-shadow hover:shadow-neon"
        >
          Log out
        </button>
      </form>
    </div>
  );
}
