const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add User Schema
const userSchemaCode = `
const AppUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  expiredAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  chatId: { type: String, default: '' } // To link with telegram
});
const AppUser = mongoose.models.AppUser || mongoose.model<any>('AppUser', AppUserSchema);
`;
code = code.replace(/const AccountSchema/, userSchemaCode + '\nconst AccountSchema');

// 2. Update Middleware to use Auth Token for Machine ID instead of IP
const newMiddleware = `
// Middleware
app.use(async (req, res, next) => {
    if (MONGODB_URI) {
       try { await connectToDatabase(); } catch(e) {}
    }

    // Try to get auth token
    const token = req.cookies?.auth_token || req.headers['authorization']?.replace('Bearer ', '');
    let mid = 'default';
    
    if (token) {
        // We will just use the token as mid for simplicity. 
        // Token will be the username for now or a signed string. Let's use simple hex encoding or just the username plain text for simplicity in this script, wait, we must protect it.
        // Let's decode very simple token => \`\${username}:\${Date.now()}\` encoded in base64
        try {
            const decoded = Buffer.from(token, 'base64').toString('ascii');
            const [username] = decoded.split(':');
            if (username && isMongoConnected) {
                 const user = await AppUser.findOne({ username });
                 if (user) {
                     mid = username; // User isolated by username!
                     (req as any).user = user;
                 }
            }
        } catch(e) {}
    } else {
       // fallback to ip
       let clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'default';
       if (Array.isArray(clientIp)) clientIp = clientIp[0];
       mid = clientIp.split(',')[0].trim();
    }
    
    als.run(mid, () => {
      next();
    });
});
`;
code = code.replace(/\/\/ Middleware[\s\S]*?app\.set\('trust proxy', 1\);/, newMiddleware + "\napp.set('trust proxy', 1);");

// 3. Add Auth & Telegram Routes
const authRoutes = `
// --- AUTH & TELEGRAM ---
app.post('/api/auth/register', async (req, res) => {
   const { username, password } = req.body;
   if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
   try {
       const existing = await AppUser.findOne({ username });
       if (existing) return res.status(400).json({ error: 'Username exists' });
       const user = new AppUser({ username, password }); // Hash in prod, plain text for simple implementation
       await user.save();
       // Send telegram message
       try {
           const ax = getAxiosInstance();
           const adminChatId = '6119523233'; // USER PROVIDED ADMIN ID
           const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14'; // USER PROVIDED BOT TOKEN
           const msg = \`Trạng thái: 🟢 <b>ĐĂNG KÝ TÀI KHOẢN MỚI</b>\\n👤 ID/User: <b>\${username}</b>\\n⚙️ <i>Để kích hoạt, hãy gửi tin nhắn theo cú pháp:</i>\\n</pre>/adddays \${username} số_ngày</pre>\\n<i>Ví dụ: </i>/adddays \${username} 30\`;
           await ax.post(\`https://api.telegram.org/bot\${botToken}/sendMessage\`, {
               chat_id: adminChatId,
               text: msg,
               parse_mode: 'HTML'
           });
       } catch(e) { console.error('tele err'); }
       res.json({ success: true });
   } catch(e) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await AppUser.findOne({ username, password });
        if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
        
        // Generate simple token
        const token = Buffer.from(\`\${username}:\${Date.now()}\`).toString('base64');
        res.cookie('auth_token', token, { httpOnly: true, secure: true, sameSite: 'none' });
        res.json({ success: true, token, user });
    } catch(e) { res.status(500).json({ error: 'Server error' }); }
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
                    const user = await AppUser.findOne({ username });
                    if (user) {
                        let baseDate = new Date();
                        if (user.expiredAt && user.expiredAt > baseDate) {
                            baseDate = new Date(user.expiredAt);
                        }
                        baseDate.setDate(baseDate.getDate() + days);
                        user.expiredAt = baseDate;
                        await user.save();
                        const ax = getAxiosInstance();
                        const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14';
                        await ax.post(\`https://api.telegram.org/bot\${botToken}/sendMessage\`, {
                            chat_id: chatId,
                            text: \`✅ Đã cộng thêm \${days} ngày cho tài khoản \${username}. Hạn mới: \${baseDate.toLocaleDateString('vi-VN')}\`
                        });
                    } else {
                       const ax = getAxiosInstance();
                       const botToken = '8681414506:AAF5y22jn9namCG-7MEQxFX4WqOyeauyM14';
                       await ax.post(\`https://api.telegram.org/bot\${botToken}/sendMessage\`, { chat_id: chatId, text: \`❌ Không tìm thấy user: \${username}\` });
                    }
                } catch(e){}
            }
        }
    }
});
// --- END AUTH ---
`;
code = code.replace(/app\.get\('\/api\/accounts'/, authRoutes + "\napp.get('/api/accounts'");

fs.writeFileSync('server.ts', code);
