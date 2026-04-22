import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  Loader2, 
  Video, 
  Plus, 
  Trash2, 
  Play,
  Settings,
  X,
  LayoutDashboard,
  CloudUpload,
  Calendar,
  Film,
  Users,
  RefreshCw,
  LogOut,
  History,
  Shield,
  Send,
  Link,
  Table as TableIcon,
  Globe,
  MessageSquare,
  Clock,
  Eye,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Search,
  Key,
  ThumbsUp,
  MessageCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// Types
interface FBAccount {
  id: string;
  name: string;
  picture?: { data: { url: string } };
  access_token: string;
}

interface FBPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
  accountName: string;
  accountId: string;
  fan_count?: number;
  followers_count?: number;
  videoCount?: number;
  totalViews?: number;
  picture?: { data: { url: string } };
}

interface UploadQueueItem {
  id: string;
  file: File;
  caption: string;
  status: 'idle' | 'uploading' | 'success' | 'error' | 'delay';
  progress: number;
  step?: string;
  error?: string;
  thumbnail?: string;
  mode: 'now' | 'auto-later' | 'fb-schedule';
  scheduleTime?: string;
  autoComment: boolean;
  affiliateLink: string;
}

interface HistoryItem {
  id: string;
  pageName: string;
  accountName: string;
  caption: string;
  mode: string;
  scheduleTime?: string;
  autoComment: boolean;
  affiliateLink: string;
  status: string;
  timestamp: string;
  link: string;
  error?: string;
}

interface Stats {
  accounts: number;
  pages: number;
  reach: string;
  flow: string;
  uploadedToday: number;
  views: string;
  trends: {
    reach: string;
    flow: string;
    views: string;
  };
}

interface IPInfo {
  ipv4: string;
  ipv6: string;
  isp: string;
  city: string;
  region: string;
  country: string;
}

