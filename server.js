const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const app = express();
const db = new sqlite3.Database(path.join(__dirname, 'casino.db'), err => {
    if (err) {
        console.error('Erreur d ouverture de la base de données :', err.message);
        process.exit(1);
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const SUPPORTED_PAYMENT_METHODS = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'RUB', 'ZAR', 'SGD', 'HKD',
    'NOK', 'SEK', 'DKK', 'TRY', 'PLN', 'CZK', 'HUF', 'AED', 'SAR', 'KWD', 'QAR',
    'PayPal', 'Bank Transfer',
    'Bitcoin', 'BTC', 'Ethereum', 'ETH', 'Tether', 'USDT', 'USD Coin', 'USDC',
    'Litecoin', 'LTC', 'Dogecoin', 'DOGE', 'Ripple', 'XRP', 'Binance Coin', 'BNB',
    'Cardano', 'ADA', 'Solana', 'SOL', 'Polkadot', 'DOT', 'Avalanche', 'AVAX',
    'Polygon', 'MATIC', 'Shiba Inu', 'SHIB', 'Tron', 'TRX', 'Chainlink', 'LINK',
    'Stellar', 'XLM', 'Bitcoin Cash', 'BCH', 'Ethereum Classic', 'ETC', 'Filecoin', 'FIL',
    'ApeCoin', 'APE', 'NEAR', 'TON', 'ICP', 'ATOM', 'EOS', 'MANA', 'FTM', 'VET',
    'Dai', 'DAI', 'Binance USD', 'BUSD', 'TrueUSD', 'TUSD', 'Pax Dollar', 'USDP', 'Gemini Dollar', 'GUSD'
];
const FIAT_CURRENCIES = [
    'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'RUB', 'ZAR', 'SGD', 'HKD',
    'NOK', 'SEK', 'DKK', 'TRY', 'PLN', 'CZK', 'HUF', 'AED', 'SAR', 'KWD', 'QAR'
];
const SPECIAL_METHODS = ['PayPal', 'Bank Transfer'];
const CRYPTO_PRICE_MAP = {
    'Bitcoin': 'bitcoin', 'BTC': 'bitcoin',
    'Ethereum': 'ethereum', 'ETH': 'ethereum',
    'Tether': 'tether', 'USDT': 'tether',
    'USD Coin': 'usd-coin', 'USDC': 'usd-coin',
    'Litecoin': 'litecoin', 'LTC': 'litecoin',
    'Dogecoin': 'dogecoin', 'DOGE': 'dogecoin',
    'Ripple': 'ripple', 'XRP': 'ripple',
    'Binance Coin': 'binancecoin', 'BNB': 'binancecoin',
    'Cardano': 'cardano', 'ADA': 'cardano',
    'Solana': 'solana', 'SOL': 'solana',
    'Polkadot': 'polkadot', 'DOT': 'polkadot',
    'Avalanche': 'avalanche-2', 'AVAX': 'avalanche-2',
    'Polygon': 'polygon', 'MATIC': 'polygon',
    'Shiba Inu': 'shiba-inu', 'SHIB': 'shiba-inu',
    'Tron': 'tron', 'TRX': 'tron',
    'Chainlink': 'chainlink', 'LINK': 'chainlink',
    'Stellar': 'stellar', 'XLM': 'stellar',
    'Bitcoin Cash': 'bitcoin-cash', 'BCH': 'bitcoin-cash',
    'Ethereum Classic': 'ethereum-classic', 'ETC': 'ethereum-classic',
    'Filecoin': 'filecoin', 'FIL': 'filecoin',
    'ApeCoin': 'apecoin', 'APE': 'apecoin',
    'NEAR': 'near',
    'TON': 'tezos',
    'ICP': 'internet-computer',
    'ATOM': 'cosmos',
    'EOS': 'eos',
    'MANA': 'decentraland',
    'FTM': 'fantom',
    'VET': 'vechain',
    'Dai': 'dai', 'DAI': 'dai',
    'Binance USD': 'binance-usd', 'BUSD': 'binance-usd',
    'TrueUSD': 'true-usd', 'TUSD': 'true-usd',
    'Pax Dollar': 'pax-dollar', 'USDP': 'pax-dollar',
    'Gemini Dollar': 'gemini-dollar', 'GUSD': 'gemini-dollar'
};
const COMMISSION_RATE = 0.05;

async function fetchRates() {
    const rates = {};
    try {
        const fiatSymbols = FIAT_CURRENCIES.filter(symbol => symbol !== 'USD');
        const fiatResponse = await fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${fiatSymbols.join(',')}`);
        const fiatData = await fiatResponse.json();
        if (fiatData && fiatData.rates) {
            rates['USD'] = 1;
            for (const symbol of fiatSymbols) {
                const value = fiatData.rates[symbol];
                rates[symbol] = value ? Math.round((1 / value) * 1000000) / 1000000 : null;
            }
        }
    } catch (err) {
        console.warn('Impossible de récupérer les taux fiat:', err.message);
    }
    try {
        const cryptoIds = [...new Set(Object.values(CRYPTO_PRICE_MAP))].join(',');
        const cryptoResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`);
        const cryptoData = await cryptoResponse.json();
        for (const [key, id] of Object.entries(CRYPTO_PRICE_MAP)) {
            const price = cryptoData[id] && cryptoData[id].usd;
            rates[key] = price ? Math.round(price * 100) / 100 : null;
        }
    } catch (err) {
        console.warn('Impossible de récupérer les prix crypto:', err.message);
    }
    for (const special of SPECIAL_METHODS) {
        rates[special] = 1;
    }
    return rates;
}

function getUsdValue(amount, method, rates) {
    const key = String(method).trim();
    const rate = rates[key] || 0;
    const usdValue = Math.round(amount * rate * 100) / 100;
    return { rate, usdValue };
}

function runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function ensureColumn(table, column, definition) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
            if (err) return reject(err);
            if (!rows.some(row => row.name === column)) {
                db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], err2 => {
                    if (err2) reject(err2);
                    else resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

async function initializeSchema() {
    db.serialize(async () => {
        db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, balance REAL DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY, userId TEXT, amount REAL, currency TEXT, status TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY, userId TEXT, amount REAL, asset TEXT, status TEXT, currency TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS casino_funds (asset TEXT PRIMARY KEY, balance REAL DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS bets (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, amount REAL, status TEXT)`);

        try {
            await ensureColumn('users', 'password', 'TEXT DEFAULT ""');
            await ensureColumn('users', 'role', 'TEXT DEFAULT "player"');
            await ensureColumn('users', 'sessionToken', 'TEXT');
            await ensureColumn('bets', 'game', 'TEXT DEFAULT ""');
            await ensureColumn('bets', 'result', 'TEXT DEFAULT ""');
            await ensureColumn('bets', 'payout', 'REAL DEFAULT 0');
            await ensureColumn('bets', 'commission', 'REAL DEFAULT 0');
            await ensureColumn('deposits', 'commission', 'REAL DEFAULT 0');
            await ensureColumn('deposits', 'usdValue', 'REAL DEFAULT 0');
            await ensureColumn('deposits', 'rate', 'REAL DEFAULT 0');
            await ensureColumn('withdrawals', 'commission', 'REAL DEFAULT 0');
            await ensureColumn('withdrawals', 'usdValue', 'REAL DEFAULT 0');
            await ensureColumn('withdrawals', 'rate', 'REAL DEFAULT 0');
        } catch (err) {
            console.error('Erreur schema update:', err.message);
        }

        db.run(`INSERT OR IGNORE INTO users (id, balance, password, role) VALUES ('samuelfleury1205@gmail.com', 0, 'Salmigondis#12', 'admin')`);
        db.run(`INSERT OR IGNORE INTO casino_funds (asset, balance) VALUES ('USD', 1000)`);
    });
}

function getTokenFromReq(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return req.body.token || req.query.token || null;
}

async function authenticate(req, res, next) {
    const token = getTokenFromReq(req);
    if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });

    const user = await getAsync('SELECT id, role, balance FROM users WHERE sessionToken = ?', [token]);
    if (!user) return res.status(401).json({ success: false, message: 'Token invalide' });

    req.user = user;
    req.user.token = token;
    next();
}

function computePayout(amount, multiplier) {
    return Math.round((amount * multiplier) * 100) / 100;
}

function getProfit(amount, payout) {
    return Math.round((amount - payout) * 100) / 100;
}

async function updateCasinoFunds(profit) {
    const current = await getAsync('SELECT balance FROM casino_funds WHERE asset = ?', ['USD']);
    const nextBalance = (current ? current.balance : 0) + profit;
    await runAsync('INSERT OR REPLACE INTO casino_funds (asset, balance) VALUES (?, ?)', ['USD', nextBalance]);
}

async function createBet(userId, amount, game, result, payout, commission = 0) {
    await runAsync('INSERT INTO bets (userId, amount, status, game, result, payout, commission) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, amount, 'finished', game, result, payout, commission]);
}

initializeSchema();

app.post('/api/auth/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
        if (!userId || !password) return res.status(400).json({ success: false, message: 'userId et password requis' });

        const existing = await getAsync('SELECT * FROM users WHERE id = ?', [userId]);
        if (!existing) {
            const token = crypto.randomUUID();
            await runAsync('INSERT INTO users (id, balance, password, role, sessionToken) VALUES (?, ?, ?, ?, ?)', [userId, 0.87, password, 'player', token]);
            return res.json({ success: true, token, userId, balance: 0.87, role: 'player' });
        }

        if (existing.password && existing.password !== password) {
            return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });
        }

        const token = crypto.randomUUID();
        await runAsync('UPDATE users SET sessionToken = ? WHERE id = ?', [token, userId]);
        res.json({ success: true, token, userId, balance: existing.balance, role: existing.role || 'player' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
    try {
        await runAsync('UPDATE users SET sessionToken = NULL WHERE id = ?', [req.user.id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/auth/profile', authenticate, async (req, res) => {
    res.json({ success: true, user: req.user });
});

app.get('/api/balance', authenticate, async (req, res) => {
    res.json({ success: true, balance: req.user.balance });
});

app.post('/api/deposit', authenticate, async (req, res) => {
    try {
        const { amount, method, currency = 'USD', userId } = req.body;
        const paymentMethod = String(method || currency || 'USD');
        const montant = Math.round(parseFloat(amount) * 1000000) / 1000000;
        if (Number.isNaN(montant) || montant <= 0) return res.status(400).json({ success: false, message: 'Montant invalide' });
        if (!SUPPORTED_PAYMENT_METHODS.includes(paymentMethod)) return res.status(400).json({ success: false, message: 'Moyen de paiement non supporté' });

        const targetUser = req.user.role === 'admin' && userId ? String(userId).trim() : req.user.id;
        const targetProfile = await getAsync('SELECT id FROM users WHERE id = ?', [targetUser]);
        if (!targetProfile) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

        const rates = await fetchRates();
        const { rate, usdValue } = getUsdValue(montant, paymentMethod, rates);
        if (usdValue <= 0) return res.status(400).json({ success: false, message: 'Impossible de calculer la valeur USD' });

        const commission = Math.round((usdValue * COMMISSION_RATE) * 100) / 100;
        const netUsd = Math.round((usdValue - commission) * 100) / 100;
        const status = 'approved';

        await runAsync('INSERT INTO deposits (userId, amount, currency, status, commission, usdValue, rate) VALUES (?, ?, ?, ?, ?, ?, ?)', [targetUser, montant, paymentMethod, status, commission, usdValue, rate]);
        await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [netUsd, targetUser]);
        await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [commission, 'samuelfleury1205@gmail.com']);

        res.json({ success: true, status, targetUser, method: paymentMethod, commission, netUsd, usdValue, rate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/withdraw', authenticate, async (req, res) => {
    try {
        const { amount, method, asset, currency = 'USD' } = req.body;
        const withdrawMethod = String(method || asset || currency || 'USD');
        const montant = Math.round(parseFloat(amount) * 1000000) / 1000000;
        if (Number.isNaN(montant) || montant <= 0) return res.status(400).json({ success: false, message: 'Montant invalide' });
        if (!SUPPORTED_PAYMENT_METHODS.includes(withdrawMethod)) return res.status(400).json({ success: false, message: 'Moyen de retrait non supporté' });

        const rates = await fetchRates();
        const { rate, usdValue } = getUsdValue(montant, withdrawMethod, rates);
        if (usdValue <= 0) return res.status(400).json({ success: false, message: 'Impossible de calculer la valeur USD' });
        if (req.user.balance < usdValue) return res.status(400).json({ success: false, message: 'Solde insuffisant' });

        const commission = Math.round((usdValue * COMMISSION_RATE) * 100) / 100;
        const usdNet = Math.round((usdValue - commission) * 100) / 100;
        const status = 'approved';

        await runAsync('INSERT INTO withdrawals (userId, amount, asset, currency, status, commission, usdValue, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.user.id, montant, withdrawMethod, currency, status, commission, usdValue, rate]);
        await runAsync('UPDATE users SET balance = balance - ? WHERE id = ?', [usdValue, req.user.id]);
        await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [commission, 'samuelfleury1205@gmail.com']);

        res.json({ success: true, status, balance: req.user.balance - usdValue, method: withdrawMethod, commission, usdValue, rate, netUsd: usdNet });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/payment-methods', async (req, res) => {
    res.json({ success: true, methods: SUPPORTED_PAYMENT_METHODS });
});

app.get('/api/rates', async (req, res) => {
    try {
        const rates = await fetchRates();
        res.json({ success: true, rates });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Impossible de récupérer les taux' });
    }
});

app.post('/api/claim-faucet', authenticate, async (req, res) => {
    try {
        const reward = 0.05;
        await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [reward, req.user.id]);
        await updateCasinoFunds(-reward);
        res.json({ success: true, message: `Gain de ${reward.toFixed(2)}$ ajouté au compte.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/game/:type', authenticate, async (req, res) => {
    try {
        const { amount, choice, target } = req.body;
        const mise = parseFloat(amount);
        if (Number.isNaN(mise) || mise <= 0) return res.status(400).json({ success: false, message: 'Montant invalide' });
        if (req.user.balance < mise) return res.status(400).json({ success: false, message: 'Solde insuffisant' });

        let result = 'lose';
        let payout = 0;
        let details = null;
        const game = req.params.type;
        const roll = Math.random();

        if (game === 'dice') {
            // 3.5% de chance de gagner x25 => RTP 87.5%
            if (roll < 0.035) {
                result = 'win';
                payout = computePayout(mise, 25);
            }
            const dice1 = Math.floor(Math.random() * 6) + 1;
            const dice2 = Math.floor(Math.random() * 6) + 1;
            details = { dice1, dice2, total: dice1 + dice2 };
        } else if (game === 'slots') {
            // 3% de chance de gagner x8.5 => RTP 25.5% (House edge 74.5%)
            if (roll < 0.03) {
                result = 'win';
                payout = computePayout(mise, 8.5);
            }
        } else if (game === 'roulette') {
            const choiceNorm = String(choice || 'red').toLowerCase();
            const redWin = roll < 18 / 37;
            const blackWin = roll >= 18 / 37 && roll < 36 / 37;
            const greenWin = roll >= 36 / 37;
            const color = redWin ? 'red' : blackWin ? 'black' : 'green';
            details = { color };
            if ((choiceNorm === 'red' && redWin) || (choiceNorm === 'black' && blackWin) || (choiceNorm === 'green' && greenWin)) {
                result = 'win';
                payout = computePayout(mise, choiceNorm === 'green' ? 13 : 1.95);
            }
        } else if (game === 'coinflip') {
            const flip = roll < 0.5 ? 'heads' : 'tails';
            details = { flip };
            if (String(choice).toLowerCase() === flip) {
                result = 'win';
                payout = computePayout(mise, 1.95);
            }
        } else if (game === 'highlow') {
            const value = Math.floor(Math.random() * 100) + 1;
            details = { value };
            if ((choice === 'higher' && value > 50) || (choice === 'lower' && value <= 50)) {
                result = 'win';
                payout = computePayout(mise, 1.95);
            }
        } else if (game === 'wheel') {
            const segment = Math.floor(Math.random() * 37);
            const color = segment === 0 ? 'green' : (segment % 2 === 0 ? 'red' : 'black');
            details = { segment, color };
            if (choice === color) {
                result = 'win';
                payout = computePayout(mise, color === 'green' ? 13 : 1.95);
            }
        } else if (game === 'keno') {
            const draw = Math.floor(Math.random() * 10) + 1;
            details = { draw };
            if (String(choice) === String(draw)) {
                result = 'win';
                payout = computePayout(mise, 9);
            }
        } else if (game === 'crash') {
            const target = Math.max(1.01, Math.min(parseFloat(target) || 1.01, 500));
            const crashRoll = Math.random();
            const crashPoint = 1 + (99 * Math.pow(crashRoll, 2));
            details = { crashPoint: Math.round(crashPoint * 100) / 100 };
            if (crashPoint >= target) {
                result = 'win';
                payout = Math.round(mise * target * 100) / 100;
            }
        } else {
            return res.status(400).json({ success: false, message: 'Jeu inconnu' });
        }

        const commission = Math.round((mise * COMMISSION_RATE) * 100) / 100;
        const effectivePayout = result === 'win' ? Math.max(0, payout - commission) : 0;
        const casinoProfit = mise - effectivePayout;

        await runAsync('UPDATE users SET balance = balance - ? + ? WHERE id = ?', [mise, effectivePayout, req.user.id]);
        await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [commission, 'samuelfleury1205@gmail.com']);
        await updateCasinoFunds(casinoProfit);
        await createBet(req.user.id, mise, game, result, effectivePayout, commission);

        const updatedUser = await getAsync('SELECT balance FROM users WHERE id = ?', [req.user.id]);
        res.json({ success: true, result, payout: effectivePayout, balance: updatedUser.balance, commission, details });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/user/bets', authenticate, async (req, res) => {
    try {
        const bets = await allAsync('SELECT * FROM bets WHERE userId = ? ORDER BY id DESC', [req.user.id]);
        res.json(bets);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admin/withdrawals', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const rows = await allAsync('SELECT * FROM withdrawals WHERE status = ?', ['pending']);
    res.json(rows);
});

app.get('/api/admin/deposits', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const rows = await allAsync('SELECT * FROM deposits WHERE status = ?', ['pending']);
    res.json(rows);
});

app.post('/api/admin/approve/deposit/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const deposit = await getAsync('SELECT * FROM deposits WHERE id = ?', [req.params.id]);
    if (!deposit) return res.status(404).json({ success: false, message: 'Dépôt introuvable' });
    const commission = deposit.commission || Math.round((deposit.amount * COMMISSION_RATE) * 100) / 100;
    const netAmount = Math.round((deposit.amount - commission) * 100) / 100;
    await runAsync('UPDATE deposits SET status = ? WHERE id = ?', ['approved', deposit.id]);
    await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [netAmount, deposit.userId]);
    await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [commission, 'samuelfleury1205@gmail.com']);
    res.json({ success: true, netAmount, commission });
});

app.post('/api/admin/approve/withdraw/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const wd = await getAsync('SELECT * FROM withdrawals WHERE id = ?', [req.params.id]);
    if (!wd) return res.status(404).json({ success: false, message: 'Retrait introuvable' });
    await runAsync('UPDATE withdrawals SET status = ? WHERE id = ?', ['approved', wd.id]);
    res.json({ success: true });
});

