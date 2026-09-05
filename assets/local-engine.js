// Musor Drop - Standalone Offline Engine
// Allows the game to run 100% offline directly by opening index.html in any browser (file:// or web)

(function() {
  console.log('[LocalEngine] Initializing standalone local game engine...');

  // Ensure default authentication and initial state
  if (!localStorage.getItem('auth-token')) {
    localStorage.setItem('auth-token', 'musor_drop_token');
  }

  // Balance in cents: default 5000 coins = 500,000 cents
  if (localStorage.getItem('musor_local_balance') === null) {
    const existingGameBalance = localStorage.getItem('game_balance');
    const initBalance = existingGameBalance ? parseInt(existingGameBalance, 10) * 100 : 500000;
    localStorage.setItem('musor_local_balance', String(initBalance));
  }

  function getBalance() {
    const val = parseInt(localStorage.getItem('musor_local_balance') || '500000', 10);
    return isNaN(val) ? 500000 : val;
  }

  function setBalance(val) {
    const clamped = Math.max(0, Math.floor(val));
    localStorage.setItem('musor_local_balance', String(clamped));
    localStorage.setItem('game_balance', String(Math.floor(clamped / 100)));
    if (window.GameState) {
      window.GameState.balance = Math.floor(clamped / 100);
    }
    return clamped;
  }

  function addBalance(amount) {
    return setBalance(getBalance() + amount);
  }

  // Inventory storage
  function getInventory() {
    try {
      const inv = JSON.parse(localStorage.getItem('musor_local_inventory') || '[]');
      return Array.isArray(inv) ? inv : [];
    } catch (e) {
      return [];
    }
  }

  function saveInventory(inv) {
    try {
      localStorage.setItem('musor_local_inventory', JSON.stringify(inv));
    } catch (e) {}
  }

  function addInventoryItem(skin) {
    const inv = getInventory();
    inv.unshift(skin);
    saveInventory(inv);
    return inv;
  }

  function removeInventoryItems(uuids) {
    const set = new Set(uuids);
    const inv = getInventory();
    const remaining = inv.filter(item => !set.has(item.uuid));
    saveInventory(remaining);
    return remaining;
  }

  // User Model with relative avatar
  function getLocalUser() {
    const balance = getBalance();
    return {
      id: 1,
      username: "Игрок",
      name: "Игрок",
      avatar: "assets/apple-touch-icon.png",
      balance: balance,
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
      is_banned: false,
      created_at: "2026-01-01T00:00:00.000Z"
    };
  }

  // Containers source
  function getContainers() {
    if (window.__LOCAL_CONTAINERS__ && Array.isArray(window.__LOCAL_CONTAINERS__) && window.__LOCAL_CONTAINERS__.length > 0) {
      return window.__LOCAL_CONTAINERS__;
    }
    return [];
  }

  // All skins flattened list
  function getAllSkins() {
    const containers = getContainers();
    const result = [];
    for (const c of containers) {
      if (c && c.skins) {
        for (const s of c.skins) {
          if (s && s.data) result.push(s.data);
        }
      }
    }
    return result;
  }

  function pickWinningSkin(container) {
    const skins = container.skins || [];
    if (skins.length === 0) return null;

    const totalChance = skins.reduce((sum, s) => sum + (s.chance || 1), 0);
    let rand = Math.random() * totalChance;
    for (const s of skins) {
      rand -= (s.chance || 1);
      if (rand <= 0) {
        return s;
      }
    }
    return skins[Math.floor(Math.random() * skins.length)];
  }

  // Main local router handler
  window.__handleLocalApi = function(method, rawUrl, body) {
    method = (method || 'GET').toUpperCase();
    let url = rawUrl || '';
    
    let path = url;
    let query = {};
    const qIndex = url.indexOf('?');
    if (qIndex !== -1) {
      path = url.substring(0, qIndex);
      const search = url.substring(qIndex + 1);
      const pairs = search.split('&');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }

    // Strip any protocol and domain (file:///, http://localhost:3000, etc.)
    const apiIdx = path.indexOf('/api/v1');
    if (apiIdx !== -1) {
      path = path.substring(apiIdx);
    } else {
      const relIdx = path.indexOf('api/v1');
      if (relIdx !== -1) {
        path = '/' + path.substring(relIdx);
      }
    }

    const containers = getContainers();

    // 1. Auth Me
    if (path === '/api/v1/auth/me') {
      return { success: true, user: getLocalUser() };
    }

    // 2. Config (admin and user)
    if (path === '/api/v1/config' || path === '/api/v1/admin/config') {
      return {
        success: true,
        config: {
          auth_url: '',
          default_currency: 'USD',
          supported_currencies: ['USD', 'RUB']
        }
      };
    }

    // 3. Containers list
    if (path === '/api/v1/games/containers' || path === '/api/v1/admin/containers' || path === '/api/v1/containers') {
      return {
        success: true,
        categories: [
          {
            id: 1,
            name: { ru: "Кейсы CS2", en: "CS2 Cases" },
            containers: containers
          }
        ],
        containers: containers
      };
    }

    // 4. Single container get
    if (path === '/api/v1/games/containers/get' || path === '/api/v1/admin/containers/get') {
      const id = String(query.id || (body && body.id) || '1');
      const found = containers.find(c => String(c.id) === id) || containers[0];
      return { success: true, container: found };
    }

    // 5. Container free opens
    if (path === '/api/v1/games/containers/get/free_opens') {
      return { success: true, count: 0 };
    }

    // 6. Open Container
    if (path === '/api/v1/games/containers/open') {
      const id = String((body && body.id) || query.id || '1');
      const count = Math.max(1, parseInt((body && body.count) || 1, 10));
      const container = containers.find(c => String(c.id) === id) || containers[0];

      if (!container || !container.skins || container.skins.length === 0) {
        return { success: false, errors: ['Контейнер не найден или пуст'] };
      }

      // Deduct cost from local balance
      const cost = (container.price_usd || 15000) * count;
      const newBal = setBalance(getBalance() - cost);

      const results = [];
      for (let i = 0; i < count; i++) {
        const picked = pickWinningSkin(container);
        const skinData = picked.data || picked.skin || picked;
        const uniqueUuid = 'drop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
        
        const wonItem = {
          ...skinData,
          uuid: uniqueUuid
        };

        // Add to local inventory
        addInventoryItem({
          id: Math.floor(Math.random() * 800000) + 100000,
          uuid: uniqueUuid,
          skin: wonItem,
          price: wonItem.price || 1500,
          price_usd: wonItem.price_usd || 1500,
          is_demo: false,
          withdraw_status: null,
          created_at: new Date().toISOString()
        });

        results.push({
          id: Math.floor(Math.random() * 800000) + 100000,
          uuid: uniqueUuid,
          skin: wonItem,
          result: wonItem,
          price: wonItem.price || 1500,
          price_usd: wonItem.price_usd || 1500,
          price_rub: wonItem.price_rub || wonItem.price_usd || 1500,
          fairness: {
            server_seed_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            client_seed: "musordrop_client_" + Math.random().toString(36).substring(2, 8),
            nonce: Math.floor(Math.random() * 100000) + 1
          }
        });
      }

      if (window.GameState && typeof window.GameState.incrementOpens === 'function') {
        window.GameState.incrementOpens();
      }

      return {
        success: true,
        results: results,
        opens_left: 99,
        balance: newBal
      };
    }

    // 7. Reward +5000 coins (Yandex ad watched)
    if (path === '/api/v1/user/reward_coins' || path === '/api/v1/reward_coins') {
      const newBal = addBalance(500000);
      console.log('[LocalEngine] +5000 coins rewarded! New balance:', newBal / 100);
      return {
        success: true,
        added: 5000,
        balance: newBal,
        user: getLocalUser()
      };
    }

    // 8. Inventory get
    if (path === '/api/v1/inventory') {
      return {
        success: true,
        skins: getInventory()
      };
    }

    // 9. Sell skin
    if (path === '/api/v1/inventory/sell') {
      const uuids = body && body.uuids ? body.uuids : (body && body.uuid ? [body.uuid] : []);
      const inv = getInventory();
      let refund = 0;
      for (const u of uuids) {
        const item = inv.find(x => x.uuid === u);
        if (item) {
          refund += (item.price || item.price_usd || 1500);
        } else {
          refund += 1500;
        }
      }
      removeInventoryItems(uuids);
      const newBal = addBalance(refund);
      return {
        success: true,
        balance: newBal
      };
    }

    // 10. Sell all skins
    if (path === '/api/v1/inventory/sell_all' || path === '/api/v1/inventory/sell/all') {
      const inv = getInventory();
      let total = 0;
      for (const item of inv) {
        total += (item.price || item.price_usd || 1500);
      }
      saveInventory([]);
      const newBal = addBalance(total);
      return {
        success: true,
        balance: newBal
      };
    }

    // 11. Live skins feed
    if (path === '/api/v1/live_skins_feed/init') {
      const all = getAllSkins();
      const shuffled = [...all].sort(() => 0.5 - Math.random()).slice(0, 15);
      return {
        success: true,
        data: {
          socket_url: null,
          skins: shuffled
        },
        socket_url: null,
        skins: shuffled
      };
    }

    if (path === '/api/v1/live_skins_feed/broadcast_item') {
      return { success: true };
    }

    // 12. Profile helpers
    if (path === '/api/v1/profile/best_win') {
      const inv = getInventory();
      let best = null;
      if (inv.length > 0) {
        best = inv.reduce((prev, curr) => ((curr.price || 0) > (prev.price || 0) ? curr : prev)).skin;
      } else {
        const all = getAllSkins();
        best = all[0] || null;
      }
      return { success: true, item: best };
    }

    if (path === '/api/v1/profile/favorite_container') {
      return { success: true, container: containers[0] || null };
    }

    if (path === '/api/v1/profile/transactions') {
      return { success: true, transactions: [] };
    }

    // 13. Fairness seeds
    if (path === '/api/v1/fairness/seeds') {
      return {
        success: true,
        seeds: {
          server_seed_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          client_seed: "musordrop_client_seed",
          nonce: 1
        }
      };
    }

    // 14. Contracts & Upgrader
    if (path === '/api/v1/games/upgrader/skins') {
      return { success: true, skins: getAllSkins().slice(0, 30) };
    }

    if (path === '/api/v1/games/contracts') {
      const all = getAllSkins();
      const prize = all[Math.floor(Math.random() * all.length)] || all[0];
      if (body && body.confirm) {
        addInventoryItem({
          id: Math.floor(Math.random() * 800000) + 100000,
          uuid: 'contract-' + Date.now(),
          skin: prize,
          price: prize.price || 5000,
          price_usd: prize.price_usd || 5000,
          is_demo: false,
          withdraw_status: null,
          created_at: new Date().toISOString()
        });
        return { success: true, result: prize };
      }
      return {
        success: true,
        data: {
          chance: 45.5,
          multiplier: 2.2,
          winning_skin: prize
        }
      };
    }

    if (path === '/api/v1/games/keno/multipliers') {
      return { success: true, multipliers: [1.2, 1.5, 2.0, 5.0, 10.0] };
    }

    if (path === '/api/v1/games/mines/game') {
      return { success: true, game: null };
    }

    // Default fallback
    return {
      success: true,
      config: { auth_url: '', default_currency: 'USD', supported_currencies: ['USD', 'RUB'] },
      user: getLocalUser(),
      categories: [{ id: 1, name: { ru: "Кейсы CS2", en: "CS2 Cases" }, containers: containers }],
      containers: containers,
      online: 1842,
      data: {}
    };
  };

  // Safe standalone XMLHttpRequest emulator
  const OriginalXHR = window.XMLHttpRequest;

  function LocalXHR() {
    this.isLocal = false;
    this.nativeXhr = null;
    this.reqMethod = 'GET';
    this.reqUrl = '';
    this.readyState = 0;
    this.status = 0;
    this.statusText = '';
    this.responseText = '';
    this.response = '';
    this.responseType = '';
    this.timeout = 0;
    this.withCredentials = false;
    this.listeners = {};
    this.requestHeaders = {};
  }

  LocalXHR.prototype.addEventListener = function(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
    if (this.nativeXhr) this.nativeXhr.addEventListener(type, listener);
  };

  LocalXHR.prototype.removeEventListener = function(type, listener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
    if (this.nativeXhr) this.nativeXhr.removeEventListener(type, listener);
  };

  LocalXHR.prototype.setRequestHeader = function(k, v) {
    this.requestHeaders[k] = v;
    if (this.nativeXhr) this.nativeXhr.setRequestHeader(k, v);
  };

  LocalXHR.prototype.getResponseHeader = function(h) {
    if (this.isLocal) {
      if (h && h.toLowerCase() === 'content-type') return 'application/json; charset=utf-8';
      return null;
    }
    return this.nativeXhr ? this.nativeXhr.getResponseHeader(h) : null;
  };

  LocalXHR.prototype.getAllResponseHeaders = function() {
    if (this.isLocal) {
      return 'content-type: application/json; charset=utf-8\r\n';
    }
    return this.nativeXhr ? this.nativeXhr.getAllResponseHeaders() : '';
  };

  LocalXHR.prototype.abort = function() {
    if (this.nativeXhr) this.nativeXhr.abort();
  };

  LocalXHR.prototype.open = function(method, url) {
    this.reqMethod = (method || 'GET').toUpperCase();
    this.reqUrl = String(url || '');
    this.readyState = 1;

    // Check if this is an API call
    if (this.reqUrl.indexOf('api/v1') !== -1 || this.reqUrl.startsWith('/api/') || this.reqUrl.startsWith('api/')) {
      this.isLocal = true;
    } else {
      this.isLocal = false;
      this.nativeXhr = new OriginalXHR();
      return this.nativeXhr.open.apply(this.nativeXhr, arguments);
    }
  };

  LocalXHR.prototype.send = function(body) {
    if (this.isLocal) {
      setTimeout(() => {
        let parsedBody = body;
        if (typeof body === 'string') {
          try { parsedBody = JSON.parse(body); } catch(e) {}
        }
        const data = window.__handleLocalApi(this.reqMethod, this.reqUrl, parsedBody);
        const resText = typeof data === 'string' ? data : JSON.stringify(data);

        this.readyState = 4;
        this.status = 200;
        this.statusText = 'OK';
        this.responseText = resText;
        this.response = this.responseType === 'json' ? data : resText;

        const emit = (eventStr, handler) => {
          const ev = new Event(eventStr);
          if (typeof handler === 'function') handler.call(this, ev);
          (this.listeners[eventStr] || []).forEach(fn => {
            try { fn.call(this, ev); } catch(e) { console.error(e); }
          });
        };

        emit('readystatechange', this.onreadystatechange);
        emit('load', this.onload);
        emit('loadend', this.onloadend);
      }, 5);
      return;
    }

    if (this.nativeXhr) {
      return this.nativeXhr.send.apply(this.nativeXhr, arguments);
    }
  };

  window.XMLHttpRequest = LocalXHR;

  // Intercept window.fetch
  const origFetch = window.fetch;
  window.fetch = async function(resource, init) {
    const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    if (url && (url.indexOf('api/v1') !== -1 || url.startsWith('/api/') || url.startsWith('api/'))) {
      const method = (init && init.method ? init.method : 'GET').toUpperCase();
      let body = init && init.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const data = window.__handleLocalApi(method, url, body);
      return new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return origFetch.apply(window, arguments);
  };

  console.log('[LocalEngine] Ready. Standalone offline mode enabled.');
})();
