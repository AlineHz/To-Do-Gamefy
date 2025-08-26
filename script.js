/* script.js — versão com sistema de levels baseado nos pontos totais (modificado: assets padronizados)
   Alteração: a função attemptHatchEgg agora gera **apenas** um caminho de asset no formato
   Title Case com espaços + ".png" (ex.: "Gato Angora.png", "Gato Laranja.png", "Bulldog.png").
   Removidos os outros formatos/variações que antes eram tentados.
*/

document.addEventListener('DOMContentLoaded', function () {
  // elements (nav + app)
  const pagesListEl = document.getElementById('pages-list');
  const btnEditPage = document.getElementById('btn-edit-page');

  const newPageTitleInput = document.getElementById('new-page-title');
  const btnAddPageNav = document.getElementById('btn-add-page');
  const btnDeletePageNav = document.getElementById('btn-delete-page-nav');

  const listsContainer = document.getElementById('lists');
  const tasksContainer = document.getElementById('tasks');
  const selectedListTitleEl = document.getElementById('selected-list-title');
  const listStatsEl = document.getElementById('list-stats');
  const emptyStateEl = document.getElementById('empty-state');
  const listAreaEl = document.getElementById('list-area');
  const remainingEl = document.getElementById('remaining');

  const newListTitle = document.getElementById('new-list-title');
  const newListDate = document.getElementById('new-list-date');
  const btnAddList = document.getElementById('btn-add-list');

  const newTaskText = document.getElementById('new-task-text');
  const btnAddTask = document.getElementById('btn-add-task');

  const btnConfirm = document.getElementById('btn-confirm');
  const btnDeleteList = document.getElementById('btn-delete-list');

  const globalProgressBar = document.querySelector('#global-progress .progress-bar');
  const globalProgressPercent = document.getElementById('global-progress-percent');
  const globalPointsEl = document.getElementById('global-points');
  const globalPointsContainer = document.getElementById('global-points-container');

  // LEVEL UI
  const levelBadge = document.getElementById('level-badge');
  const levelProgressBar = document.getElementById('level-progress-bar');

  const victoryPop = document.getElementById('victory-pop');
  const confettiCanvas = document.getElementById('confetti-canvas');

  const tabActive = document.getElementById('tab-active');
  const tabPlanned = document.getElementById('tab-planned');
  const tabCompleted = document.getElementById('tab-completed');

  const monthlyInput = document.getElementById('new-list-month-day');
  const weeklyControls = document.getElementById('weekly-controls');
  const monthlyControls = document.getElementById('monthly-controls');
  const listRepeatControlsEl = document.getElementById('list-repeat-controls');

  // state
  let state = { pages: [], currentPageId: null };
  const uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

  // points config (existing)
  const POINTS_PER_TASK = 5;
  const BONUS_PER_LIST = 50;

  // level/xp config
  const XP_BASE = 100; // base incremental XP (see formula below)

  // audio helpers (unchanged)
  let _audioCtx = null;
  function ensureAudioContext() {
    if (_audioCtx) return _audioCtx;
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { _audioCtx = null; }
    return _audioCtx;
  }
  function playShortChime() {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.7, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.19);
    } catch (e) { /* silent */ }
  }
  function playVictorySound() {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
      const now = ctx.currentTime;
      const freqs = [880, 1100, 1320];
      const dur = 0.9;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(0.9, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.001, now + dur);
      master.connect(ctx.destination);
      freqs.forEach(function (f, i) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        g.gain.setValueAtTime(1 - i * 0.18, now);
        osc.connect(g); g.connect(master);
        osc.start(now + i * 0.0); osc.stop(now + dur + 0.02);
      });
    } catch (e) { /* silent */ }
  }

  // util datas
  function startOfDay(date) { const d = date ? new Date(date) : new Date(); d.setHours(0,0,0,0); return d; }
  function toInputDate(date) { return startOfDay(date).toISOString().slice(0,10); }
  function parseInputDate(v) { if (!v) return null; return startOfDay(new Date(v + 'T00:00:00')).toISOString(); }

  // persistence: save/load pages
  function save() { try { localStorage.setItem('mini_todo_data_v1', JSON.stringify(state)); } catch (e) {} }
  function load() {
    try {
      const raw = localStorage.getItem('mini_todo_data_v1');
      const todayISO = startOfDay().toISOString();
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migration handling (keeps compatibility)
        if (parsed && parsed.pages && Array.isArray(parsed.pages)) {
          state = parsed;
        } else if (parsed && Array.isArray(parsed.lists)) {
          state.pages = [{
            id: uid(),
            title: 'Principal',
            lists: (parsed.lists || []).map(function (l) { return normalizeList(l); }),
            selectedListId: parsed.selectedListId || ((parsed.lists[0] && parsed.lists[0].id) || null),
            viewMode: parsed.viewMode || 'active'
          }];
          state.currentPageId = state.pages[0].id;
        } else {
          state = parsed || state;
        }
      }
    } catch (e) {
      state = { pages: [], currentPageId: null };
    }

    // ensure at least one page exists
    if (!state.pages || !state.pages.length) {
      state.pages = [{
        id: uid(),
        title: 'Principal',
        lists: [],
        selectedListId: null,
        viewMode: 'active'
      }];
    }
    if (!state.currentPageId) state.currentPageId = state.pages[0].id;

    // normalize lists per page
    state.pages = state.pages.map(function(p){
      return {
        id: p.id || uid(),
        title: p.title || 'Página',
        lists: (p.lists || []).map(normalizeList),
        selectedListId: p.selectedListId || (p.lists && p.lists[0] && p.lists[0].id) || null,
        viewMode: p.viewMode || 'active'
      };
    });

    // retroativo: marca bonus se completada e sem flag
    state.pages.forEach(function(pg){
      (pg.lists || []).forEach(function(l){
        if (l.completed && !l.bonusAwarded) {
          l.pointsAwarded = (Number(l.pointsAwarded) || 0) + BONUS_PER_LIST;
          l.bonusAwarded = true;
        }
      });
    });
  }

  function normalizeList(l) {
    const todayISO = startOfDay().toISOString();
    return {
      id: l.id || uid(),
      title: l.title || 'Sem título',
      tasks: (l.tasks || []).map(function (t) { return { id: t.id || uid(), text: t.text || '', done: !!t.done }; }),
      completed: !!l.completed,
      completedAt: l.completedAt || null,
      repeat: l.repeat || 'once',
      createdAt: l.createdAt || new Date().toISOString(),
      availableOn: l.availableOn || todayISO,
      originId: l.originId || null,
      repeatDays: Array.isArray(l.repeatDays) ? l.repeatDays.slice() : [],
      repeatDay: (typeof l.repeatDay === 'number') ? l.repeatDay : (l.repeatDay ? Number(l.repeatDay) : null),
      pointsAwarded: typeof l.pointsAwarded === 'number' ? l.pointsAwarded : ((l.tasks || []).filter(function(t){return t.done}).length * POINTS_PER_TASK),
      bonusAwarded: !!l.bonusAwarded
    };
  }

  // page helpers
  function getCurrentPage() {
    return state.pages.find(function(p){ return p.id === state.currentPageId; }) || state.pages[0];
  }

  function setCurrentPage(id) {
    state.currentPageId = id;
    save();
    renderPagesNav();
    renderLists();
    renderTasks();
  }

  // add/remove pages
  function addPage(title) {
    title = (title || '').trim() || 'Página ' + (state.pages.length + 1);
    const page = { id: uid(), title: title, lists: [], selectedListId: null, viewMode: 'active' };
    state.pages.push(page);
    state.currentPageId = page.id;
    save();
    renderPagesNav();
    renderLists();
    renderTasks();
  }

  function removeCurrentPage() {
    if (!confirm('Deseja realmente excluir esta página e todo o conteúdo dentro dela?')) return;
    if (state.pages.length <= 1) { alert('Não é possível excluir a última página.'); return; }
    const idx = state.pages.findIndex(function(p){ return p.id === state.currentPageId; });
    if (idx === -1) return;
    state.pages.splice(idx,1);
    state.currentPageId = state.pages[Math.max(0, idx-1)].id;
    save();
    renderPagesNav();
    renderLists();
    renderTasks();
  }

  // points helpers (global across all pages)
  function computeTotalPointsAllPages() {
    return state.pages.reduce(function (acc, p) { return acc + (p.lists || []).reduce(function(a,l){ return a + (Number(l.pointsAwarded)||0); },0); }, 0);
  }
  function updatePointsDisplay() {
    if (globalPointsEl) globalPointsEl.textContent = computeTotalPointsAllPages();
    updateLevelDisplay(); // update level always when points update
  }

  function animatePoints(delta) {
    if (!globalPointsContainer) return;
    var sign = delta >= 0 ? '+' : '';
    var badge = document.createElement('div');
    badge.className = 'points-badge' + (delta < 0 ? ' negative' : '');
    badge.textContent = sign + delta + ' pts';
    globalPointsContainer.appendChild(badge);
    setTimeout(function () { try { globalPointsContainer.removeChild(badge); } catch (e) {} }, 1100);
  }

  // confetti etc (unchanged)
  function runConfetti(duration) {
    try {
      duration = duration || 1500;
      if (!confettiCanvas) return;
      var canvas = confettiCanvas;
      var ctx = canvas.getContext('2d');
      var ratio = window.devicePixelRatio || 1;
      function resize() {
        canvas.width = window.innerWidth * ratio;
        canvas.height = window.innerHeight * ratio;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(ratio,0,0,ratio,0,0);
      }
      resize();
      window.addEventListener('resize', resize);
      var colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'];
      var pieces = [];
      var count = 80;
      for (var i=0;i<count;i++){
        pieces.push({
          x: window.innerWidth/2 + (Math.random()-0.5)*300,
          y: -20 - Math.random()*200,
          vx: (Math.random()-0.5)*6,
          vy: 2 + Math.random()*6,
          size: 6 + Math.random()*8,
          rot: Math.random()*360,
          velRot: (Math.random()-0.5)*10,
          color: colors[Math.floor(Math.random()*colors.length)],
        });
      }
      var start = null;
      function step(ts){
        if (!start) start = ts;
        var elapsed = ts - start;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        pieces.forEach(function(p){
          p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.rot += p.velRot;
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
          ctx.fillStyle = p.color; ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
          ctx.restore();
        });
        if (elapsed < duration) requestAnimationFrame(step);
        else { ctx.clearRect(0,0,canvas.width,canvas.height); window.removeEventListener('resize', resize); }
      }
      requestAnimationFrame(step);
    } catch (e) {}
  }

  var lastOverallPercent = 0;
  var victoryCooldown = false;
  function showVictoryPop() {
    if (!victoryPop || victoryCooldown) return;
    victoryCooldown = true;
    victoryPop.classList.remove('hidden');
    victoryPop.setAttribute('aria-hidden','false');
    runConfetti(1800);
    try { playVictorySound(); } catch(e){}
    setTimeout(function(){
      victoryPop.classList.add('hidden');
      victoryPop.setAttribute('aria-hidden','true');
      setTimeout(function(){ victoryCooldown = false; }, 400);
    }, 3000);
  }

  // helpers UI
  function escapeHtml(s) { return String(s).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;',"'":"&#39;"}[ch];}); }

  // progress / render for current page
  function computeListProgress(list) {
    if (!list.tasks || !list.tasks.length) return 0;
    var done = list.tasks.filter(function(t){return t.done}).length;
    return Math.round((done / list.tasks.length) * 100);
  }
  
function computeOverallProgressCurrentPage() {
    var pg = getCurrentPage();
    if (!pg) return 0;
    var lists = pg.lists || [];
    var total = 0, done = 0;
    // For progress we will IGNORE tasks from repeating lists that are planned (i.e., not available today).
    // However, lists that are one-off (repeat === 'once') or repeating lists available today are counted.
    for (var i = 0; i < lists.length; i++) {
      var l = lists[i];
      try {
        // If the list is a repeating list and is planned for the future, skip its tasks.
        if (l.repeat && l.repeat !== 'once' && isPlannedFuture(l)) {
          continue;
        }
      } catch (e) {}
      var tasks = l.tasks || [];
      for (var j = 0; j < tasks.length; j++) {
        total += 1;
        if (tasks[j].done) done += 1;
      }
    }
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }


  function isAvailableToday(list) {
    var today = startOfDay();
    var avail = startOfDay(new Date(list.availableOn || new Date().toISOString()));
    if (list.completed) return false;
    if (list.repeat === 'daily') {
      return avail <= today;
    } else if (list.repeat === 'weekly') {
      if (Array.isArray(list.repeatDays) && list.repeatDays.length) {
        var todayIdx = today.getDay();
        return avail <= today && list.repeatDays.indexOf(todayIdx) !== -1;
      }
      return avail <= today;
    } else if (list.repeat === 'monthly') {
      var targetDay = (typeof list.repeatDay === 'number' && !isNaN(list.repeatDay)) ? list.repeatDay : (new Date(list.availableOn)).getDate();
      var todayDay = today.getDate();
      var year = today.getFullYear(), month = today.getMonth();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var effectiveTarget = Math.min(targetDay, daysInMonth);
      return avail <= today && todayDay === effectiveTarget;
    } else {
      return avail <= today;
    }
  }
  
function computeNextOccurrence(list) {
    var today = startOfDay();
    var avail = list.availableOn ? startOfDay(new Date(list.availableOn)) : null;
    // If a one-time future availability is set, return it
    if (list.repeat === 'once') {
      if (avail && avail > today) return avail;
      return null;
    }
    // Search forward up to 365 days for next matching occurrence after today
    var maxDays = 365;
    for (var i=1;i<=maxDays;i++) {
      var cand = startOfDay(new Date());
      cand.setDate(cand.getDate() + i);
      // candidate must be >= avail if avail specified
      if (avail && cand < avail) continue;
      if (list.repeat === 'daily') {
        return cand;
      } else if (list.repeat === 'weekly') {
        if (Array.isArray(list.repeatDays) && list.repeatDays.length) {
          if (list.repeatDays.indexOf(cand.getDay()) !== -1) return cand;
        } else {
          // no specific days -> any week day works
          return cand;
        }
      } else if (list.repeat === 'monthly') {
        var baseDay = (typeof list.repeatDay === 'number' && !isNaN(list.repeatDay)) ? list.repeatDay : (avail ? (new Date(list.availableOn)).getDate() : null);
        if (!baseDay) continue;
        var year = cand.getFullYear(), month = cand.getMonth();
        // find days in that month
        var daysInMonth = new Date(year, month+1, 0).getDate();
        var day = Math.min(baseDay, daysInMonth);
        if (cand.getDate() === day) return cand;
      }
    }
    return null;
  }

  
function isPlannedFuture(list) {
    // Compare using local Y/M/D components to avoid timezone shifts that make
    // an availableOn ISO string appear as the next day in some timezones.
    function dateYMD(d) {
      if (!d) return null;
      var D = new Date(d);
      return [D.getFullYear(), D.getMonth(), D.getDate()];
    }
    var todayD = dateYMD(startOfDay());
    var availD = list.availableOn ? dateYMD(list.availableOn) : null;
    if (availD) {
      // if availableOn is strictly after today (by date), it's planned
      for (var i=0;i<3;i++) {
        if (availD[i] > todayD[i]) return true;
        if (availD[i] < todayD[i]) return false;
      }
      // equal dates -> not planned
      return false;
    }
    // otherwise compute next occurrence based on repeat rules (tomorrow+)
    var next = computeNextOccurrence(list);
    if (!next) return false;
    var nextD = dateYMD(next);
    for (var j=0;j<3;j++) {
      if (nextD[j] > todayD[j]) return true;
      if (nextD[j] < todayD[j]) return false;
    }
    return false;
  }



  // ----------------------
  // LEVEL / XP FUNCTIONS
  // ----------------------

  // xpToReachLevel(N) = cumulative XP required to reach level N.
  // level 1 = 0 XP, level 2 = XP_BASE * 1, level 3 = XP_BASE*(1+2) = 300, etc.
  function xpToReachLevel(N) {
    if (N <= 1) return 0;
    return XP_BASE * ((N - 1) * N / 2);
  }

  // given totalPoints, compute current level (integer >=1) and xp progress
  function computeLevelFromPoints(totalPoints) {
    var level = 1;
    // naive loop (safe because points won't be huge); small optimization: exponential search could be used
    while (true) {
      var nextReq = xpToReachLevel(level + 1);
      if (totalPoints >= nextReq) { level += 1; continue; }
      break;
    }
    var xpCurrentLevel = totalPoints - xpToReachLevel(level);
    var xpNextLevel = xpToReachLevel(level + 1) - xpToReachLevel(level); // equals XP_BASE * level
    if (xpNextLevel <= 0) xpNextLevel = XP_BASE;
    var progressPercent = Math.min(100, Math.round((xpCurrentLevel / xpNextLevel) * 100));
    var pointsToNext = Math.max(0, xpToReachLevel(level + 1) - totalPoints);
    return {
      level: level,
      xpForThisLevel: xpCurrentLevel,
      xpForNextLevel: xpNextLevel,
      progressPercent: progressPercent,
      pointsToNext: pointsToNext
    };
  }

  // update level UI (badge + small progress bar)
  function updateLevelDisplay() {
    if (!levelBadge || !levelProgressBar) return;
    var total = computeTotalPointsAllPages();
    var data = computeLevelFromPoints(total);
    levelBadge.textContent = 'LV ' + data.level;
    levelProgressBar.style.width = data.progressPercent + '%';
    // update title for tooltip
    levelBadge.title = 'LV ' + data.level + ' — ' + total + ' pts • ' + data.pointsToNext + ' pts para LV ' + (data.level + 1);
    // optionally change style on level up (small pulse)
    // detect level-up by storing lastLevel
    if (typeof updateLevelDisplay.lastLevel === 'undefined') updateLevelDisplay.lastLevel = data.level;
    if (data.level > updateLevelDisplay.lastLevel) {
      // simple pulse
      levelBadge.animate([
        { transform: 'scale(1)', boxShadow: '0 4px 10px rgba(2,6,23,0.08)' },
        { transform: 'scale(1.08)', boxShadow: '0 8px 18px rgba(34,197,94,0.12)' },
        { transform: 'scale(1)', boxShadow: '0 4px 10px rgba(2,6,23,0.08)' }
      ], { duration: 650, easing: 'cubic-bezier(.2,.9,.2,1)' });
      // also optional confetti when big milestone
      runConfetti(900);
    }
    updateLevelDisplay.lastLevel = data.level;
  }

  // ----------------------
  // PAGES NAV RENDER
  // ----------------------
  function renderPagesNav() {
    if (!pagesListEl) return;
    pagesListEl.innerHTML = '';
    state.pages.forEach(function(pg){
      var btn = document.createElement('button');
      btn.className = 'tab';
      btn.style.marginRight = '6px';
      btn.setAttribute('role','tab');
      btn.setAttribute('data-page-id', pg.id);
      btn.title = pg.title;
      btn.type = 'button';

      if (pg.id === state.currentPageId) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected','true');
      } else {
        btn.setAttribute('aria-selected','false');
      }

      // content: title text (escaped)
      btn.innerHTML = '<span class="tab-title">' + escapeHtml(pg.title) + '</span>';
      btn.addEventListener('click', function(){ setCurrentPage(pg.id); });
      pagesListEl.appendChild(btn);
    });
  }

  // --- inline edit of lists (unchanged) ---
  function openInlineEdit(listEl, list) {
    var existing = listsContainer.querySelector('.edit-form');
    if (existing) { renderLists(); }

    listEl.classList.add('editing');
    var form = document.createElement('div'); form.className = 'edit-form';
    var inputTitle = document.createElement('input'); inputTitle.type='text'; inputTitle.value = list.title || '';
    var inputDate = document.createElement('input'); inputDate.type='date'; inputDate.value = toInputDate(list.availableOn ? new Date(list.availableOn) : new Date());
    var inputMonthDay = document.createElement('input'); inputMonthDay.type='number'; inputMonthDay.min='1'; inputMonthDay.max='31';
    inputMonthDay.placeholder = 'Insira o dia do mês, ex: 15';
    if (typeof list.repeatDay === 'number') inputMonthDay.value = list.repeatDay;
    var actions = document.createElement('div'); actions.className = 'edit-actions';
    var btnSave = document.createElement('button'); btnSave.className='btn-save'; btnSave.textContent='Salvar';
    var btnCancel = document.createElement('button'); btnCancel.className='btn-cancel'; btnCancel.textContent='Cancelar';
    btnSave.addEventListener('click', function(e){
      e.stopPropagation();
      var nt = inputTitle.value.trim();
      if (!nt) { alert('O título não pode ficar vazio.'); inputTitle.focus(); return; }
      list.title = nt;
      var parsed = parseInputDate(inputDate.value) || startOfDay().toISOString();
      list.availableOn = parsed;
      var md = parseInt(inputMonthDay.value,10);
      if (!isNaN(md) && md >= 1 && md <= 31) list.repeatDay = md;
      else list.repeatDay = null;
      save(); renderLists(); var pg = getCurrentPage(); pg.selectedListId = list.id; renderTasks();
    });
    btnCancel.addEventListener('click', function(e){ e.stopPropagation(); renderLists(); renderTasks(); });
    actions.appendChild(btnCancel); actions.appendChild(btnSave);
    form.appendChild(inputTitle); form.appendChild(inputDate);
    var mdContainer = document.createElement('div'); mdContainer.style.display='flex'; mdContainer.style.gap='8px'; mdContainer.style.alignItems='center';
    mdContainer.appendChild(inputMonthDay);
    form.appendChild(mdContainer);
    form.appendChild(actions);
    var left = listEl.querySelector('.list-left');
    if (left) { left.innerHTML=''; left.appendChild(form); inputTitle.focus(); form.addEventListener('click', function(ev){ ev.stopPropagation(); }); }
  }

  function createListElement(list) {
    var pg = getCurrentPage();
    var el = document.createElement('div'); el.className='list-item' + (pg.selectedListId===list.id ? ' selected' : '');
    var percent = computeListProgress(list);
    var left = document.createElement('div'); left.className='list-left';
    var repeatBadge = '';
    if (list.repeat && list.repeat !== 'once') {
      if (list.repeat === 'daily') repeatBadge = '<span class="repeat-badge">Diária</span>';
      else if (list.repeat === 'weekly') repeatBadge = '<span class="repeat-badge">Semanal</span>';
      else if (list.repeat === 'monthly') repeatBadge = '<span class="repeat-badge">Mensal</span>';
    }
    var daysNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var daysText = '';
    if (list.repeat === 'weekly' && Array.isArray(list.repeatDays) && list.repeatDays.length) {
      daysText = ' • ' + list.repeatDays.map(function(d){return daysNames[d];}).join(', ');
    } else if (list.repeat === 'monthly') {
      var rd = (typeof list.repeatDay === 'number' && !isNaN(list.repeatDay)) ? list.repeatDay : (new Date(list.availableOn)).getDate();
      daysText = ' • dia ' + rd;
    }
    left.innerHTML = '<div style="font-weight:600">' + escapeHtml(list.title) + ' ' + repeatBadge + (list.originId ? ' • (Planejado)' : '') + daysText + '</div>' +
                     '<div class="list-meta">' + (list.tasks ? list.tasks.length : 0) + ' tarefas ' + (list.completed ? '• concluída' : '') + '</div>' +
                     '<div class="progress small"><div class="progress-bar" style="width:' + percent + '%"></div><div class="progress-percent">' + percent + '%</div></div>';
    var right = document.createElement('div'); right.style.display='flex'; right.style.alignItems='center'; right.style.gap='8px';
    var status = document.createElement('div'); status.innerHTML = list.completed ? '✅' : (isPlannedFuture(list) ? '📅' : '');
    right.appendChild(status);
    var btnEdit = document.createElement('button'); btnEdit.className='btn-icon'; btnEdit.title='Editar título / data'; btnEdit.innerHTML='✏️';
    btnEdit.addEventListener('click', function(e){ e.stopPropagation(); openInlineEdit(el, list); });
    right.appendChild(btnEdit);
    el.appendChild(left); el.appendChild(right);
    el.addEventListener('click', function(){ selectList(list.id); });
    return el;
  }

  
