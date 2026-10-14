/* AWS SAA-C03 practice app. Questions, answers and explanations are decrypted from data/bank.enc.js with the access code. */
(function () {
  'use strict';

  // Filled in once the access code decrypts data/bank.enc.js
  let BANK = [];
  let BY_ID = new Map();
  let IMAGES = {};
  const STORE_KEY = 'saa-c03-prep-v1';
  const CODE_KEY = 'saa-c03-access-code';
  const PAGE_SIZE = 10;
  const app = document.getElementById('app');

  /* ---------- storage ---------- */
  function emptyState() { return { progress: {}, history: [], session: null }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === 'object') return Object.assign(emptyState(), s);
    } catch (e) { /* storage unavailable or corrupt */ }
    return emptyState();
  }
  let state = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function inline(s) {
    return esc(s)
      .replace(/\[\[img:([\w.-]+)\]\]/g, (m, f) => `<img class="q-img" src="${IMAGES[f] || ''}" alt="Exhibit from the question">`)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:)\]])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  const paras = s => String(s).split('\n').filter(Boolean).map(l => /^\[\[img:/.test(l) ? inline(l) : `<p>${inline(l)}</p>`).join('');
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const isRight = (q, ans) => !!ans && sameSet(q.answer, ans);
  const pct = (n, d) => d ? Math.round(n / d * 100) : 0;
  const numWord = n => ({ 2: 'two', 3: 'three' }[n] || n);
  const fmtDate = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const fmtDur = ms => { const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60; return `${m}m ${String(s).padStart(2, '0')}s`; };

  // In-page yes/no dialog (native browser dialogs are blocked in some embedded viewers)
  function ask(message, okLabel) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-back';
      wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><p>${esc(message)}</p><div class="row"><span class="spacer"></span><button class="btn" data-a="no">Cancel</button><button class="btn primary" data-a="yes">${esc(okLabel || 'OK')}</button></div></div>`;
      const done = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const onKey = e => { if (e.key === 'Escape') done(false); };
      wrap.addEventListener('click', e => { if (e.target === wrap || e.target.dataset.a === 'no') done(false); else if (e.target.dataset.a === 'yes') done(true); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(wrap);
      wrap.querySelector('[data-a=yes]').focus();
    });
  }

  function pools() {
    const p = state.progress;
    const seen = BANK.filter(q => p[q.id]);
    return {
      new: BANK.filter(q => !p[q.id]),
      seen,
      wrong: seen.filter(q => p[q.id].last === 'wrong'),
      all: BANK,
    };
  }

  function go(hash) { if (location.hash === '#' + hash) route(); else location.hash = hash; }

  /* ---------- home ---------- */
  function viewHome() {
    const p = pools();
    const right = p.seen.filter(q => state.progress[q.id].last === 'right').length;
    const s = state.session;
    app.innerHTML = `
      <h1>AWS Solutions Architect – Associate practice</h1>
      <p class="lead">${BANK.length} questions from your SAA-C03 document. Write practice tests, rewrite what you got wrong, then study the explanations.</p>
      ${s && s.phase !== 'done' ? `
      <div class="card row between">
        <div><h3>You have a test in progress</h3><div class="muted small">${s.ids.length} questions · started ${fmtDate(s.started)}</div></div>
        <div class="row"><button class="btn primary" data-act="resume">Resume</button><button class="btn danger" data-act="discard">Discard</button></div>
      </div>` : ''}
      <div class="grid stats section">
        <div class="stat"><b>${BANK.length}</b><span>Questions in bank</span></div>
        <div class="stat"><b>${p.seen.length}</b><span>Attempted</span></div>
        <div class="stat"><b>${p.new.length}</b><span>Not yet seen</span></div>
        <div class="stat"><b>${p.wrong.length}</b><span>Wrong last time</span></div>
        <div class="stat"><b>${pct(right, p.seen.length)}%</b><span>Correct last time</span></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
        <div class="card"><h2>Write a test</h2><p class="muted">Choose how many questions and whether you want new ones, repeats, or a mix. Questions are picked at random.</p><a class="btn primary" href="#setup">Start a new test</a></div>
        <div class="card"><h2>Study</h2><p class="muted">Browse every question with its answer and explanation. Filter to the ones you got wrong.</p><a class="btn" href="#study">Open study mode</a></div>
      </div>`;
    app.querySelector('[data-act=resume]')?.addEventListener('click', () => go(s.phase === 'choice' ? 'results' : 'test'));
    app.querySelector('[data-act=discard]')?.addEventListener('click', async () => {
      if (await ask('Discard the test in progress?', 'Discard')) { state.session = null; save(); viewHome(); }
    });
  }

  /* ---------- setup ---------- */
  function viewSetup() {
    const p = pools();
    const prev = state.lastSetup || { mode: p.new.length ? 'new' : 'mix', repeat: 'wrong', count: 20 };
    app.innerHTML = `
      <h1>New test</h1>
      <p class="lead">Questions are randomly selected from the pool you choose.</p>
      <form class="card" id="setup">
        <div class="section">
          <h2>1. Which questions?</h2>
          <div class="choice-grid">
            <label class="choice"><input type="radio" name="mode" value="new"><span class="t">New questions only</span><span class="d">Only questions you have never attempted.</span><span class="n">${p.new.length} available</span></label>
            <label class="choice"><input type="radio" name="mode" value="repeat"><span class="t">Repeat questions</span><span class="d">Only questions you have already attempted.</span><span class="n">${p.seen.length} available</span></label>
            <label class="choice"><input type="radio" name="mode" value="mix"><span class="t">Mix</span><span class="d">Any question from the whole bank, new and seen.</span><span class="n">${p.all.length} available</span></label>
          </div>
          <div id="repeat-opts" class="section" style="margin-top:12px">
            <label class="field">Repeat which ones?</label>
            <div class="row">
              <label><input type="radio" name="repeat" value="wrong"> Ones I got wrong last time (${p.wrong.length})</label>
              <label><input type="radio" name="repeat" value="seen"> Any I have already done (${p.seen.length})</label>
            </div>
          </div>
        </div>
        <div class="section">
          <h2>2. How many questions?</h2>
          <input type="number" id="count" min="1" step="1">
          <div class="chips" id="chips"></div>
          <p class="muted small" id="avail"></p>
        </div>
        <div class="notice small section">After you submit, you can rewrite the questions you got wrong before the paper is marked. The marked paper shows the correct answers and an explanation for every question you got wrong.</div>
        <div class="row"><button class="btn primary" type="submit" id="go">Start test</button><a class="btn" href="#home">Cancel</a></div>
      </form>`;
    const form = app.querySelector('#setup');
    const countEl = form.querySelector('#count');
    form.mode.value = prev.mode; form.repeat.value = prev.repeat; countEl.value = prev.count;

    function pool() {
      const m = form.mode.value;
      if (m === 'new') return p.new;
      if (m === 'repeat') return form.repeat.value === 'wrong' ? p.wrong : p.seen;
      return p.all;
    }
    function refresh() {
      form.querySelector('#repeat-opts').style.display = form.mode.value === 'repeat' ? '' : 'none';
      const n = pool().length;
      countEl.max = Math.max(1, n);
      form.querySelector('#avail').textContent = n ? `${n} question${n === 1 ? '' : 's'} available in this pool.` : 'No questions available in this pool — choose another option.';
      form.querySelector('#chips').innerHTML = [10, 20, 30, 65].filter(c => c < n).concat(n ? [n] : [])
        .map(c => `<button type="button" class="btn sm" data-c="${c}">${c === n ? `All ${n}` : c}</button>`).join('');
      form.querySelector('#go').disabled = !n;
    }
    form.addEventListener('change', refresh);
    form.querySelector('#chips').addEventListener('click', e => { const c = e.target.dataset.c; if (c) countEl.value = c; });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const src = pool();
      const n = Math.min(src.length, Math.max(1, parseInt(countEl.value, 10) || 0));
      if (!src.length) return;
      if (state.session && state.session.phase !== 'done' && !(await ask('This replaces your test in progress. Continue?', 'Start new test'))) return;
      state.lastSetup = { mode: form.mode.value, repeat: form.repeat.value, count: n };
      const modeLabel = form.mode.value === 'new' ? 'New only' : form.mode.value === 'mix' ? 'Mix' : (form.repeat.value === 'wrong' ? 'Repeat (wrong)' : 'Repeat (seen)');
      state.session = {
        ids: shuffle(src.map(q => q.id)).slice(0, n),
        mode: modeLabel,
        started: Date.now(),
        phase: 'test',        // test -> choice -> retry -> choice ... -> done
        round: 0,             // 0 = first attempt, 1+ = rewrite rounds
        active: null,         // ids being answered in the current round
        answers: [{}],        // answers[round][id] = ['A', ...]
        flags: {},
        idx: 0,
      };
      state.session.active = state.session.ids.slice();
      save();
      go('test');
    });
    refresh();
  }

  /* ---------- test / rewrite ---------- */
  function viewTest() {
    const s = state.session;
    if (!s || (s.phase !== 'test' && s.phase !== 'retry')) return go(s ? 'results' : 'setup');
    const ids = s.active;
    const ans = s.answers[s.round];
    s.idx = Math.min(Math.max(0, s.idx), ids.length - 1);
    const q = BY_ID.get(ids[s.idx]);
    const need = q.answer.length;
    const mine = ans[q.id] || [];
    const answered = ids.filter(id => (ans[id] || []).length).length;
    const retry = s.phase === 'retry';

    app.innerHTML = `
      <div class="test-head">
        <div class="row between">
          <div><b>${retry ? `Rewrite round ${s.round}` : 'Practice test'}</b> <span class="muted small">· ${answered}/${ids.length} answered</span></div>
          <button class="btn primary sm" data-act="submit">${retry ? 'Submit rewrite' : 'Submit test'}</button>
        </div>
        <div class="progress"><i style="width:${pct(answered, ids.length)}%"></i></div>
      </div>
      ${retry ? `<div class="notice small section">You got these wrong. Answer them again — the correct answers stay hidden until the paper is marked.</div>` : ''}
      <div class="card">
        <div class="row between"><span class="qnum">Question ${s.idx + 1} of ${ids.length}</span><span class="muted small">Bank #${q.id}</span></div>
        <div class="qtext" style="margin-top:10px">${paras(q.q)}</div>
        ${need > 1 ? `<span class="choose-hint">Select ${numWord(need)} answers</span>` : ''}
        <div class="options" role="${need > 1 ? 'group' : 'radiogroup'}">
          ${Object.entries(q.options).map(([k, v]) => `
            <label class="opt ${mine.includes(k) ? 'selected' : ''}">
              <input type="${need > 1 ? 'checkbox' : 'radio'}" name="opt" value="${k}" ${mine.includes(k) ? 'checked' : ''}>
              <span class="letter">${k}.</span><span class="otext">${paras(v)}</span>
            </label>`).join('')}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" data-act="prev" ${s.idx === 0 ? 'disabled' : ''}>← Previous</button>
          <button class="btn" data-act="flag">${s.flags[q.id] ? '★ Flagged' : '☆ Flag for review'}</button>
          <span class="spacer"></span>
          ${s.idx < ids.length - 1 ? `<button class="btn primary" data-act="next">Next →</button>` : `<button class="btn primary" data-act="submit">${retry ? 'Submit rewrite' : 'Submit test'}</button>`}
        </div>
      </div>
      <div class="card">
        <h3>Questions</h3>
        <div class="palette">${ids.map((id, i) => `<button data-i="${i}" class="${(ans[id] || []).length ? 'answered' : ''} ${i === s.idx ? 'current' : ''} ${s.flags[id] ? 'flagged' : ''}" title="Question ${i + 1}${s.flags[id] ? ' (flagged)' : ''}">${i + 1}</button>`).join('')}</div>
        <p class="muted small" style="margin-bottom:0">Dark = answered · orange underline = flagged</p>
      </div>`;

    app.querySelectorAll('input[name=opt]').forEach(inp => inp.addEventListener('change', () => {
      let sel = [...app.querySelectorAll('input[name=opt]:checked')].map(i => i.value);
      if (need > 1 && sel.length > need) { inp.checked = false; sel = sel.filter(v => v !== inp.value); }
      ans[q.id] = sel.sort();
      app.querySelectorAll('.opt').forEach(l => l.classList.toggle('selected', l.querySelector('input').checked));
      save();
      const pal = app.querySelector(`.palette [data-i="${s.idx}"]`);
      pal.classList.toggle('answered', sel.length > 0);
      const done = ids.filter(id => (ans[id] || []).length).length;
      app.querySelector('.test-head .muted').textContent = `· ${done}/${ids.length} answered`;
      app.querySelector('.progress i').style.width = pct(done, ids.length) + '%';
    }));
    const move = i => { s.idx = i; save(); viewTest(); window.scrollTo(0, 0); };
    app.querySelector('[data-act=prev]').addEventListener('click', () => move(s.idx - 1));
    app.querySelector('[data-act=next]')?.addEventListener('click', () => move(s.idx + 1));
    app.querySelector('[data-act=flag]').addEventListener('click', () => { s.flags[q.id] = !s.flags[q.id]; save(); viewTest(); });
    app.querySelector('.palette').addEventListener('click', e => { if (e.target.dataset.i) move(+e.target.dataset.i); });
    app.querySelectorAll('[data-act=submit]').forEach(b => b.addEventListener('click', async () => {
      const missing = ids.filter(id => (ans[id] || []).length !== BY_ID.get(id).answer.length).length;
      if (missing && !(await ask(`${missing} question${missing === 1 ? ' is' : 's are'} unanswered or incomplete. Submit anyway?`, 'Submit'))) return;
      submitRound();
    }));
  }

  function submitRound() {
    const s = state.session;
    const ans = s.answers[s.round];
    if (s.round === 0) {
      // first attempt is what counts towards your progress
      s.ids.forEach(id => {
        const ok = isRight(BY_ID.get(id), ans[id]);
        const p = state.progress[id] || { seen: 0, right: 0, wrong: 0 };
        p.seen++; ok ? p.right++ : p.wrong++; p.last = ok ? 'right' : 'wrong'; p.ts = Date.now();
        state.progress[id] = p;
      });
    }
    s.phase = 'choice';
    s.finished = Date.now();
    save();
    go('results');
  }

  /* ---------- per-question outcome ---------- */
  function outcome(s, id) {
    const q = BY_ID.get(id);
    const tries = [];
    for (let r = 0; r <= s.round; r++) {
      const a = s.answers[r] && s.answers[r][id];
      if (r === 0 || a !== undefined) tries.push({ round: r, ans: a || [], ok: isRight(q, a) });
    }
    return { q, tries, first: tries[0].ok, final: tries[tries.length - 1].ok };
  }

  /* ---------- results (choice after each round) ---------- */
  function viewResults() {
    const s = state.session;
    if (!s) return go('home');
    if (s.phase === 'test' || s.phase === 'retry') return go('test');
    const outs = s.ids.map(id => outcome(s, id));
    const first = outs.filter(o => o.first).length;
    const final = outs.filter(o => o.final).length;
    const stillWrong = outs.filter(o => !o.final);
    const fixed = final - first;
    const lastRoundIds = s.active;
    const lastRoundRight = s.round > 0 ? lastRoundIds.filter(id => isRight(BY_ID.get(id), s.answers[s.round][id])).length : null;

    app.innerHTML = `
      <h1>${s.round === 0 ? 'Test submitted' : `Rewrite round ${s.round} submitted`}</h1>
      <p class="lead">${s.mode} · ${s.ids.length} questions${s.finished ? ` · ${fmtDur(s.finished - s.started)}` : ''}</p>
      <div class="card">
        <div class="row" style="gap:28px">
          <div><div class="score">${pct(first, s.ids.length)}%</div><div class="muted small">First attempt: ${first} / ${s.ids.length}</div></div>
          ${s.round > 0 ? `<div><div class="score" style="color:var(--good)">${pct(final, s.ids.length)}%</div><div class="muted small">After rewrites: ${final} / ${s.ids.length}</div></div>` : ''}
        </div>
        ${lastRoundRight !== null ? `<p style="margin-bottom:0">This round you corrected <b>${lastRoundRight}</b> of ${lastRoundIds.length}. ${fixed > 0 ? `In total you fixed ${fixed} question${fixed === 1 ? '' : 's'} by rewriting.` : ''}</p>` : ''}
      </div>
      ${stillWrong.length ? `
      <div class="card">
        <h2>${stillWrong.length} question${stillWrong.length === 1 ? '' : 's'} still wrong</h2>
        <p class="muted">You can rewrite them now — the correct answers stay hidden — or go straight to the marked paper.</p>
        <div class="row">
          <button class="btn primary" data-act="retry">Rewrite the ${stillWrong.length} I got wrong</button>
          <button class="btn" data-act="mark">Mark paper &amp; show explanations</button>
        </div>
      </div>` : `
      <div class="card">
        <h2>${first === s.ids.length ? 'Perfect score!' : 'Everything is now correct.'}</h2>
        <div class="row"><button class="btn primary" data-act="mark">View marked paper</button></div>
      </div>`}`;

    app.querySelector('[data-act=retry]')?.addEventListener('click', () => {
      s.round++;
      s.active = shuffle(stillWrong.map(o => o.q.id));
      s.answers[s.round] = Object.fromEntries(s.active.map(id => [id, []]));
      s.idx = 0;
      s.phase = 'retry';
      save();
      go('test');
    });
    app.querySelector('[data-act=mark]').addEventListener('click', () => finish());
  }

  function finish() {
    const s = state.session;
    if (s.phase !== 'done') {
      const outs = s.ids.map(id => outcome(s, id));
      state.history.unshift({
        date: s.started, mode: s.mode, total: s.ids.length, rounds: s.round,
        first: outs.filter(o => o.first).length, final: outs.filter(o => o.final).length,
        ids: s.ids, answers: s.answers,
      });
      state.history = state.history.slice(0, 50);
      s.phase = 'done';
      s.historyIndex = 0;
      save();
    }
    go('paper');
  }

  /* ---------- marked question paper ---------- */
  function renderPaperQuestion(o, n, opts) {
    const { q, tries } = o;
    const chosen = tries[tries.length - 1].ans;
    const firstAns = tries[0].ans;
    const status = o.first ? 'ok' : (o.final ? 'fix' : 'no');
    const label = { ok: '✓ Correct', fix: '✓ Corrected on rewrite', no: '✗ Wrong' }[status];
    const optHtml = Object.entries(q.options).map(([k, v]) => {
      const isAns = q.answer.includes(k);
      const picked = firstAns.includes(k) || chosen.includes(k);
      const cls = isAns ? 'correct' : (picked ? 'wrong' : '');
      return `<div class="opt static ${cls}"><span class="letter">${k}.</span><span class="otext">${paras(v)}</span>${isAns ? '<span class="badge ok">Answer</span>' : (picked ? '<span class="badge no">Your pick</span>' : '')}</div>`;
    }).join('');
    const lines = tries.map(t => `<div>${t.round === 0 ? 'Your answer' : `Rewrite ${t.round}`}: <b>${t.ans.length ? t.ans.join(', ') : '— (blank)'}</b> ${t.ok ? '<span class="badge ok">✓</span>' : '<span class="badge no">✗</span>'}</div>`).join('');
    const exp = `<h4>Explanation</h4>${q.explanation.map(p => `<p>${inline(p)}</p>`).join('') || '<p class="muted">No explanation in the document.</p>'}`;
    return `
      <div class="card paper-q is-${o.first ? 'ok' : 'no'}" id="pq-${q.id}">
        <div class="row between"><span class="qnum">Question ${n}</span><span class="row"><span class="muted small">Bank #${q.id}</span><span class="badge ${status}">${label}</span></span></div>
        <div class="qtext" style="margin-top:10px">${paras(q.q)}</div>
        <div class="options">${optHtml}</div>
        <div class="answer-line">${lines}<div>Correct answer: <b>${q.answer.join(', ')}</b></div></div>
        ${!o.first || opts.expandAll ? `<div class="explain">${exp}</div>` : `<details class="explain-toggle"><summary>Show explanation</summary><div class="explain">${exp}</div></details>`}
      </div>`;
  }

  function viewPaper(histIndex) {
    const rec = state.history[histIndex || 0];
    if (!rec) return go('home');
    const sess = { ids: rec.ids, answers: rec.answers, round: rec.rounds };
    const outs = rec.ids.map(id => outcome(sess, id));
    let filter = 'all';
    function draw() {
      const shown = outs.map((o, i) => [o, i + 1]).filter(([o]) => filter === 'all' || (filter === 'wrong' ? !o.first : o.first));
      app.innerHTML = `
        <h1>Marked paper</h1>
        <p class="lead">${fmtDate(rec.date)} · ${rec.mode} · ${rec.total} questions</p>
        <div class="card row between">
          <div class="row" style="gap:28px">
            <div><div class="score">${pct(rec.first, rec.total)}%</div><div class="muted small">First attempt: ${rec.first} / ${rec.total}</div></div>
            ${rec.rounds ? `<div><div class="score" style="color:var(--good)">${pct(rec.final, rec.total)}%</div><div class="muted small">After rewrites: ${rec.final} / ${rec.total}</div></div>` : ''}
          </div>
          <div class="row">
            <a class="btn primary" href="#setup">New test</a>
            ${rec.total - rec.first ? `<a class="btn" href="#study/test-${histIndex || 0}">Study the ones I got wrong</a>` : ''}
          </div>
        </div>
        <div class="row section">
          <span class="muted small">Show:</span>
          <button class="btn sm ${filter === 'all' ? 'primary' : ''}" data-f="all">All (${outs.length})</button>
          <button class="btn sm ${filter === 'wrong' ? 'primary' : ''}" data-f="wrong">Got wrong (${outs.filter(o => !o.first).length})</button>
          <button class="btn sm ${filter === 'right' ? 'primary' : ''}" data-f="right">Got right (${outs.filter(o => o.first).length})</button>
        </div>
        ${shown.map(([o, n]) => renderPaperQuestion(o, n, {})).join('') || '<div class="empty">Nothing to show.</div>'}`;
      app.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    }
    draw();
  }

  /* ---------- study ---------- */
  const study = { q: '', filter: 'all', page: 0, reveal: false, only: null };
  function viewStudy(arg) {
    if (arg && arg.startsWith('test-')) {
      const rec = state.history[+arg.slice(5)];
      if (rec) {
        const sess = { ids: rec.ids, answers: rec.answers, round: rec.rounds };
        study.only = { label: `wrong in test of ${fmtDate(rec.date)}`, ids: rec.ids.filter(id => !outcome(sess, id).first) };
        study.page = 0; study.reveal = true;
      }
      history.replaceState(null, '', '#study');
    }
    const prog = state.progress;
    const term = study.q.trim().toLowerCase();
    let list = study.only ? study.only.ids.map(id => BY_ID.get(id)) : BANK;
    list = list.filter(q => {
      const p = prog[q.id];
      if (study.filter === 'wrong' && !(p && p.wrong > 0)) return false;
      if (study.filter === 'lastwrong' && !(p && p.last === 'wrong')) return false;
      if (study.filter === 'right' && !(p && p.last === 'right')) return false;
      if (study.filter === 'new' && p) return false;
      if (study.filter === 'multi' && q.answer.length < 2) return false;
      if (!term) return true;
      if (/^#?\d+$/.test(term)) return q.id === parseInt(term.replace('#', ''), 10);
      return (q.q + ' ' + Object.values(q.options).join(' ') + ' ' + q.explanation.join(' ')).toLowerCase().includes(term);
    });
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    study.page = Math.min(study.page, pages - 1);
    const slice = list.slice(study.page * PAGE_SIZE, (study.page + 1) * PAGE_SIZE);

    const pager = `<div class="pager">
      <button class="btn sm" data-p="${study.page - 1}" ${study.page === 0 ? 'disabled' : ''}>← Prev</button>
      <span class="muted small">Page ${study.page + 1} of ${pages}</span>
      <button class="btn sm" data-p="${study.page + 1}" ${study.page >= pages - 1 ? 'disabled' : ''}>Next →</button></div>`;

    app.innerHTML = `
      <h1>Study</h1>
      <p class="lead">Read through questions, answers and explanations at your own pace.</p>
      ${study.only ? `<div class="notice section row between"><span>Showing the ${study.only.ids.length} questions you got ${esc(study.only.label)}.</span><button class="btn sm" data-act="clear-only">Show all questions</button></div>` : ''}
      <div class="card">
        <div class="filters">
          <input type="search" id="sq" placeholder="Search text or question number (e.g. 125)" value="${esc(study.q)}">
          <select id="sf">
            <option value="all">All questions</option>
            <option value="lastwrong">Wrong last time</option>
            <option value="wrong">Ever got wrong</option>
            <option value="right">Right last time</option>
            <option value="new">Never attempted</option>
            <option value="multi">Choose two / three</option>
          </select>
          <label class="row small" style="flex:0 1 auto"><input type="checkbox" id="sr" ${study.reveal ? 'checked' : ''}> Show answers</label>
        </div>
        <p class="muted small" style="margin:10px 0 0">${list.length} question${list.length === 1 ? '' : 's'}</p>
      </div>
      ${slice.map(q => studyCard(q, prog[q.id])).join('') || '<div class="empty">No questions match.</div>'}
      ${list.length > PAGE_SIZE ? pager : ''}`;

    const sf = app.querySelector('#sf'); sf.value = study.filter;
    let t;
    app.querySelector('#sq').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { study.q = e.target.value; study.page = 0; viewStudy(); const el = app.querySelector('#sq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 250);
    });
    sf.addEventListener('change', () => { study.filter = sf.value; study.page = 0; viewStudy(); });
    app.querySelector('#sr').addEventListener('change', e => { study.reveal = e.target.checked; viewStudy(); });
    app.querySelector('[data-act=clear-only]')?.addEventListener('click', () => { study.only = null; study.page = 0; viewStudy(); });
    app.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { study.page = +b.dataset.p; viewStudy(); window.scrollTo(0, 0); }));
  }

  function studyCard(q, p) {
    const exp = `<div class="explain"><h4>Answer: ${q.answer.join(', ')}</h4>${q.explanation.map(x => `<p>${inline(x)}</p>`).join('')}</div>`;
    const hist = p ? `<span class="badge ${p.last === 'right' ? 'ok' : 'no'}">${p.last === 'right' ? 'Right' : 'Wrong'} last time · ${p.right}/${p.seen}</span>` : '<span class="badge">Not attempted</span>';
    return `
      <div class="card">
        <div class="row between"><span class="qnum">Question #${q.id}</span>${hist}</div>
        <div class="qtext" style="margin-top:10px">${paras(q.q)}</div>
        <div class="options">${Object.entries(q.options).map(([k, v]) => `<div class="opt static ${study.reveal && q.answer.includes(k) ? 'correct' : ''}"><span class="letter">${k}.</span><span class="otext">${paras(v)}</span></div>`).join('')}</div>
        ${study.reveal ? exp : `<details class="explain-toggle"><summary>Show answer &amp; explanation</summary>${exp}</details>`}
      </div>`;
  }

  /* ---------- history ---------- */
  function viewHistory() {
    const h = state.history;
    app.innerHTML = `
      <h1>History</h1>
      <p class="lead">Your past tests. Open any one to see its marked paper again.</p>
      <div class="card">
        ${h.length ? `<div class="table-scroll"><table class="hist">
          <thead><tr><th>Date</th><th>Questions</th><th>Pool</th><th>First attempt</th><th>After rewrites</th><th></th></tr></thead>
          <tbody>${h.map((r, i) => `<tr><td>${fmtDate(r.date)}</td><td>${r.total}</td><td>${esc(r.mode)}</td><td>${r.first}/${r.total} (${pct(r.first, r.total)}%)</td><td>${r.rounds ? `${r.final}/${r.total} (${pct(r.final, r.total)}%)` : '—'}</td><td><a href="#paper/${i}">View paper</a></td></tr>`).join('')}</tbody>
        </table></div>` : '<div class="empty">No tests yet. <a href="#setup">Write your first one.</a></div>'}
      </div>
      <div class="card">
        <h3>Reset progress</h3>
        <p class="muted small">Clears which questions you have seen, your results and your history on this device.</p>
        <button class="btn danger" data-act="reset">Reset all progress</button>
      </div>`;
    app.querySelector('[data-act=reset]').addEventListener('click', async () => {
      if (await ask('Delete all progress and history? This cannot be undone.', 'Delete everything')) { state = emptyState(); save(); viewHistory(); }
    });
  }

  /* ---------- router ---------- */
  function route() {
    const [name, arg] = (location.hash.slice(1) || 'home').split('/');
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    if (!BANK.length) return viewLogin();
    switch (name) {
      case 'setup': return viewSetup();
      case 'test': return viewTest();
      case 'results': return viewResults();
      case 'paper': return viewPaper(arg ? +arg : 0);
      case 'study': return viewStudy(arg);
      case 'history': return viewHistory();
      default: return viewHome();
    }
  }
  /* ---------- access code ---------- */
  const normCode = c => String(c).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function unlock(code) {
    const enc = window.ENCRYPTED_BANK;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(normCode(code)), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.data));  // throws on a wrong code
    const data = JSON.parse(new TextDecoder().decode(plain));
    BANK = data.questions; BY_ID = new Map(BANK.map(q => [q.id, q])); IMAGES = data.images;
  }
  const savedCode = () => { try { return localStorage.getItem(CODE_KEY); } catch (e) { return null; } };
  function setSavedCode(c) { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch (e) { /* ignore */ } }

  // Wrong code: a big laughing face and "Zama nakambe" for a few seconds
  function laughAtWrongCode() {
    document.querySelector('.laugh')?.remove();
    const el = document.createElement('div');
    el.className = 'laugh';
    el.setAttribute('role', 'alert');
    el.innerHTML = '<span class="laugh-face" aria-hidden="true">😂</span><span class="laugh-text">Zama nakambe</span>';
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  function viewLogin(message) {
    document.body.classList.add('locked');
    app.innerHTML = `
      <form class="card login" id="login">
        <h1>Enter your access code</h1>
        <p class="lead">This practice site is locked. Type or paste your access code to open it.</p>
        <label class="field" for="code">Access code</label>
        <input type="password" id="code" autocomplete="current-password" spellcheck="false" autocapitalize="characters" required>
        <label class="row small"><input type="checkbox" id="remember" checked> Keep me signed in on this device</label>
        <p class="login-error" id="err" role="alert">${message ? esc(message) : ''}</p>
        <button class="btn primary" type="submit" id="unlock">Unlock</button>
      </form>`;
    const form = app.querySelector('#login');
    form.querySelector('#code').focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const code = form.querySelector('#code').value;
      const btn = form.querySelector('#unlock');
      btn.disabled = true; btn.textContent = 'Checking…';
      try {
        await unlock(code);
        setSavedCode(form.querySelector('#remember').checked ? code : null);
        start();
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Unlock';
        form.querySelector('#err').textContent = '';
        laughAtWrongCode();
        form.querySelector('#code').select();
      }
    });
  }

  let started = false;
  function start() {
    document.body.classList.remove('locked');
    if (!started) {
      started = true;
      window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
      document.querySelector('[data-act=logout]').addEventListener('click', () => {
        setSavedCode(null);
        BANK = []; BY_ID = new Map(); IMAGES = {};
        viewLogin('You are signed out.');
      });
    }
    route();
  }

  (async function boot() {
    if (!window.ENCRYPTED_BANK || !window.crypto || !crypto.subtle) {
      app.innerHTML = '<div class="card empty">The question bank could not be loaded. Open the site over https (for example GitHub Pages), not as a local file.</div>';
      return;
    }
    const c = savedCode();
    if (c) { try { await unlock(c); return start(); } catch (e) { setSavedCode(null); } }
    viewLogin();
  })();
})();
