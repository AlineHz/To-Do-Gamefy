/* pet-roster.js — CORRIGIDO
   Ajuste final: o gabarito considera apenas pets chocados (code === petCode)
   ou itens cujo NOME seja exatamente igual ao nome do pet.
*/

(function(document, window){
  'use strict';

  var LS_INVENTORY = 'mini_todo_inventory_v1';

  // Lista canônica de pets (base codes). Ajuste/expanda se quiser.
  var PETS = [
    { code: 'bulldog', name: 'Bulldog', emoji: '🐶' },
    { code: 'calopsita', name: 'Calopsita', emoji: '🐦' },
    { code: 'coelho', name: 'Coelho', emoji: '🐰' },
    { code: 'collie', name: 'Collie', emoji: '🐕' },
    { code: 'corgi', name: 'Corgi', emoji: '🐕‍🦺' },
    { code: 'gato_angora', name: 'Gato Angora', emoji: '🐱' },
    { code: 'gato_bombay', name: 'Gato Bombay', emoji: '🐱' },
    { code: 'gato_cinza', name: 'Gato Cinza', emoji: '🐱' },
    { code: 'gato_laranja', name: 'Gato Laranja', emoji: '🐱' },
    { code: 'retriever', name: 'Retriever', emoji: '🐕' },
    { code: 'hamster', name: 'Hamster', emoji: '🐹' },
    { code: 'husky', name: 'Husky', emoji: '🐺' },
    { code: 'macaco', name: 'Macaco', emoji: '🐵' },
    { code: 'rotweiller', name: 'Rotweiller', emoji: '🐕' },
    { code: 'tartaruga', name: 'Tartaruga', emoji: '🐢' }
  ];

  function safeJSONParse(s, fallback){
    try { return JSON.parse(s||'null') || fallback; } catch(e){ return fallback; }
  }

  function loadInventory(){
    return safeJSONParse(localStorage.getItem(LS_INVENTORY), []) || [];
  }

  // Normaliza strings para comparação (minusculas, espaços, replace de '_' e '-')
  function normalize(s){ return String(s||'').toLowerCase().replace(/[\s\-_]+/g,' ').trim(); }

  // --- Matching restrito: apenas pets chocados (code === petCode) ou item com NOME exatamente igual ao pet ---
  function inventoryHasPet(inv, petCode, petName){
    // Agora *apenas* pets chocados (code === petCode) ou itens cujo NOME seja exatamente o mesmo
    if (!Array.isArray(inv)) return false;
    petCode = String(petCode||'').toLowerCase();
    var normPetName = normalize(petName||'');

    for (var i=0;i<inv.length;i++){
      var it = inv[i];
      if (!it) continue;
      var code = String(it.code || '').toLowerCase();
      var name = normalize(it.name || '');

      // Considera possession apenas quando:
      //  - item chocado: code === petCode
      if (code === petCode) return true;
      //  - ou quando o nome do item for exatamente o nome do pet (após normalização)
      if (name && (name === normPetName || name === petCode)) return true;
    }
    return false;
  }

  // Contabiliza somente items que representam efetivamente o pet chocado ou item com nome igual
  function inventoryCountForPet(inv, petCode, petName){
    if (!Array.isArray(inv)) return 0;
    var count = 0;
    petCode = String(petCode||'').toLowerCase();
    var normPetName = normalize(petName||'');

    for (var i=0;i<inv.length;i++){
      var it = inv[i];
      if (!it) continue;
      var code = String(it.code || '').toLowerCase();
      var name = normalize(it.name || '');

      if (code === petCode) count++;
      else if (name && (name === normPetName || name === petCode)) count++;
    }
    return count;
  }

  // Build panel DOM
  function buildPanel(){
    var panel = document.createElement('div');
    panel.id = 'rwd-pets-panel';
    panel.className = 'rwd-slot-panel';
    panel.style.marginTop = '8px';
    panel.style.padding = '10px';
    panel.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Gabarito de Pets</div>';
    var list = document.createElement('div');
    list.id = 'rwd-pets-list';
    list.className = 'rwd-inv-list';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill,minmax(160px,1fr))';
    list.style.gap = '8px';
    panel.appendChild(list);

    var actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '10px';
    actions.style.justifyContent = 'flex-end';

    var btnFilter = document.createElement('button');
    btnFilter.type = 'button';
    btnFilter.id = 'rwd-pets-filter-missing';
    btnFilter.className = 'rwd-action-btn';
    btnFilter.textContent = 'Mostrar só faltando';
    btnFilter.dataset.onlyMissing = 'false'; // sempre inicia mostrando TODOS
    btnFilter.addEventListener('click', function(){
      var v = this.dataset.onlyMissing === 'true';
      this.dataset.onlyMissing = (!v).toString();
      this.textContent = (!v) ? 'Mostrar todos' : 'Mostrar só faltando';
      renderPanel(); 
    });
    actions.appendChild(btnFilter);

    panel.appendChild(actions);
    return panel;
  }

  // Render content into #rwd-pets-list
  function renderPanel(){
    var sidebar = document.querySelector('.progress-sidebar'); if (!sidebar) return;
    var panel = sidebar.querySelector('#rwd-pets-panel'); if (!panel) return;
    var listEl = panel.querySelector('#rwd-pets-list'); if (!listEl) return;
    var onlyMissing = panel.querySelector('#rwd-pets-filter-missing') && panel.querySelector('#rwd-pets-filter-missing').dataset.onlyMissing === 'true';

    var inv = loadInventory() || [];
    listEl.innerHTML = '';
    PETS.forEach(function(p){
      var owned = inventoryHasPet(inv, p.code, p.name);
      var count = inventoryCountForPet(inv, p.code, p.name);
      if (onlyMissing && owned) return;
      var box = document.createElement('div');
      box.className = 'rwd-pet-item';
      box.style.border = '1px solid rgba(0,0,0,0.06)';
      box.style.borderRadius = '8px';
      box.style.padding = '8px';
      box.style.display = 'flex';
      box.style.gap = '8px';
      box.style.alignItems = 'center';
      box.style.justifyContent = 'space-between';
      var left = document.createElement('div');
      left.style.display = 'flex';
      left.style.gap = '8px';
      left.style.alignItems = 'center';
      var em = document.createElement('div');
      em.textContent = p.emoji || '🐾';
      em.style.fontSize = '22px';
      em.style.width = '34px';
      em.style.textAlign = 'center';
      var nm = document.createElement('div');
      nm.style.fontWeight = '700';
      nm.style.fontSize = '13px';
      nm.textContent = p.name;
      left.appendChild(em); left.appendChild(nm);

      var right = document.createElement('div');
      right.style.textAlign = 'right';
      right.style.fontSize = '13px';
      if (owned){
        var s = document.createElement('div'); s.style.color = '#059669'; s.style.fontWeight='700'; s.textContent = 'Possui';
        var c = document.createElement('div'); c.style.fontSize='12px'; c.style.color='#374151'; c.textContent = (count>1? (count + ' itens') : (count + ' item'));
        right.appendChild(s); right.appendChild(c);
      } else {
        var s2 = document.createElement('div'); s2.style.color = '#ef4444'; s2.style.fontWeight='700'; s2.textContent = 'Falta';
        right.appendChild(s2);
      }

      box.appendChild(left); box.appendChild(right);
      listEl.appendChild(box);
    });
  }

  // Ensure UI exist and wire events
  function ensurePetsUI(){
    var sidebar = document.querySelector('.progress-sidebar'); if (!sidebar) return false;
    // find controls container
    var controls = sidebar.querySelector('.rwd-controls');
    if (!controls){
      controls = document.createElement('div');
      controls.className = 'rwd-controls';
      var header = sidebar.querySelector('#fixed-progress-title');
      if (header && header.parentNode) header.parentNode.insertBefore(controls, header.nextSibling);
      else sidebar.insertBefore(controls, sidebar.firstChild);
    }

    // insert button alongside missions (after it)
    if (!controls.querySelector('#rwd-pets-toggle')){
      var actionWrap = document.createElement('div'); actionWrap.className='rwd-action';
      var btn = document.createElement('button');
      btn.id = 'rwd-pets-toggle';
      btn.type = 'button';
      btn.className = 'rwd-action-btn';
      btn.textContent = '📋 Pets';
      btn.title = 'Abrir gabarito de pets';
      btn.addEventListener('click', function(){
        var p = sidebar.querySelector('#rwd-pets-panel');
        if (!p){
          var panel = buildPanel();
          sidebar.appendChild(panel);
          panel.classList.add('open');
          renderPanel();
        } else {
          p.classList.toggle('open');
          if (p.classList.contains('open')) {
            renderPanel();
          }
        }
      });
      actionWrap.appendChild(btn);
      var missionsBtn = controls.querySelector('#rwd-missions-toggle');
      if (missionsBtn && missionsBtn.parentNode) missionsBtn.parentNode.parentNode.insertBefore(actionWrap, missionsBtn.parentNode.nextSibling);
      else controls.appendChild(actionWrap);
    }

    if (!sidebar.querySelector('#rwd-pets-panel')){
      var panel = buildPanel();
      panel.classList.remove('open');
      panel.style.maxHeight = '0';
      panel.style.overflow = 'hidden';
      panel.style.transition = 'max-height .28s ease, opacity .16s ease, padding .16s ease';
      var observer = new MutationObserver(function(muts){
        var p = sidebar.querySelector('#rwd-pets-panel');
        if (!p) return;
        if (p.classList.contains('open')){
          p.style.maxHeight = '420px';
          p.style.opacity = '1';
          p.style.padding = '10px';
        } else {
          p.style.maxHeight = '0';
          p.style.opacity = '0';
          p.style.padding = '0 10px';
        }
      });
      observer.observe(sidebar, { childList: true, subtree: true, attributes: true });
      sidebar.appendChild(panel);
      renderPanel();
    }
    return true;
  }

  // initialize and wire inventory change updates
  function init(){
    try {
      ensurePetsUI();
      document.addEventListener('mini_todo_inventory_changed', function(){ renderPanel(); });
      window.addEventListener('storage', function(e){ if (e.key === LS_INVENTORY) renderPanel(); });
      document.addEventListener('mini_todo_missions_changed', function(){ renderPanel(); });
    } catch(e){ console.error('pet-roster init error', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.petRoster = {
    render: renderPanel,
    buildPanel: buildPanel,
    PETS: PETS
  };

})(document, window);
