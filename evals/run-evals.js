#!/usr/bin/env node
/* Groww for GenZ: eval harness.
   Usage:  npm i jsdom  &&  node run-evals.js path/to/groww-genz.html
   Loads the real app in jsdom and drives it through the UI the way a user would. */
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, 'groww-genz.html'));
const HTML = fs.readFileSync(FILE, 'utf8');
const CSS = (HTML.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1].replace(/\/\*[\s\S]*?\*\//g, '');
const results = [], info = [];
const check = (group, name, pass, detail = '') => results.push({ group, name, pass: !!pass, detail: String(detail || '') });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function boot() {
  const errors = [], noise = [], vc = new VirtualConsole();
  const rec = m => { const s = String((m && (m.stack || m.message)) || m).split('\n')[0]; (/Could not parse CSS stylesheet|Not implemented/.test(s) ? noise : errors).push(s); };
  vc.on('error', rec); vc.on('jsdomError', rec);
  const dom = new JSDOM(HTML, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, url: 'https://prototype.test/',
    beforeParse(w) { w.__FAST = true; w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.HTMLCanvasElement.prototype.getContext = () => null; w.scrollTo = () => {}; } });
  const w = dom.window, d = w.document;
  const E = { w, d, A: w.__app, errors, noise };
  const sel = (a, attrs) => `[data-act="${a}"]` + Object.entries(attrs || {}).map(([k, v]) => `[data-${k}="${v}"]`).join('');
  E.$ = s => d.querySelector(s); E.$$ = s => Array.from(d.querySelectorAll(s));
  E.has = (a, attrs) => !!d.querySelector(sel(a, attrs));
  E.act = (a, attrs) => { const el = d.querySelector(sel(a, attrs)); if (!el) throw new Error(`missing ${sel(a, attrs)} on route ${w.__app.S.route}`); el.click(); return el; };
  E.input = (s, v) => { const el = d.querySelector(s); if (!el) throw new Error('missing ' + s); el.value = String(v); el.dispatchEvent(new w.Event('input', { bubbles: true })); return el; };
  E.text = (s = '#view') => { const n = d.querySelector(s); if (!n) return ''; const c = n.cloneNode(true); c.querySelectorAll('[data-quote]').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
  E.S = () => w.__app.S;
  return E;
}
async function onboard(E, { name = 'Riya', persona = 'student', band = 's1', monthly = null, goals = ['trip', 'future'], vibe = 'wait' } = {}) {
  E.act('ob-start'); E.input('[data-in="ob-name"]', name); E.act('ob-persona', { v: persona }); E.act('ob-next');
  E.act('ob-band', { v: band }); if (monthly != null) E.input('[data-in="ob-amt"]', monthly); E.act('ob-next');
  for (const g of goals) E.act('ob-goal', { v: g }); E.act('ob-next'); E.act('ob-vibe', { v: vibe }); E.act('ob-next');
}
async function start(E) { E.act('plan-start'); E.act('upi-approve'); await sleep(15); }
const sumSip = G => G.reduce((s, g) => s + g.sip, 0), sumInv = G => G.reduce((s, g) => s + g.invested, 0);

/* ---- readability helpers ---- */
function syllables(w) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); }
const sentences = t => t.split(/(?<=[.!?…])\s+/).map(s => s.trim()).filter(Boolean);
const words = t => t.split(/\s+/).filter(x => /[A-Za-z0-9₹]/.test(x));
function flesch(t) { const S = sentences(t).length || 1, W = words(t), syl = W.reduce((s, w) => s + (/[a-z]/i.test(w) ? syllables(w) : 1), 0);
  return 206.835 - 1.015 * (W.length / S) - 84.6 * (syl / Math.max(1, W.length)); }
const maxWords = t => Math.max(0, ...sentences(t).map(s => words(s).length));

/* ---- contrast helpers ---- */
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function tokens(dark) { const grab = re => { const m = CSS.match(re); const t = {}; if (m) for (const x of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) t[x[1]] = x[2]; return t; };
  const light = grab(/:root\{([^}]*)\}/); return dark ? Object.assign({}, light, grab(/:root\[data-theme="dark"\]\{([^}]*)\}/)) : light; }