function renderLists() {
    var pg = getCurrentPage();
    if (!listsContainer) return;
    listsContainer.innerHTML = '';
    var filtered;
    // Support active, planned and completed view modes explicitly
    if (pg.viewMode === 'completed') {
      filtered = (pg.lists || []).filter(function(l){ return l.completed; });
    } else if (pg.viewMode === 'planned') {
      // show lists that have an availableOn date in the future (planned)
      filtered = (pg.lists || []).filter(function(l){ return isPlannedFuture(l); });
    } else {
      // default: active (available today according to repeat rules)
      filtered = (pg.lists || []).filter(function(l){ return isAvailableToday(l); });
    }

    if (!filtered.length) {
      var e = document.createElement('div'); e.className='list-item'; e.style.opacity='.6';
      if (pg.viewMode === 'completed') e.textContent = 'Nenhuma lista concluída ainda.';
      else if (pg.viewMode === 'planned') e.textContent = 'Nenhuma lista planejada.';
      else e.textContent = 'Nenhuma lista ativa hoje. Verifique Planejados.';
      listsContainer.appendChild(e);
      return;
    }

    filtered.forEach(function(l){
      var el = createListElement(l);
      // add a visual class for planned items so they can be styled differently if desired
      if (pg.viewMode === 'planned') el.classList.add('planned-item');
      listsContainer.appendChild(el);
    });

    if (!filtered.find(function(x){ return x.id === pg.selectedListId; })) pg.selectedListId = filtered[0].id;
  }

