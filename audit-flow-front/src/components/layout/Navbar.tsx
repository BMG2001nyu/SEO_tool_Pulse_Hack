import { Coins, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="h-14 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-4">
      {/* Left: Logo */}
      <div className="flex items-center gap-8">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Aduit Log
        </h1>
      </div>

      {/* Right: Credits, Language, Sign In */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50">
          <Globe className="w-4 h-4" />
          <span>EN-US</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <Button 
          size="sm"
          className="gradient-primary hover:opacity-90 transition-opacity text-white font-medium"
        >
          Sign in
        </Button>
      </div>
    </header>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50">
      {icon}
      <span>{label}</span>
    </button>
  );
}