(async () => {
  /* ===================== Functional: first-time user, end to end ===================== */
  { const E = boot();
    check('Functional', 'App boots to the welcome screen', E.S().route === 'welcome' && E.$('.hero'));
    E.act('ob-start');
    check('Functional', 'Onboarding keeps Continue disabled until a choice is made', E.$('[data-act="ob-next"]').disabled === true);
    E.act('ob-persona', { v: 'student' });
    check('Functional', 'Choosing a situation enables Continue', E.$('[data-act="ob-next"]').disabled === false);
    E.act('ob-next'); E.act('ob-band', { v: 's2' });
    check('Functional', 'Suggested amount is 10% of the band midpoint for students', E.S().ob.monthly === 1000, E.S().ob.monthly);
    E.input('[data-in="ob-amt"]', 2500);
    check('Functional', 'Comfort label reacts live to the amount slider', /A stretch/.test(E.text('#ob-comfort')), E.text('#ob-comfort'));
    E.act('ob-next'); for (const g of ['trip', 'studies', 'future']) E.act('ob-goal', { v: g }); E.act('ob-next'); E.act('ob-vibe', { v: 'wait' }); E.act('ob-next');
    const G = E.S().goals, by = t => G.find(g => g.type === t);
    check('Functional', 'Plan screen shows one row per goal', E.S().route === 'plan' && E.$$('.prow').length === 3);
    check('Functional', 'Buckets follow the horizon: trip Safe, studies Balanced, Future me Growth', by('trip').bucket === 'safe' && by('studies').bucket === 'balanced' && by('future').bucket === 'growth');
    E.act('plan-edit', { id: by('trip').id }); E.input('[data-in="ge-months"]', 60); E.act('ge-save');
    check('Functional', 'Editing a goal to 60 months moves it to Growth and re-splits the money', by('trip').bucket === 'growth' && sumSip(G) === 2500);
    E.act('plan-edit', { id: by('trip').id }); E.input('[data-in="ge-months"]', 8); E.act('ge-save');
    await start(E);
    check('Functional', 'UPI approval lands on the success screen', E.S().route === 'success' && E.S().started);
    check('Functional', 'First instalment is invested on day one and the streak starts at 1', sumInv(G) === 2500 && E.S().streak === 1, `${sumInv(G)} / ${E.S().streak}`);
    E.act('to-home');
    check('Functional', 'Home lists every goal, with the tab bar visible', E.$$('.goal').length === 3 && !E.$('#tabbar').hidden);
    check('Guardrails', 'Calm view is on by default and hides the daily change', E.S().calm && !/Today [+−]/.test(E.text()));
    E.act('calm'); check('Functional', 'Turning Calm view off shows the daily change', /Today [+−]/.test(E.text())); E.act('calm');
    const before = sumInv(G); E.act('demo-payday'); E.act('open-payday'); E.input('[data-in="pd"]', 20);
    const shown = +E.text('#pd-amt').replace(/[^\d]/g, ''); E.act('pd-invest');
    check('Functional', 'Payday invests exactly the amount shown, split across goals', sumInv(G) - before === shown && shown === 2000, `shown ${shown}, added ${sumInv(G) - before}`);
    const inv0 = sumInv(G), st0 = E.S().streak, sip = G.filter(g => !g.paused).reduce((s, g) => s + g.sip, 0);
    E.act('demo-ff');
    check('Functional', 'Fast-forward adds six instalments and six streak months', sumInv(G) - inv0 === sip * 6 && E.S().streak === st0 + 6, `${sumInv(G) - inv0} vs ${sip * 6}`);
    check('Functional', 'No console errors during the first-time flow', E.errors.length === 0, E.errors.slice(0, 3).join(' | '));
    if (E.noise.length) info.push(`jsdom environment notices (not app errors): ${[...new Set(E.noise)].join('; ')}`);
  }

  /* ===================== Functional + guardrails: returning user ===================== */
  { const E = boot(); E.act('demo-sample'); const S = E.S(), G = S.goals;
    check('Functional', 'Sample user loads with goals and a 3-month streak', S.started && S.user.name === 'Arjun' && G.length === 3 && S.streak === 3);
    E.act('demo-dip');
    check('Guardrails', 'A market dip shows a calm card on Home, not an alarm', E.has('open-dip') && /plan hasn.t changed/i.test(E.text()));
    E.act('open-dip');
    check('Functional', 'Dip screen explains each goal and gives the 2020 history check', E.S().route === 'dip' && E.$$('.drow').length === G.length && /2020/.test(E.text()) && /more units/.test(E.text()));
    E.act('dip-pause'); const pick = E.$('[data-act="pp-pick"]'), gid = pick.dataset.id; pick.click();
    check('Guardrails', 'Pausing shows one honest screen before anything changes', /buys more units/.test(E.text('#sheet-root')) && !G.find(g => g.id === gid).paused);
    E.act('pause-1', { id: gid });
    check('Guardrails', 'After that screen, pausing works (the user keeps control)', G.find(g => g.id === gid).paused === true);
    E.act('dip-keep'); check('Functional', '"Keep my plan going" returns to Home', E.S().route === 'home'); E.act('demo-dip');
    G.forEach(g => { g.paused = false; g.pauseLeft = 0; });
    let ok = true; for (const g of G) { E.A.go('goal', { id: g.id }); E.act('sip-pause', { id: g.id }); E.act('pause-x', { id: g.id }); if (!g.paused) ok = false; E.act('sip-resume', { id: g.id }); if (g.paused) ok = false; }
    check('Guardrails', 'Every SIP can be paused and resumed', ok);
    // learning
    E.act('tab', { tab: 'learn' }); const xp0 = E.S().xp;
    E.act('open-lesson', { id: 'sip' }); for (let i = 0; i < 4; i++) E.act('story-next'); E.act('story-answer', { k: 0 });
    check('Functional', 'A byte answered right gives 30 XP (10 for finishing, 20 for correct)', E.S().xp - xp0 === 30 && E.S().done.sip);
    E.act('story-close'); E.act('open-lesson', { id: 'sip' }); for (let i = 0; i < 4; i++) E.act('story-next'); E.act('story-answer', { k: 1 });
    check('Functional', 'Replaying a byte gives no extra XP', E.S().xp - xp0 === 30); E.act('story-close');
    E.act('open-lesson', { id: 'index' }); for (let i = 0; i < 4; i++) E.act('story-next'); E.act('story-answer', { k: 2 });
    check('Functional', 'A wrong answer still explains why and gives 10 XP', E.S().xp - xp0 === 40 && /Not quite/.test(E.text('#story-root'))); E.act('story-close');
    E.act('term', { term: 'nav' }); const en = E.text('#sheet-root'); E.act('term-lang', { v: 'hi', term: 'nav' }); const hi = E.text('#sheet-root');
    check('Functional', 'Money words open a plain definition that switches to Hinglish', /price of one unit/i.test(en) && /daam/i.test(hi));
    E.act('term-lang', { v: 'en', term: 'nav' }); E.act('sheet-close');
    // license
    E.act('tab', { tab: 'explore' });
    check('Guardrails', 'F&O shows as locked in Explore', /Locked until/.test(E.text()));
    E.act('open-license'); const step = n => E.$(`[data-act="lic-open"][data-v="${n}"]`);
    check('Guardrails', 'License steps unlock strictly in order', step(2).disabled && step(3).disabled && step(4).disabled);
    E.act('lic-read'); check('Functional', 'Reading the reality check unlocks the leverage lab', !step(2).disabled && step(3).disabled);
    for (let i = 0; i < 3; i++) E.act('lic-round');
    check('Functional', 'Three leverage-lab rounds unlock the quiz', !step(3).disabled && E.S().license.rounds.length === 3);
    const Q = E.A.LIC_QUIZ;
    for (let q = 0; q < 4; q++) E.act('lic-pick', { q, o: q < 2 ? (Q[q].a + 1) % 3 : Q[q].a }); E.act('lic-check');
    check('Guardrails', 'The quiz needs 3 of 4 to pass', E.S().license.passed === false && E.S().license.quizScore === 2);
    for (let q = 0; q < 4; q++) E.act('lic-pick', { q, o: Q[q].a }); E.act('lic-check');
    check('Functional', 'Passing the quiz opens the guardrails step', E.S().license.passed && !step(4).disabled);
    check('Guardrails', 'Apply stays disabled until the risk is acknowledged', E.$('[data-act="lic-apply"]').disabled);
    E.input('[data-in="lic-ll"]', 3000); E.act('lic-ack'); E.act('lic-apply');
    check('Guardrails', 'Applying starts a 24-hour cooling-off, not instant access', E.S().license.status === 'cooling' && /Cooling off/.test(E.text()));
    E.act('lic-skip');
    check('Functional', 'An active license shows the chosen loss limit', E.S().license.status === 'active' && /₹3,000/.test(E.text()));
    // tip check
    E.act('tab', { tab: 'explore' }); E.act('open-tip'); const lv = [];
    for (let i = 0; i < 3; i++) { E.act('tip-sample', { i }); E.act('tip-check'); const r = E.S().tip.result; lv.push(`${r.level}:${r.flags.length}:${r.score}`); }
    check('Functional', 'Tip Check rates the Telegram scam High risk with 3+ flags', /^high:/.test(lv[0]) && +lv[0].split(':')[1] >= 3, lv[0]);
    check('Functional', "Tip Check rates the friend's FOMO message Medium risk", /^medium:/.test(lv[1]), lv[1]);
    check('Functional', 'Tip Check rates the sensible plan Low risk', /^low:/.test(lv[2]), lv[2]);
    E.input('[data-in="tip"]', '<img src=x onerror="window.__pwned=1"> sure shot 100% guaranteed'); E.act('tip-check');
    check('Guardrails', 'Pasted text is escaped and never runs as HTML', !E.$('#tip-out img') && !E.w.__pwned);
    // simulator, navigation, search
    E.act('tab', { tab: 'explore' }); E.act('open-sim'); const pl = y => { E.input('[data-in="sim-y"]', y); return E.text('.ploss'); };
    const p1 = pl(1), p10 = pl(10);
    check('Functional', 'Future simulator updates the chance of loss live', p1 !== p10, `${p1} at 1 yr, ${p10} at 10 yrs`);
    E.act('tab', { tab: 'explore' }); E.act('open-cat', { id: 'grow' }); E.act('open-fund', { id: 'index' }); E.act('back'); const r1 = E.S().route; E.act('back');
    check('Functional', 'Back goes from fund to category to Explore', r1 === 'category' && E.S().route === 'explore');
    E.input('[data-in="search"]', 'nav'); const t1 = E.has('term', { term: 'nav' });
    E.input('[data-in="search"]', 'index'); check('Functional', 'Search finds funds and money words', t1 && E.$$('#search-results [data-act="open-fund"]').length >= 2);
    E.act('open-cat', { id: 'grow' }); E.act('open-fund', { id: 'flexi' }); E.act('fund-use', { id: 'flexi' });
    const em = G.find(g => g.type === 'emergency'); E.act('fu-pick', { id: em.id, fund: 'flexi' });
    check('Guardrails', 'Picking a risky fund for a short-term goal warns first', /Heads up/.test(E.text('#sheet-root')) && em.fundId === 'liquid'); E.act('sheet-close');
    // squad + autopilot + reset
    E.act('tab', { tab: 'squad' });
    check('Guardrails', 'Squad never shows rupee amounts', !/₹/.test(E.text()));
    const st = E.$$('.board [data-streak]').map(x => +x.dataset.streak);
    check('Guardrails', 'The consistency board is ranked by streak, not returns', st.length === 4 && st.every((v, i) => i === 0 || st[i - 1] >= v), st.join(','));
    E.act('nudge', { v: 'Dev' }); check('Functional', 'A nudge confirms once and cannot be spammed', !E.has('nudge', { v: 'Dev' }));
    E.act('tab', { tab: 'profile' }); E.act('toggle', { v: 'autopilot' }); E.act('demo-payday');
    check('Guardrails', 'With payday autopilot off, payday never nags', !E.has('open-payday'));
    E.act('demo-restart');
    check('Functional', 'Restart clears everything back to the welcome screen', E.S().route === 'welcome' && !E.S().started && E.S().goals.length === 0);
    check('Functional', 'No console errors during the returning-user flows', E.errors.length === 0, E.errors.slice(0, 3).join(' | '));
  }

  /* ===================== Plan engine: exhaustive invariants ===================== */
  { const E = boot(), A = E.A, types = ['trip', 'gadget', 'emergency', 'studies', 'future', 'explore'];
    let n = 0, bad = 0, badF = 0, ex = [];
    for (const [pk, p] of Object.entries(A.PERSONAS)) for (const b of p.bands) for (let mask = 1; mask < 64; mask++) for (const vibe of ['sell', 'wait', 'more'])
      for (const raw of [p.min, Math.round(b.mid * p.pct / p.step) * p.step, p.max]) {
        const m = Math.min(p.max, Math.max(p.min, raw)), user = { persona: pk, band: b.id, incomeMid: b.mid, monthly: m, vibe };
        const sel = types.filter((t, i) => mask & (1 << i)), G = A.makeGoals(sel, user); A.assignBuckets(G, vibe); A.allocate(G, m); n++;
        const okSum = sumSip(G) === m && G.every(g => g.sip % 50 === 0 && (g.sip === 0 || g.sip >= 100));
        const okFund = G.every(g => ['liquid', 'baf', 'index'].includes(g.fundId));
        if (!okSum) { bad++; if (ex.length < 3) ex.push(`${pk}/${b.id}/${sel}/${vibe}/${m}: ${G.map(g => g.type + ':' + g.sip).join(',')}`); }
        if (!okFund) badF++;
      }
    check('Functional', `Plan maths holds on all ${n} combinations: SIPs sum to the monthly amount, in ₹50 steps, each ₹100+ or zero`, bad === 0, ex.join(' | '));
    check('Guardrails', `F&O never appears in any of the ${n} generated plans`, badF === 0);
    for (const bk of ['safe', 'balanced', 'growth']) { const s = A.simulate({ monthly: 1000, months: 120, bucket: bk, seed: 3 });
      check('Accessibility & integrity', `Monte Carlo percentiles stay ordered every month (${bk})`, s.P.p10.every((v, i) => v <= s.P.p50[i] + 1e-9 && s.P.p50[i] <= s.P.p90[i] + 1e-9)); }
    const pls = [12, 60, 120, 240].map(mo => A.simulate({ monthly: 1000, months: mo, bucket: 'growth', seed: 5 }).pLoss);
    check('Accessibility & integrity', 'Chance of ending below what you put in falls as years rise (Growth)', pls.every((v, i) => i === 0 || v <= pls[i - 1]) && pls[0] > pls[3], pls.map(v => (v * 100).toFixed(1) + '%').join(' > '));
    const safe10 = A.simulate({ monthly: 1000, months: 120, bucket: 'safe', seed: 5 }), gr10 = A.simulate({ monthly: 1000, months: 120, bucket: 'growth', seed: 5 });
    check('Accessibility & integrity', 'Safe futures are narrower than Growth futures', (safe10.end.p90 - safe10.end.p10) < (gr10.end.p90 - gr10.end.p10));
  }

  /* ===================== Personas ===================== */
  const persona = async (label, opts, expect) => { const E = boot(); await onboard(E, opts); let res; try { res = await expect(E, E.S().goals); } catch (e) { res = 'threw: ' + e.message; } check('Personas', label, res === true, res === true ? '' : res); };
  await persona('Riya, 20, student, ₹300 a month, trip plus Future me, stressed by dips', { name: 'Riya', persona: 'student', band: 's1', goals: ['trip', 'future'], vibe: 'sell' }, (E, G) => {
    const t = G.find(g => g.type === 'trip'), f = G.find(g => g.type === 'future');
    if (E.S().user.monthly !== 300) return 'monthly ' + E.S().user.monthly;
    if (t.bucket !== 'safe' || t.fundId !== 'liquid') return 'trip bucket ' + t.bucket;
    if (f.bucket !== 'balanced' || !f.softened) return 'Future me was not softened to Balanced';
    if (!/Started in Balanced because dips stress you/.test(E.text())) return 'softened note missing';
    if (!/At this pace/.test(E.text())) return 'trip should show an honest later date';
    return true; });
  await persona('Arjun, 24, first job, ₹10,000 a month, emergency fund plus laptop plus Future me', { name: 'Arjun', persona: 'job', band: 'j3', monthly: 10000, goals: ['emergency', 'gadget', 'future'], vibe: 'wait' }, (E, G) => {
    const e = G.find(g => g.type === 'emergency'), l = G.find(g => g.type === 'gadget'), f = G.find(g => g.type === 'future');
    if (e.target !== 40000) return 'emergency target ' + e.target;
    if (!(e.bucket === 'safe' && l.bucket === 'safe' && f.bucket === 'growth')) return 'buckets ' + [e.bucket, l.bucket, f.bucket];
    if (e.sip < l.sip) return 'emergency fund should get first claim';
    if (!/emergency fund gets first claim/i.test(E.text())) return 'priority reason missing';
    if (/F&O/.test(E.text())) return 'F&O mentioned in the plan';
    return true; });
  await persona('Sana, 25, freelancer, ₹3,500 a month, higher studies plus Future me', { name: 'Sana', persona: 'freelance', band: 'f2', goals: ['studies', 'future'], vibe: 'wait' }, async (E, G) => {
    const s = G.find(g => g.type === 'studies'); if (s.bucket !== 'balanced') return 'studies bucket ' + s.bucket;
    if (sumSip(G) !== 3500) return 'sum ' + sumSip(G);
    await start(E); E.act('to-home');
    if (!/2 skip passes left/.test(E.text())) return 'freelancer skip passes missing';
    if (!E.has('roundup-on')) return 'round-up suggestion missing for irregular income';
    return true; });
  await persona('Kabir, 21, student with irregular money, just exploring', { name: 'Kabir', persona: 'student', band: 's4', goals: ['explore'], vibe: 'more' }, async (E, G) => {
    if (G.length !== 1 || G[0].type !== 'future' || !G[0].exploring) return 'should be one exploring Future me goal';
    if (G[0].sip !== 500 || G[0].bucket !== 'growth') return `sip ${G[0].sip}, bucket ${G[0].bucket}`;
    await start(E); E.act('to-home');
    if (!/Starting small while you explore/.test(E.text())) return 'exploring status missing';
    if (!E.has('open-lesson')) return 'byte suggestion missing';
    E.act('tab', { tab: 'explore' }); E.act('open-license');
    if (!/suggest waiting/.test(E.text())) return 'low-income note missing on the license';
    if (!E.has('lic-read')) return 'low-income student must not be blocked';
    return true; });

  /* ===================== Crawl every screen and sheet ===================== */
  const grabs = [];
  { const E = boot();
    const grab = (label, sel = '#view') => { const n = E.$(sel); if (!n) return; const unl = Array.from(n.querySelectorAll('button')).filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length;
      grabs.push({ label, view: sel === '#view', text: E.text(sel), html: n.innerHTML, h1: !!n.querySelector('h1'), unl }); };
    grab('welcome'); E.act('ob-start'); grab('ob1'); E.act('ob-persona', { v: 'job' }); E.act('ob-next'); E.act('ob-band', { v: 'j2' }); grab('ob2'); E.act('ob-next');
    for (const g of ['trip', 'gadget', 'emergency', 'studies', 'future']) E.act('ob-goal', { v: g }); grab('ob3'); E.act('ob-next'); E.act('ob-vibe', { v: 'sell' }); grab('ob4'); E.act('ob-next');
    grab('plan'); E.act('plan-edit', { id: E.S().goals[0].id }); grab('sheet:goal-edit', '#sheet-root'); E.act('sheet-close');
    E.act('plan-monthly'); grab('sheet:monthly', '#sheet-root'); E.act('sheet-close'); E.act('plan-start'); grab('sheet:upi', '#sheet-root'); E.act('upi-approve'); await sleep(15); grab('success'); E.act('to-home');
    for (const t of ['home', 'explore', 'learn', 'squad', 'profile']) { E.act('tab', { tab: t }); grab(t); }
    for (const g of E.S().goals) { E.A.go('goal', { id: g.id }); grab('goal:' + g.type); for (const [a, l] of [['add-money', 'add'], ['sip-change', 'sip'], ['sip-pause', 'pause']]) { E.act(a, { id: g.id }); grab(`sheet:${l}:${g.type}`, '#sheet-root'); E.act('sheet-close'); } }
    for (const c of E.A.CATS) { E.A.go('category', { id: c.id }); grab('category:' + c.id); }
    for (const id of Object.keys(E.A.FUNDS)) { E.A.go('fund', { id }); grab('fund:' + id); E.act('fund-use', { id }); grab('sheet:fund-use', '#sheet-root'); E.act('sheet-close'); }
    E.A.go('sim'); grab('sim'); for (const b of ['safe', 'balanced']) { E.act('sim-b', { v: b }); grab('sim:' + b); }
    E.act('tab', { tab: 'explore' }); E.act('stocks-info'); grab('sheet:stocks', '#sheet-root'); E.act('sheet-close');
    E.A.go('license'); grab('license:1'); E.act('lic-read'); for (let i = 0; i < 3; i++) E.act('lic-round'); grab('license:2'); E.act('lic-open', { v: 3 }); grab('license:3'); E.act('lic-open', { v: 4 }); grab('license:4');
    E.A.go('tipcheck'); for (let i = 0; i < 3; i++) { E.act('tip-sample', { i }); E.act('tip-check'); grab('tip:' + i); }
    for (const k of Object.keys(E.A.JARGON)) { E.act('tab', { tab: 'learn' }); E.act('term', { term: k }); grab('term:' + k, '#sheet-root'); E.act('sheet-close'); }
    for (const l of E.A.LESSONS) { E.act('tab', { tab: 'learn' }); E.act('open-lesson', { id: l.id }); for (let i = 0; i < l.slides.length; i++) { grab(`story:${l.id}:${i}`, '#story-root'); E.act('story-next'); }
      grab(`story:${l.id}:quiz`, '#story-root'); E.act('story-answer', { k: l.quiz.a }); grab(`story:${l.id}:done`, '#story-root'); E.act('story-close'); }
    E.act('demo-payday'); E.act('open-payday'); grab('sheet:payday', '#sheet-root'); E.act('sheet-close');
    E.act('demo-dip'); grab('home:dip'); E.act('open-dip'); grab('dip'); E.act('dip-pause'); grab('sheet:pause-pick', '#sheet-root'); E.act('sheet-close'); E.act('demo-dip');
    E.act('tab', { tab: 'home' }); E.act('add-goal'); grab('sheet:add-goal', '#sheet-root'); E.act('sheet-close');
    E.act('demo-open'); grab('sheet:demo', '#sheet-root'); E.act('sheet-close'); E.act('calm'); grab('home:calm-off'); E.act('calm');
    grab('presenter', '#presenter');
    check('Functional', `Crawled ${grabs.length} screens, sheets and story slides without console errors`, E.errors.length === 0, E.errors.slice(0, 3).join(' | '));
  }
  const banned = /guaranteed returns?|risk[- ]free|sure[- ]shot|can'?t lose|100% safe|assured returns?/i;
  const hits = grabs.filter(g => banned.test(g.text)).map(g => g.label + ': "' + (g.text.match(banned) || [''])[0] + '"');
  check('Guardrails', `No hype phrases on any of ${grabs.length} screens (quoted scam examples excluded)`, hits.length === 0, hits.slice(0, 4).join(' | '));
  const proj = grabs.filter(g => /class="futures/.test(g.html)), noDown = proj.filter(g => !(/Bad luck|end below/.test(g.text) && /Illustrative, not guaranteed/.test(g.text))).map(g => g.label);
  check('Guardrails', `All ${proj.length} projections show a downside case and "Illustrative, not guaranteed"`, proj.length > 5 && noDown.length === 0, noDown.join(', '));
  const funds = grabs.filter(g => g.label.startsWith('fund:')), A0 = boot().A;
  const missing = funds.filter(g => { const f = A0.FUNDS[g.label.slice(5)]; return !(g.text.includes(A0.PERSONAS && f ? ['Low', 'Low to moderate', 'Moderate', 'Moderately high', 'High', 'Very high'][f.risk - 1] : '') && g.text.includes(f.er.toFixed(2) + '%')); }).map(g => g.label);
  check('Guardrails', `Every fund page (${funds.length}) shows its riskometer level and expense ratio`, funds.length === 8 && missing.length === 0, missing.join(', '));
  const unl = grabs.filter(g => g.unl).map(g => g.label);
  check('Accessibility & integrity', 'Every icon-only button has an accessible name', unl.length === 0, unl.join(', '));
  const noH1 = grabs.filter(g => g.view && !g.h1).map(g => g.label);
  check('Accessibility & integrity', 'Every screen has a top-level heading', noH1.length === 0, noH1.join(', '));
  const used = new Set(); grabs.forEach(g => { for (const m of g.html.matchAll(/data-term="(\w+)"/g)) used.add(m[1]); });
  const unknown = [...used].filter(k => !A0.JARGON[k]);
  const need = ['sip', 'nav', 'er', 'exit', 'index', 'liquid', 'nifty', 'vol', 'comp', 'rca', 'direct', 'xirr', 'fno', 'lev', 'div', 'lock', 'units', 'risk'];
  check('Content', `Every money word used in the UI (${used.size}) has a decoder entry`, unknown.length === 0, unknown.join(', '));
  check('Content', 'All 18 required money words are in the decoder, each with a Hinglish version', need.every(k => A0.JARGON[k] && A0.JARGON[k].hi && A0.JARGON[k].en));

  /* ===================== Content quality ===================== */
  { const A = A0; const lessonText = l => [...l.slides.map(s => s.t + '. ' + (typeof s.b === 'function' ? s.b() : s.b)), l.quiz.q, l.quiz.why].join(' ');
    const shape = A.LESSONS.filter(l => !(l.slides.length >= 3 && l.slides.length <= 5 && l.quiz.opts.length >= 2 && l.quiz.a >= 0 && l.quiz.a < l.quiz.opts.length && l.quiz.why)).map(l => l.id);
    check('Content', `All ${A.LESSONS.length} bytes have 3 to 5 slides and one quiz with exactly one right answer and an explanation`, A.LESSONS.length === 7 && shape.length === 0, shape.join(', '));
    const fl = A.LESSONS.map(l => [l.id, flesch(lessonText(l))]), lowF = fl.filter(([, v]) => v < 50);
    check('Content', 'Every byte reads at Flesch 50 or above (plain English)', lowF.length === 0, fl.map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', '));
    const gl = Object.values(A.JARGON).map(j => j.en + ' ' + j.an).join(' '), glF = flesch(gl);
    check('Content', 'The money-word decoder reads at Flesch 50 or above', glF >= 50, glF.toFixed(0));
    const all = A.LESSONS.map(lessonText).join(' ') + ' ' + gl, mw = maxWords(all);
    check('Content', 'No sentence in bytes or definitions runs past 20 words', mw <= 20, 'longest ' + mw + ' words');
    info.push('Readability: ' + fl.map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ') + `, decoder ${glF.toFixed(0)} (Flesch reading ease)`);
  }

  /* ===================== Accessibility & integrity ===================== */
  { const TEXT = ['ink', 'ink-2', 'ink-3', 'mint-text', 'coral', 'sky-text', 'amber-text', 'lilac-text', 'sun-text'], SURF = ['paper', 'surface', 'surface-2'];
    const SOFT = ['sky-soft', 'amber-soft', 'mint-soft', 'coral-soft', 'lilac-soft', 'sun-soft'];
    for (const dark of [false, true]) { const t = tokens(dark), fails = []; let n = 0;
      const pair = (a, b, A, B) => { n++; const r = ratio(A || t[a], B || t[b]); if (!(r >= 4.5)) fails.push(`${a} on ${b} ${r.toFixed(2)}`); };
      for (const a of TEXT) for (const b of SURF) pair(a, b);
      for (const s of SOFT) { pair(s.replace('-soft', s === 'coral-soft' ? '' : '-text').replace(/-$/, ''), s); for (const a of ['ink', 'ink-2', 'ink-3']) pair(a, s); }
      pair('mint-ink', 'mint'); pair('paper', 'ink'); pair('white', 'lilac', '#FFFFFF');
      if (!dark) for (const l of A0.LESSONS) pair('white', 'story ' + l.id, '#FFFFFF', l.color);
      check('Accessibility & integrity', `Text contrast is at least 4.5:1 on all ${n} ${dark ? 'dark' : 'light'}-theme pairs`, fails.length === 0, fails.join(' | ')); }
    info.push(`Spec palette coral #C93434 on its tint #FBE6E6 measures ${ratio('#C93434', '#FBE6E6').toFixed(2)}:1, below 4.5:1, so the build ships #B42D2D (${ratio('#B42D2D', '#FBE6E6').toFixed(2)}:1)`);
    const sels = ['.btn', '.btn.sm', '.chip', '.chip.sm', '.tab', '.seg button', '.iconbtn', '.setting', '.opt', '.tile', '.qopt', '.qrow', '.link', '.check', '.step', '.lrow', '.demo-fab', '.tour button', 'input[type=range]', '.field'];
    const h = s => { let best = 0; for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) { if (m[1].split(',').map(x => x.trim()).includes(s)) { const v = m[2].match(/(?:^|;)\s*min-height:\s*(\d+)px/) || m[2].match(/(?:^|;)\s*height:\s*(\d+)px/); if (v) best = Math.max(best, +v[1]); } } return best; };
    const small = sels.map(s => [s, h(s)]).filter(([, v]) => v < 44);
    check('Accessibility & integrity', `All ${sels.length} kinds of tap target are at least 44 px tall`, small.length === 0, small.map(([s, v]) => `${s} ${v}px`).join(', '));
    check('Accessibility & integrity', 'Reduced-motion preference is respected', /prefers-reduced-motion:\s*reduce/.test(CSS));
    check('Accessibility & integrity', 'Phone layout handles notches (viewport-fit and safe-area insets)', /viewport-fit=cover/.test(HTML) && /safe-area-inset-top/.test(CSS) && /safe-area-inset-bottom/.test(CSS));
    const kb = fs.statSync(FILE).size / 1024;
    check('Accessibility & integrity', 'Single HTML file under 300 KB', kb < 300, kb.toFixed(0) + ' KB');
    const urls = [...HTML.matchAll(/https?:\/\/[^\s"')<>]+/g)].map(m => new URL(m[0]).host), ext = [...new Set(urls)].filter(x => !/^fonts\.(googleapis|gstatic)\.com$/.test(x));
    const script = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];
    check('Accessibility & integrity', 'No network calls except Google Fonts (no tracking, no APIs)', ext.length === 0 && !/\bfetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(script), ext.join(', '));
    info.push(`File size ${kb.toFixed(0)} KB`);
  }

  /* ===================== Report ===================== */
  const groups = [...new Set(results.map(r => r.group))];
  for (const g of groups) { const rs = results.filter(r => r.group === g); console.log(`\n${g}: ${rs.filter(r => r.pass).length}/${rs.length}`);
    for (const r of rs) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && (!r.pass || /Readab|chance|Flesch/i.test(r.name)) ? '   [' + r.detail + ']' : ''}`); }
  if (info.length) { console.log('\nNotes'); for (const i of info) console.log('  ' + i); }
  const failed = results.filter(r => !r.pass).length;
  console.log(`\nTotal: ${results.length - failed}/${results.length} passed`);
  fs.writeFileSync(path.join(process.cwd(), 'eval-results.json'), JSON.stringify({ file: path.basename(FILE), ran: new Date().toISOString(), passed: results.length - failed, total: results.length, results, info }, null, 1));
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error('HARNESS ERROR', e); process.exitCode = 2; });
