import { Building2, BriefcaseBusiness, UserCircle, CalendarCheck, Home, LayoutList, DollarSign, Info, Shield, ShieldAlert, LogOut, User } from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';
import { useAuth } from '../../features/auth/AuthContext';

export type ViewState = 'home' | 'services' | 'pricing' | 'book' | 'client' | 'contractor' | 'about' | 'staff' | 'qa' | 'signin';

interface NavigationProps {
  currentView: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
}

export function Navigation({ currentView, setView }: NavigationProps) {
  const { isAuthenticated, user, signOut } = useAuth();
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'services', label: 'Services', icon: LayoutList },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'book', label: 'Book Labor', icon: CalendarCheck },
    { id: 'about', label: 'About', icon: Info },
    { id: 'client', label: 'Client Portal', icon: Building2 },
    { id: 'contractor', label: 'Contractors', icon: UserCircle },
    { id: 'staff', label: 'Staff Console', icon: Shield },
    { id: 'qa', label: 'QA Staging Hub', icon: ShieldAlert },
  ] as const;

  return (
    <nav className="bg-[#161920] border-b border-[#2A2D35] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <button
              type="button"
              className="flex-shrink-0 flex items-center cursor-pointer bg-transparent border-0 p-0"
              onClick={() => setView('home')}
              aria-label="Go to home"
            >
              <div className="w-3 h-3 bg-[#10B981] rounded-full flex-shrink-0"></div>
              <span className="ml-2 font-display font-bold text-xl text-white tracking-tight uppercase">
                BlockLabor
              </span>
            </button>
          </div>
          <div className="hidden sm:flex sm:space-x-4 overflow-x-auto">
            {navItems.filter(item => {
              if (item.id === 'staff' || item.id === 'qa') {
                return isAuthenticated && (user?.role === 'owner' || user?.role === 'recruiter' || user?.role === 'scheduler' || user?.role === 'payroll');
              }
              return true;
            }).map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                  ${currentView === item.id 
                    ? 'border-[#10B981] text-[#10B981]' 
                    : 'border-transparent text-[#8E9299] hover:border-[#373A43] hover:text-white'
                  }
                `}
              >
                <item.icon className="h-4 w-4 mr-2 hidden lg:block" />
                {item.label}
              </button>
            ))}
            {isAuthenticated && (
              <button
                type="button"
                onClick={signOut}
                className={`
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                  border-transparent text-[#E54848] hover:border-[#373A43] hover:text-white
                `}
              >
                <LogOut className="h-4 w-4 mr-2 hidden lg:block" />
                Sign Out
              </button>
            )}
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => setView('home')} // Assuming 'home' is the sign-in page, or create a specific '/signin' route
                className={`
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors whitespace-nowrap
                  border-transparent text-[#8E9299] hover:border-[#373A43] hover:text-white
                `}
              >
                <User className="h-4 w-4 mr-2 hidden lg:block" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile nav hints (simplified) */}
      <div className="sm:hidden border-t border-[#2A2D35] flex justify-start overflow-x-auto p-2 bg-[#161920] gap-2 hide-scrollbar">
         {navItems.filter(item => {
              if (item.id === 'staff' || item.id === 'qa') {
                return isAuthenticated && (user?.role === 'owner' || user?.role === 'recruiter' || user?.role === 'scheduler' || user?.role === 'payroll');
              }
              return true;
            }).map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-shrink-0 flex items-center px-3 py-2 rounded text-xs transition-colors ${currentView === item.id ? 'text-white bg-[#1F232B] border border-[#373A43]' : 'text-[#8E9299]'}`}
            >
              <item.icon className="h-4 w-4 mr-1.5" />
              {item.label}
            </button>
         ))}
         {isAuthenticated && (
            <button
              type="button"
              onClick={signOut}
              className={`flex-shrink-0 flex items-center px-3 py-2 rounded text-xs transition-colors text-[#E54848]`}
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign Out
            </button>
          )}
          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => setView('home')}
              className={`flex-shrink-0 flex items-center px-3 py-2 rounded text-xs transition-colors text-[#8E9299]`}
            >
              <User className="h-4 w-4 mr-1.5" />
              Sign In
            </button>
          )}
      </div>
    </nav>
  );
}