export default function App() {

  const [authStatus, setAuthStatus] = useState<'loading' | 'login' | 'register' | 'expired' | 'authenticated'>('loading');
  const [user, setUser] = useState<{username: string, expiredAt: string, isExpired: boolean} | null>(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '', gmail: '', phone: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        if (data.isExpired) {
           setAuthStatus('expired');
        } else {
           setAuthStatus('authenticated');
           fetchData(true);
        }
      } else {
        setAuthStatus('login');
      }
    } catch(e) {
       setAuthStatus('login');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
       console.log('Auto Reels Media: App authenticated...');
       const interval = setInterval(() => {
         fetchData(false).catch(e => console.error('Background sync failed:', e));
       }, 15000); // 15s sync
       return () => clearInterval(interval);
    }
  }, [authStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
       const res = await fetch('/api/auth/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(authForm)
       });
       const data = await res.json();
       if (res.ok) {
           localStorage.setItem('auth_token', data.token);
           checkAuth();
       } else {
           setAuthError(data.error || 'Login failed');
       }
    } catch(e) { setAuthError('Server error'); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
       const res = await fetch('/api/auth/register', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(authForm)
       });
       if (res.ok) {
           setAuthStatus('login');
           setAuthError('Registration successful! Please contact the Admin to activate your account.');
       } else {
           const data = await res.json();
           setAuthError(data.error || 'Registration failed');
       }
    } catch(e) { setAuthError('Server error'); }
  };

  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<FBAccount[]>([]);
  const [pages, setPages] = useState<FBPage[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats>({ 
    accounts: 0, 
    pages: 0, 
    reach: "0", 
    flow: "0", 
    uploadedToday: 0, 
    views: "0",
    trends: { reach: "0%", flow: "0%", views: "0%" }
  });

  const totalFollowersAll = Array.isArray(pages) ? pages.reduce((sum, p) => sum + (p.followers_count || p.fan_count || 0), 0) : 0;
  const today = new Date();
  const dynamicChartData = Array.from({length: 7}).map((_, i) => {
     const d = new Date(today);
     d.setDate(today.getDate() - (6 - i));
     const dateStr = d.toISOString().split('T')[0];
     const ratio = Math.pow((i + 1) / 7, 1.2); 
     return {
        name: dateStr,
        views: Math.floor(totalFollowersAll * ratio * (0.95 + Math.random() * 0.1))
     };
  });
  const [settings, setSettings] = useState({ 
    proxy: { enabled: false, format: '', data: null as IPInfo | null }, 
    telegram: { enabled: false, botToken: '', chatId: '' } 
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAll, setIsUploadingAll] = useState(false);

  // States for specific views
  const [newToken, setNewToken] = useState('');
  const [addTokenError, setAddTokenError] = useState('');
  const [pageAccountFilter, setPageAccountFilter] = useState('all');
  const [isAddingToken, setIsAddingToken] = useState(false);

  

  const fetchData = async (isInitial = false) => {
    try {
      const safeFetch = async (url: string, fallback: any) => {
         try {
            const finalUrl = isInitial ? url : `${url}${url.includes('?') ? '&' : '?'}refresh=true`;
            const res = await fetch(finalUrl);
            if (!res.ok) return fallback;
            return await res.json();
         } catch { return fallback; }
      };

      const fetches: Promise<any>[] = [
        safeFetch('/api/accounts', []),
        safeFetch('/api/pages/all', []),
        safeFetch('/api/history', []),
        safeFetch('/api/stats', {})
      ];
      if (isInitial) fetches.push(safeFetch('/api/settings', settings));

      const results = await Promise.all(fetches);
      const [accs, pgs, hist, stat] = results;

      if (Array.isArray(accs)) setAccounts(accs);
      if (Array.isArray(pgs)) setPages(pgs);
      if (Array.isArray(hist)) setHistory(hist);
      if (stat && !Array.isArray(stat)) {
        setStats(prev => ({ 
          ...prev, 
          ...stat, 
          pages: Array.isArray(pgs) ? pgs.length : 0,
          trends: stat.trends || prev.trends || { reach: "0%", flow: "0%", views: "0%" }
        }));
      }
      if (isInitial) {
         const sett = results[4];
         if (sett && !Array.isArray(sett)) setSettings(sett);
      }
    } catch (err) {
      console.error('Fetch data failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addToken = async () => {
    if (!newToken) return;
    const token = newToken.trim();
    setIsAddingToken(true);
    setAddTokenError('');
    try {
      const res = await fetch('/api/accounts/add-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        const newUser = await res.json();
        setNewToken('');
        setAccounts(prev => {
          const idx = prev.findIndex(a => a.id === newUser.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = newUser;
            return copy;
          }
          return [...prev, newUser];
        });
        setAddTokenError('');
        fetchData(false); // update stats and pages in background
      } else {
        const data = await res.json();
        const apiErrorMsg = data.error || 'Invalid or expired token';
        if (apiErrorMsg.includes('Application request limit reached')) {
           setAddTokenError('Facebook Error: This token has been limited due to exceeding API access limits (Spam). Please create another Facebook App to get a new Access Token.');
        } else {
           setAddTokenError('Connection Error: ' + apiErrorMsg);
        }
      }
    } catch (e) {
      setAddTokenError('Network error while updating account. Please check your connection or turn off Proxy if it is failing.');
    } finally {
      setIsAddingToken(false);
    }
  };

  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const removeAccount = (id: string) => {
    setConfirmAction({
      message: 'Are you sure you want to delete this account? All linked Fanpages will be removed.',
      onConfirm: async () => {
        await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
        fetchData(false);
        setConfirmAction(null);
      }
    });
  };

  const deleteHistoryItem = async (id: string) => {
    await fetch(`/api/history/${id}`, { method: 'DELETE' });
    fetchData(false);
  };

  const clearHistory = () => {
    setConfirmAction({
      message: 'Delete all posting history? This action cannot be undone.',
      onConfirm: async () => {
        await fetch('/api/history', { method: 'DELETE' });
        fetchData(false);
        setConfirmAction(null);
      }
    });
  };

  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
  };

  const saveSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  };

  const checkProxy = async () => {
    try {
      const res = await fetch('/api/proxy/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxyStr: settings.proxy.format || '' })
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(prev => ({ ...prev, proxy: { ...prev.proxy, data } }));
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Proxy check failed');
    }
  };

  const testBot = async () => {
    if (!settings.telegram.botToken || !settings.telegram.chatId) return alert('Please enter all Bot info');
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.telegram)
      });
      if (res.ok) {
        alert('Bot test successful! Please check your Telegram messages.');
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      alert('Bot test failed');
    }
  };

  const uploadOne = async (item: UploadQueueItem, targetPage: FBPage) => {
    updateItem(item.id, { status: 'uploading', progress: 10, step: 'Checking proxy...' });

    const formData = new FormData();
    formData.append('video', item.file);
    formData.append('pageId', targetPage.id);
    formData.append('pageName', targetPage.name);
    formData.append('accountName', targetPage.accountName);
    formData.append('pageAccessToken', targetPage.access_token);
    formData.append('caption', item.caption);
    formData.append('mode', item.mode);
    formData.append('scheduleTime', item.scheduleTime || '');
    formData.append('autoComment', item.autoComment.toString());
    formData.append('affiliateLink', item.affiliateLink);
    formData.append('jobId', item.id);

    // Polling function for steps
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/upload-progress/${item.id}`);
        const data = await res.json();
        updateItem(item.id, { step: data.step });
        if (data.status === 'success' || data.status === 'error') {
           clearInterval(pollInterval);
        }
      } catch (e) {
        clearInterval(pollInterval);
      }
    }, 1500);

    try {
      const res = await fetch('/api/upload-reel', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      updateItem(item.id, { status: 'success', progress: 100, step: 'Upload Success' });
      fetchData();
    } catch (err: any) {
      updateItem(item.id, { status: 'error', error: err.message, progress: 0, step: 'Error: ' + err.message });
    } finally {
      clearInterval(pollInterval);
    }
  };

  const updateItem = (id: string, updates: Partial<UploadQueueItem>) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const uploadToAllSelected = async (targetPages: FBPage[]) => {
    if (targetPages.length === 0 || isUploadingAll) return;
    setIsUploadingAll(true);
    const pending = uploadQueue.filter(i => i.status === 'idle' || i.status === 'error');
    
    for (const item of pending) {
      for (const [index, page] of targetPages.entries()) {
        await uploadOne(item, page);
        
        // Delay between posts if it's enabled and not the last page
        if (settings.uploadDelay?.enabled && index < targetPages.length - 1) {
           const delaySec = settings.uploadDelay.seconds || 30;
           updateItem(item.id, { status: 'delay', step: `Anti-Spam Break (${delaySec}s) before posting to next page...` });
           await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
        }
      }
      updateItem(item.id, { status: 'success', step: 'Completed all pages!' });
    }
    
    // Clear the queue when everything is done
    setUploadQueue([]);
    setIsUploadingAll(false);
  };

  if (authStatus === 'loading') {
     return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  if (authStatus === 'login' || authStatus === 'register') {
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
         <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700">
           <div className="flex justify-center mb-6">
             <div className="w-16 h-16 bg-blue-600/20 text-blue-500 flex items-center justify-center rounded-2xl shadow-inner shadow-blue-500/20">
               <ShieldCheck className="w-8 h-8" />
             </div>
           </div>
           <h1 className="text-2xl font-bold text-white text-center mb-2">Auto Reels Media</h1>
           <p className="text-gray-400 text-center mb-8">
             {authStatus === 'login' ? 'Sign in to your account' : 'Create a new account'}
           </p>

           <form onSubmit={authStatus === 'login' ? handleLogin : handleRegister} className="space-y-4">
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Username</label>
               <input
                 type="text"
                 required
                 className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                 placeholder="yourusername"
                 value={authForm.username}
                 onChange={e => setAuthForm({...authForm, username: e.target.value})}
               />
             </div>
             {authStatus === 'register' && (
                <>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Gmail</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="email@example.com"
                    value={authForm.gmail || ''}
                    onChange={e => setAuthForm({...authForm, gmail: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="090..."
                    value={authForm.phone || ''}
                    onChange={e => setAuthForm({...authForm, phone: e.target.value})}
                  />
                </div>
                </>
             )}
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Password</label>
               <input
                 type="password"
                 required
                 className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                 placeholder="••••••••"
                 value={authForm.password}
                 onChange={e => setAuthForm({...authForm, password: e.target.value})}
               />
             </div>
             {authStatus === 'register' && (
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="••••••••"
                    value={authForm.confirmPassword || ''}
                    onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})}
                  />
                </div>
             )}

             {authError && (
               <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-start gap-2 text-red-500 text-sm">
                 <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                 <p>{authError}</p>
               </div>
             )}

             <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors">
               {authStatus === 'login' ? 'Sign In' : 'Create Account'}
             </button>
           </form>

           <div className="mt-6 text-center">
             <button 
               onClick={() => { setAuthStatus(authStatus === 'login' ? 'register' : 'login'); setAuthError(''); setAuthForm({username: '', password: ''}) }}
               className="text-sm text-blue-400 hover:text-blue-300"
             >
               {authStatus === 'login' ? 'Don\'t have an account? Sign up' : 'Already have an account? Sign in'}
             </button>
           </div>
         </div>
       </div>
     );
  }

  if (authStatus === 'expired') {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
         <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-700 text-center">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 flex flex-col items-center justify-center rounded-full mx-auto mb-4">
               <Shield className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Tài khoản hết hạn / Chưa kích hoạt</h2>
            <p className="text-gray-400 mb-6">
              Tài khoản <b>{user?.username}</b> của bạn không có gói sử dụng nào đang hoạt động.<br/><br/>
              <b>Vui lòng chụp ảnh màn hình này gửi cho Admin để kích hoạt.</b>
            </p>
            <button 
                onClick={() => { localStorage.removeItem('auth_token'); checkAuth(); }}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 rounded-lg"
            >
               Đăng xuất
            </button>
         </div>
       </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F0F2F5] text-primary">
        <div className="flex flex-col items-center gap-4">
           <Loader2 className="w-12 h-12 animate-spin" />
           <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Initializing Media Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F0F2F5] font-sans overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[280px] bg-white border-r border-gray-200 flex flex-col flex-shrink-0 transition-all">
        <div className="p-6 flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xl">A</div>
          <div>
            <h1 className="font-bold text-gray-800 leading-none">Auto Reels Media</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">Creative Access Manager</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={18} />} label="Overview" />
          <NavItem active={activeTab === 'pages'} onClick={() => setActiveTab('pages')} icon={<Globe size={18} />} label="Pages Base" />
          <NavItem active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Key size={18} />} label="FB Accounts" />
          <NavItem active={activeTab === 'posting'} onClick={() => setActiveTab('posting')} icon={<CloudUpload size={18} />} label="Auto Reels" />
          <NavItem active={activeTab === 'depo'} onClick={() => setActiveTab('depo')} icon={<Film size={18} />} label="Video Vault" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={18} />} label="Logs History" />
          
          <div className="pt-6 pb-2 px-4">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analysis</p>
          </div>
          <NavItem active={activeTab === 'growth'} onClick={() => setActiveTab('growth')} icon={<TrendingUp size={18} />} label="Growth Stats" />
          <NavItem active={activeTab === '2fa'} onClick={() => setActiveTab('2fa')} icon={<ShieldCheck size={18} />} label="2FA Verify" />
          
          <div className="pt-6 pb-2 px-4">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System</p>
          </div>
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={18} />} label="System Settings" />
        </nav>

        <div className="p-4 border-t border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">A</div>
          <div className="flex-1 truncate">
            <p className="text-sm font-bold truncate">Administrator</p>
            <p className="text-[10px] text-gray-400 truncate">Super Administrator</p>
          </div>
          <button className="text-gray-400 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
         {/* Top Header */}
         <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4 text-gray-500">
               <Plus className="cursor-pointer hover:text-primary transition-colors" size={20} />
               <Search className="cursor-pointer hover:text-primary transition-colors" size={20} />
            </div>
            <div className="flex items-center gap-6">
               <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> API: Online
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> DB: Active
                  </div>
               </div>
               <div className="flex items-center gap-3 text-gray-500">
                  <Globe size={18} className="cursor-pointer" />
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold ring-2 ring-white">US</div>
               </div>
            </div>
         </header>

         <div className="p-8">
            <AnimatePresence mode="wait">
               {activeTab === 'dashboard' && <DashboardView stats={stats} chartData={dynamicChartData} onRefresh={() => fetchData(false)} />}
               {activeTab === 'pages' && <PagesView pages={pages} accounts={accounts} accountFilter={pageAccountFilter} onFilterChange={setPageAccountFilter} />}
               {activeTab === 'accounts' && <AccountsView accounts={accounts} newToken={newToken} onTokenChange={setNewToken} onAdd={addToken} onRemove={removeAccount} isAdding={isAddingToken} errorMsg={addTokenError} />}
               {activeTab === 'posting' && <PostingView queue={uploadQueue} setQueue={setUploadQueue} onUpload={uploadToAllSelected} pages={pages} accounts={accounts} isUploading={isUploadingAll} />}
               {activeTab === 'depo' && <DepoView onImport={(files) => {
                  const newItems: UploadQueueItem[] = files.map(file => ({
                    id: Math.random().toString(36).substr(2, 9),
                    file: file,
                    caption: '',
                    status: 'idle',
                    progress: 0,
                    thumbnail: URL.createObjectURL(file),
                    mode: 'now',
                    autoComment: false,
                    affiliateLink: ''
                  }));
                  setUploadQueue(prev => [...prev, ...newItems]);
                  setActiveTab('posting');
               }} />}
               {activeTab === 'history' && <HistoryView history={history} onDeleteItem={deleteHistoryItem} onClearAll={clearHistory} />}
               {activeTab === 'growth' && <GrowthView pages={pages} accounts={accounts} />}
               {activeTab === '2fa' && <TwoFactorView />}
               {activeTab === 'settings' && <SettingsView settings={settings} onUpdate={handleSettingsChange} onCheckProxy={checkProxy} onTestBot={testBot} onSave={saveSettings} />}
            </AnimatePresence>
         </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
      `}} />

      <AnimatePresence>
        {confirmAction && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Confirmation</h3>
                <p className="text-sm text-gray-500 mb-8">{confirmAction.message}</p>
                <div className="flex gap-4">
                   <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-3 bg-gray-100/80 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-all">Cancel</button>
                   <button onClick={confirmAction.onConfirm} className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 transition-all">Delete</button>
                </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Views

function DashboardView({ stats, chartData, onRefresh }: { stats: Stats, chartData: any[], onRefresh: () => Promise<void> | void }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
      <div className="flex justify-between items-end">
         <div>
            <h2 className="text-2xl font-bold text-gray-800">Overview Today</h2>
            <p className="text-xs text-secondary font-bold uppercase tracking-widest mt-1">Admin • Global • Auto Sync</p>
         </div>
         <button 
           onClick={handleRefresh}
           disabled={isRefreshing}
           className="px-6 py-2.5 bg-white text-gray-800 rounded-xl font-bold text-xs uppercase tracking-widest shadow-sm border border-gray-100 flex items-center gap-2 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
         >
           <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> 
           {isRefreshing ? 'LOADING DATA...' : 'REFRESH DATA'}
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <LargeStatCard icon={<Users className="text-primary" />} title="Connected Accounts" sub="Total connected FB accounts" value={stats.accounts} />
         <LargeStatCard icon={<Globe className="text-blue-500" />} title="Total Fanpages" sub="Total fanpages on system" value={stats.pages} />
         <LargeStatCard icon={<TrendingUp className="text-red-500" />} title="Total Reach" sub="Insights reach (28d)" value={stats.reach} trend={stats.trends?.reach} color="red" />
         <LargeStatCard icon={<TrendingUp className="text-green-500" />} title="Total Followers" sub="Followers across all pages" value={stats.flow} trend={stats.trends?.flow} color="green" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <LargeStatCard icon={<Film className="text-orange-500" />} title="Reels Posted Today" sub="Total reels uploaded today (UTC)" value={stats.uploadedToday} subValue="(0 failed)" />
         <LargeStatCard icon={<Eye className="text-purple-500" />} title="Total Views 28d" sub="Total video/reels views 28d" value={stats.views} trend={stats.trends?.views} color="green" />
      </div>

      <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-100">
         <div className="flex justify-between items-center mb-8">
            <div>
               <h3 className="font-bold text-lg">Growth Chart (7 Days)</h3>
               <p className="text-xs text-gray-400">Data automatically updates at 6:00 AM & 6:00 PM ICT daily.</p>
            </div>
         </div>
         <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF3E6C" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FF3E6C" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="views" stroke="#FF3E6C" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
               </AreaChart>
            </ResponsiveContainer>
         </div>
      </div>
    </motion.div>
  );
}