function selectList(id) { var pg = getCurrentPage(); pg.selectedListId = id; save(); renderLists(); renderTasks(); }

  function renderTasks() {
    var pg = getCurrentPage();
    var list = (pg.lists || []).find(function(l){ return l.id === pg.selectedListId; });
    if (!list) {
      listAreaEl.style.display='none';
      emptyStateEl.style.display='block';
      if (selectedListTitleEl) selectedListTitleEl.textContent = 'Selecione uma lista';
      listStatsEl.textContent = '';
      updateGlobalProgress();
      return;
    }
    emptyStateEl.style.display='none';
    listAreaEl.style.display='flex';
    var planned = isPlannedFuture(list);
    var availText = planned ? ' • Disponível em ' + (new Date(list.availableOn)).toLocaleDateString('pt-BR') : '';
    if (selectedListTitleEl) selectedListTitleEl.textContent = list.title + (list.completed ? ' (Concluída)' : '');
    listStatsEl.textContent = (list.completed ? 'Concluída em ' + (list.completedAt ? new Date(list.completedAt).toLocaleString() : '') : ((list.tasks || []).length + ' tarefas')) + availText;

    tasksContainer.innerHTML = '';
    if (!planned) {
      var pending = (list.tasks || []).filter(function(t){ return !t.done; });
      if (!pending.length) {
        var msg = document.createElement('div'); msg.style.opacity='.7'; msg.style.padding='10px'; msg.textContent='Nenhuma tarefa pendente hoje nessa lista.';
        tasksContainer.appendChild(msg);
      } else {
        (list.tasks || []).forEach(function(task){
          var t = document.createElement('div'); t.className = 'task' + (task.done ? ' done' : '');
          var cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!task.done;
          cb.addEventListener('change', function(){ toggleTask(list.id, task.id); });
          var text = document.createElement('div'); text.className='text'; text.textContent = task.text;
          var del = document.createElement('button'); del.className='trash'; del.innerHTML='🗑️';
          del.addEventListener('click', function(e){ e.stopPropagation(); removeTask(list.id, task.id); });
          t.appendChild(cb); t.appendChild(text); t.appendChild(del);
          tasksContainer.appendChild(t);
        });
      }
    } else {
      (list.tasks || []).forEach(function(task){
        var t = document.createElement('div'); t.className = 'task' + (task.done ? ' done' : '');
        var cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!task.done; cb.disabled = true;
        var text = document.createElement('div'); text.className='text'; text.textContent = task.text;
        t.appendChild(cb); t.appendChild(text); tasksContainer.appendChild(t);
      });
    }
    updateFooter(list, planned);
    updateGlobalProgress();
  }

  function updateGlobalProgress() {
    var percent = computeOverallProgressCurrentPage();
    if (globalProgressBar) globalProgressBar.style.width = percent + '%';
    if (globalProgressPercent) globalProgressPercent.textContent = percent + '%';
    updatePointsDisplay();
    if (percent === 100 && lastOverallPercent < 100) {
      showVictoryPop();
    // Tentar chocar ovo selecionado (se houver)
    try { attemptHatchEgg(); } catch(e){ console.error('Erro em attemptHatchEgg:', e); }

    }
    lastOverallPercent = percent;
  }

  function updateFooter(list, planned) {
    var remaining = (list.tasks || []).filter(function(t){ return !t.done; }).length;
    remainingEl.textContent = planned ? 'Agendada — ficará disponível na data indicada' : (remaining === 0 ? 'Nenhuma tarefa restante' : remaining + ' tarefa(s) restante(s)');
    btnConfirm.disabled = planned || !((list.tasks || []).length && (list.tasks || []).every(function(t){ return t.done; }) && !list.completed);
  }

  // actions adapted to current page
  function addList(title, repeat, availableOnISO, repeatDays, repeatDay) {
    var pg = getCurrentPage();
    title = (title || '').trim(); if (!title) return;
    var now = new Date();
    var availableOn = availableOnISO || startOfDay(now).toISOString();
    var item = {
      id: uid(), title: title, tasks: [], completed: false, completedAt: null,
      repeat: repeat || 'once', createdAt: now.toISOString(), availableOn: startOfDay(new Date(availableOn)).toISOString(),
      originId: null, repeatDays: Array.isArray(repeatDays) ? repeatDays.slice() : [], repeatDay: (typeof repeatDay === 'number' && !isNaN(repeatDay)) ? repeatDay : null,
      pointsAwarded: 0, bonusAwarded: false
    };
    pg.lists.push(item);
    pg.selectedListId = item.id;
    save(); renderLists(); renderTasks();
  }

  function addTask(listId, text) {
    var pg = getCurrentPage();
    text = (text || '').trim(); if (!text) return;
    var list = pg.lists.find(function(l)

