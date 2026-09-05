import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Load containers data
const containersDataPath = path.join(__dirname, 'containers_data.json');
let containersList = [];
if (fs.existsSync(containersDataPath)) {
  try {
    containersList = JSON.parse(fs.readFileSync(containersDataPath, 'utf8'));
  } catch (e) {
    console.error('Error reading containers_data.json:', e);
  }
}

// Balance in cents: 5000 coins = 500000
let userBalanceInCents = 500000;
const balanceFile = path.join(__dirname, '.balance.json');
if (fs.existsSync(balanceFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(balanceFile, 'utf8'));
    if (typeof saved.balance === 'number') {
      userBalanceInCents = saved.balance;
    }
  } catch (e) {}
}

function saveBalance() {
  try {
    fs.writeFileSync(balanceFile, JSON.stringify({ balance: userBalanceInCents }));
  } catch (e) {}
}

function getMockUser() {
  return {
    id: 1,
    username: "Игрок",
    name: "Игрок",
    avatar: "/assets/apple-touch-icon.png",
    balance: userBalanceInCents,
    demo_balance: 1000000,
    demo_enabled: false,
    currency: "USD",
    isAuth: true,
    auth: true,
    token: "musor_drop_token",
    steam_id: "76561198000000000",
    steamId: "76561198000000000",
    trade_link: "https://steamcommunity.com/tradeoffer/new/?partner=12345678&token=abcdefgh",
    trade_url: "https://steamcommunity.com/tradeoffer/new/?partner=12345678&token=abcdefgh",
    role: "user",
    created_at: new Date().toISOString()
  };
}

const mockCategory = {
  id: 1,
  name: { ru: "Кейсы CS2", en: "CS2 Cases" },
  title: "Кейсы CS2",
  containers: containersList
};

// API Endpoints
app.get('/api/v1/auth/me', (req, res) => {
  res.json({ success: true, user: getMockUser() });
});

app.get('/api/v1/config', (req, res) => {
  res.json({
    success: true,
    config: {
      auth_url: '',
      default_currency: 'USD',
      supported_currencies: ['USD', 'RUB']
    }
  });
});

app.get(['/api/v1/games/containers', '/api/v1/admin/containers'], (req, res) => {
  res.json({
    success: true,
    categories: [
      {
        id: 1,
        name: { ru: "Кейсы CS2", en: "CS2 Cases" },
        containers: containersList
      }
    ],
    containers: containersList
  });
});

app.get(['/api/v1/games/containers/get', '/api/v1/admin/containers/get'], (req, res) => {
  const reqId = String(req.query.id);
  const found = containersList.find(c => String(c.id) === reqId) || containersList[0];
  res.json({ success: true, container: found });
});

app.get('/api/v1/games/containers/get/free_opens', (req, res) => {
  res.json({ success: true, count: 0 });
});

app.post('/api/v1/games/containers/open', (req, res) => {
  const { id, count = 1 } = req.body;
  const container = containersList.find(c => String(c.id) === String(id)) || containersList[0];
  
  const skins = container.skins || [];
  if (skins.length === 0) {
    return res.status(400).json({ error: 'No skins in container' });
  }

  // Deduct cost from user balance
  const cost = (container.price_usd || 15000) * count;
  userBalanceInCents = Math.max(0, userBalanceInCents - cost);
  saveBalance();

  const results = [];
  for (let i = 0; i < count; i++) {
    // Pick winning skin randomly
    const winningSkin = skins[Math.floor(Math.random() * skins.length)];
    const uniqueUuid = 'drop-' + Math.random().toString(36).substring(2, 11);
    
    const wonData = winningSkin.data || winningSkin.skin || winningSkin;
    const skinResult = {
      ...wonData,
      uuid: uniqueUuid
    };

    results.push({
      id: Math.floor(Math.random() * 800000) + 100000,
      uuid: uniqueUuid,
      skin: skinResult,
      result: skinResult,
      price: skinResult.price || 1500,
      price_usd: skinResult.price_usd || 1500,
      price_rub: skinResult.price_rub || skinResult.price_usd || 1500,
      fairness: {
        server_seed_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        client_seed: "client-" + Math.random().toString(36).substring(2, 8),
        nonce: Math.floor(Math.random() * 100000) + 1
      }
    });
  }

  res.json({
    success: true,
    results: results,
    opens_left: 99,
    balance: userBalanceInCents
  });
});

