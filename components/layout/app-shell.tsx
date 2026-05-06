"use client";

import {
  Beaker,
  CheckCheck,
  Database,
  Home,
  Menu,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { NetworkOffline } from "@/components/fallbacks";
import { PerformanceHud } from "@/components/performance-hud";
import { useOnlineStatus } from "@/components/resilience";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  hint?: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: <Home className="h-4 w-4" />, hint: "overview" },
  { href: "/catalog", label: "Catalog", icon: <Database className="h-4 w-4" />, hint: "table" },
  {
    href: "/validation",
    label: "Validation",
    icon: <CheckCheck className="h-4 w-4" />,
    hint: "queue",
  },
  {
    href: "/enrichment",
    label: "Enrichment",
    icon: <Sparkles className="h-4 w-4" />,
    hint: "AI",
  },
  { href: "/lab", label: "Lab", icon: <Beaker className="h-4 w-4" />, hint: "resilience" },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <span
              className={cn(
                "transition-colors",
                active
                  ? "text-primary"
                  : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
              )}
            >
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.hint ? (
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
                {item.hint}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const online = useOnlineStatus();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground md:flex">
        <BrandMark />
        <Separator className="bg-sidebar-border" />
        <ScrollArea className="flex-1">
          <NavLinks pathname={pathname} />
        </ScrollArea>
        <Separator className="bg-sidebar-border" />
        <div className="flex items-center justify-between p-3 text-xs text-sidebar-foreground/60">
          <span className="flex items-center gap-1.5">
            {online ? (
              <Wifi className="h-3 w-3 text-success" aria-hidden />
            ) : (
              <WifiOff className="h-3 w-3 text-warning" aria-hidden />
            )}
            <span>{online ? "online" : "offline"}</span>
          </span>
          <Badge variant="outline" className="px-1.5 text-[10px]">
            v0.1
          </Badge>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!online ? <NetworkOffline /> : null}
        <Topbar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} pathname={pathname} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <PerformanceHud />
    </div>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 px-4 py-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Database className="h-4 w-4" aria-hidden />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">Granary</span>
        <span className="text-[10px] text-sidebar-foreground/50">product data infra</span>
      </div>
    </Link>
  );
}

function Topbar({
  mobileOpen,
  setMobileOpen,
  pathname,
}: {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  pathname: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
      {/* Mobile hamburger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-sidebar p-0 text-sidebar-foreground">
          <BrandMark />
          <Separator className="bg-sidebar-border" />
          <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <span className="text-xs text-muted-foreground">
        Validate, enrich, and edit massive product catalogs at speed.
      </span>
      <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          demo
        </Badge>
      </span>
    </header>
  );
}
