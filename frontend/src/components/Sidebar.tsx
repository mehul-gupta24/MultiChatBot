import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare,
    Code2,
    PenTool,
    Lightbulb,
    Calculator,
    Search,
    Mail,
    FileText,
    ShieldAlert,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Settings,
    Moon,
    Sun,
    Sparkles
} from 'lucide-react';
import { ChatMode } from '@/types/chat';
import { useTheme } from '@/context/ThemeContext';
import clsx from 'clsx';

interface SidebarProps {
    selectedMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
}

const modes: { id: ChatMode; name: string; icon: React.ElementType; color: string }[] = [
    { id: 'chat', name: 'Chat', icon: MessageSquare, color: 'text-blue-500' },
    { id: 'code', name: 'Code', icon: Code2, color: 'text-emerald-500' },
    { id: 'write', name: 'Write', icon: PenTool, color: 'text-orange-500' },
    { id: 'brainstorm', name: 'Brainstorm', icon: Lightbulb, color: 'text-yellow-500' },
    { id: 'math', name: 'Math', icon: Calculator, color: 'text-pink-500' },
    { id: 'research', name: 'Research', icon: Search, color: 'text-cyan-500' },
    { id: 'email', name: 'Email', icon: Mail, color: 'text-violet-500' },
    { id: 'analyze', name: 'Analyze', icon: FileText, color: 'text-teal-500' },
    { id: 'moderate', name: 'Moderate', icon: ShieldAlert, color: 'text-red-500' },
];

const Sidebar = ({ selectedMode, onModeChange, isCollapsed, setIsCollapsed }: SidebarProps) => {
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) setIsCollapsed(true);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setIsCollapsed]);

    return (
        <>
            {/* Mobile Toggle */}
            {isMobile && (
                <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-card border border-border shadow-lg text-foreground"
                >
                    {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
                </button>
            )}

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobile && showMobileMenu && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowMobileMenu(false)}
                        className="fixed inset-0 bg-black/50 z-40"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <div
                className={clsx(
                    "h-screen flex-shrink-0 z-40 flex flex-col bg-card border-r border-border transition-all duration-300",
                    isMobile
                        ? clsx("fixed inset-y-0 left-0 w-[260px] shadow-2xl", !showMobileMenu && "-translate-x-full")
                        : isCollapsed ? "w-[72px]" : "w-[260px]"
                )}
            >
                {/* Collapse Button (Desktop) */}
                {!isMobile && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="absolute -right-3 top-10 z-50 bg-card border border-border text-muted-foreground hover:text-foreground p-1 rounded-full shadow-md hover:shadow-lg transition-all"
                    >
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                )}

                <div className="flex flex-col h-full py-6">
                    {/* Logo */}
                    <div className={clsx("px-5 mb-8 flex items-center gap-3", isCollapsed && !isMobile && "justify-center px-0")}>
                        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg">
                            <Sparkles size={18} className="text-white" />
                        </div>
                        {(!isCollapsed || isMobile) && (
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-foreground tracking-tight leading-none">
                                    MultiChat<span className="text-primary">.ai</span>
                                </span>
                                <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mt-0.5">Pro Edition</span>
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto px-3 space-y-1">
                        {modes.map((mode) => {
                            const Icon = mode.icon;
                            const isActive = selectedMode === mode.id;

                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => {
                                        onModeChange(mode.id);
                                        if (isMobile) setShowMobileMenu(false);
                                    }}
                                    className={clsx(
                                        "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all duration-200 group relative",
                                        isActive
                                            ? "bg-primary/10 text-primary font-semibold"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                        isCollapsed && !isMobile && "justify-center"
                                    )}
                                >
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} className={clsx(isActive && mode.color)} />
                                    {(!isCollapsed || isMobile) && (
                                        <span className="text-sm">{mode.name}</span>
                                    )}

                                    {/* Tooltip */}
                                    {isCollapsed && !isMobile && (
                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover border border-border text-popover-foreground text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap shadow-lg pointer-events-none">
                                            {mode.name}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Bottom */}
                    <div className={clsx("px-3 pt-4 mt-auto space-y-1", isCollapsed && !isMobile && "items-center")}>
                        <button
                            onClick={toggleTheme}
                            className={clsx(
                                "flex items-center gap-3 w-full p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
                                isCollapsed && !isMobile && "justify-center"
                            )}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            {(!isCollapsed || isMobile) && <span className="text-sm">Theme</span>}
                        </button>
                        <button className={clsx(
                            "flex items-center gap-3 w-full p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
                            isCollapsed && !isMobile && "justify-center"
                        )}>
                            <Settings size={18} />
                            {(!isCollapsed || isMobile) && <span className="text-sm">Settings</span>}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
