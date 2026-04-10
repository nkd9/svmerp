import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  Menu,
  User as UserIcon,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type SubItem = { name: string; path: string; adminOnly?: boolean };
type SidebarItem = {
  name: string;
  icon: any;
  path?: string;
  adminOnly?: boolean;
  subItems?: SubItem[];
};

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { 
    name: 'Admissions', 
    icon: Users,
    subItems: [
      { name: 'Admissions', path: '/students' },
      { name: 'Promotion', path: '/student-promotion', adminOnly: true },
      { name: 'Alumni', path: '/alumni', adminOnly: true }
    ]
  },
  { 
    name: 'Exams & Marks', 
    icon: BookOpen, 
    subItems: [
      { name: 'Exams & Marks', path: '/exams' },
      { name: 'Subject Master', path: '/exams/subjects' }
    ]
  },
  { 
    name: 'Fees & Dues', 
    icon: CreditCard, 
    subItems: [
      { name: 'Fees & Dues', path: '/fees' },
      { name: 'Fee Reports', path: '/fees/reports' },
      { name: 'Fee Structures', path: '/fee-structures', adminOnly: true }
    ]
  },
  { 
    name: 'Reports', 
    icon: FileText, 
    subItems: [
      { name: 'Reports', path: '/reports' }
    ]
  },
  { 
    name: 'Admin', 
    icon: Settings, 
    adminOnly: true,
    subItems: [
      { name: 'Admin Settings', path: '/admin-settings' }
    ]
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const visibleSidebarItems = sidebarItems.filter((item) => !item.adminOnly || user?.role === 'admin');

  const toggleMenu = (name: string) => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      setOpenMenus({ [name]: true });
    } else {
      setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-theme min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out flex flex-col fixed h-full z-50",
          isSidebarOpen ? "w-64 overflow-y-auto hide-scrollbar" : "w-20 overflow-y-visible"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold shrink-0">S</div>
          {isSidebarOpen && <span className="font-bold text-xl text-white tracking-tight leading-none">SVM College ERP</span>}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {visibleSidebarItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const visibleSubItems = hasSubItems 
              ? item.subItems!.filter(sub => !sub.adminOnly || user?.role === 'admin')
              : [];
            
            const isActive = !hasSubItems && location.pathname === item.path;
            const isMenuOpen = openMenus[item.name];

            return (
              <div key={item.name} className="relative group/menu">
                {hasSubItems ? (
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={cn(
                      "flex items-center w-full gap-3 px-3 py-2.5 rounded-lg transition-colors group relative outline-none",
                      isMenuOpen ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0 text-inherit" />
                    {isSidebarOpen && (
                      <>
                        <span className="font-medium flex-1 text-left">{item.name}</span>
                        {isMenuOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                      </>
                    )}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    to={item.path!}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative outline-none",
                      isActive ? "bg-indigo-600 text-white" : "hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-inherit")} />
                    {isSidebarOpen && <span className="font-medium">{item.name}</span>}
                    {!isSidebarOpen && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                )}

                {/* Submenus */}
                {hasSubItems && isSidebarOpen && (
                  <AnimatePresence>
                    {isMenuOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pl-11 pr-3 py-1 space-y-1">
                          {visibleSubItems.map(subItem => {
                            const isSubActive = location.pathname === subItem.path;
                            return (
                              <Link
                                key={subItem.name}
                                to={subItem.path}
                                className={cn(
                                  "block px-3 py-2 text-sm rounded-lg transition-colors",
                                  isSubActive ? "bg-indigo-600 text-white font-medium" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                )}
                              >
                                {subItem.name}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-slate-800 hover:text-white w-full",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 text-inherit" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          isSidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 app-theme-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden md:block text-sm text-slate-500">
              Graduation college management for Arts and Science
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <UserIcon className="w-6 h-6" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