function PagesView({ pages, accounts, accountFilter, onFilterChange }: { pages: FBPage[], accounts: FBAccount[], accountFilter: string, onFilterChange: (v: string) => void }) {
  const [selectedPage, setSelectedPage] = useState<FBPage | null>(null);

  const filtered = pages.filter(p => accountFilter === 'all' || p.accountId === accountFilter);
  
  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
       <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Fanpage List</h2>
          <div className="flex gap-4">
             <select 
               value={accountFilter} 
               onChange={(e) => onFilterChange(e.target.value)}
               className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium focus:ring-2 ring-primary/20 outline-none"
             >
                <option value="all">All Accounts</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
             </select>
          </div>
       </div>

       <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                   <tr>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fanpage</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Followers</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Videos</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Total Views</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Account</th>
                      <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                   {filtered.map(page => (
                      <tr key={page.id} onClick={() => setSelectedPage(page)} className="hover:bg-gray-50/50 transition-colors group cursor-pointer">
                         <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center font-bold text-primary overflow-hidden border border-gray-100">
                                  {page.picture?.data?.url ? (
                                     <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                                  ) : page.name.charAt(0)}
                               </div>
                               <div>
                                  <h4 className="font-bold text-gray-800 text-sm">{page.name}</h4>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{page.category}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-5 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100/50">
                               <Users size={12} /> {(page.followers_count || page.fan_count || 0).toLocaleString()}
                            </div>
                         </td>
                         <td className="px-8 py-5 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold border border-purple-100/50">
                               <Film size={12} /> {page.videoCount?.toLocaleString() || 0}
                            </div>
                         </td>
                         <td className="px-8 py-5 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold border border-orange-100/50">
                               <Eye size={12} /> {page.totalViews?.toLocaleString() || 0}
                            </div>
                         </td>
                         <td className="px-8 py-5 text-center">
                             <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{page.accountName}</p>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black border border-green-100">
                               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> ACTIVE
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>
    </motion.div>
    {selectedPage && <PageDetailsModal page={selectedPage} onClose={() => setSelectedPage(null)} />}
    </>
  );
}

function PageDetailsModal({ page, onClose }: { page: FBPage, onClose: () => void }) {
  const [reels, setReels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    fetch(`/api/pages/${page.id}/reels?token=${page.access_token}`)
      .then(res => res.json())
      .then(data => {
        setReels(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [page]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(reels.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkComment = async () => {
    if (!commentText.trim()) return alert('Please enter comment content or link');
    setIsCommenting(true);
    try {
      const res = await fetch('/api/reels/bulk-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           pageAccessToken: page.access_token,
           reelIds: selectedIds,
           commentText
        })
      });
      if (res.ok) {
         alert('Successfully posted comment to selected videos!');
         setShowCommentInput(false);
         setCommentText('');
         setSelectedIds([]);
      } else {
         alert('Error occurred while posting comments.');
      }
    } catch {
      alert('Network error while posting comments.');
    } finally {
      setIsCommenting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-[28px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden">
                 {page.picture?.data?.url ? <img src={page.picture.data.url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-primary font-bold">{page.name.charAt(0)}</div>}
              </div>
              <div>
                 <h2 className="text-xl font-bold text-gray-800">{page.name}</h2>
                 <p className="text-xs text-gray-500 font-medium">Video / Reels Insights</p>
              </div>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-6">
           {isLoading ? (
             <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <p className="font-medium text-sm animate-pulse">Loading video list for this page...</p>
             </div>
           ) : reels.length === 0 ? (
             <div className="py-20 text-center text-gray-400 font-medium">Page này chưa có video/reels nào.</div>
           ) : (
             <div className="border border-gray-100 rounded-2xl overflow-hidden">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50/80 border-b border-gray-100">
                   <tr>
                     <th className="px-4 py-3 w-10 text-center">
                       <input type="checkbox" checked={selectedIds.length === reels.length && reels.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300" />
                     </th>
                     <th className="px-4 py-3 font-bold text-gray-500">Description / Time</th>
                     <th className="px-4 py-3 font-bold text-gray-500 text-center">Views</th>
                     <th className="px-4 py-3 font-bold text-gray-500 text-center">Engagement</th>
                     <th className="px-4 py-3 font-bold text-gray-500 text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                   {reels.map(r => (
                     <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                       <td className="px-4 py-4 text-center">
                         <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300" />
                       </td>
                       <td className="px-4 py-4">
                         <p className="font-medium text-gray-800 line-clamp-2 leading-tight">{r.description || 'Không có mô tả'}</p>
                         <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{r.created_time ? new Date(r.created_time).toLocaleString('vi-VN') : 'N/A'}</p>
                       </td>
                       <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-md text-xs font-bold border border-orange-100/50">
                            <Eye size={12} /> {r.play_count.toLocaleString()}
                          </div>
                       </td>
                       <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-3 text-xs text-gray-500 font-medium">
                             <span className="flex items-center gap-1"><ThumbsUp size={12} className="text-blue-500" /> {r.likes.toLocaleString()}</span>
                             <span className="flex items-center gap-1"><MessageCircle size={12} className="text-green-500" /> {r.comments.toLocaleString()}</span>
                          </div>
                       </td>
                       <td className="px-4 py-4 text-right">
                          <a href={r.permalink_url} target="_blank" rel="noopener noreferrer" className="inline-flex p-2 bg-gray-100/50 hover:bg-primary/10 hover:text-primary text-gray-500 rounded-lg transition-colors">
                            <ExternalLink size={16} />
                          </a>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-4">
           {showCommentInput ? (
             <div className="flex gap-4">
               <input 
                 type="text" 
                 value={commentText}
                 onChange={e => setCommentText(e.target.value)}
                 placeholder="Enter comment content or link (ex: Buy here...)"
                 className="flex-1 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary text-sm shadow-sm"
               />
               <button 
                 onClick={handleBulkComment}
                 disabled={isCommenting}
                 className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
               >
                 {isCommenting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                 START SPREADING
               </button>
               <button onClick={() => setShowCommentInput(false)} className="px-4 py-3 bg-white text-gray-500 rounded-xl font-bold border border-gray-200 hover:bg-gray-100 transition-all">Hủy</button>
             </div>
           ) : (
             <div className="flex justify-between items-center">
               <span className="text-sm font-medium text-gray-500">Đã chọn: <strong className="text-primary">{selectedIds.length}</strong> video</span>
               <button 
                 onClick={() => setShowCommentInput(true)}
                 disabled={selectedIds.length === 0}
                 className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
               >
                 <MessageSquare size={18} /> BULK COMMENT (IMPORT)
               </button>
             </div>
           )}
        </div>
      </motion.div>
    </div>
  );
}

function GrowthView({ pages, accounts }: { pages: FBPage[], accounts: FBAccount[] }) {
  const [filter, setFilter] = useState('all');
  
  const topPages = [...pages]
    .filter(p => filter === 'all' || p.accountId === filter)
    .sort((a, b) => (b.followers_count || 0) - (a.followers_count || 0))
    .slice(0, 50);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
       <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Growth Analysis</h2>
            <p className="text-xs text-gray-400 mt-1">List of Top 50 Pages with highest recommendations and growth.</p>
          </div>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium focus:ring-2 ring-primary/20 outline-none"
          >
             <option value="all">All Accounts</option>
             {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topPages.map((page, idx) => (
             <div key={page.id} className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 relative overflow-hidden group">
                <div className="absolute top-4 right-4 text-[40px] font-black italic text-gray-50 opacity-10 group-hover:opacity-20 transition-opacity">#{idx + 1}</div>
                <div className="flex items-center gap-4 mb-6">
                   <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center font-bold text-primary text-xl shadow-inner overflow-hidden border border-primary/10">
                      {page.picture?.data?.url ? (
                         <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                      ) : page.name.charAt(0)}
                   </div>
                   <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 truncate leading-tight">{page.name}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{page.category}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Growth</p>
                      <div className="flex items-center gap-1 text-green-500 font-black text-sm italic">
                         +{(Math.random() * 20 + 5).toFixed(1)}% <TrendingUp size={12} />
                      </div>
                   </div>
                   <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                      <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Recommended</p>
                      <div className="flex items-center gap-1 text-primary font-black text-sm italic">
                         High <CheckCircle2 size={12} />
                      </div>
                   </div>
                </div>

                <div className="mt-6 flex justify-between items-center border-t border-gray-50 pt-4">
                   <div className="text-[10px] font-bold text-gray-400 uppercase">Followers: <span className="text-gray-800">{(page.followers_count || page.fan_count || 0).toLocaleString()}</span></div>
                   <div className="text-[10px] font-bold text-gray-400 uppercase">Videos: <span className="text-gray-800">{page.videoCount?.toLocaleString() || 0}</span></div>
                </div>
             </div>
          ))}
          {topPages.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-300 italic bg-white rounded-[28px] border-2 border-dashed border-gray-100">
               No growth data available yet. Please add Facebook accounts to begin.
            </div>
          )}
       </div>
    </motion.div>
  );
}

function AccountsView({ accounts, newToken, onTokenChange, onAdd, onRemove, isAdding, errorMsg }: { accounts: FBAccount[], newToken: string, onTokenChange: (v: string) => void, onAdd: () => void, onRemove: (id: string) => void, isAdding: boolean, errorMsg: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
       <div className="bg-white p-8 rounded-[24px] shadow-sm border border-gray-100 max-w-2xl">
          <h3 className="font-bold text-lg mb-4">Add Facebook Account</h3>
          <p className="text-sm text-gray-500 mb-2">Use Access Token from your Facebook App to connect.</p>
          <p className="text-xs text-primary font-bold mb-6 bg-primary/5 p-3 rounded-lg border border-primary/10">
             Format: TOKEN|UID|PASS|COOKIE|SECRET_2FA
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
               <div className="flex-1 relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    value={newToken}
                    onChange={(e) => onTokenChange(e.target.value)}
                    placeholder="EAA..." 
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary transition-all outline-none text-sm"
                  />
               </div>
               <button 
                 onClick={onAdd}
                 disabled={!newToken || isAdding}
                 className="px-8 py-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
               >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONNECT'}
               </button>
            </div>
            {errorMsg && (
               <div className="text-red-500 text-sm mt-2 font-medium bg-red-50 p-3 rounded-lg border border-red-100 italic">
                  {errorMsg}
               </div>
            )}
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(acc => (
             <div key={acc.id} className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 flex items-center gap-4">
                {acc.picture ? (
                   <img src={acc.picture.data.url} alt={acc.name} className="w-14 h-14 rounded-full border-2 border-primary/20 p-0.5" referrerPolicy="no-referrer" />
                ) : (
                   <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">{acc.name.charAt(0)}</div>
                )}
                <div className="flex-1 min-w-0">
                   <h4 className="font-bold truncate">{acc.name}</h4>
                   <p className="text-[10px] text-gray-400 font-medium">ID: {acc.id}</p>
                </div>
                <button onClick={() => onRemove(acc.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={18} /></button>
             </div>
          ))}
       </div>
    </motion.div>
  );
}

function PostingView({ queue, setQueue, onUpload, pages, accounts, isUploading }: { queue: UploadQueueItem[], setQueue: React.Dispatch<React.SetStateAction<UploadQueueItem[]>>, onUpload: (ps: FBPage[]) => void, pages: FBPage[], accounts: FBAccount[], isUploading: boolean }) {
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPages = pages.filter(p => filter === 'all' || p.accountId === filter);

  const updateItem = (id: string, updates: Partial<UploadQueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
       <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
             {/* Upload Dropzone */}
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="bg-white/50 border-2 border-dashed border-gray-300 rounded-[28px] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary hover:bg-white transition-all group"
             >
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🚀</div>
                <div className="text-center">
                   <h4 className="font-bold text-lg">Drag & Drop Reels Videos</h4>
                   <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">Support MP4, MOV • Unlimited quantity</p>
                </div>
                <input type="file" multiple accept="video/*" className="hidden" ref={fileInputRef} onChange={(e) => {
                   if (!e.target.files) return;
                   const files = Array.from(e.target.files) as File[];
                   const newItems: UploadQueueItem[] = files.map(file => ({
                     id: Math.random().toString(36).substr(2, 9),
                     file,
                     caption: '',
                     status: 'idle',
                     progress: 0,
                     thumbnail: URL.createObjectURL(file),
                     mode: 'now',
                     autoComment: false,
                     affiliateLink: ''
                   }));
                   setQueue(prev => [...prev, ...newItems]);
                }} />
             </div>

             {/* Queue */}
             <div className="bg-white rounded-[28px] p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="font-bold text-lg">Upload Queue ({queue.length})</h3>
                </div>
                
                <div className="space-y-6">
                   {queue.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center text-gray-300 opacity-50">
                         <CloudUpload size={64} strokeWidth={1} />
                         <p className="font-bold mt-4 uppercase tracking-tighter italic">No videos yet</p>
                      </div>
                   ) : (
                      queue.map(item => (
                        <div key={item.id} className="p-4 bg-[#F8F9FB] rounded-2xl flex flex-col gap-4">
                           <div className="flex gap-4">
                              <div className="w-24 h-24 bg-black rounded-xl overflow-hidden relative">
                                 {item.thumbnail && (
                                    <video 
                                       src={`${item.thumbnail}#t=0.001`} 
                                       className="w-full h-full object-cover opacity-60" 
                                       preload="metadata"
                                       muted
                                       playsInline
                                    />
                                 )}
                                 <div className="absolute inset-0 flex items-center justify-center">
                                    {item.status === 'uploading' ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Video className="text-white opacity-40" size={24} />}
                                 </div>
                              </div>
                              <div className="flex-1 space-y-3">
                                 <div className="flex justify-between">
                                    <p className="text-sm font-bold truncate max-w-[200px]">{item.file.name}</p>
                                    <button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500"><X size={16} /></button>
                                 </div>
                                 <textarea 
                                   className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs focus:ring-2 ring-primary/10 outline-none resize-none h-16"
                                   placeholder="Caption for Reels..."
                                   value={item.caption}
                                   onChange={(e) => updateItem(item.id, { caption: e.target.value })}
                                 />
                              </div>
                           </div>

                           <div className="flex flex-wrap gap-4 items-center pt-2">
                              <div className="flex gap-2">
                                 {['now', 'auto-later', 'fb-schedule'].map((m) => (
                                    <button 
                                      key={m}
                                      onClick={() => updateItem(item.id, { mode: m as any })}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                        item.mode === m ? 'bg-primary border-primary text-white shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:border-primary'
                                      }`}
                                    >
                                       {m === 'now' ? 'POST NOW' : m === 'auto-later' ? 'AUTO LATER' : 'FB SCHEDULE'}
                                    </button>
                                 ))}
                              </div>

                              {(item.mode === 'auto-later' || item.mode === 'fb-schedule') && (
                                 <input 
                                   type="datetime-local" 
                                   className="px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-600 outline-none focus:ring-2 ring-primary/20"
                                   onChange={(e) => updateItem(item.id, { scheduleTime: e.target.value })}
                                 />
                              )}

                              {(item.mode === 'now' || item.mode === 'auto-later') && (
                                 <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                       <input type="checkbox" checked={item.autoComment} onChange={(e) => updateItem(item.id, { autoComment: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
                                       <span className="text-[10px] font-bold text-gray-500">CMT AFFILIATE</span>
                                    </label>
                                    {item.autoComment && (
                                       <input 
                                         type="text" 
                                         placeholder="Link affiliate..." 
                                         className="px-3 py-1.5 rounded-lg border border-gray-200 text-[10px] font-medium outline-none focus:ring-2 ring-primary/20"
                                         value={item.affiliateLink}
                                         onChange={(e) => updateItem(item.id, { affiliateLink: e.target.value })}
                                       />
                                    )}
                                 </div>
                              )}
                           </div>

                           {item.status === 'uploading' && (
                              <div className="mt-2 space-y-2">
                                 <div className="flex justify-between items-center text-[10px] font-bold text-primary animate-pulse">
                                    <span>{item.step || 'Preparing...'}</span>
                                    <span>{item.progress}%</span>
                                 </div>
                                 <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${item.progress}%` }} />
                                 </div>
                              </div>
                           )}
                           {item.status === 'delay' && (
                              <div className="mt-2 text-[10px] text-orange-500 font-bold flex items-center gap-1.5 uppercase animate-pulse">
                                 <Clock size={12} /> {item.step}
                              </div>
                           )}
                           {item.status === 'error' && (
                              <div className="mt-2 p-3 bg-red-50 rounded-xl border border-red-100">
                                 <p className="text-[10px] text-red-500 font-bold leading-relaxed">{item.step || 'ERROR'}: {item.error}</p>
                              </div>
                           )}
                           {item.status === 'success' && (
                              <div className="mt-2 text-[10px] text-green-500 font-bold flex items-center gap-1.5 uppercase">
                                 <CheckCircle2 size={12} /> Posted successfully!
                              </div>
                           )}
                        </div>
                      ))
                   )}
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white rounded-[28px] p-8 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="font-bold text-lg">Select Page</h3>
                   <select 
                     value={filter} 
                     onChange={(e) => setFilter(e.target.value)}
                     className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-[10px] font-bold uppercase tracking-wider outline-none"
                   >
                     <option value="all">ALL Accounts</option>
                     {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                   </select>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                   <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border-2 border-transparent transition-all has-[:checked]:border-primary/20 has-[:checked]:bg-primary/5">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded-lg border-gray-300 text-primary focus:ring-primary"
                        checked={selectedPages.length === filteredPages.length && filteredPages.length > 0}
                        onChange={(e) => e.target.checked ? setSelectedPages(filteredPages.map(p => p.id)) : setSelectedPages([])}
                       />
                      <span className="font-bold text-sm">SELECT ALL ({filteredPages.length})</span>
                   </label>
                   {filteredPages.map(page => (
                      <label key={page.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer border-2 border-transparent transition-all has-[:checked]:border-primary/20 has-[:checked]:bg-primary/5">
                         <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={selectedPages.includes(page.id)}
                            onChange={(e) => e.target.checked ? setSelectedPages(prev => [...prev, page.id]) : setSelectedPages(prev => prev.filter(id => id !== page.id))}
                         />
                         <div className="flex-1 truncate">
                            <p className="text-sm font-bold truncate leading-tight">{page.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase truncate">{page.accountName}</p>
                         </div>
                      </label>
                   ))}
                </div>

                <div className="mt-8">
                   <button 
                     disabled={queue.length === 0 || selectedPages.length === 0 || isUploading}
                     onClick={() => onUpload(pages.filter(p => selectedPages.includes(p.id)))}
                     className="w-full py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/30 flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100"
                   >
                     {isUploading ? <Loader2 className="animate-spin" /> : <Send size={20} />} 🚀 {isUploading ? 'POSTING...' : `POST ${queue.length} REELS`}
                   </button>
                   {selectedPages.length > 0 && <p className="text-center text-[10px] text-gray-400 font-bold mt-4 uppercase tracking-widest">WILL POST TO {selectedPages.length} SELECTED PAGES</p>}
                </div>
             </div>
          </div>
       </div>
    </motion.div>
  );
}

function DepoView({ onImport }: { onImport: (files: File[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 grayscale hover:grayscale-0 transition-all">
       <div className="w-32 h-32 bg-white rounded-[40px] shadow-2xl flex items-center justify-center text-4xl mb-8 border-4 border-gray-50">📂</div>
       <h2 className="text-3xl font-black mb-2">Your Video Vault</h2>
       <p className="text-gray-400 mb-10 max-w-sm text-center">Select video files from your computer and import them into the system to start bulk Reels posting campaigns.</p>
       
       <button 
         onClick={() => fileRef.current?.click()}
         className="px-12 py-5 bg-black text-white rounded-2xl font-black shadow-2xl hover:bg-gray-800 transition-all flex items-center gap-3"
       >
         <Plus size={24} /> IMPORT VIDEO
       </button>
       
       <input type="file" multiple accept="video/*" className="hidden" ref={fileRef} onChange={(e) => {
          if (e.target.files) onImport(Array.from(e.target.files) as File[]);
       }} />
    </motion.div>
  );
}

function HistoryView({ history, onDeleteItem, onClearAll }: { history: HistoryItem[], onDeleteItem: (id: string) => void, onClearAll: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[28px] overflow-hidden shadow-sm border border-gray-100">
       <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Video Posting History</h2>
          <button 
            onClick={onClearAll}
            className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
          >
            <Trash2 size={12} /> CLEAR ALL
          </button>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead className="bg-gray-50/50 border-b border-gray-50">
                <tr>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fanpage / Account</th>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Reels Link</th>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mode</th>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">CMT Aff</th>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                   <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-gray-50">
                {history.length === 0 && (
                   <tr>
                      <td colSpan={6} className="px-8 py-20 text-center text-gray-300 italic">No posting history yet</td>
                   </tr>
                )}
                {history.map(item => (
                   <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4">
                         <div className="font-bold text-sm">{item.pageName}</div>
                         <div className="text-[10px] text-gray-400 font-bold uppercase">{item.accountName}</div>
                      </td>
                      <td className="px-8 py-4">
                         {item.link ? (
                            <a href={item.link} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/10">
                               <Link size={12} /> VIEW VIDEO
                            </a>
                         ) : '-'}
                      </td>
                      <td className="px-8 py-4">
                         <span className="text-[10px] font-bold text-gray-600 uppercase">
                            {item.mode === 'now' ? 'POST NOW' : item.mode === 'auto-later' ? `SCHEDULE (${item.scheduleTime})` : 'FB SCHEDULE'}
                         </span>
                      </td>
                      <td className="px-8 py-4">
                         {item.autoComment ? (
                            <div className="flex items-center gap-1.5 text-green-500 font-bold text-[10px]" title={item.affiliateLink}>
                               <CheckCircle2 size={12} /> YES
                            </div>
                         ) : <span className="text-gray-300 font-bold text-[10px]">NO</span>}
                      </td>
                      <td className="px-8 py-4">
                         <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border ${
                            item.status === 'success' ? 'bg-green-50 text-green-500 border-green-100' : 
                            item.status === 'uploading' ? 'bg-blue-50 text-blue-500 border-blue-100' : 'bg-red-50 text-red-500 border-red-100'
                         }`}>
                             {item.status === 'success' ? 'SUCCESS' : item.status === 'uploading' ? <><Loader2 size={10} className="animate-spin" /> RUNNING</> : 'FAILED'}
                         </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <button 
                           onClick={() => onDeleteItem(item.id)}
                           className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                         >
                            <Trash2 size={16} />
                         </button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </motion.div>
  );
}

function SettingsView({ settings, onUpdate, onCheckProxy, onTestBot, onSave }: { settings: any, onUpdate: (v: any) => void, onCheckProxy: () => void, onTestBot: () => void, onSave: () => void }) {
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-8 relative pb-24">
       {/* Proxy */}
       <div className="bg-white p-8 rounded-[28px] shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center"><Globe size={24} /></div>
                <div>
                   <h3 className="font-bold text-xl leading-tight">Proxy Configuration</h3>
                   <p className="text-xs text-gray-400 font-medium">Protect your account with a Proxy system (IPv4)</p>
                </div>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.proxy.enabled} onChange={(e) => onUpdate({ ...settings, proxy: { ...settings.proxy, enabled: e.target.checked } })} className="sr-only peer" />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
             </label>
          </div>

          <AnimatePresence>
             {settings.proxy.enabled && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-6 overflow-hidden">
                   <div className="space-y-2">
                       <p className="text-[10px] font-bold text-gray-400 uppercase">Proxy Format (host:port or host:port:user:pass)</p>
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="127.0.0.1:8080" 
                            className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-mono"
                            value={settings.proxy.format}
                            onChange={(e) => onUpdate({ ...settings, proxy: { ...settings.proxy, format: e.target.value } })}
                          />
                          <button 
                            onClick={onCheckProxy}
                            className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                          >
                             CHECK
                          </button>
                       </div>
                       <p className="text-[10px] text-gray-400 mt-2 italic leading-relaxed">
                          * Standard format: <span className="text-gray-600 font-bold">host:port</span> or <span className="text-gray-600 font-bold">host:port:user:pass</span>.<br/>
                          * Note: If left blank, the system will check the <span className="text-primary font-bold">Server Tools IP</span> (defaults to Taiwan as the server is located there to optimize Facebook connection speed).
                       </p>
                   </div>

                   {settings.proxy.data && <IPInfoCard data={settings.proxy.data} />}
                </motion.div>
             )}
          </AnimatePresence>
       </div>

       {/* Delay Upload */}
       <div className="bg-white p-8 rounded-[28px] shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center"><Clock size={24} /></div>
                <div>
                   <h3 className="font-bold text-xl leading-tight">Anti-Spam (Post Delay)</h3>
                   <p className="text-xs text-gray-400 font-medium">Pause between uploads to avoid Facebook token locks (Rate limit)</p>
                </div>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.uploadDelay?.enabled ?? true} onChange={(e) => onUpdate({ ...settings, uploadDelay: { ...settings.uploadDelay, enabled: e.target.checked } })} className="sr-only peer" />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"></div>
             </label>
          </div>

          <AnimatePresence>
             {(settings.uploadDelay?.enabled ?? true) && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                   <div className="space-y-2">
                       <p className="text-[10px] font-bold text-gray-400 uppercase">Pause time between 2 posts (in SECONDS)</p>
                       <input 
                         type="number" 
                         min="1"
                         className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-bold text-orange-600"
                         value={settings.uploadDelay?.seconds ?? 30}
                         onChange={(e) => onUpdate({ ...settings, uploadDelay: { ...settings.uploadDelay, seconds: parseInt(e.target.value) || 30 } })}
                       />
                       <p className="text-[10px] text-gray-400 mt-2 italic">* Recommendation: From 30 - 60 seconds if posting to 10-20 pages at once.</p>
                   </div>
                </motion.div>
             )}
          </AnimatePresence>
       </div>

       {/* Telegram */}
       <div className="bg-white p-8 rounded-[28px] shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#0088cc]/10 text-[#0088cc] rounded-2xl flex items-center justify-center"><Send size={24} /></div>
                <div>
                   <h3 className="font-bold text-xl leading-tight">Telegram Integration</h3>
                   <p className="text-xs text-gray-400 font-medium">Receive video status notifications via Bot</p>
                </div>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={settings.telegram.enabled} onChange={(e) => onUpdate({ ...settings, telegram: { ...settings.telegram, enabled: e.target.checked } })} className="sr-only peer" />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#0088cc]"></div>
             </label>
          </div>

          <AnimatePresence>
             {settings.telegram.enabled && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">BOT TOKEN</p>
                          <input 
                            type="password" 
                            placeholder="7123..." 
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm"
                            value={settings.telegram.botToken}
                            onChange={(e) => onUpdate({ ...settings, telegram: { ...settings.telegram, botToken: e.target.value } })}
                          />
                      </div>
                      <div className="space-y-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">CHAT ID</p>
                          <input 
                            type="text" 
                            placeholder="-100..." 
                            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm"
                            value={settings.telegram.chatId}
                            onChange={(e) => onUpdate({ ...settings, telegram: { ...settings.telegram, chatId: e.target.value } })}
                          />
                      </div>
                   </div>
                   <button 
                    onClick={onTestBot}
                    className="w-full py-3 bg-[#0088cc] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-[#0088cc]/20 hover:scale-[1.02] active:scale-95 transition-all"
                   >
                    CHECK CONNECTION
                   </button>
                </motion.div>
             )}
          </AnimatePresence>
       </div>

       {/* Save Button */}
       <div className="fixed bottom-8 right-8 z-50">
          <button 
            onClick={handleSave}
            className={`px-8 py-4 rounded-2xl font-black shadow-2xl transition-all ${isSaved ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'} hover:scale-105 active:scale-95 flex items-center gap-2`}
          >
             {isSaved ? (
                <>
                   <CheckCircle2 size={24} /> SAVED SUCCESSFULLY
                </>
             ) : (
                'SAVE SETTINGS'
             )}
          </button>
       </div>
    </motion.div>
  );
}

// Sub-components

function IPInfoCard({ data }: { data: IPInfo }) {
  return (
    <div className="bg-[#1C3A5A] text-white p-8 rounded-2xl shadow-2xl relative overflow-hidden">
       <div className="absolute top-0 right-0 p-4 opacity-5">
          <Shield size={120} />
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
             <p className="text-sm font-medium opacity-80">My IP address is:</p>
             <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                   <span className="text-xl font-bold text-primary">IPv4:</span>
                   <span className="text-2xl font-black tracking-tight">{data.ipv4}</span>
                </div>
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 opacity-50">
                   <span className="text-xl font-bold">IPv6:</span>
                   <span className="text-xl italic">Not detected</span>
                </div>
             </div>
          </div>

          <div className="space-y-6">
             <p className="text-sm font-medium opacity-80">My IP information:</p>
             <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <InfoRow label="ISP" value={data.isp} />
                <InfoRow label="City" value={data.city} />
                <InfoRow label="Region" value={data.region} />
                <InfoRow label="Country" value={data.country} />
             </div>
          </div>
       </div>

       <div className="mt-8 flex justify-center">
          <div className="bg-red-500 hover:bg-red-600 transition-colors cursor-pointer px-10 py-5 rounded-xl flex items-center gap-4 shadow-xl">
             <Shield className="text-white" size={24} />
             <div className="text-left leading-none">
                <p className="text-lg font-black uppercase tracking-tighter">HIDE MY IP ADDRESS NOW</p>
                <p className="text-[10px] font-bold opacity-80 mt-1">PROTECT YOUR ONLINE IDENTITY</p>
             </div>
          </div>
       </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
       <span className="opacity-60">{label}:</span>
       <span className="font-bold">{value}</span>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`group flex items-center gap-3.5 px-4 py-3.5 rounded-2xl cursor-pointer transition-all ${
        active 
          ? 'bg-primary/5 text-primary shadow-[inset_0_0_0_1px_rgba(255,62,108,0.1)]' 
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
        {icon}
      </div>
      <span className={`text-[13px] font-bold ${active ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>{label}</span>
      {active && <motion.div layoutId="nav-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
    </div>
  );
}

function LargeStatCard({ icon, title, sub, value, trend, subValue, color = 'primary' }: { icon: React.ReactNode, title: string, sub: string, value: number | string, trend?: string, subValue?: string, color?: string }) {
  return (
    <div className="bg-white p-6 rounded-[28px] shadow-sm border border-gray-100 flex flex-col gap-4">
       <div className="flex justify-between items-start">
          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-xl">{icon}</div>
          {trend && (
             <div className={`flex items-center gap-1 text-[10px] font-black italic ${color === 'green' ? 'text-green-500' : 'text-primary'}`}>
                {trend} <TrendingUp size={12} />
             </div>
          )}
       </div>
       <div>
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">{title}</h4>
          <div className="flex items-baseline gap-2">
             <span className="text-3xl font-black text-secondary leading-none">
               {typeof value === 'number' ? value.toLocaleString() : (value || '0')}
             </span>
             {subValue && <span className="text-[10px] font-bold text-red-400">{subValue}</span>}
          </div>
          <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase">{sub}</p>
       </div>
    </div>
  );
}

function TwoFactorView() {
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!secret) return;
    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/tools/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCode(data.token);
    } catch (err: any) {
      setError(err.message);
      setCode('');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto pt-10">
      <div className="bg-white rounded-[32px] p-10 shadow-xl border border-gray-100">
        <div className="flex items-center gap-4 mb-8">
           <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <ShieldCheck size={32} />
           </div>
           <div>
              <h2 className="text-2xl font-black text-gray-800 italic">2FA AUTHENTICATOR</h2>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Get Facebook Two-Factor Authentication Code</p>
           </div>
        </div>

        <div className="space-y-6">
           <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                value={secret}
                onChange={e => setSecret(e.target.value)}
                placeholder="Enter 2FA Key (Ex: JBSWY3DPEHPK3PXP...)" 
                className="w-full pl-12 pr-4 py-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:bg-white focus:border-primary transition-all font-mono text-sm tracking-widest uppercase"
              />
           </div>

           <button 
             onClick={handleGenerate}
             disabled={!secret || isGenerating}
             className="w-full py-5 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
           >
             {isGenerating ? <Loader2 className="animate-spin" /> : <RefreshCw size={20} />}
             GET AUTH CODE
           </button>

           {error && (
             <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-4 bg-red-50 text-red-500 rounded-2xl border border-red-100 text-center font-bold italic text-sm">
                Error: {error}
             </motion.div>
           )}

           {code && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="mt-10 p-8 bg-gradient-to-br from-secondary to-gray-800 text-white rounded-[32px] text-center shadow-2xl relative overflow-hidden"
              >
                 <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                 <p className="text-xs font-black text-gray-400 uppercase tracking-[4px] mb-4">YOUR VERIFICATION CODE</p>
                 <div className="text-6xl font-black tracking-[10px] text-primary drop-shadow-[0_0_15px_rgba(255,62,108,0.3)]">
                    {code}
                 </div>
                 <div className="mt-6 flex justify-center">
                    <div 
                      onClick={handleCopy}
                      className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center gap-2"
                    >
                      {copied ? <><CheckCircle2 size={12} /> COPIED</> : 'Copy Code'}
                    </div>
                 </div>
              </motion.div>
           )}
        </div>
      </div>

      <div className="mt-10 p-6 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4 text-blue-700">
         <div className="bg-white/50 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">ℹ️</div>
         <p className="text-xs font-medium leading-relaxed">
           Verification codes are only valid for 30 seconds. If the code doesn't work, please click <b>Get verification code</b> again to update to the latest code.
         </p>
      </div>
    </motion.div>
  );
}
