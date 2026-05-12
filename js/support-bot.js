// BuyDirectFromUSA — cute AI support bot
// Floating bubble bottom-left. Conversational flow: greet → category → details → match supplier_products → estimate → submit
// Backend pluggable: today uses local rule engine + supplier_products; later swap to Claude API via Edge Function.

import { supabase } from './supabase.js';
import { submitRequest } from './requests.js';

const BOT_NAME = 'Sonia';
const BOT_AVATAR = '🤖';

// Pricing formula (matches procurement form)
const SHIP_RATES = {
  'Nigeria': { perLb: 5, vehicle: 2000 },
  'Ghana': { perLb: 6, vehicle: 2200 },
  'Kenya': { perLb: 6, vehicle: 2400 },
  'South Africa': { perLb: 6, vehicle: 2400 },
  'UAE': { perLb: 4, vehicle: 1800 },
  'Saudi Arabia': { perLb: 4, vehicle: 1800 },
  'United Kingdom': { perLb: 4, vehicle: 1500 },
  'India': { perLb: 5, vehicle: 2200 },
  'Philippines': { perLb: 5, vehicle: 2300 },
  'Bangladesh': { perLb: 5, vehicle: 2300 },
};
const NY_TAX = 0.089;
const SERVICE_FEE = 0.10;
const SHIP_MIN = 65;

// Global air shipping rate (ShipStation-aligned international air, ex-Nigeria).
// Marginal per-lb cost for an average-size, non-oversized parcel:
//   $90 minimum (covers fixed carrier fees + handling)
//   0-40 lbs:  $9/lb marginal
//   40-50 lbs: linear blend $9 → $6/lb (mid-band, avg $7.50/lb)
//   50+ lbs:   $6/lb marginal
function globalAirShipping(lbs) {
  const w = Math.max(0, Number(lbs) || 0);
  let cost = 0;
  cost += Math.min(w, 40) * 9;
  if (w > 40) cost += Math.min(w - 40, 10) * 7.5;
  if (w > 50) cost += (w - 50) * 6;
  return Math.max(90, cost);
}

const state = {
  step: 'greet',          // greet → category → product → quantity → country → contact → review → submitted
  category: null,         // 'consumer' | 'vehicle' | 'parts' | 'other'
  product: null,          // {name, supplier?, price?, weight?}
  candidates: [],         // matched supplier_products for picking
  qty: 1,
  country: '',
  estimate: null,         // {listed, tax, fee, ship, total}
  contact: { name: '', email: '' },
  // Bot-control payload — sent server-side at submit time
  _hp: '',                          // honeypot: filled by bots, never by humans
  _formStarted: Date.now(),         // form-fill timestamp; submissions <5s rejected server-side
  _turnstile: '',                   // Cloudflare Turnstile token (optional, set if widget rendered)
};

const $ = (id) => document.getElementById(id);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };

