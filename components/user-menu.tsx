import { getCurrentSession } from "@/lib/auth/current-session";
import { AccountMenu } from "./account-menu";

// Every color keeps white initials above AA contrast.
const AVATAR_COLORS = ["#2563ff", "#6b46f5", "#b4237a", "#0a78b5", "#0f7a46"];

function avatarColor(name: string) {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export async function UserMenu() {
  const session = await getCurrentSession();
  if (!session) return null;

  return (
    <div className="text-sm">
      <AccountMenu
        trigger={
          <>
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full font-heading font-semibold text-white"
              style={{ backgroundColor: avatarColor(session.name) }}
            >
              {session.name.charAt(0).toUpperCase()}
            </span>
            <span className="sr-only font-medium sm:not-sr-only">{session.name}</span>
          </>
        }
      />
    </div>
  );
}
