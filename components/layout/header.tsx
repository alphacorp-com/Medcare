import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/useAppStore";
import { useRouter } from "next/navigation";

export function Header() {
  const { currentUser, setUser, setActiveModules } = useAppStore();
  const router = useRouter();

  const handleLogout = () => {
    setUser(null);
    setActiveModules([]);
    router.push("/login");
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search Patients (ID, Name, SSN)..."
            className="w-96 pl-10 pr-4 py-1.5 h-8 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-blue-400"
          />
          <div className="absolute left-3 top-2 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
            {currentUser?.role || 'User'}
          </span>
          <div className="text-right leading-none">
            <div className="text-xs font-semibold">{currentUser?.fullName}</div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center focus:outline-none">
            <Avatar className="h-8 w-8 border border-slate-300 hover:opacity-80 transition-opacity">
              <AvatarImage src="" alt={currentUser?.fullName || "User"} />
              <AvatarFallback className="bg-slate-200">{currentUser?.fullName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 font-medium cursor-pointer focus:text-red-700 focus:bg-red-50">Log out</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