// ---- UI ----
function injectUI() {
  if (document.getElementById('sonia-bot')) return;
  const root = document.createElement('div');
  root.id = 'sonia-bot';
  root.innerHTML = `
    <button id="sonia-toggle" aria-label="Open chat with ${BOT_NAME}" style="position:fixed;bottom:24px;left:24px;z-index:9998;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#0369a1);border:none;cursor:pointer;box-shadow:0 8px 24px rgba(2,132,199,0.4);transition:transform .2s;display:flex;align-items:center;justify-content:center;font-size:28px;">
      <span style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));">💬</span>
      <span id="sonia-badge" style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:white;font-size:11px;font-weight:bold;display:none;align-items:center;justify-content:center;font-family:system-ui;">!</span>
    </button>
    <div id="sonia-panel" style="position:fixed;bottom:96px;left:24px;z-index:9999;width:360px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 130px);background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.25);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="background:linear-gradient(135deg,#0ea5e9,#0369a1);padding:14px 16px;color:white;display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:20px;">${BOT_AVATAR}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;font-size:14px;line-height:1;">Hi, I'm ${BOT_NAME} 🇺🇸</div>
          <div style="font-size:11px;opacity:.85;margin-top:2px;">BuyDirectFromUSA sourcing assistant</div>
        </div>
        <button id="sonia-close" aria-label="Close" style="background:transparent;border:none;color:white;cursor:pointer;font-size:22px;line-height:1;padding:4px;">×</button>
      </div>
      <div id="sonia-msgs" style="flex:1;overflow-y:auto;padding:14px;background:linear-gradient(180deg,#f0f9ff 0%,#fafafa 100%);display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.45;color:#0f172a;"></div>
      <div id="sonia-quick" style="padding:0 14px 8px;display:flex;flex-wrap:wrap;gap:6px;background:linear-gradient(180deg,#fafafa 0%,white 100%);"></div>
      <div style="padding:10px 12px;border-top:1px solid #e2e8f0;background:white;display:flex;gap:8px;align-items:center;flex-shrink:0;">
        <input id="sonia-input" placeholder="Type a reply..." autocomplete="off" style="flex:1;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;font-size:14px;outline:none;font-family:inherit;">
        <button id="sonia-send" style="background:#0284c7;border:none;color:white;width:38px;height:38px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;">→</button>
      </div>
      <!-- Honeypot: hidden from humans, irresistible to bots. If filled, server rejects. -->
      <input id="sonia-hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;">
    </div>`;
  document.body.appendChild(root);

  $('sonia-toggle').addEventListener('click', () => {
    const open = $('sonia-panel').style.display === 'flex';
    $('sonia-panel').style.display = open ? 'none' : 'flex';
    $('sonia-badge').style.display = 'none';
    if (!open) {
      // Reset bot-control timer on every open — server rejects submissions <5s after this.
      state._formStarted = Date.now();
      if (state.step === 'greet') startGreeting();
    }
  });
  $('sonia-close').addEventListener('click', () => { $('sonia-panel').style.display = 'none'; });
  $('sonia-send').addEventListener('click', sendUserInput);
  $('sonia-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendUserInput(); } });
}

function botSay(html, opts = {}) {
  const c = $('sonia-msgs');
  const msg = document.createElement('div');
  msg.style.cssText = 'background:white;border:1px solid #e2e8f0;border-radius:14px;border-top-left-radius:4px;padding:10px 12px;max-width:85%;align-self:flex-start;box-shadow:0 1px 2px rgba(0,0,0,0.04);';
  msg.innerHTML = html;
  c.appendChild(msg);
  c.scrollTop = c.scrollHeight;
  if (opts.quickReplies) showQuickReplies(opts.quickReplies);
  else hideQuickReplies();
}

function userSay(text) {
  const c = $('sonia-msgs');
  const msg = document.createElement('div');
  msg.style.cssText = 'background:#0284c7;color:white;border-radius:14px;border-top-right-radius:4px;padding:10px 12px;max-width:85%;align-self:flex-end;';
  msg.textContent = text;
  c.appendChild(msg);
  c.scrollTop = c.scrollHeight;
  hideQuickReplies();
}

function showQuickReplies(opts) {
  const q = $('sonia-quick');
  q.innerHTML = opts.map(o => `<button class="sonia-qr" data-val="${esc(o.val)}" style="background:white;border:1.5px solid #0ea5e9;color:#0369a1;border-radius:18px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;font-family:inherit;">${esc(o.label)}</button>`).join('');
  q.querySelectorAll('.sonia-qr').forEach(b => b.addEventListener('click', () => handleInput(b.dataset.val, b.textContent)));
}
function hideQuickReplies() { $('sonia-quick').innerHTML = ''; }

function sendUserInput() {
  const v = $('sonia-input').value.trim();
  if (!v) return;
  $('sonia-input').value = '';
  handleInput(v, v);
}

// ---- Conversation engine ----
async function startGreeting() {
  state.step = 'category';
  await typingThen(() => {
    botSay(`Hey there! I'm <strong>Sonia</strong> 👋<br>I help you source U.S. products fast. What can I help you with today?`, {
      quickReplies: [
        { label: '📦 Consumer goods', val: 'consumer' },
        { label: '🚗 Vehicle', val: 'vehicle' },
        { label: '🔧 Auto parts', val: 'parts' },
        { label: '✨ Something else', val: 'other' },
      ]
    });
  });
}

async function handleInput(value, displayText) {
  userSay(displayText);
  await typingThen(() => routeStep(value));
}

async function routeStep(value) {
  const v = value.toLowerCase().trim();

  if (state.step === 'category') {
    state.category = v.includes('consumer') || v.includes('goods') || v.includes('item') ? 'consumer'
      : v.includes('vehicle') || v.includes('car') ? 'vehicle'
      : v.includes('parts') ? 'parts'
      : v.includes('other') || v.includes('something') ? 'other'
      : null;
    if (!state.category) {
      botSay(`Got it — let me make sure I understand. Are you looking for consumer goods (like electronics, beauty, food), a vehicle, auto parts, or something else?`, {
        quickReplies: [
          { label: 'Consumer goods', val: 'consumer' },
          { label: 'Vehicle', val: 'vehicle' },
          { label: 'Auto parts', val: 'parts' },
          { label: 'Other', val: 'other' },
        ]
      });
      return;
    }
    state.step = 'product';
    if (state.category === 'consumer') {
      botSay(`Nice — consumer goods. <strong>What product are you looking for?</strong> You can paste a product URL (Amazon, eBay, Walmart, etc.) or just describe it (e.g. "Olay Regenerist Whip 1.7oz" or "OSD Audio outdoor speakers").`);
    } else if (state.category === 'vehicle') {
      botSay(`Cool — a vehicle. Tell me <strong>make, model, year range</strong> (e.g. "Toyota Camry 2018-2022, used") and I'll get a sourcing pass started.`);
    } else if (state.category === 'parts') {
      botSay(`Auto parts — let's nail the fitment. Share <strong>part name + vehicle make/model/year</strong> (e.g. "front brake pads, 2019 Honda Accord"). VIN if you have it makes me lethal.`);
    } else {
      botSay(`Tell me what you need and I'll figure it out.`);
    }
    return;
  }

  if (state.step === 'product') {
    state.product = { name: value, url: '', price: 0, weight: 5 };
    if (/^https?:\/\//.test(value)) {
      state.product.url = value;
      botSay(`Got the link — let me look it up...`);
      const fetched = await fetchProductFromUrl(value);
      if (fetched && !fetched.error) {
        state.product.name = fetched.title || value;
        state.product.price = parseFloat(fetched.price) || 0;
        state.product.image = fetched.image;
        botSay(`Found it: <strong>${esc(state.product.name)}</strong>${state.product.image ? `<br><img src="${esc(state.product.image)}" style="max-width:160px;max-height:120px;border-radius:8px;margin-top:6px;">` : ''}${state.product.price ? `<br>Price on listing: $${state.product.price.toFixed(2)}` : '<br><em>(price not visible — we\'ll confirm at quote time)</em>'}`);
      } else {
        botSay(`Couldn't auto-fetch the page — that's OK, I'll source it manually after you submit.`);
      }
    } else {
      // 1) Match against our featured supplier_products
      const matches = await findCandidates(value);
      if (matches.length > 0) {
        state.candidates = matches;
        botSay(`I found ${matches.length} matching item${matches.length === 1 ? '' : 's'} from our vetted suppliers — pick one or I'll search the web:`, {
          quickReplies: [
            ...matches.slice(0, 3).map(m => ({ label: `${m.name.substring(0, 40)}${m.name.length > 40 ? '…' : ''}`, val: '__pick:' + m.id })),
            { label: '🌐 Search the web', val: '__web:' + value }
          ]
        });
        return;
      }
      // 2) No supplier match — search the web directly
      botSay(`Let me search the web for that...`);
      const webResults = await searchWeb(value);
      if (webResults.length > 0) {
        state.candidates = webResults.map(r => ({ id: '__url:' + r.url, name: r.title, image_url: '', price_range: '', supplier: { company_name: r.host }, url: r.url, snippet: r.snippet }));
        botSay(`Top hits across major U.S. retailers — pick one and I'll fetch its price:`, {
          quickReplies: [
            ...webResults.slice(0, 4).map(r => ({ label: `${r.host} · ${r.title.substring(0, 32)}${r.title.length > 32 ? '…' : ''}`, val: '__weburl:' + r.url })),
            { label: 'None — describe manually', val: '__skip-match' }
          ]
        });
        return;
      } else {
        botSay(`I couldn't find a clean web match — that's OK, I'll source it after you submit.`);
      }
    }
    askQuantity();
    return;
  }

  if (state.step === 'product' || (value.startsWith('__pick:') && state.candidates.length) || value.startsWith('__weburl:') || value.startsWith('__web:')) {
    if (value.startsWith('__pick:')) {
      const id = value.slice(7);
      const m = state.candidates.find(c => c.id === id);
      if (m) {
        state.product = {
          name: m.name,
          price: parsePrice(m.price_range),
          image: m.image_url,
          supplier: m.supplier?.company_name,
          weight: estimateWeight(m.name)
        };
        botSay(`<strong>${esc(m.name)}</strong> from <strong>${esc(m.supplier?.company_name || 'our network')}</strong>${m.image_url ? `<br><img src="${esc(m.image_url)}" style="max-width:160px;max-height:120px;border-radius:8px;margin-top:6px;">` : ''}${state.product.price ? `<br>Price: $${state.product.price.toFixed(2)}` : ''}`);
      }
      askQuantity();
      return;
    }
    if (value.startsWith('__web:')) {
      const q = value.slice(6);
      botSay(`Searching the web for "${esc(q)}"...`);
      const webResults = await searchWeb(q);
      if (webResults.length > 0) {
        state.candidates = webResults.map(r => ({ id: '__url:' + r.url, name: r.title, image_url: '', price_range: '', supplier: { company_name: r.host }, url: r.url, snippet: r.snippet }));
        botSay(`Top hits — pick one and I'll fetch its price:`, {
          quickReplies: [
            ...webResults.slice(0, 4).map(r => ({ label: `${r.host} · ${r.title.substring(0, 32)}${r.title.length > 32 ? '…' : ''}`, val: '__weburl:' + r.url })),
            { label: 'None — describe manually', val: '__skip-match' }
          ]
        });
      } else {
        botSay(`No web hits returned. I'll source it manually after you submit.`);
        askQuantity();
      }
      return;
    }
    if (value.startsWith('__weburl:')) {
      const url = value.slice(9);
      botSay(`Fetching listing details from <em>${esc(new URL(url).hostname.replace(/^www\./,''))}</em>...`);
      const fetched = await fetchProductFromUrl(url);
      if (fetched && !fetched.error) {
        state.product = {
          name: fetched.title || url,
          url,
          price: parseFloat(fetched.price) || 0,
          image: fetched.image,
          weight: estimateWeight(fetched.title || '')
        };
        botSay(`<strong>${esc(state.product.name)}</strong>${state.product.image ? `<br><img src="${esc(state.product.image)}" style="max-width:160px;max-height:120px;border-radius:8px;margin-top:6px;">` : ''}${state.product.price ? `<br>Price: $${state.product.price.toFixed(2)}` : '<br><em>(price not visible — we\'ll confirm at quote)</em>'}`);
      } else {
        state.product = { name: url, url, price: 0, weight: 5 };
        botSay(`Couldn't auto-fetch (${esc(fetched?.error || 'unknown')}) — saved the URL anyway, the team will quote it.`);
      }
      askQuantity();
      return;
    }
    if (value === '__skip-match') {
      botSay(`No worries — I'll source what you described.`);
      askQuantity();
      return;
    }
    askQuantity();
    return;
  }

  if (state.step === 'quantity') {
    const n = parseInt(value, 10);
    state.qty = isNaN(n) || n < 1 ? 1 : n;
    state.step = 'country';
    botSay(`Got it — <strong>${state.qty}</strong> unit${state.qty === 1 ? '' : 's'}. <strong>Where are we shipping?</strong>`, {
      quickReplies: [
        { label: '🇦🇪 UAE', val: 'UAE' },
        { label: '🇸🇦 Saudi', val: 'Saudi Arabia' },
        { label: '🇰🇪 Kenya', val: 'Kenya' },
        { label: '🇳🇬 Nigeria', val: 'Nigeria' },
        { label: '🇬🇭 Ghana', val: 'Ghana' },
        { label: 'Other', val: '__other-country' },
      ]
    });
    return;
  }

  if (state.step === 'country') {
    if (value === '__other-country') {
      botSay(`Type the destination country (we ship worldwide).`);
      return;
    }
    state.country = value.charAt(0).toUpperCase() + value.slice(1);
    state.step = 'estimate';
    showEstimate();
    return;
  }

  if (state.step === 'contact') {
    if (!state.contact.email) {
      // First contact answer — try to extract email
      const emailMatch = value.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (emailMatch) {
        state.contact.email = emailMatch[0];
        state.contact.name = value.replace(emailMatch[0], '').replace(/[<>,]/g, '').trim() || 'Customer';
        await submitToBackend();
      } else {
        botSay(`I just need your <strong>name and email</strong> so my human teammates can confirm and send the formal quote. Format: "Jane jane@example.com"`);
      }
      return;
    }
  }

  // Fallback
  botSay(`Got it. Anything else I can help with?`, {
    quickReplies: [{ label: 'Start a new request', val: '__restart' }]
  });
  if (value === '__restart') resetAndRestart();
}

function askQuantity() {
  state.step = 'quantity';
  botSay(`How many do you need?`, {
    quickReplies: [
      { label: '1', val: '1' },
      { label: '5', val: '5' },
      { label: '10', val: '10' },
      { label: '50', val: '50' },
      { label: '100+', val: '100' },
    ]
  });
}

function showEstimate() {
  const ship = SHIP_RATES[state.country];
  const p = state.product;
  const listed = (p?.price || 0) * state.qty;
  const weight = Math.max(2, p?.weight || 5) * state.qty;
  const tax = listed * NY_TAX;
  const fee = listed * SERVICE_FEE;
  let shipCost = null;
  if (ship?.perLb != null) {
    if (state.country === 'Nigeria') shipCost = Math.max(SHIP_MIN, weight * ship.perLb);
    else shipCost = globalAirShipping(weight);
  }
  state.estimate = { listed, weight, tax, fee, shipCost, total: shipCost == null ? null : listed + tax + fee + shipCost };

  if (!listed) {
    botSay(`I don't have a live price for this item yet, so I can't run the math right now. <strong>My human teammates will confirm pricing and send the formal quote within 24 hours.</strong>`);
    askContact();
    return;
  }

  const fmt = (n) => '$' + Number(n).toFixed(2);
  let msg = `Here's a quick estimate to <strong>${esc(state.country)}</strong>:<br><br>`;
  msg += `• Listed: ${fmt(listed)} (qty ${state.qty})<br>`;
  msg += `• NY tax: ${fmt(tax)}<br>`;
  msg += `• Service fee: ${fmt(fee)}<br>`;
  msg += `• Shipping: ${shipCost == null ? '<em>TBA</em>' : fmt(shipCost)}<br>`;
  msg += `<br><strong>Total: ${state.estimate.total == null ? 'Will quote' : fmt(state.estimate.total)}</strong><br><br>`;
  msg += `Want me to lock this in? I'll need your name and email.`;
  botSay(msg, { quickReplies: [{ label: 'Yes, send it', val: '__send' }, { label: 'Adjust quantity', val: '__adjust-qty' }] });
  state.step = 'estimate-decision';
}

async function routeEstimateDecision(v) {
  if (v === '__adjust-qty') { askQuantity(); return; }
  if (v === '__send' || v.toLowerCase().includes('yes') || v.toLowerCase().includes('send')) {
    askContact();
    return;
  }
  botSay(`No problem. Let me know if you change your mind.`);
}

function askContact() {
  state.step = 'contact';
  botSay(`Awesome. Just give me your <strong>name and email</strong>. Format: "Jane jane@example.com"`);
}

async function submitToBackend() {
  const p = state.product;
  const r = state.estimate || {};
  const fmt = (n) => '$' + Number(n).toFixed(2);
  const result = await submitRequest({
    clientName: state.contact.name,
    clientEmail: state.contact.email,
    productNeeded: (p?.name || 'Sourcing request').substring(0, 200),
    requestType: 'custom',
    targetCountry: state.country,
    quantity: String(state.qty),
    specialNotes: [
      `Submitted via Sonia chat bot`,
      p?.url ? `URL: ${p.url}` : '',
      p?.supplier ? `Suggested supplier: ${p.supplier}` : '',
      r.total ? `Bot estimate: listed ${fmt(r.listed)} + tax ${fmt(r.tax)} + fee ${fmt(r.fee)} + ship ${r.shipCost == null ? 'TBA' : fmt(r.shipCost)} = ${fmt(r.total)}` : 'No bot estimate (price unknown)',
    ].filter(Boolean).join('\n\n'),
    dynamicData: { channel: 'sonia-chat', product: p, estimate: r },
    // Bot-control payload — read by submit-deal-protected edge function
    _meta: {
      hp: (document.getElementById('sonia-hp')?.value || '').trim(),
      formStarted: state._formStarted,
      turnstile: state._turnstile || (window.turnstile && window.turnstileToken) || '',
    }
  });
  if (result.error) {
    botSay(`Hmm, something didn't go through: ${esc(result.error)}. Try again or use the form on the homepage.`);
  } else {
    state.step = 'submitted';
    botSay(`✅ <strong>Done!</strong> I sent your request to the team. You'll get a confirmation email at <strong>${esc(state.contact.email)}</strong>. Expect a quote within 24 hours.<br><br>Anything else?`, {
      quickReplies: [{ label: 'New request', val: '__restart' }, { label: 'Done for now', val: '__done' }]
    });
  }
}

function resetAndRestart() {
  Object.assign(state, { step: 'greet', category: null, product: null, candidates: [], qty: 1, country: '', estimate: null, contact: { name: '', email: '' } });
  startGreeting();
}

// ---- Helpers ----
function typingThen(fn) {
  return new Promise((resolve) => {
    const c = $('sonia-msgs');
    const t = document.createElement('div');
    t.style.cssText = 'background:white;border:1px solid #e2e8f0;border-radius:14px;border-top-left-radius:4px;padding:10px 14px;max-width:85%;align-self:flex-start;font-size:18px;letter-spacing:2px;color:#94a3b8;';
    t.textContent = '•••';
    c.appendChild(t);
    c.scrollTop = c.scrollHeight;
    setTimeout(() => { t.remove(); fn(); resolve(); }, 600);
  });
}

async function fetchProductFromUrl(url) {
  try {
    const r = await fetch('https://zffevasaeaogjxuslhtw.supabase.co/functions/v1/fetch-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': 'sb_publishable_RT45PjUDX9CmFFgjrazm4w_hWnrcrMg', 'Authorization': 'Bearer sb_publishable_RT45PjUDX9CmFFgjrazm4w_hWnrcrMg' },
      body: JSON.stringify({ url })
    });
    return await r.json();
  } catch (e) { return { error: e.message }; }
}