app.post('/api/admin/reject/deposit/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const deposit = await getAsync('SELECT * FROM deposits WHERE id = ?', [req.params.id]);
    if (!deposit) return res.status(404).json({ success: false, message: 'Dépôt introuvable' });
    await runAsync('UPDATE deposits SET status = ? WHERE id = ?', ['rejected', deposit.id]);
    res.json({ success: true });
});

app.post('/api/admin/reject/withdraw/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const wd = await getAsync('SELECT * FROM withdrawals WHERE id = ?', [req.params.id]);
    if (!wd) return res.status(404).json({ success: false, message: 'Retrait introuvable' });
    const commission = wd.commission || Math.round((wd.amount * COMMISSION_RATE) * 100) / 100;
    await runAsync('UPDATE withdrawals SET status = ? WHERE id = ?', ['rejected', wd.id]);
    await runAsync('UPDATE users SET balance = balance + ? WHERE id = ?', [wd.amount, wd.userId]);
    await runAsync('UPDATE users SET balance = balance - ? WHERE id = ?', [commission, 'samuelfleury1205@gmail.com']);
    res.json({ success: true });
});

app.get('/api/admin/stats', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const funds = await getAsync('SELECT * FROM casino_funds WHERE asset = ?', ['USD']);
    const totalBets = await getAsync('SELECT COALESCE(SUM(amount), 0) AS total FROM bets');
    const totalWins = await getAsync('SELECT COUNT(*) AS count FROM bets WHERE result = ?', ['win']);
    const totalLosses = await getAsync('SELECT COUNT(*) AS count FROM bets WHERE result = ?', ['lose']);
    const totalProfit = await getAsync('SELECT COALESCE(SUM(amount - payout), 0) AS profit FROM bets');
    const totalGameCommission = await getAsync('SELECT COALESCE(SUM(commission), 0) AS commission FROM bets');
    const totalDepositCommission = await getAsync('SELECT COALESCE(SUM(commission), 0) AS commission FROM deposits');
    const totalWithdrawCommission = await getAsync('SELECT COALESCE(SUM(commission), 0) AS commission FROM withdrawals');
    res.json({
        success: true,
        funds: funds ? funds.balance : 0,
        totalBets: totalBets.total,
        totalWins: totalWins.count,
        totalLosses: totalLosses.count,
        totalProfit: totalProfit.profit,
        totalGameCommission: totalGameCommission.commission,
        totalDepositCommission: totalDepositCommission.commission,
        totalWithdrawCommission: totalWithdrawCommission.commission,
        totalCommission: Math.round((totalGameCommission.commission + totalDepositCommission.commission + totalWithdrawCommission.commission) * 100) / 100
    });
});

app.get('/api/admin/all-users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Accès admin requis' });
    const users = await allAsync('SELECT id, balance, role FROM users');
    res.json(users);
});

app.get('/api/balance/:userId', async (req, res) => {
    const user = await getAsync('SELECT balance FROM users WHERE id = ?', [req.params.userId]);
    res.json({ balance: user ? user.balance : 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur lancé sur le port ${PORT}`));
