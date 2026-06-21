// ============================================================================
// Self-contained HTML dashboard for the actuator.
//
// Zero dependencies, zero build step: a single static HTML document with inline
// CSS + JS. It calls the actuator's own JSON endpoints (relative to the page
// URL) and renders health, info, and metrics with a small auto-refresh loop.
// Served at `<basePath>/dashboard`.
// ============================================================================

export function renderDashboard(basePath: string): string {
  // basePath is the actuator mount point, e.g. '/actuator'. The dashboard lives
  // at `<basePath>/dashboard`, so endpoints are one level up.
  const base = JSON.stringify(basePath);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Actuator Dashboard</title>
<style>
  :root {
    --bg: #0d1117; --panel: #161b22; --border: #30363d; --text: #e6edf3;
    --muted: #8b949e; --up: #2ea043; --down: #da3633; --warn: #d29922; --accent: #58a6ff;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text); }
  header { display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px; border-bottom: 1px solid var(--border); }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .meta { color: var(--muted); font-size: 12px; }
  main { padding: 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px; max-width: 1200px; margin: 0 auto; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted);
    margin: 0 0 12px; }
  .status { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 18px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); }
  .dot.UP { background: var(--up); } .dot.DOWN, .dot.OUT_OF_SERVICE { background: var(--down); }
  .dot.UNKNOWN { background: var(--warn); }
  .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border); }
  .row:last-child { border-bottom: 0; }
  .row .k { color: var(--muted); } .row .v { font-variant-numeric: tabular-nums; }
  .comp { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-top: 4px; }
  .bar > span { display: block; height: 100%; background: var(--accent); }
  a { color: var(--accent); text-decoration: none; } a:hover { text-decoration: underline; }
  .links { display: flex; flex-wrap: wrap; gap: 8px; }
  .links a { background: #21262d; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
  .err { color: var(--down); font-size: 12px; }
  footer { text-align: center; color: var(--muted); font-size: 11px; padding: 16px; }
</style>
</head>
<body>
<header>
  <h1>⚙️ Actuator Dashboard</h1>
  <span class="meta" id="meta">loading…</span>
</header>
<main>
  <section class="card"><h2>Health</h2><div id="health">…</div></section>
  <section class="card"><h2>Info</h2><div id="info">…</div></section>
  <section class="card"><h2>Memory</h2><div id="memory">…</div></section>
  <section class="card"><h2>Process</h2><div id="process">…</div></section>
  <section class="card"><h2>Endpoints</h2><div class="links" id="links">…</div></section>
</main>
<footer>node-actuator-lite · auto-refreshes every 5s</footer>
<script>
(function () {
  var BASE = ${base};
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function row(k, v) { return '<div class="row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }
  function bytes(n) {
    if (n == null) return '–';
    var u = ['B', 'KB', 'MB', 'GB']; var i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return n.toFixed(1) + ' ' + u[i];
  }
  function dur(s) {
    if (s == null) return '–';
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60);
    return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm';
  }
  function fetchJSON(path) {
    return fetch(BASE + path, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  function renderHealth(h) {
    if (!h) { el('health').innerHTML = '<span class="err">unavailable</span>'; return; }
    var html = '<div class="status"><span class="dot ' + esc(h.status) + '"></span>' + esc(h.status) + '</div>';
    var comps = h.components || h.details || {};
    Object.keys(comps).forEach(function (name) {
      var c = comps[name] || {};
      html += '<div class="comp"><span class="dot ' + esc(c.status || 'UNKNOWN') + '"></span>' + esc(name) + '</div>';
    });
    el('health').innerHTML = html;
  }
  function renderInfo(i) {
    if (!i) { el('info').innerHTML = '<span class="err">unavailable</span>'; return; }
    var r = i.runtime || {}, b = i.build || {};
    var html = '';
    if (b.name) html += row('app', b.name + (b.version ? ' v' + b.version : ''));
    html += row('node', r.nodeVersion || '–');
    html += row('platform', (r.platform || '') + '/' + (r.arch || ''));
    html += row('pid', r.pid != null ? r.pid : '–');
    html += row('uptime', dur(r.uptime));
    el('info').innerHTML = html;
  }
  function renderMetrics(m) {
    if (!m || !m.process) { el('memory').innerHTML = el('process').innerHTML = '<span class="err">unavailable</span>'; return; }
    var mem = m.process.memory || {};
    var used = mem.heapUsed || 0, total = mem.heapTotal || 1;
    var pct = Math.min(100, (used / total) * 100);
    el('memory').innerHTML =
      row('heap used', bytes(used)) + row('heap total', bytes(total)) +
      row('rss', bytes(mem.rss)) + row('external', bytes(mem.external)) +
      '<div class="bar"><span style="width:' + pct.toFixed(0) + '%"></span></div>';
    var cpu = m.process.cpu || {};
    el('process').innerHTML =
      row('uptime', dur(m.process.uptime)) +
      row('cpu user', ((cpu.user || 0) / 1000).toFixed(0) + ' ms') +
      row('cpu system', ((cpu.system || 0) / 1000).toFixed(0) + ' ms');
  }
  function renderLinks(d) {
    if (!d || !d._links) { el('links').innerHTML = '<span class="err">unavailable</span>'; return; }
    var html = '';
    Object.keys(d._links).forEach(function (k) {
      var href = d._links[k].href;
      if (d._links[k].templated) return;
      html += '<a href="' + esc(href) + '">' + esc(k) + '</a>';
    });
    el('links').innerHTML = html || '<span class="k">none</span>';
  }

  function refresh() {
    Promise.all([
      fetchJSON('/health'), fetchJSON('/info'),
      fetchJSON('/metrics'), fetchJSON('/'),
    ]).then(function (res) {
      renderHealth(res[0]); renderInfo(res[1]);
      renderMetrics(res[2]); renderLinks(res[3]);
      el('meta').textContent = 'updated ' + new Date().toLocaleTimeString();
    });
  }
  refresh();
  setInterval(refresh, 5000);
})();
</script>
</body>
</html>`;
}
