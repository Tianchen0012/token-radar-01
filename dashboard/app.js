// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail panel with the
// model's own arithmetic and the protocol's farm plan, and a separate live-token view.
// No network: every byte it shows is in data.js. Deep links: #detail=<slug>,
// #cat=<category>, #chain=<chain>, #q=<text>, #watchlist=1, #live=1.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var state = { q: '', cat: 'all', chain: 'all', watch: false, tab: 'board',
    sort: 'implied_value_usd', dir: -1, selected: null };

  var $ = function (id) { return document.getElementById(id); };
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + Number(n).toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  var wl = {};
  (DATA.watchlist || []).forEach(function (s) { wl[s] = true; });

  // ---- header, model card, footer ----
  $('meta').textContent = 'Snapshot ' + DATA.as_of + ' · ' + DATA.rows.length + ' pre-token protocols ranked · ' +
    DATA.watchlist_size + ' on the watchlist · ' + DATA.live_size + ' live tokens set aside · source: ' + DATA.source;
  $('model-card').innerHTML =
    '<h2>How the value model works — model ' + esc(DATA.model_version) + '</h2>' +
    '<p class="formula"><code>' + esc(DATA.formula) + '</code></p>' +
    '<p>TVL is the base: a launch is priced off the value already locked in the protocol. ' +
    'The category multiple says how much of that TVL a launch turns into token value — trading venues and lending markets (0.35–0.40) convert more than bridges (0.12–0.15), which mostly move other people\'s assets. ' +
    'Seven-day TVL growth, clamped to −50%…+150%, moves the value by up to ±0.6× its weight, so a hot week helps but never dominates. ' +
    'Age is a hump, not a slope: 0.85 for listings under 90 days, rising to 1.15 near two years, easing back to 0.80 after four — a launch is most valuable once a protocol has built users, and less likely the longer it has gone without one. ' +
    'Each chain adds 2% (up to 10%) for wider distribution. Every number comes from the snapshot alone; no protocol name is ever special-cased.</p>' +
    '<p>“Pre-token” means the snapshot records no token for the protocol — no market cap, no CoinGecko id, no symbol. ' +
    'That is the record, not proof: a protocol may still have a token its record does not carry. Centralised exchanges, versioned pools and wrapped or staked products of tokens that already trade are not ranked. ' +
    'Protocols whose token already trades sit in the Live tokens tab at the market\'s own value, never ranked by implied value.</p>';
  $('foot').textContent = 'Token Radar, model ' + DATA.model_version + '. Implied values are this entry\'s own claim, never make.fun\'s. ' +
    'Data: DefiLlama protocols snapshot of ' + DATA.as_of + ' (' + DATA.source + '). ' +
    'Nothing here is financial advice; a farm plan\'s costs are the model\'s estimates from the snapshot, not quoted fees.';

  // ---- filter controls ----
  function fillSelect(el, values) {
    values.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }
  var cats = [], chains = [];
  DATA.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  fillSelect($('cat'), cats);
  fillSelect($('chain'), chains);

  // ---- filtering and sorting ----
  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.watch && !wl[r.slug]) return false;
      if (state.cat !== 'all' && r.category !== state.cat) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort, dir = state.dir;
    rows.sort(function (a, b) {
      var x = a[key], y = b[key];
      if (x === null || x === undefined) x = -Infinity;
      if (y === null || y === undefined) y = -Infinity;
      if (typeof x === 'string') return dir * (x < y ? -1 : x > y ? 1 : 0);
      return dir * (x - y);
    });
    return rows;
  }

  function renderBoard() {
    var rows = visibleRows();
    var tb = $('rows');
    tb.innerHTML = '';
    if (!rows.length) {
      tb.innerHTML = '<tr><td colspan="8" class="empty">No protocol matches these filters.</td></tr>';
    }
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.selected === r.slug) tr.className = 'sel';
      var g = r.change_7d;
      tr.innerHTML =
        '<td>' + r.rank + '</td>' +
        '<td><span class="nm">' + esc(r.name) + '</span><br><span class="sl">' + esc(r.slug) + '</span> ' +
          (wl[r.slug] ? '<span class="pill wl">watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join(' ') +
          (r.chains.length > 3 ? ' <span class="pill">+' + (r.chains.length - 3) + '</span>' : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + fmtPct(g) + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><span class="vl">' + fmtUsd(r.implied_value_usd) + '</span></td>';
      tr.addEventListener('click', function () { select(r.slug, true); });
      tb.appendChild(tr);
    });
    $('count').textContent = rows.length + ' of ' + DATA.rows.length + ' shown';
    $('hint').textContent = 'Click a row for the detail view: the model\'s arithmetic for that protocol and its farm plan. Click a column header to sort.';
  }

  function renderLive() {
    var tb = $('rows');
    tb.innerHTML = '';
    DATA.live.forEach(function (r) {
      var tr = document.createElement('tr');
      var g = r.change_7d;
      tr.innerHTML =
        '<td>—</td>' +
        '<td><span class="nm">' + esc(r.name) + '</span><br><span class="sl">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + r.chains.slice(0, 3).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join(' ') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num ' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + fmtPct(g) + '</td>' +
        '<td class="num">trades</td>' +
        '<td class="num"><span class="vl">' + fmtUsd(r.mcap_usd) + '</span></td>';
      tr.addEventListener('click', function () { selectLive(r.slug); });
      tb.appendChild(tr);
    });
    $('count').textContent = DATA.live.length + ' live tokens — market value, not implied value';
    $('hint').textContent = 'These protocols already trade. Their market cap is the market\'s own value; they are never ranked by implied value.';
  }

  // ---- detail panel ----
  function select(slug, fromClick) {
    state.selected = slug;
    var r = null;
    DATA.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    renderBoard();
    var d = $('detail');
    var steps = (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    d.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + '</h2>' +
      '<p class="sub2">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + r.chains.map(esc).join(', ') + '</p>' +
      '<dl class="kv">' +
      '<dt>Implied value</dt><dd class="big">' + fmtUsd(r.implied_value_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + fmtPct(r.change_7d) + '</dd>' +
      '<dt>Listed with no token</dt><dd>' + fmtAge(r.age_days) + (r.listed_at ? ' (since ' + esc(r.listed_at) + ')' : '') + '</dd>' +
      '<dt>Snapshot</dt><dd>' + esc(DATA.as_of) + '</dd></dl>' +
      '<div class="math"><b>How the value was computed</b><br>' +
      'TVL ' + fmtUsd(r.tvl_usd) + ' × category ' + r.category_multiple.toFixed(2) + ' = base ' + fmtUsd(r.base_usd) + '<br>' +
      '× growth ' + r.growth_multiplier.toFixed(2) + ' (7d ' + fmtPct(r.change_7d) + ') × age ' + r.age_factor.toFixed(2) +
      ' (' + fmtAge(r.age_days) + ') × chains ' + r.chain_multiplier.toFixed(2) + ' (' + r.chains.length + ' chains)<br>' +
      '= <code>' + fmtUsd(r.implied_value_usd) + '</code> implied launch value.</div>' +
      '<h3>How to farm it — 5 steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="sub2">Costs and times are the model\'s estimates from the snapshot (capital tier from TVL, hold from age). ' +
      'Never pay a fee to claim; claim only from the link the protocol itself publishes.</p>';
    // Only scroll when the reader clicked a row; the first load keeps the header,
    // the model card and the toolbar in view for the board screenshot.
    if (fromClick) d.scrollIntoView({ block: 'nearest' });
  }

  function selectLive(slug) {
    var r = null;
    DATA.live.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    $('detail').innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="sub2">' + esc(r.slug) + ' · ' + esc(r.category || 'no category') + ' · ' + r.chains.map(esc).join(', ') + '</p>' +
      '<dl class="kv">' +
      '<dt>Market cap</dt><dd class="big">' + fmtUsd(r.mcap_usd) + '</dd>' +
      '<dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd>' +
      '<dt>7-day TVL change</dt><dd>' + fmtPct(r.change_7d) + '</dd></dl>' +
      '<p class="sub2">This protocol\'s token already trades, so there is no implied value and no farm plan for a launch that has already happened. ' +
      'It is shown here so the board\'s pre-token ranking is never mixed up with the market\'s own values.</p>';
  }

  // ---- tabs, controls, sorting ----
  function setTab(tab) {
    state.tab = tab;
    $('tab-board').className = 'tab' + (tab === 'board' ? ' on' : '');
    $('tab-live').className = 'tab' + (tab === 'live' ? ' on' : '');
    $('toolbar').style.display = tab === 'board' ? '' : 'none';
    var lastTh = document.querySelector('#board thead th[data-sort="implied_value_usd"]');
    if (lastTh) lastTh.textContent = tab === 'live' ? 'Market cap' : 'Implied value';
    if (tab === 'board') renderBoard(); else renderLive();
    if (tab === 'board' && !state.selected) {
      $('detail').innerHTML = '<h2>Pick a protocol</h2><p class="sub2">Click any row to see its model arithmetic and its farm plan.</p>';
    }
  }
  $('tab-board').addEventListener('click', function () { setTab('board'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });

  $('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; renderBoard(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; renderBoard(); });

  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      if (state.tab === 'live') return;
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'name' || key === 'category' || key === 'chains' ? 1 : -1; }
      renderBoard();
    });
  });

  // ---- deep links from the URL hash, for screenshots and sharing ----
  function readHash() {
    var h = {};
    (location.hash || '').replace(/^#/, '').split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) h[kv[0]] = decodeURIComponent(kv[1] || '');
    });
    return h;
  }
  var hash = readHash();
  if (hash.q) { state.q = hash.q; $('q').value = hash.q; }
  if (hash.cat && cats.indexOf(hash.cat) >= 0) { state.cat = hash.cat; $('cat').value = hash.cat; }
  if (hash.chain && chains.indexOf(hash.chain) >= 0) { state.chain = hash.chain; $('chain').value = hash.chain; }
  if (hash.watchlist === '1') { state.watch = true; $('watch').checked = true; }
  if (hash.live === '1') setTab('live'); else setTab('board');
  if (hash.detail) select(hash.detail, true);
  else if (state.tab === 'board' && DATA.rows.length) select(DATA.rows[0].slug);
})();
