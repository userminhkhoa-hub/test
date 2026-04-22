const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

const authStateCode = `
  const [authStatus, setAuthStatus] = useState<'loading' | 'login' | 'register' | 'expired' | 'authenticated'>('loading');
  const [user, setUser] = useState<{username: string, expiredAt: string, isExpired: boolean} | null>(null);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
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
           setAuthError('Đăng ký thành công! Vui lòng liên hệ Admin đọc tên tài khoản để kích hoạt.');
       } else {
           const data = await res.json();
           setAuthError(data.error || 'Registration failed');
       }
    } catch(e) { setAuthError('Server error'); }
  };
`;

code = code.replace(/export default function App\(\) \{/, 'export default function App() {\n' + authStateCode);

code = code.replace(/useEffect\(\(\) => \{\n    console\.log\('Auto Reels Media: App mounting\.\.\.'\);\n    fetchData\(true\)\.catch\(e => console\.error\('Initial fetch failed:', e\)\);\n    const interval = setInterval\(\(\) => fetchData\(false\)\.catch\(e => console\.error\('Background sync failed:', e\)\), 15000\); \/\/ 15s sync\n    return \(\) => clearInterval\(interval\);\n  \}, \[\]\);/, '');

const authRenderCode = `
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
             {authStatus === 'login' ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản mới'}
           </p>

           <form onSubmit={authStatus === 'login' ? handleLogin : handleRegister} className="space-y-4">
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Tên Đăng Nhập</label>
               <input
                 type="text"
                 required
                 className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                 placeholder="yourusername"
                 value={authForm.username}
                 onChange={e => setAuthForm({...authForm, username: e.target.value})}
               />
             </div>
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Mật khẩu</label>
               <input
                 type="password"
                 required
                 className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                 placeholder="••••••••"
                 value={authForm.password}
                 onChange={e => setAuthForm({...authForm, password: e.target.value})}
               />
             </div>

             {authError && (
               <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-start gap-2 text-red-500 text-sm">
                 <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
                 <p>{authError}</p>
               </div>
             )}

             <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors">
               {authStatus === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
             </button>
           </form>

           <div className="mt-6 text-center">
             <button 
               onClick={() => { setAuthStatus(authStatus === 'login' ? 'register' : 'login'); setAuthError(''); setAuthForm({username: '', password: ''}) }}
               className="text-sm text-blue-400 hover:text-blue-300"
             >
               {authStatus === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
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
`;

code = code.replace(/return \(\s*<div className="flex h-screen/, authRenderCode + '\n  return (\n    <div className="flex h-screen');

// Let's add a logout button to the Dashboard Menu. Assuming there's a nav.
const logoutHtml = `
          <button
            onClick={() => { localStorage.removeItem('auth_token'); window.location.reload(); }}
            className="w-full flex items-center mb-8 gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium whitespace-nowrap overflow-hidden">Đăng Xuất</span>
          </button>
        </div>
      </nav>
`;
code = code.replace(/<\/div>\s*<\/nav>/, logoutHtml);

fs.writeFileSync('src/App.tsx', code);
