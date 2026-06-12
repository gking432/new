import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Compass className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Northstar <span className="text-muted-foreground font-normal">Exterior &amp; Home</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#services" className="hover:text-foreground">Services</Link>
          <Link href="/#storm" className="hover:text-foreground">Storm Damage</Link>
          <Link href="/#process" className="hover:text-foreground">How It Works</Link>
          <Link href="/login" className="hover:text-foreground">Team Login</Link>
        </nav>
        <Button asChild>
          <Link href="/request">Request Free Inspection</Link>
        </Button>
      </div>
    </header>
  );
}
