import { MoonIcon, SignOutIcon, SunIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** The product mark: a glance, drawn as a fixation cross inside a frame. */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[19px] font-light tracking-[0.01em]", className)}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.75 8V2.75H8M16 2.75h5.25V8M21.25 16v5.25H16M8 21.25H2.75V16" />
        <path d="M12 8.25v7.5M8.25 12h7.5" stroke="var(--mint)" />
      </svg>
      {/* On a phone the top bar keeps the mark and drops the name to make room for navigation. */}
      <span className={compact ? "max-sm:sr-only" : undefined}>GlanceLab</span>
    </span>
  );
}

const NAV = [
  { to: "/", label: "Studies", end: true },
  { to: "/images", label: "Images", end: false },
  { to: "/settings", label: "Settings", end: false },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isDark ? "Use the light canvas" : "Use the dark canvas"}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{isDark ? "Light canvas" : "Dark canvas"}</TooltipContent>
    </Tooltip>
  );
}

/** The always-dark top bar with the three places the admin can go, and the page below it. */
export function AppShell({ username }: { username: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();

  const logOut = async (): Promise<void> => {
    await api.logout().catch(() => undefined);
    client.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="shell sticky top-0 z-40 border-b border-shell-line bg-shell text-foreground">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-6 sm:px-6">
          <NavLink to="/" aria-label="GlanceLab, all studies">
            <Wordmark compact />
          </NavLink>
          <nav aria-label="Main" className="flex h-full items-stretch gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative inline-flex items-center px-2 text-sm text-muted-foreground sm:px-3 transition-colors hover:text-foreground",
                    isActive &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[linear-gradient(90deg,var(--violet),var(--indigo))]",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center">
            <span className="mr-2 hidden font-mono text-xs text-muted-foreground sm:inline">{username}</span>
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Log out" onClick={() => void logOut()}>
                  <SignOutIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Log out</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
