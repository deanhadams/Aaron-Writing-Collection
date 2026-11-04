"use client";

import { useTransition, type ReactNode } from "react";
import { logout } from "@/lib/auth/actions";
import { startDownload } from "@/lib/download";
import { ActionMenu, MenuDivider, MenuItem } from "./structure/action-menu";

export function AccountMenu({ trigger }: { trigger: ReactNode }) {
  const [, startLogout] = useTransition();

  return (
    <ActionMenu label="Account menu" trigger={trigger} triggerClass="flex items-center gap-2 rounded-full">
      <MenuItem onSelect={() => startDownload("/api/backup")}>Download everything</MenuItem>
      <MenuDivider />
      <MenuItem onSelect={() => startLogout(() => logout())}>Log out</MenuItem>
    </ActionMenu>
  );
}
