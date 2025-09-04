
/* script_with_taskArrays.js — versão adaptada: mantém um array (list.taskArray) com as tarefas para cada lista
   Principais mudanças:
   - normalizeList agora inicializa list.taskArray a partir de list.tasks ao carregar.
   - addList cria list.taskArray = [].
   - addTask insere também em list.taskArray.
   - removeTask remove também de list.taskArray.
   - toggleTask mantém list.taskArray sincronizado (done e _pointsAwarded).
   - setCompletedAndSchedule cria historyTasks/nextTasks e atualiza list.taskArray.
   - Novas funções utilitárias:
       ensureTaskArray(list) -> garante que list.taskArray exista e esteja sincronizada.
       getTasksArray(listId) -> retorna array de tarefas (cópia) da lista indicada.
       buildAllTaskArrays() -> retorna um objeto { listId: [tasks...] } para a página atual.
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
    // garante tasks array padrão normalizado
    var tasks = (l.tasks || []).map(function (t) { return { id: t.id || uid(), text: t.text || '', done: !!t.done, _pointsAwarded: !!t._pointsAwarded, _isHistory: !!t._isHistory }; });
    // cria taskArray (um array separado que pode ser usado para export/analytics) a partir de tasks se não existir
    var taskArray = Array.isArray(l.taskArray) ? l.taskArray.slice() : tasks.map(function(t){ return { id: t.id, text: t.text, done: !!t.done, _pointsAwarded: !!t._pointsAwarded, _isHistory: !!t._isHistory }; });

    // Template persistente para geração de próximas tarefas em listas repetitivas.
    // Não confundir com taskArray (que é efêmero e reseta à meia-noite).
    var templateTasks = Array.isArray(l.templateTasks) ? l.templateTasks.slice() : (taskArray && taskArray.length ? taskArray.map(function(t){ return { id: t.id || uid(), text: t.text }; }) : tasks.map(function(t){ return { id: t.id || uid(), text: t.text }; }));

    return {
      id: l.id || uid(),
      title: l.title || 'Sem título',
      tasks: tasks,
      taskArray: taskArray,
      templateTasks: templateTasks,
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


  // ----------------------
  // NOVAS FUNÇÕES: TASK ARRAY
  // ----------------------

  // Garante que list.taskArray exista e esteja sincronizada com list.tasks
  function ensureTaskArray(list) {
    if (!list) return;
    if (!Array.isArray(list.taskArray)) {
      list.taskArray = (list.tasks || []).map(function(t){ return { id: t.id, text: t.text, done: !!t.done, _pointsAwarded: !!t._pointsAwarded, _isHistory: !!t._isHistory }; });
      return;
    }
    // sincroniza flags de done e _pointsAwarded por id
    (list.tasks || []).forEach(function(t){
      var a = list.taskArray.find(function(x){ return x.id === t.id; });
      if (a) { a.text = t.text; a.done = !!t.done; a._pointsAwarded = !!t._pointsAwarded; }
      else { // tarefa presente em tasks mas não em taskArray -> adicionar
        list.taskArray.push({ id: t.id, text: t.text, done: !!t.done, _pointsAwarded: !!t._pointsAwarded, _isHistory: !!t._isHistory });
      }
    });
    // remove da taskArray itens que não existem mais em tasks (opcional)
    list.taskArray = list.taskArray.filter(function(a){ return (list.tasks || []).some(function(t){ return t.id === a.id; }); });
  }

  // Retorna uma cópia do array de tarefas para a lista indicada (por id). Se não houver, retorna [].
  function getTasksArray(listId) {
    var pg = getCurrentPage();
    var list = (pg.lists || []).find(function(l){ return l.id === listId; });
    if (!list) return [];
    ensureTaskArray(list);
    // devolve cópia para evitar mutação externa
    return (list.taskArray || []).map(function(t){ return Object.assign({}, t); });
  }

  // Constrói um objeto com { listId: [tasks...] } para a página atual
  function buildAllTaskArrays() {
    var pg = getCurrentPage();
    var out = {};
    (pg.lists || []).forEach(function(l){
      ensureTaskArray(l);
      out[l.id] = (l.taskArray || []).map(function(t){ return Object.assign({}, t); });
    });
    return out;
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
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];}); }

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
    // However, if a repeating list is *completed* and scheduled for the future it contains a history entry
    // (a task flagged with _isHistory). In that case we should count only those history records so the
    // global progress reflects that the occurrence was completed.
    for (var i = 0; i < lists.length; i++) {
      var l = lists[i];
      try {
        // If the list is a repeating list and is planned for the future...
        if (l.repeat && l.repeat !== 'once' && isPlannedFuture(l)) {
          // ...and it has history tasks (from previous completion), count only those history tasks.
          var htasks = (l.tasks || []).filter(function(t){ return !!t._isHistory; });
          for (var h = 0; h < htasks.length; h++) {
            total += 1;
            if (htasks[h].done) done += 1;
          }
          // otherwise (no history tasks) this planned list contributes nothing to today's progress.
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


    function getCurrentDate() {
      // Verifica se o 'FakeDate' foi configurado (usando __dateEmulator)
      if (window.__dateEmulator && window.__dateEmulator.getFakeNow) {
        const fakeNow = window.__dateEmulator.getFakeNow();
        if (fakeNow) {
          console.log("Data emulada:", fakeNow);  // Verifique no console se a data emulada está sendo usada
          return fakeNow;  // Retorna a data emulada
        }
      }

      // Caso contrário, use a data real
      const realDate = new Date();
      console.log("Data real:", realDate);  // Verifique no console se a data real está sendo usada
      return realDate;  // Retorna a data real
    }

  function isAvailableToday(list) {
      var today = startOfDay();
      var avail = startOfDay(new Date(list.availableOn || new Date().toISOString()));

      if (list.completed) {
          if (list.repeat && list.repeat !== 'once') {
              if (avail <= today) {
                  // Permitir prosseguir — consideraremos a lista disponível hoje mesmo que 'completed' esteja true
              } else {
                  return false;
              }
          } else {
              return false;
          }
      }

      // Verifica a repetição diária, semanal ou mensal
      if (list.repeat === 'daily') {
          return avail <= today;
      } else if (list.repeat === 'weekly') {
          if (Array.isArray(list.repeatDays) && list.repeatDays.length) {
              return avail <= today;
          }
          return avail <= today;
      } else if (list.repeat === 'monthly') {
          return avail <= today;
      } else {
          return avail <= today;
      }
  }

  function computeNextOccurrence(list) {
      var today = startOfDay();
      var avail = list.availableOn ? startOfDay(new Date(list.availableOn)) : null;

      // Se a lista for única ('once'), não há próxima ocorrência
      if (list.repeat === 'once') {
          if (avail && avail > today) return avail;
          return null;
      }

      // Para listas repetitivas, calcule a próxima ocorrência
      var maxDays = 365; // Limite de dias para busca
      for (var i = 1; i <= maxDays; i++) {
          var cand = startOfDay(new Date());
          cand.setDate(cand.getDate() + i);

          // Ignorar se a data inicial for maior que a data de disponibilidade
          if (avail && cand < avail) continue;

          if (list.repeat === 'daily') {
              return cand;
          } else if (list.repeat === 'weekly') {
              if (Array.isArray(list.repeatDays) && list.repeatDays.length) {
                  if (list.repeatDays.indexOf(cand.getDay()) !== -1) return cand;
              } else {
                  // Se não houver dias específicos, qualquer dia da semana serve
                  return cand;
              }
          } else if (list.repeat === 'monthly') {
              var baseDay = (typeof list.repeatDay === 'number' && !isNaN(list.repeatDay)) ? list.repeatDay : (avail ? (new Date(list.availableOn)).getDate() : null);
              if (!baseDay) continue;
              var year = cand.getFullYear(), month = cand.getMonth();
              var daysInMonth = new Date(year, month + 1, 0).getDate();
              var day = Math.min(baseDay, daysInMonth);
              if (cand.getDate() === day) return cand;
          }
      }
      return null; // Se não encontrar uma data válida, retorna null
  }


    function isPlannedFuture(list) {
      // determina se a lista é 'planejada' — ou seja, tem próxima ocorrência NO FUTURO (após hoje)
      var today = startOfDay();
      var avail = list.availableOn ? startOfDay(new Date(list.availableOn)) : null;

      // one-time lists: planned if availableOn is in the future
      if (list.repeat === 'once') {
        if (avail && avail > today) return true;
        return false;
      }

      // repeating lists:
      // if the list is available today (segundo regras de repetição), então NÃO é planejada
      if (isAvailableToday(list)) return false;

      // if availableOn exists and is in the future, it's planned
      if (avail && avail > today) return true;

      // otherwise compute the next occurrence after today; if it's > today, it's planned
      try {
        var next = computeNextOccurrence(list);
        if (next && startOfDay(next) > today) return true;
      } catch (e) {}

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
      // coletar dias da semana selecionados no formulário de edição
      var selectedWeekdays = Array.from(form.querySelectorAll('input[name=\"list-repeat-days-edit\"]:checked')).map(function(cb){return parseInt(cb.value,10);});
      // Prioridade: se o usuário especificou um dia do mês válido, tratar como repetição mensal
      if (!isNaN(md) && md >= 1 && md <= 31) {
        list.repeatDay = md;
        list.repeat = 'monthly';
        // ao definir mensal, removemos seleções semanais para evitar conflito
        list.repeatDays = [];
      } else {
        // nenhum dia do mês válido informado -> limpar repeatDay
        list.repeatDay = null;
        if (selectedWeekdays.length) {
          // se houver dias da semana selecionados, tratar como semanal
          list.repeatDays = selectedWeekdays;
          list.repeat = 'weekly';
        } else {
          // nenhuma seleção -> se antes era semanal ou mensal, remover repetição, caso contrário limpar repeatDays
          if (list.repeat === 'weekly' || list.repeat === 'monthly') {
            list.repeat = 'once';
            list.repeatDays = [];
            list.repeatDay = null;
          } else {
            list.repeatDays = Array.isArray(list.repeatDays) ? [] : [];
          }
        }
      }
      save(); renderLists(); var pg = getCurrentPage(); pg.selectedListId = list.id; renderTasks();
    });
    btnCancel.addEventListener('click', function(e){ e.stopPropagation(); renderLists(); renderTasks(); });
    actions.appendChild(btnCancel); actions.appendChild(btnSave);
    form.appendChild(inputTitle); form.appendChild(inputDate);
        var mdContainer = document.createElement('div');
    // ocupar a linha inteira para que o texto do input seja totalmente visível
    mdContainer.style.display = 'block';
    mdContainer.style.width = '100%';
    mdContainer.style.marginTop = '8px';
    mdContainer.style.boxSizing = 'border-box';
    // estilos no input para garantir que ocupe 100% da largura disponível
    inputMonthDay.style.width = '100%';
    inputMonthDay.style.boxSizing = 'border-box';
    inputMonthDay.style.padding = '8px 10px';
    inputMonthDay.style.fontSize = '14px';
    inputMonthDay.style.display = 'block';
        // Campo para selecionar múltiplos dias da semana (semana semanal)
    var weekdayLabel = document.createElement('label');
    weekdayLabel.textContent = 'Dias da semana (selecione um ou mais):';
    weekdayLabel.style.display = 'block';
    weekdayLabel.style.marginTop = '6px';
    weekdayLabel.style.fontSize = '13px';
    var days = [
      {v:0,t:'Dom'},
      {v:1,t:'Seg'},
      {v:2,t:'Ter'},
      {v:3,t:'Qua'},
      {v:4,t:'Qui'},
      {v:5,t:'Sex'},
      {v:6,t:'Sáb'}
    ];
    var weekdayContainer = document.createElement('div');
    weekdayContainer.style.display = 'block';
    weekdayContainer.style.width = '100%';
    weekdayContainer.style.marginTop = '4px';
    weekdayContainer.appendChild(weekdayLabel);
    var checkRow = document.createElement('div'); checkRow.style.display='flex'; checkRow.style.gap='6px'; checkRow.style.flexWrap='wrap'; checkRow.style.marginTop='6px';
    days.forEach(function(d){
      var cbWrap = document.createElement('label'); cbWrap.style.display='inline-flex'; cbWrap.style.alignItems='center'; cbWrap.style.gap='6px'; cbWrap.style.padding='4px 6px'; cbWrap.style.borderRadius='6px'; cbWrap.style.border='1px solid transparent';
      var cb = document.createElement('input'); cb.type='checkbox'; cb.name='list-repeat-days-edit'; cb.value = String(d.v);
      // pre-check if list.repeatDays contains this day
      if (Array.isArray(list.repeatDays) && list.repeatDays.indexOf(d.v) !== -1) cb.checked = true;
      var span = document.createElement('span'); span.textContent = d.t; span.style.fontSize='13px';
      cbWrap.appendChild(cb); cbWrap.appendChild(span); checkRow.appendChild(cbWrap);
    });
    weekdayContainer.appendChild(checkRow);
    form.appendChild(weekdayContainer);

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
    // garante que exista taskArray sincronizada
    ensureTaskArray(list);

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
        var cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!task.done; cb.disabled = (list.repeat !== 'once'); cb.addEventListener('change', function(){ if(cb.disabled) return; toggleTask(list.id, task.id); });
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
    btnConfirm.disabled = (planned && list.repeat !== 'once') || !((list.tasks || []).length && (list.tasks || []).every(function(t){ return t.done; }) && !list.completed);
  }

  // actions adapted to current page
  function addList(title, repeat, availableOnISO, repeatDays, repeatDay) {
    var pg = getCurrentPage();
    title = (title || '').trim(); if (!title) return;
    var now = new Date();
    var availableOn = availableOnISO || startOfDay(now).toISOString();
    var item = {
      id: uid(), title: title, tasks: [], taskArray: [], templateTasks: [], completed: false, completedAt: null,
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
    var list = pg.lists.find(function(l){ return l.id === listId; });
    if (!list) return;
    var newTask = { id: uid(), text: text, done: false };
    list.tasks.push(newTask);
    // garantir taskArray e adicionar lá também (efêmero)
    ensureTaskArray(list);
    list.taskArray.push({ id: newTask.id, text: newTask.text, done: false, _pointsAwarded: false, _isHistory: false });
    // garantir templateTasks (modelo persistente) — adiciona apenas se não existir texto igual (trimmed, case-insensitive)
    if (!Array.isArray(list.templateTasks)) list.templateTasks = [];
    var exists = (list.templateTasks || []).some(function(tt){ return (tt.text || '').trim().toLowerCase() === text.trim().toLowerCase(); });
    if (!exists) {
        list.templateTasks.push({ id: uid(), text: text });
    }
    save(); renderLists(); renderTasks();
  }




function setCompletedAndSchedule(list) {
  // marca timestamp da ocorrência atual
  list.completedAt = (new Date()).toISOString();

  if (!list.bonusAwarded) {
    list.bonusAwarded = true;
  }

  // Se for repetitiva (não 'once'), re-agendamos e criamos histórico
  if (list.repeat && list.repeat !== 'once') {
    var next = null;
    try { next = computeNextOccurrence(list); } catch(e) { next = null; }

    // --- Criar snapshot das tarefas da ocorrência atual (não-históricas)
    var currentOccurrence = (list.tasks || []).filter(function(t){ return !t._isHistory; });
    var origTasks = currentOccurrence.length ? currentOccurrence : (list.tasks || []).slice();

    // --- Criar snapshot de histórico: todas as tarefas da ocorrência atual marcadas como concluídas
    var historyTasks = origTasks.map(function(t) {
      return {
        id: uid(),
        text: t.text,
        done: true,
        _isHistory: true,
        _originTaskId: t.id || null,
        _completedAt: (new Date()).toISOString(),
        _pointsAwarded: !!t._pointsAwarded
      };
    });

    // --- Determinar origem/template para próximas tarefas
    // Preferimos usar list.templateTasks (modelo persistente) se existir e tiver conteúdo.
    var templateSourceRaw = Array.isArray(list.templateTasks) && list.templateTasks.length ? list.templateTasks : origTasks.map(function(t){ return { text: t.text }; });

    // Deduplicar o template por texto (trim + lowercase)
    var seen = {};
    var templateSource = [];
    templateSourceRaw.forEach(function(item){
      var key = (item.text || '').toString().trim().toLowerCase();
      if (!key) return;
      if (!seen[key]) { seen[key] = true; templateSource.push(item); }
    });

    // --- Criar tarefas limpas para a próxima ocorrência (incompletas) => geradas a partir do templateSource
    var nextTasks = templateSource.map(function(t){
      return {
        id: uid(),
        text: t.text,
        done: false,
        _pointsAwarded: false
      };
    });

    // Junta histórico + próximas tarefas (histórico vem primeiro)
    list.tasks = historyTasks.concat(nextTasks);

    // NÃO sobrescrevemos list.templateTasks aqui — é o modelo persistente.
    // Mas podemos atualizar taskArray (efêmero) para refletir as próximas tarefas se desejado:
    // list.taskArray = nextTasks.map(function(t){ return { id: t.id, text: t.text, done: t.done, _pointsAwarded: t._pointsAwarded }; });

    // Agendar próxima ocorrência (se encontrada)
    if (next) {
      list.availableOn = startOfDay(next).toISOString();
    } else {
      list.availableOn = startOfDay().toISOString();
    }

    list.completed = false;
  } else {
    // Para listas 'once' comportamento normal: marcar concluída permanentemente
    list.completed = true;
    list.completedAt = (new Date()).toISOString();
    // sincroniza taskArray também (todas as tasks permanecem)
    ensureTaskArray(list);
  }

  save();
  renderLists();
  renderTasks();
}







  function toggleTask(listId, taskId) {
    var pg = getCurrentPage();
    var list = pg.lists.find(function(l){ return l.id === listId; });
    if (!list) return;
    var task = (list.tasks || []).find(function(t){ return t.id === taskId; });
    if (!task) return;
    var prev = !!task.done;
    task.done = !task.done;

    // Also sync in taskArray (if present)
    ensureTaskArray(list);
    var ta = list.taskArray.find(function(x){ return x.id === taskId; });
    if (ta) { ta.done = !!task.done; }

    // Variáveis para controlar os pontos a serem adicionados
    var pointsToAdd = 0;

    if (!prev && task.done) {
        // Adiciona pontos da tarefa, mas verifica se já foram adicionados
        if (!task._pointsAwarded) {
            pointsToAdd += POINTS_PER_TASK;
            task._pointsAwarded = true;  // Marcar a tarefa como pontuada
            if (ta) ta._pointsAwarded = true;
        }
    } else if (prev && !task.done) {
        // Remove pontos da tarefa
        if (task._pointsAwarded) {
            pointsToAdd -= POINTS_PER_TASK;
            task._pointsAwarded = false;  // Desmarcar a tarefa como pontuada
            if (ta) ta._pointsAwarded = false;
        }
    }

    // Verifica se todas as tarefas estão feitas
    var allDone = (list.tasks || []).length > 0 && (list.tasks || []).every(function(t){ return t.done; });

    if (allDone && !list.completed) {
        // A lista está completa e deve ser marcada como concluída
        pointsToAdd += BONUS_PER_LIST;
        setCompletedAndSchedule(list);  // Marca como concluída e agenda a próxima ocorrência
    } else if (!allDone && list.completed) {
        if (list.bonusAwarded) {
            // Remove o bônus se a lista não estiver mais completa
            pointsToAdd -= BONUS_PER_LIST;
            list.bonusAwarded = false;
        }
        list.completed = false;
        list.completedAt = null;
    }

    // Atualiza os pontos da lista
    list.pointsAwarded = (Number(list.pointsAwarded) || 0) + pointsToAdd;

    // Anima apenas uma vez, com a quantidade total de pontos
    animatePoints(pointsToAdd);
    try { playShortChime(); } catch(e){}

    save(); renderLists(); renderTasks();
  }

  function removeTask(listId, taskId) {
    var pg = getCurrentPage();
    var list = pg.lists.find(function(l){ return l.id === listId; });
    if (!list) return;
    var removed = (list.tasks || []).find(function(t){ return t.id === taskId; });
    if (removed && removed.done) {
      list.pointsAwarded = Math.max(0, (Number(list.pointsAwarded) || 0) - POINTS_PER_TASK);
      animatePoints(-POINTS_PER_TASK);
    }
    list.tasks = (list.tasks || []).filter(function(t){ return t.id !== taskId; });
    // remover também de taskArray (se existir)
    if (Array.isArray(list.taskArray)) {
      list.taskArray = list.taskArray.filter(function(a){ return a.id !== taskId; });
    }
    if ((list.tasks || []).length === 0) { list.completed = false; list.bonusAwarded = false; list.completedAt = null; }
    save(); renderLists(); renderTasks();
  }

  function confirmCompletion(listId) {
    var pg = getCurrentPage();
    var list = pg.lists.find(function(l){ return l.id === listId; });
    if (!list) return;
    if (!list.tasks || !list.tasks.length) return;
    if (!(list.tasks.every(function(t){ return t.done; }))) return;
    setCompletedAndSchedule(list);
    try { playShortChime(); } catch(e){}
    save(); renderLists(); renderTasks();
  }

  // view mode per page
  function setViewMode(mode) {
    var pg = getCurrentPage();
    pg.viewMode = mode || 'active';
    if (tabActive) tabActive.classList.toggle('active', pg.viewMode === 'active');
    if (tabPlanned) tabPlanned.classList.toggle('active', pg.viewMode === 'planned');
    if (tabCompleted) tabCompleted.classList.toggle('active', pg.viewMode === 'completed');
    save(); renderLists(); renderTasks();
  }

  // --- EDIT INLINE ON THE ACTIVE TAB (keeps previous behavior: inline input) ---
  function startEditActiveTab() {
    if (!pagesListEl) return;
    var activeTab = pagesListEl.querySelector('.tab.active');
    if (!activeTab) return;
    var pageId = activeTab.getAttribute('data-page-id');
    var page = state.pages.find(function(p){ return p.id === pageId; });
    if (!page) return;

    if (activeTab.classList.contains('editing')) return;

    var originalTitle = page.title || '';
    activeTab.classList.add('editing');

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'page-tab-input';
    input.value = originalTitle;
    input.setAttribute('aria-label','Editar título da página');

    activeTab.innerHTML = '';
    activeTab.appendChild(input);
    input.focus();
    input.setSelectionRange(0, input.value.length);

    function commit() {
      var newVal = input.value.trim();
      if (!newVal) { alert('O título não pode ficar vazio.'); input.focus(); return; }
      page.title = newVal;
      save();
      renderPagesNav();
      setCurrentPage(page.id);
    }
    function cancel() {
      renderPagesNav();
      setCurrentPage(page.id);
    }

    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', function(){ commit(); });
  }

  // wire the edit button to start inline edit
  if (btnEditPage) btnEditPage.addEventListener('click', function () {
    startEditActiveTab();
  });

  // add page via nav
  if (btnAddPageNav) {
    btnAddPageNav.addEventListener('click', function () {
      var title = newPageTitleInput ? newPageTitleInput.value.trim() : '';
      if (!title) { alert('Insira um título para a nova página.'); return; }
      addPage(title);
      if (newPageTitleInput) newPageTitleInput.value = '';
    });
    if (newPageTitleInput) {
      newPageTitleInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') btnAddPageNav.click(); });
    }
  }

  // excluir página atual
  if (btnDeletePageNav) {
    btnDeletePageNav.addEventListener('click', function () {
      removeCurrentPage();
    });
  }

  // add list / tasks events (unchanged)
  if (btnAddList) btnAddList.addEventListener('click', function () {
    var repeatVal = (document.querySelector('input[name="repeat"]:checked') || { value: 'once' }).value;
    var dateVal = newListDate ? newListDate.value : '';
    var avail = parseInputDate(dateVal) || null;
    var repeatDays = Array.from(document.querySelectorAll('#form-add-list input[name="list-repeat-days"]:checked')).map(function(cb){return parseInt(cb.value,10);});
    var monthlyDay = null;
    if (monthlyInput && monthlyInput.value) {
      var md = parseInt(monthlyInput.value,10);
      if (!isNaN(md) && md >=1 && md <=31) monthlyDay = md;
    }
    addList(newListTitle.value, repeatVal, avail, repeatDays, monthlyDay);
    newListTitle.value=''; if (newListDate) newListDate.value=''; if (monthlyInput) monthlyInput.value='';
  });

  if (btnAddTask) btnAddTask.addEventListener('click', function(){ var pg = getCurrentPage(); if (pg.selectedListId) addTask(pg.selectedListId, newTaskText.value); newTaskText.value=''; });
  if (btnConfirm) btnConfirm.addEventListener('click', function(){ var pg = getCurrentPage(); if (pg.selectedListId) confirmCompletion(pg.selectedListId); });
  if (btnDeleteList) btnDeleteList.addEventListener('click', function(){ var pg = getCurrentPage(); var idx = pg.lists.findIndex(function(l){return l.id === pg.selectedListId}); if (idx>-1 && confirm('Deseja realmente excluir esta lista?')) { pg.lists.splice(idx,1); save(); renderLists(); renderTasks(); } });

  if (tabActive) tabActive.addEventListener('click', function(){ setViewMode('active'); });
  if (tabPlanned) tabPlanned.addEventListener('click', function(){ setViewMode('planned'); });
  if (tabCompleted) tabCompleted.addEventListener('click', function(){ setViewMode('completed'); });

  if (newListTitle) newListTitle.addEventListener('keydown', function(e){ if (e.key === 'Enter') btnAddList.click(); });
  if (newTaskText) newTaskText.addEventListener('keydown', function(e){ if (e.key === 'Enter') btnAddTask.click(); });

  // persistence init
  load();
  renderPagesNav();
  if (!state.pages.find(function(p){ return p.id === state.currentPageId; })) state.currentPageId = state.pages[0].id;
  save();
  renderPagesNav();
  renderLists();
  renderTasks();
  updatePointsDisplay();
  lastOverallPercent = computeOverallProgressCurrentPage();


// repeat controls init (robust)
(function setupRepeatControls(){
  var form = document.getElementById('form-add-list');
  var weeklyControls = document.getElementById('weekly-controls');
  var monthlyControls = document.getElementById('monthly-controls');
  var listRepeatControlsEl = document.getElementById('list-repeat-controls');

  function updateRepeatControlsDisplay(){
    var weeklyChecked = (document.getElementById('repeat-weekly') && document.getElementById('repeat-weekly').checked);
    var monthlyChecked = (document.getElementById('repeat-monthly') && document.getElementById('repeat-monthly').checked);
    if (!listRepeatControlsEl) return;
    if (weeklyChecked) {
      if (weeklyControls) weeklyControls.style.display = 'flex';
      if (monthlyControls) monthlyControls.style.display = 'none';
      listRepeatControlsEl.style.display = 'block';
    } else if (monthlyChecked) {
      if (weeklyControls) weeklyControls.style.display = 'none';
      if (monthlyControls) monthlyControls.style.display = 'flex';
      listRepeatControlsEl.style.display = 'block';
    } else {
      if (weeklyControls) weeklyControls.style.display = 'none';
      if (monthlyControls) monthlyControls.style.display = 'none';
      listRepeatControlsEl.style.display = 'none';
    }
  }

  // Listen centrally on the form for changes to inputs named 'repeat'
  if (form) {
    form.addEventListener('change', function(e){
      var target = e.target;
      if (!target) return;
      if (target.name === 'repeat' || target.id === 'repeat-weekly' || target.id === 'repeat-monthly' || target.id === 'repeat-daily') {
        // small timeout to ensure radio state updated in some browsers
        setTimeout(updateRepeatControlsDisplay, 0);
      }
    }, false);
  }

  // initialize display on load
  try { updateRepeatControlsDisplay(); } catch(e) {}
})();
;

  // expose some functions for debugging in console (if needed)
  window.__mini_todo_state = state;
  window.__mini_todo_save = save;
  window.__mini_todo_computeLevel = computeLevelFromPoints;
  // novas exposições úteis:
  window.__mini_todo_getTasksArray = getTasksArray;
  window.__mini_todo_buildAllTaskArrays = buildAllTaskArrays;
});



// ----------------------
// RESET DIÁRIO (MEIA-NOITE)
// ----------------------
// Objetivo: esvaziar list.taskArray para todas as listas à meia-noite local.
// Estratégia:
// 1) Ao carregar: verificamos se o último reset registrado no localStorage é de outro dia — se sim, limpamos.
// 2) Agendamos um setTimeout até a próxima meia-noite; quando disparar, limpamos e então disparamos um setInterval de 24h.
// 3) Expondo uma função de debug: window.__mini_todo_forceClearTaskArrays()

(function setupDailyTaskArrayReset(){
  var RESET_KEY = 'mini_todo_taskArray_lastReset_v1';

  function clearAllTaskArrays() {
    try {
      state.pages.forEach(function(pg){
        (pg.lists || []).forEach(function(l){
          l.taskArray = [];
        });
      });
      save();
      // re-render para atualizar a UI caso o usuário esteja com a página aberta
      try { renderLists(); renderTasks(); updateGlobalProgress(); } catch(e) {}
    } catch (e) { console.error('Erro ao limpar taskArray:', e); }
  }

  function todayKeyString() {
    return startOfDay().toISOString().slice(0,10); // YYYY-MM-DD
  }

  function performDailyResetIfNeeded() {
    try {
      var last = localStorage.getItem(RESET_KEY);
      var today = todayKeyString();
      if (last !== today) {
        // Executa o reset (limpa arrays) e grava a data
        clearAllTaskArrays();
        localStorage.setItem(RESET_KEY, today);
        console.log('[mini_todo] taskArray reset realizado para o dia', today);
      } else {
        // já resetado hoje
      }
    } catch (e) { console.error('performDailyResetIfNeeded erro:', e); }
  }

  function scheduleMidnightReset() {
    try {
      var now = new Date();
      var nextMidnight = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      var delay = nextMidnight.getTime() - now.getTime();
      if (delay < 0) delay = 0;
      // timeout até a próxima meia-noite
      setTimeout(function() {
        try {
          clearAllTaskArrays();
          localStorage.setItem(RESET_KEY, todayKeyString());
          // após o primeiro acionamento, agendamos interval de 24h (aproximação suficiente)
          setInterval(function(){
            try {
              clearAllTaskArrays();
              localStorage.setItem(RESET_KEY, todayKeyString());
            } catch(e) { console.error('interval clear error', e); }
          }, 24 * 60 * 60 * 1000);
        } catch (e) { console.error('Erro no timeout de meia-noite:', e); }
      }, delay);
    } catch (e) { console.error('scheduleMidnightReset erro:', e); }
  }

  // Expor função para debug/manual trigger
  window.__mini_todo_forceClearTaskArrays = function(){ clearAllTaskArrays(); localStorage.setItem(RESET_KEY, todayKeyString()); };

  // Executar verificação imediatamente na inicialização
  try { performDailyResetIfNeeded(); scheduleMidnightReset(); } catch(e){ console.error('setupDailyTaskArrayReset erro:', e); }
})();
