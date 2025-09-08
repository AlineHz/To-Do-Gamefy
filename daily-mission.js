/* daily-missions.js
   Missões diárias (conta tarefas ao serem selecionadas + listas concluídas hoje)
   - Conta tarefa no momento da seleção (antes de ser movida para concluída)
   - Mantém contagem fixa por dia (não decrementa se usuário desmarcar)
*/

(function(window, document){
  'use strict';

  var LS_INVENTORY_KEY = 'mini_todo_inventory_v1';
  var LS_MISSIONS_KEY = 'mini_todo_daily_missions_v1';
  var LS_COUNTED_TASKS_KEY = 'mini_todo_counted_tasks_v1'; // { "YYYY-MM-DD": ["id1","id2",...] }

  var ITEM_POOL = [
    { id: 'moeda_bulldog', name: 'Moeda Bulldog', emoji: '💎', desc: 'Uma moeda colecionável com tema Bulldog.' },
    { id: 'moeda_calopsita', name: 'Moeda Calopsita', emoji: '💎', desc: 'Uma moeda colecionável com tema Calopsita.' },
    { id: 'moeda_coelho', name: 'Moeda Coelho', emoji: '💎', desc: 'Uma moeda colecionável com tema Coelho.' },
    { id: 'moeda_collie', name: 'Moeda Collie', emoji: '💎', desc: 'Uma moeda colecionável com tema Collie.' },
    { id: 'moeda_corgi', name: 'Moeda Corgi', emoji: '💎', desc: 'Uma moeda colecionável com tema Corgi.' },
    { id: 'moeda_gato_angora', name: 'Moeda Gato Angora', emoji: '💎', desc: 'Uma moeda colecionável com tema Gato Angora.' },
    { id: 'moeda_gato_bombay', name: 'Moeda Gato Bombay', emoji: '💎', desc: 'Uma moeda colecionável com tema Gato Bombay.' },
    { id: 'moeda_gato_cinza', name: 'Moeda Gato Cinza', emoji: '💎', desc: 'Uma moeda colecionável com tema Gato Cinza.' },
    { id: 'moeda_gato_laranja', name: 'Moeda Gato Laranja', emoji: '💎', desc: 'Uma moeda colecionável com tema Gato Laranja.' },
    { id: 'moeda_golden', name: 'Moeda Golden', emoji: '💎', desc: 'Uma moeda colecionável com tema Golden.' },
    { id: 'moeda_hamster', name: 'Moeda Hamster', emoji: '💎', desc: 'Uma moeda colecionável com tema Hamster.' },
    { id: 'moeda_husky', name: 'Moeda Husky', emoji: '💎', desc: 'Uma moeda colecionável com tema Husky.' },
    { id: 'moeda_macaco', name: 'Moeda Macaco', emoji: '💎', desc: 'Uma moeda colecionável com tema Macaco.' },
    { id: 'moeda_rotweiller', name: 'Moeda Rotweiller', emoji: '💎', desc: 'Uma moeda colecionável com tema Rotweiller.' },
    { id: 'moeda_tartaruga', name: 'Moeda Tartaruga', emoji: '💎', desc: 'Uma moeda colecionável com tema Tartaruga.' }
  ];

  /* ---------- storage helpers ---------- */
  function safeJSONParse(s, fallback){ try { return JSON.parse(s||'null') || fallback; } catch(e){ return fallback; } }
  function loadInventory(){ return safeJSONParse(localStorage.getItem(LS_INVENTORY_KEY), []) || []; }
  function saveInventory(inv){ try { localStorage.setItem(LS_INVENTORY_KEY, JSON.stringify(inv||[])); } catch(e){} }
  function loadMissions(){ return safeJSONParse(localStorage.getItem(LS_MISSIONS_KEY), null); }
  function saveMissions(data){ try { localStorage.setItem(LS_MISSIONS_KEY, JSON.stringify(data)); } catch(e){} }

  function loadCountedMap(){ return safeJSONParse(localStorage.getItem(LS_COUNTED_TASKS_KEY), {} ) || {}; }
  function saveCountedMap(m){ try { localStorage.setItem(LS_COUNTED_TASKS_KEY, JSON.stringify(m||{})); } catch(e){} }

  function todayKey(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function defaultMissionsState(){
    var td = todayKey();
    return {
      date: td,
      missions: {
        complete3Tasks: { id: 'complete3Tasks', title: 'Completar 3 tarefas', target: 3, progress: 0, completed: false },
        dailyLogin:     { id: 'dailyLogin', title: 'Login diário', target: 1, progress: 0, completed: false }
      },
      combinedClaimedOn: null
    };
  }

  function getState(){
    var st = loadMissions();
    var td = todayKey();
    if (!st || st.date !== td){
      st = defaultMissionsState();
      saveMissions(st);
    }
    if (typeof st.combinedClaimedOn === 'undefined') st.combinedClaimedOn = null;
    return st;
  }
  function saveState(st){ saveMissions(st); }

  /* ---------- counted tasks (per-day, immutable for the day) ---------- */
  function getTodayCountedSet(){
    var map = loadCountedMap();
    var td = todayKey();
    var arr = map[td] || [];
    try { return new Set(arr); } catch(e) { return new Set(arr || []); }
  }
  function isTaskCountedToday(id){
    if (!id) return false;
    var s = getTodayCountedSet();
    return s.has(id);
  }
  function addCountedTaskIdToday(id){
    if (!id) return false;
    var map = loadCountedMap();
    var td = todayKey();
    map[td] = map[td] || [];
    if (map[td].indexOf(id) === -1){
      map[td].push(id);
      saveCountedMap(map);
      // dispatch event so other UIs can react
      try{ document.dispatchEvent(new CustomEvent('mini_todo_task_counted', { detail: { id: id, date: td } })); } catch(e){}
      return true;
    }
    return false;
  }
  function countedTaskIdsToday(){
    var s = getTodayCountedSet();
    return Array.from(s);
  }

  /* ---------- helpers to identify a task element (stable-ish) ---------- */
  function normalizeText(s){ return String(s||'').replace(/\s+/g,' ').trim().slice(0,200); }

  function getTaskIdentifier(taskEl){
    try{
      if (!taskEl) return null;
      // prefer dataset.uid / data-uid
      if (taskEl.dataset && taskEl.dataset.uid) return 'uid:'+taskEl.dataset.uid;
      if (taskEl.getAttribute && taskEl.getAttribute('data-uid')) return 'uid:'+taskEl.getAttribute('data-uid');
      if (taskEl.getAttribute && taskEl.getAttribute('data-id')) return 'id:'+taskEl.getAttribute('data-id');
      if (taskEl.id) return 'id:'+taskEl.id;
      // check checkbox inside
      var cb = taskEl.querySelector && taskEl.querySelector('input[type="checkbox"], input[type="radio"]');
      if (cb){
        if (cb.dataset && cb.dataset.uid) return 'uid:'+cb.dataset.uid;
        if (cb.id) return 'cb:'+cb.id;
        if (cb.name) return 'cbname:'+cb.name + ':' + (cb.value || '');
      }
      // fallback: text + parent context
      var textNode = taskEl.querySelector && (taskEl.querySelector('.text') || taskEl.querySelector('.task-text') || taskEl.querySelector('label')) ;
      var text = textNode ? textNode.textContent : taskEl.textContent;
      text = normalizeText(text);
      var parent = taskEl.closest && (taskEl.closest('.list-item') || taskEl.closest('.list') || taskEl.closest('#lists') ) ;
      var pkey = '';
      if (parent){
        if (parent.dataset && parent.dataset.uid) pkey = parent.dataset.uid;
        else if (parent.id) pkey = parent.id;
        else pkey = normalizeText(parent.textContent).slice(0,60);
      }
      return 'gen:' + (text || 'untitled') + '|' + pkey;
    } catch(e){
      try{ return 'gen:' + (taskEl.textContent||'').trim().slice(0,80); }catch(ee){ return null; }
    }
  }

  /* ---------- lists completed today detection (keeps previous heuristics) ---------- */

  function extractDateFromString(str){
    if (!str) return null;
    str = String(str).trim();
    var iso = str.match(/(\d{4}[\/-]\d{2}[\/-]\d{2})/);
    if (iso) return new Date(iso[1].replace(/\//g,'-'));
    var dmy = str.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
    if (dmy){
      var parts = dmy[1].split(/[\/-]/);
      return new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
    }
    return null;
  }

  function isSameDay(d1, d2){
    return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
  }

  function countListsCompletedToday(){
    try{
      var root = document.getElementById('lists') || document.querySelector('.lists') || document.querySelector('#app');
      if (!root) return 0;
      var candidates = [];
      var selList = ['.list-item', '.list', '.list-row', '.todo-list', '.page-list-item'];
      selList.forEach(function(s){ Array.prototype.forEach.call(root.querySelectorAll(s), function(el){ candidates.push(el); }); });

      Array.prototype.forEach.call(root.querySelectorAll('*'), function(el){
        if (candidates.indexOf(el) !== -1) return;
        var cls = (el.className || '') + '';
        if (/\b(completed|done|concluida|concluido|finalizada|finalizado|concluded)\b/i.test(cls)){
          candidates.push(el);
        } else {
          var t = (el.textContent||'').trim();
          if (t && /\b(concluida|concluido|concluída|finalizada|finalizado|conclu)\b/i.test(t) && el.childElementCount===0){
            candidates.push(el.parentElement || el);
          }
        }
      });

      var today = new Date();
      var counted = 0;
      var seen = new Set();
      candidates.forEach(function(el){
        if (!el || seen.has(el)) return;
        var listEl = el.closest('.list-item') || el.closest('.list') || el;
        if (!listEl || seen.has(listEl)) return;
        seen.add(listEl);

        var attrDate = listEl.getAttribute && (listEl.getAttribute('data-completed-at') || listEl.getAttribute('data-completed'));
        if (attrDate){
          var parsed = extractDateFromString(attrDate);
          if (parsed && isSameDay(parsed, today)){ counted++; return; }
        }

        var candDateEl = listEl.querySelector && ( listEl.querySelector('.completed-at') || listEl.querySelector('.list-completed-at') || listEl.querySelector('.completedOn') || listEl.querySelector('.completed-date') );
        if (candDateEl){
          var parsed2 = extractDateFromString(candDateEl.textContent || candDateEl.getAttribute('datetime') || '');
          if (parsed2 && isSameDay(parsed2, today)){ counted++; return; }
        }

        var clsAll = (listEl.className || '') + '';
        if (/\b(completed|done|concluded|concluida|concluido|finalizada|finalizado)\b/i.test(clsAll)) { counted++; return; }

        var metaText = (listEl.textContent || '').trim();
        if (/\b(concluida|concluido|concluídas|concluidas|concluído|finalizada|finalizado)\b/i.test(metaText)){
          var foundDate = extractDateFromString(metaText);
          if (foundDate){
            if (isSameDay(foundDate, today)){ counted++; return; }
          } else {
            counted++; return;
          }
        }
      });

      return counted;
    }catch(e){
      console.error('daily-missions:countListsCompletedToday error', e);
      return 0;
    }
  }

  /* ---------- tasks + lists progress aggregation (now uses counted tasks set) ---------- */
  function computeCombinedProgress(){
    try{
      var tasksCounted = countedTaskIdsToday().length;
      var listsDone = countListsCompletedToday();
      return { tasksDone: tasksCounted, listsDone: listsDone, total: (tasksCounted + listsDone) };
    }catch(e){ return { tasksDone:0, listsDone:0, total:0 }; }
  }

  /* ---------- awarding / inventory ---------- */
  function makeCoinItemFromPool(chosen){
    var meta = chosen || ITEM_POOL[Math.floor(Math.random()*ITEM_POOL.length)];
    return {
      uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
      code: meta.id,
      name: meta.name,
      emoji: meta.emoji || '💎',
      desc: meta.desc || 'Recompensa de missão diária',
      awardedAt: new Date().toISOString(),
      level: 0
    };
  }

  function awardRandomCoinAndNotify(missionId){
    try {
      var chosen = ITEM_POOL[Math.floor(Math.random()*ITEM_POOL.length)];
      var item = makeCoinItemFromPool(chosen);
      var inv = loadInventory(); inv.push(item); saveInventory(inv);
      try{ document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: item.code, delta: +1 } })); } catch(e){}
      try{ document.dispatchEvent(new CustomEvent('mini_todo_mission_awarded', { detail: { missionId: missionId, item: item } })); } catch(e){}
      showToast('Missão completada! Você recebeu ' + item.emoji + ' ' + item.name + '!');
      return item;
    } catch(e){ console.error('awardRandomCoin error', e); return null; }
  }

  /* ---------- UI helpers & panel ---------- */
  function showToast(msg){
    try{
      var t = document.createElement('div');
      t.className = 'rwd-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateY(8px)'; }, 1600);
      setTimeout(function(){ try{ document.body.removeChild(t); }catch(e){} }, 2200);
    }catch(e){}
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g, function(ch){ return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]; }); }

  function ensureMissionsUI(){
    var sidebar = document.querySelector('.progress-sidebar'); if (!sidebar) return false;
    if (sidebar.querySelector('#rwd-missions-toggle')) return true;

    var controls = sidebar.querySelector('.rwd-controls');
    if (!controls){
      controls = document.createElement('div');
      controls.className = 'rwd-controls';
      var header = sidebar.querySelector('#fixed-progress-title');
      if (header && header.parentNode) header.parentNode.insertBefore(controls, header.nextSibling);
      else sidebar.insertBefore(controls, sidebar.firstChild);
    }

    var actionWrap = document.createElement('div'); actionWrap.className='rwd-action';
    var btn = document.createElement('button');
    btn.id = 'rwd-missions-toggle';
    btn.type = 'button';
    btn.className = 'rwd-action-btn';
    btn.textContent = '🎯 Missões';
    btn.title = 'Abrir painel de missões diárias';
    btn.addEventListener('click', function(){
      var p = sidebar.querySelector('#rwd-missions-panel');
      if (p) p.classList.toggle('open'); else renderMissionsPanel();
    });
    actionWrap.appendChild(btn);
    controls.appendChild(actionWrap);

    if (!sidebar.querySelector('#rwd-missions-panel')){
      var panel = document.createElement('div');
      panel.id = 'rwd-missions-panel';
      panel.className = 'rwd-slot-panel';
      panel.style.marginTop = '8px';
      panel.innerHTML = '<div class="rwd-slot-row">Carregando missões...</div>';
      sidebar.appendChild(panel);
    }

    renderMissionsPanel();

    (function removeResetBtn(){
      try{ var el = document.getElementById('rwd-missions-reset'); if (el && el.parentNode) el.parentNode.removeChild(el); }catch(e){}
    })();

    return true;
  }

  function renderMissionsPanel(){
    var sidebar = document.querySelector('.progress-sidebar'); if (!sidebar) return;
    var panel = sidebar.querySelector('#rwd-missions-panel'); if (!panel) return;
    var st = getState();
    var m = st.missions;

    // compute combined progress (updates state.progress for UI)
    var combined = computeCombinedProgress();
    var c = m.complete3Tasks;
    c.progress = Math.min(combined.total, c.target);
    c.completed = (c.progress >= c.target);
    saveState(st);

    var html = '';
    html += '<div style="padding:10px">';
    html += '<div style="font-weight:700;margin-bottom:6px">Missões diárias</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';

    // complete3Tasks
    html += '<div style="padding:8px;border-radius:8px;background:linear-gradient(180deg,#fff,#fbfbff);border:1px solid #f3f4f6;display:flex;flex-direction:column;gap:6px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:700">' + escapeHtml(c.title) + '</div><div style="color:#9ca3af;font-size:13px">' + (c.completed ? 'Concluída' : 'Em progresso') + '</div></div>';
    html += '<div style="font-size:13px;color:#6b7280">Progresso total: ' + c.progress + ' / ' + c.target + ' (Tarefas contadas: ' + combined.tasksDone + ', Listas hoje: ' + combined.listsDone + ')</div>';
    html += '</div>';

    // dailyLogin
    var d = m.dailyLogin;
    html += '<div style="padding:8px;border-radius:8px;background:linear-gradient(180deg,#fff,#fbfbff);border:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">';
    html += '<div><div style="font-weight:700">' + escapeHtml(d.title) + '</div>';
    html += '<div style="font-size:13px;color:#6b7280">' + (d.progress ? 'Logado hoje' : 'Não logado') + '</div></div>';
    html += '<div style="color:#9ca3af;font-size:13px">' + (d.completed ? 'Concluída' : 'Aguardando') + '</div>';
    html += '</div>';

    // combined claim area
    var combinedClaimed = st.combinedClaimedOn;
    if (m.complete3Tasks.completed && m.dailyLogin.completed && !combinedClaimed) {
      html += '<div style="padding:8px;border-radius:8px;background:linear-gradient(180deg,#fff,#fbfbff);border:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center">';
      html += '<div><div style="font-weight:700">Recompensa de Conquista</div><div style="font-size:13px;color:#6b7280">Complete ambas missões para reivindicar 1 moeda.</div></div>';
      html += '<div><button id="rwd-claim-both" class="rwd-action-btn">Reclamar recompensa</button></div>';
      html += '</div>';
    } else if (combinedClaimed) {
      html += '<div style="padding:8px;border-radius:8px;background:#fff;border:1px solid #f3f4f6;color:#9ca3af">Reivindicada: ' + escapeHtml(combinedClaimed) + '</div>';
    } else {
      html += '<div style="padding:8px;border-radius:8px;background:#fff;border:1px solid #f3f4f6;color:#9ca3af">Reivindique quando ambas as missões estiverem completas.</div>';
    }

    html += '</div></div>';

    panel.innerHTML = html;

    // bind combined claim button
    var btn = panel.querySelector('#rwd-claim-both');
    if (btn) btn.addEventListener('click', function(){
      claimCombined();
      renderMissionsPanel();
      updateInventoryPanel();
    });
  }

  /* ---------- mission logic ---------- */

  // called when a task is selected (before it moves to "done")
  function handleTaskSelection(taskEl){
    try{
      if (!taskEl) return;
      var id = getTaskIdentifier(taskEl);
      if (!id) return;
      // if not counted yet for today, count it (fixed)
      if (!isTaskCountedToday(id)){
        addCountedTaskIdToday(id);
        showToast('Tarefa contabilizada para missões do dia.');
        // update progress UI
        updateTaskProgressFromDOM();
      }
    }catch(e){ console.error('daily-missions:handleTaskSelection', e); }
  }

  // update based on counted tasks + lists
  function updateTaskProgressFromDOM(){
    try{
      var st = getState();
      var c = st.missions.complete3Tasks;
      var combined = computeCombinedProgress();
      c.progress = Math.min(combined.total, c.target);
      c.completed = (c.progress >= c.target);
      saveState(st);
      renderMissionsPanel();
    } catch(e) { console.error('daily-missions:updateTaskProgressFromDOM', e); }
  }

  function onTaskCompletedEvent(){ updateTaskProgressFromDOM(); }

  function onPageLoadMarkLogin(){
    try{
      var st = getState();
      var d = st.missions.dailyLogin;
      if (!d.progress){
        d.progress = 1;
        d.completed = true;
        saveState(st);
        renderMissionsPanel();
        showToast('Login diário registrado! Você pode reclamar a recompensa quando completar a outra missão.');
      }
    }catch(e){ console.error('daily-missions:onPageLoadMarkLogin', e); }
  }

  function claimCombined(){
    try{
      var st = getState();
      if (!st) return;
      var m = st.missions;
      if (!(m.complete3Tasks && m.dailyLogin && m.complete3Tasks.completed && m.dailyLogin.completed)){
        showToast('Ambas as missões precisam estar completas para reclamar.');
        return;
      }
      if (st.combinedClaimedOn){
        showToast('Recompensa já reivindicada hoje.');
        return;
      }
      var item = awardRandomCoinAndNotify('combined');
      if (item){
        st.combinedClaimedOn = new Date().toLocaleString();
        saveState(st);
        try{ document.dispatchEvent(new CustomEvent('mini_todo_missions_changed')); }catch(e){}
      }
    }catch(e){ console.error('daily-missions:claimCombined', e); }
  }

  /* ---------- daily reset (meia-noite local) ---------- */
  function scheduleMidnightReset(){
    try{
      window.dailyMissions = window.dailyMissions || {};
      if (window.dailyMissions._midnightTimer){ try{ clearTimeout(window.dailyMissions._midnightTimer); }catch(e){} }
      var now = new Date();
      var next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,50);
      var ms = next - now;
      if (!ms || ms <= 0) ms = 60 * 1000;
      window.dailyMissions._midnightTimer = setTimeout(function(){
        try{
          // reset mission state for new day (counted tasks are per-day map so no need to wipe global storage)
          var st = defaultMissionsState();
          saveState(st);
          try{ document.dispatchEvent(new CustomEvent('mini_todo_missions_changed')); }catch(e){}
          renderMissionsPanel();
          updateInventoryPanel();
        }catch(e){ console.error('daily-missions:midnight reset error', e); }
        scheduleMidnightReset();
      }, ms);
    }catch(e){ console.error('daily-missions:scheduleMidnightReset', e); }
  }

  /* ---------- integration / observers ---------- */
  function updateInventoryPanel(){
    try{
      // best-effort: rewards.js listens to 'mini_todo_inventory_changed' and will refresh its UI
    }catch(e){}
  }

  function ensureObservers(){
  var tasksRoot = document.getElementById('tasks') || document.querySelector('.tasks');
  var listsRoot  = document.getElementById('lists') || document.querySelector('.lists');

  // helper: detecta se um elemento (ou seus descendentes) está "concluído"
  function elementIsCompleted(el){
    if (!el) return false;
    try{
      // checkbox/radio inside
      var cb = el.querySelector && el.querySelector('input[type="checkbox"], input[type="radio"]');
      if (cb && (cb.checked || cb.getAttribute && cb.getAttribute('aria-checked')==='true')) return true;

      // attribute flags
      var attrCompleted = el.getAttribute && (el.getAttribute('data-completed') || el.getAttribute('data-done') || el.getAttribute('aria-checked'));
      if (attrCompleted){
        var v = String(attrCompleted).toLowerCase();
        if (v === 'true' || v === '1' || /\b(yes|done|completed|concluida|concluido|finalizado)\b/.test(v)) return true;
      }

      // classes containing keywords
      var cls = (el.className || '') + '';
      if (/\b(completed|done|concluded|concluida|concluido|finalizada|finalizado)\b/i.test(cls)) return true;

      // textual breadcrumbs (last resort): "Concluída", "Finalizado"
      var text = (el.textContent||'').trim();
      if (/\b(concluida|concluido|finalizado|finalizada|conclu)\b/i.test(text) && el.childElementCount <= 2) return true;

      return false;
    }catch(e){ return false; }
  }

  // helper: encontra o elemento "task" real a partir de qualquer nó interno
  function findTaskElement(node){
    if (!node) return null;
    return node.closest && (
      node.closest('.task') ||
      node.closest('.task-item') ||
      node.closest('[data-task-id]') ||
      node.closest('[data-uid]') ||
      node.closest('[data-id]') ||
      node.closest('[role="listitem"]') ||
      node.closest('li') ||
      node
    );
  }

  if (tasksRoot){
    // initial sync
    updateTaskProgressFromDOM();

    // observer mais geral: observa subtree e atributos (não filtrados) para detectar mudanças de classe/atributo/movimentação
    var mo = new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        try{
          // attributes changed -> ver se virou "concluído"
          if (m.type === 'attributes'){
            var t = m.target;
            var taskEl = findTaskElement(t);
            if (taskEl && elementIsCompleted(taskEl)){
              // só conta se ainda não tiver sido contado hoje
              var id = getTaskIdentifier(taskEl);
              if (id && !isTaskCountedToday(id)) handleTaskSelection(taskEl);
            }
          }

          // nodes added -> podem ser itens movidos para "concluídos"
          if (m.addedNodes && m.addedNodes.length){
            Array.prototype.forEach.call(m.addedNodes, function(node){
              if (node.nodeType !== 1) return;
              // se o próprio nó estiver marcado como concluído, ou conter filhos concluídos, contabiliza
              if (elementIsCompleted(node)){
                // tentar tarefas internas
                var tasks = node.querySelectorAll && node.querySelectorAll('.task, .task-item, [role="listitem"], li, [data-task-id]');
                if (tasks && tasks.length){
                  Array.prototype.forEach.call(tasks, function(t){
                    var tid = getTaskIdentifier(t);
                    if (tid && !isTaskCountedToday(tid) && elementIsCompleted(t)) handleTaskSelection(t);
                  });
                } else {
                  var taskEl = findTaskElement(node);
                  if (taskEl){
                    var tid = getTaskIdentifier(taskEl);
                    if (tid && !isTaskCountedToday(tid) && elementIsCompleted(taskEl)) handleTaskSelection(taskEl);
                  }
                }
              }
            });
          }

          // nodes removed: ignore (they podem ser re-adicionados via addedNodes)
        }catch(e){}
      });
    });

    try{ mo.observe(tasksRoot, { childList:true, subtree:true, attributes:true, attributeOldValue:true }); }catch(e){}
    window.dailyMissions = window.dailyMissions || {};
    window.dailyMissions._tasksObserver = mo;

    // change handler (checkboxes)
    tasksRoot.addEventListener('change', function(ev){
      try{
        var tgt = ev.target;
        if (!tgt) return;
        if (tgt.tagName === 'INPUT' && (tgt.type === 'checkbox' || tgt.type === 'radio')){
          if (tgt.checked || tgt.getAttribute && tgt.getAttribute('aria-checked')==='true'){
            var taskEl = findTaskElement(tgt);
            if (taskEl) handleTaskSelection(taskEl);
          }
        }
      }catch(e){ console.error('daily-missions:tasksRoot change handler', e); }
    });

    // click handler (best-effort for apps that change selection on click)
    tasksRoot.addEventListener('click', function(ev){
      try{
        var el = ev.target;
        var taskEl = findTaskElement(el);
        if (!taskEl) return;
        // se houver checkbox, confere estado; senão assume clique como intenção de completar
        var cb = taskEl.querySelector && taskEl.querySelector('input[type="checkbox"], input[type="radio"]');
        if (cb){
          if (cb.checked || cb.getAttribute && cb.getAttribute('aria-checked')==='true'){
            handleTaskSelection(taskEl);
          }
        } else {
          // clique sem checkbox: conta se o elemento parecer concluído
          if (elementIsCompleted(taskEl)) handleTaskSelection(taskEl);
        }
      }catch(e){ /* fail silently */ }
    }, true);

  } else {
    // fallback global observer + click
    var moFallback = new MutationObserver(function(){ updateTaskProgressFromDOM(); });
    try{ moFallback.observe(document.body, { childList:true, subtree:true, attributes:true }); }catch(e){}
    window.dailyMissions = window.dailyMissions || {};
    window.dailyMissions._listsObserver = moFallback;

    document.body.addEventListener('click', function(ev){
      try{
        var el = ev.target;
        var taskEl = findTaskElement(el);
        if (!taskEl) return;
        handleTaskSelection(taskEl);
      }catch(e){}
    }, true);
  }

  // Observe lists region too (detecta itens movidos entre listas)
  if (listsRoot){
    var mo2 = new MutationObserver(function(muts){
      muts.forEach(function(m){
        try{
          if (m.addedNodes && m.addedNodes.length){
            Array.prototype.forEach.call(m.addedNodes, function(node){
              if (node.nodeType !== 1) return;
              var taskEl = findTaskElement(node);
              if (taskEl && elementIsCompleted(taskEl)){
                var id = getTaskIdentifier(taskEl);
                if (id && !isTaskCountedToday(id)) handleTaskSelection(taskEl);
              }
              // também checa descendentes
              var tasks = node.querySelectorAll && node.querySelectorAll('.task, .task-item, [role="listitem"], li, [data-task-id]');
              if (tasks && tasks.length){
                Array.prototype.forEach.call(tasks, function(t){
                  var tid = getTaskIdentifier(t);
                  if (tid && !isTaskCountedToday(tid) && elementIsCompleted(t)) handleTaskSelection(t);
                });
              }
            });
          }
        }catch(e){}
      });
    });
    try{ mo2.observe(listsRoot, { childList:true, subtree:true, attributes:true, attributeOldValue:true }); }catch(e){}
    window.dailyMissions = window.dailyMissions || {};
    window.dailyMissions._listsObserver = mo2;
  }

  document.addEventListener('mini_todo_task_completed', onTaskCompletedEvent);
  document.addEventListener('mini_todo_task_changed', onTaskCompletedEvent);
  document.addEventListener('mini_todo_task_selected', function(ev){
    try{ var t = ev && ev.detail && ev.detail.el; handleTaskSelection(t); }catch(e){} 
  });
}

  /* ---------- init ---------- */
  function init(){
    try{
      ensureMissionsUI();
      ensureObservers();
      onPageLoadMarkLogin();
      scheduleMidnightReset();

      window.dailyMissions = window.dailyMissions || {};
      window.dailyMissions.getState = getState;
      window.dailyMissions.resetToday = function(){ saveState(defaultMissionsState()); renderMissionsPanel(); updateInventoryPanel(); };
      window.dailyMissions.forceAward = function(){ var st = getState(); st.missions.complete3Tasks.completed = true; st.missions.complete3Tasks.progress = st.missions.complete3Tasks.target; st.missions.dailyLogin.completed = true; st.combinedClaimedOn = null; saveState(st); renderMissionsPanel(); };

      (function removeResetBtn(){ try{ var el = document.getElementById('rwd-missions-reset'); if (el && el.parentNode) el.parentNode.removeChild(el); }catch(e){} })();

      document.addEventListener('mini_todo_inventory_changed', function(){ try{ renderMissionsPanel(); updateInventoryPanel(); }catch(e){} });
    }catch(e){ console.error('daily-missions init error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})(window, document);
