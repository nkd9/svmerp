import React, { useEffect, useMemo, useState } from 'react';
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
  ChevronRight,
  GraduationCap,
  X
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './ui';

type SubItem = { name: string; path: string; adminOnly?: boolean };
type SidebarItem = {
  name: string;
  icon: any;
  path?: string;
  adminOnly?: boolean;
  eyebrow?: string;
  subItems?: SubItem[];
};

const parseSidebarPath = (path: string) => {
  const [pathAndSearch, hash = ''] = path.split('#');
  const [pathname, search = ''] = pathAndSearch.split('?');
  return {
    pathname,
    search: search ? `?${search}` : '',
    hash: hash ? `#${hash}` : '',
  };
};

const sidebarItems: SidebarItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/', eyebrow: 'Overview' },
  { 
    name: 'Admissions', 
    icon: Users,
    eyebrow: 'Students',
    subItems: [
      { name: 'Student Admission', path: '/students' },
      { name: 'Promotion & Graduation', path: '/student-promotion', adminOnly: true },
      { name: 'Alumni Directory', path: '/alumni', adminOnly: true }
    ]
  },
  { 
    name: 'Exams & Marks', 
    icon: BookOpen,
    eyebrow: 'Academic',
    subItems: [
      { name: 'Exam Dashboard', path: '/exams' },
      { name: 'Exams List', path: '/exams#exams-list' },
      { name: 'Student Marks Table', path: '/exams#student-marks-table' },
      { name: 'Exam Reports', path: '/exams#exam-reports' },
      { name: 'Subject Master', path: '/exams/subjects' }
    ]
  },
  { 
    name: 'Fees & Dues', 
    icon: CreditCard,
    eyebrow: 'Accounts',
    subItems: [
      { name: 'Fee Collection', path: '/fees?action=collect' },
      { name: 'Fee Register', path: '/fees#fee-register' },
      { name: 'Fee Reports Overview', path: '/fees/reports' },
      { name: 'Student Fee Report', path: '/fees/reports#student-fee-report' },
      { name: 'Admission Due Report', path: '/fees/reports#admission-due-report' },
      { name: 'Old Due Report', path: '/old-due-report' },
      { name: 'Promoted Due Report', path: '/fees/reports#promoted-due-report' },
      { name: 'Due By Class Report', path: '/fees/reports#due-by-class-report' },
      { name: 'Daily Collection Report', path: '/fees/reports#daily-collection-report' },
      { name: 'Transaction Report', path: '/fees/reports#transaction-report' },
      { name: 'Monthly Report', path: '/fees/reports#monthly-report' },
      { name: 'Fee Structures', path: '/fee-structures', adminOnly: true }
    ]
  },
  { 
    name: 'Reports', 
    icon: FileText,
    eyebrow: 'Office',
    subItems: [
      { name: 'Reports Dashboard', path: '/reports' },
      { name: 'Due Reports', path: '/reports#due-reports' },
      { name: 'Collection Reports', path: '/reports#collection-reports' },
      { name: 'Pending Due List', path: '/reports#pending-due-list' }
    ]
  },
  { 
    name: 'Admin', 
    icon: Settings, 
    adminOnly: true,
    eyebrow: 'Setup',
    subItems: [
      { name: 'Admin Overview', path: '/admin-settings' },
      // Production Tools hidden for now. Re-enable when backup/health/reconciliation UI is needed again.
      // { name: 'Production Tools', path: '/admin-settings#production-tools' },
      { name: 'Create Users', path: '/admin-settings#create-users' },
      { name: 'Class Master', path: '/admin-settings#class-master' },
      { name: 'Fee Ledgers', path: '/admin-settings#fee-ledgers' },
      { name: 'Session Master', path: '/admin-settings#session-master' },
      { name: 'Stream Master', path: '/admin-settings#stream-master' },
      { name: 'Student Account Search', path: '/admin-settings#student-account-search' }
    ]
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const visibleSidebarItems = useMemo(
    () => sidebarItems.filter((item) => !item.adminOnly || user?.role === 'admin'),
    [user?.role],
  );

  useEffect(() => {
    const activeItem = visibleSidebarItems.find((item) =>
      item.subItems?.some((subItem) => location.pathname === parseSidebarPath(subItem.path).pathname),
    );

    if (activeItem) {
      setOpenMenus((prev) => ({ ...prev, [activeItem.name]: true }));
    }
    setIsMobileSidebarOpen(false);
  }, [location.pathname, visibleSidebarItems]);

  useEffect(() => {
    if (!location.hash) return;
    const targetId = decodeURIComponent(location.hash.slice(1));
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [location.pathname, location.hash]);

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

  const isSubItemActive = (subItem: SubItem) => {
    const parsed = parseSidebarPath(subItem.path);
    return (
      location.pathname === parsed.pathname &&
      (!parsed.search || location.search === parsed.search) &&
      (!parsed.hash ? !location.hash : location.hash === parsed.hash)
    );
  };
  const isItemActive = (item: SidebarItem, visibleSubItems: SubItem[]) =>
    item.path ? location.pathname === item.path : visibleSubItems.some(isSubItemActive);

  return (
    <div className="app-theme min-h-screen bg-slate-50 flex">
      {isMobileSidebarOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "svm-sidebar text-white transition-all duration-300 ease-in-out flex flex-col fixed inset-y-0 left-0 z-50 shadow-2xl",
          isSidebarOpen ? "w-[18rem] overflow-y-auto hide-scrollbar" : "w-20 overflow-y-visible",
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn(
          "sticky top-0 z-10 flex items-center border-b border-white/10 bg-indigo-700/35 px-4 py-4 backdrop-blur-xl",
          isSidebarOpen ? "gap-3" : "justify-center"
        )}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-700 shadow-lg shadow-black/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          {isSidebarOpen && (
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight text-white">SVM College ERP</p>
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/80">Arts & Science</p>
            </div>
          )}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="ml-auto rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSidebarOpen && (
          <div className="mx-4 mt-4 rounded-3xl border border-white/10 bg-white/[0.07] p-4 shadow-inner shadow-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70">Current Module</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {visibleSidebarItems.find((item) => isItemActive(item, item.subItems || []))?.name || 'Dashboard'}
            </p>
          </div>
        )}

        <nav className="flex-1 px-3 py-5">
          {isSidebarOpen && (
            <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">
              Main Menu
            </p>
          )}
          <div className="space-y-2">
          {visibleSidebarItems.map((item) => {
            const hasSubItems = item.subItems && item.subItems.length > 0;
            const visibleSubItems = hasSubItems 
              ? item.subItems!.filter(sub => !sub.adminOnly || user?.role === 'admin')
              : [];
            
            const isActive = isItemActive(item, visibleSubItems);
            const isMenuOpen = openMenus[item.name];

            return (
              <div key={item.name} className="relative group/menu">
                {hasSubItems ? (
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-all duration-200",
                      isActive
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/10"
                        : "text-white/78 hover:bg-white/10 hover:text-white",
                      !isSidebarOpen && "justify-center"
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-indigo-50 text-indigo-700" : "bg-white/10 text-indigo-50"
                    )}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    {isSidebarOpen && (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold uppercase tracking-[0.18em] opacity-55">{item.eyebrow}</span>
                          <span className="block text-sm font-bold">{item.name}</span>
                        </span>
                        {isMenuOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-70" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />}
                      </>
                    )}
                    {!isSidebarOpen && (
                      <div className="pointer-events-none absolute left-full z-50 ml-3 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover/menu:opacity-100 whitespace-nowrap">
                        {item.name}
                      </div>
                    )}
                  </button>
                ) : (
                  <Link
                    to={item.path!}
                    className={cn(
                      "relative flex items-center gap-3 rounded-2xl px-3 py-3 outline-none transition-all duration-200",
                      isActive
                        ? "bg-white text-indigo-700 shadow-lg shadow-black/10"
                        : "text-white/78 hover:bg-white/10 hover:text-white",
                      !isSidebarOpen && "justify-center"
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                      isActive ? "bg-indigo-50 text-indigo-700" : "bg-white/10 text-indigo-50"
                    )}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    {isSidebarOpen && (
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] opacity-55">{item.eyebrow}</span>
                        <span className="block text-sm font-bold">{item.name}</span>
                      </span>
                    )}
                    {!isSidebarOpen && (
                      <div className="pointer-events-none absolute left-full z-50 ml-3 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover/menu:opacity-100 whitespace-nowrap">
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
                        <div className="ml-7 mt-2 space-y-1 border-l border-white/12 py-1 pl-5">
                          {visibleSubItems.map(subItem => {
                            const isSubActive = isSubItemActive(subItem);
                            return (
                              <Link
                                key={subItem.name}
                                to={subItem.path}
                                className={cn(
                                  "relative block rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                                  isSubActive
                                    ? "bg-white text-indigo-700 shadow-sm"
                                    : "text-white/62 hover:bg-white/10 hover:text-white"
                                )}
                              >
                                {isSubActive && (
                                  <span className="absolute -left-[1.62rem] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_0_4px_rgba(165,243,252,0.12)]" />
                                )}
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
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          {isSidebarOpen && (
            <div className="mb-3 rounded-2xl bg-white/[0.07] px-3 py-3">
              <p className="truncate text-sm font-bold text-white">{user?.name || 'Office User'}</p>
              <p className="text-xs font-semibold capitalize text-cyan-100/70">{user?.role || 'staff'}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-white/78 transition-colors hover:bg-white/10 hover:text-white",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5 text-inherit" />
            {isSidebarOpen && <span className="font-bold">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          isSidebarOpen ? "lg:ml-[18rem]" : "lg:ml-20"
        )}
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 app-theme-header">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setIsMobileSidebarOpen(true);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition"
              aria-label="Toggle navigation"
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
        <div className="p-4 sm:p-6 lg:p-8">
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