async function findCandidates(query) {
  const { data } = await supabase.from('supplier_products')
    .select('id, name, image_url, price_range, supplier:suppliers(company_name)')
    .eq('featured', true).eq('status', 'active')
    .or(`name.ilike.%${query.replace(/[%_]/g, '')}%,description.ilike.%${query.replace(/[%_]/g, '')}%`)
    .limit(3);
  return data || [];
}

async function searchWeb(query) {
  try {
    const r = await fetch('https://zffevasaeaogjxuslhtw.supabase.co/functions/v1/search-products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': 'sb_publishable_RT45PjUDX9CmFFgjrazm4w_hWnrcrMg', 'Authorization': 'Bearer sb_publishable_RT45PjUDX9CmFFgjrazm4w_hWnrcrMg' },
      body: JSON.stringify({ q: query })
    });
    const data = await r.json();
    return data.results || [];
  } catch (e) { return []; }
}

function parsePrice(s) {
  if (!s) return 0;
  const m = String(s).replace(/[^0-9.]/g, '').match(/^\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

const WEIGHTS = { speaker: 25, subwoofer: 60, amplifier: 15, mount: 6, truss: 36, generator: 80, phone: 1, laptop: 6, tv: 35 };
function estimateWeight(name) {
  const n = (name || '').toLowerCase();
  for (const k of Object.keys(WEIGHTS)) if (n.includes(k)) return WEIGHTS[k];
  return 5;
}

// Override route handler for estimate-decision step
const origRoute = routeStep;
function patchedRoute(value) {
  if (state.step === 'estimate-decision') return routeEstimateDecision(value);
  return origRoute(value);
}
// Re-bind handleInput to use patched router
async function patchedHandleInput(value, displayText) {
  userSay(displayText);
  await typingThen(() => patchedRoute(value));
}

// Init
injectUI();
// Replace handleInput in event listeners by re-wiring
$('sonia-send').onclick = () => {
  const v = $('sonia-input').value.trim();
  if (!v) return;
  $('sonia-input').value = '';
  patchedHandleInput(v, v);
};
$('sonia-input').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); $('sonia-send').click(); } };
// Re-wire quick replies
const origShowQR = showQuickReplies;
window.__soniaQrClick = (val, label) => patchedHandleInput(val, label);
showQuickReplies = function(opts) {
  const q = $('sonia-quick');
  q.innerHTML = opts.map(o => `<button class="sonia-qr" data-val="${esc(o.val)}" style="background:white;border:1.5px solid #0ea5e9;color:#0369a1;border-radius:18px;padding:6px 12px;font-size:12px;cursor:pointer;font-weight:600;font-family:inherit;">${esc(o.label)}</button>`).join('');
  q.querySelectorAll('.sonia-qr').forEach(b => b.addEventListener('click', () => patchedHandleInput(b.dataset.val, b.textContent)));
};

// Show badge after 3s on first load to invite the user to chat
setTimeout(() => {
  if ($('sonia-panel').style.display !== 'flex') $('sonia-badge').style.display = 'flex';
}, 3000);
