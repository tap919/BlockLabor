import { Building2, BriefcaseBusiness, UserCircle, CalendarCheck, Home, LayoutList, DollarSign, Info, Shield, ShieldAlert } from 'lucide-react';
import { Dispatch, SetStateAction } from 'react';

export type ViewState = 'home' | 'services' | 'pricing' | 'book' | 'client' | 'contractor' | 'about' | 'staff' | 'qa';

interface NavigationProps {
  currentView: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
}

export function Navigation({ currentView, setView }: NavigationProps) {
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
            <div 
              className="flex-shrink-0 flex items-center cursor-pointer"
              onClick={() => setView('home')}
            >
              <div className="w-3 h-3 bg-[#10B981] rounded-full flex-shrink-0"></div>
              <span className="ml-2 font-display font-bold text-xl text-white tracking-tight uppercase">
                BlockLabor
              </span>
            </div>
          </div>
          <div className="hidden sm:flex sm:space-x-4 overflow-x-auto">
            {navItems.map((item) => (
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
          </div>
        </div>
      </div>
      
      {/* Mobile nav hints (simplified) */}
      <div className="sm:hidden border-t border-[#2A2D35] flex justify-start overflow-x-auto p-2 bg-[#161920] gap-2 hide-scrollbar">
         {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex-shrink-0 flex items-center px-3 py-2 rounded text-xs transition-colors ${currentView === item.id ? 'text-white bg-[#1F232B] border border-[#373A43]' : 'text-[#8E9299]'}`}
            >
              <item.icon className="h-4 w-4 mr-1.5" />
              {item.label}
            </button>
         ))}
      </div>
    </nav>
  );
}
