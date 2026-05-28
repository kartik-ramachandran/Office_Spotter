import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, MapPin, CalendarDays } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/spots", label: "Spots", icon: MapPin },
    { href: "/checkins", label: "Check-ins", icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-sidebar flex-shrink-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-sidebar-primary">
            <MapPin className="h-6 w-6" />
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">ParkDesk</span>
          </div>
        </div>
        <div className="p-4 flex-1">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 text-xs text-sidebar-foreground/50 border-t border-sidebar-border">
          ParkDesk OS v1.0
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
