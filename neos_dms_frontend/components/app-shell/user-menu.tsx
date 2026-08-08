"use client";

import { ChevronDown, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const initials = getInitials(user?.fullName || user?.email || "?");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
            compact ? "p-1.5" : "w-full p-2",
          )}
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!compact && (
            <>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-medium">
                  {user?.fullName || "User"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.roleCode || "Member"}
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? "end" : "start"}
        side={compact ? "bottom" : "right"}
        className="w-64"
      >
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">
                {user?.fullName || "User"}
              </span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user?.email}
              </span>
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-primary">
            <ShieldCheck className="size-3" aria-hidden />
            {user?.roleCode || "Member"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User aria-hidden />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Settings aria-hidden />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