// Reward endpoint for 5000 coins (Yandex SDK ad)
app.post(['/api/v1/user/reward_coins', '/api/v1/reward_coins'], (req, res) => {
  // +5000 coins = +500,000 cents
  userBalanceInCents += 500000;
  saveBalance();
  console.log(`User rewarded 5000 coins! New balance: ${userBalanceInCents / 100}`);
  res.json({
    success: true,
    added: 5000,
    balance: userBalanceInCents,
    user: getMockUser()
  });
});

// Sell inventory skin
app.post('/api/v1/inventory/sell', (req, res) => {
  const { uuid } = req.body;
  // refund typical skin price
  userBalanceInCents += 1500;
  saveBalance();
  res.json({ success: true, balance: userBalanceInCents });
});

app.post('/api/v1/inventory/sell_all', (req, res) => {
  const { uuids = [] } = req.body;
  userBalanceInCents += uuids.length * 1500;
  saveBalance();
  res.json({ success: true, balance: userBalanceInCents });
});

app.get('/api/v1/inventory', (req, res) => {
  res.json({ success: true, skins: [] });
});

app.post('/api/v1/live_skins_feed/init', (req, res) => {
  const randomSkins = [];
  for (const c of containersList) {
    if (c.skins) randomSkins.push(...c.skins.map(s => s.data));
  }
  res.json({
    success: true,
    socket_url: "wss://echo.websocket.events",
    skins: randomSkins.slice(0, 15)
  });
});

app.get('/api/v1/profile/best_win', (req, res) => {
  const skin = containersList[0]?.skins[0]?.data || null;
  res.json({ success: true, item: skin });
});

app.get('/api/v1/profile/favorite_container', (req, res) => {
  res.json({ success: true, container: containersList[0] || null });
});

app.get('/api/v1/profile/transactions', (req, res) => {
  res.json({ success: true, transactions: [] });
});

app.get('/api/v1/games/keno/multipliers', (req, res) => {
  res.json({ success: true, multipliers: [1.2, 1.5, 2.0, 5.0, 10.0] });
});

app.get('/api/v1/games/mines/game', (req, res) => {
  res.json({ success: true, game: null });
});

app.get('/api/v1/games/upgrader/skins', (req, res) => {
  const all = [];
  for (const c of containersList) {
    if (c.skins) all.push(...c.skins.map(s => s.data));
  }
  res.json({ success: true, skins: all.slice(0, 30) });
});

app.get('/api/v1/fairness/seeds', (req, res) => {
  res.json({
    success: true,
    seeds: {
      server_seed_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      client_seed: "musordrop_client_seed",
      nonce: 1
    }
  });
});

app.get('/api/v1/wallet/deposit/methods', (req, res) => res.json({ success: true, methods: [] }));
app.get('/api/v1/referrer', (req, res) => res.json({ success: true, referrer: null, levels: [], voucher: null }));
app.get('/api/v1/bonuses/rakeback', (req, res) => res.json({ success: true, rakeback: { available: 0 } }));
app.get('/api/v1/bonuses/telegram_subscribe', (req, res) => res.json({ success: true, bonus: { available: false } }));
app.get('/api/v1/bonuses/cashback', (req, res) => res.json({ success: true, cashback: { available: 0 } }));

// Catch-all for other /api/v1 calls
app.all('/api/v1/*', (req, res) => {
  const u = getMockUser();
  res.json({
    success: true,
    user: u,
    categories: [mockCategory],
    cases: containersList,
    containers: containersList,
    data: {
      user: u,
      categories: [mockCategory],
      cases: containersList,
      containers: containersList,
      online: 1842
    },
    online: 1842
  });
});

// Serve static assets from root and dist
const staticPath = fs.existsSync(path.join(__dirname, 'dist'))
  ? path.join(__dirname, 'dist')
  : __dirname;

app.use(['/assets', '/containers/assets'], express.static(path.join(__dirname, 'assets')));
app.use(express.static(staticPath));
if (staticPath !== __dirname) {
  app.use(express.static(__dirname));
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Musor Drop server running on http://0.0.0.0:${PORT}`);
});
