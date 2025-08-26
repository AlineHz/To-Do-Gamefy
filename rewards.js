
/*
  rewards.js - Atualizado: itens ao subir de nível são aleatórios e exclusivos de uma lista de 15 "Moedas"
  - Cada item premiado tem o ícone de diamante (💎) e um dos nomes pedidos.
  - Seleção aleatória do item no momento do award (pode repetir ao longo do tempo).
  - Mantém o restante da lógica: MutationObserver, evento 'mini_todo_level_change', chamada window.rewardsAwardLevel(level).
*/

(function (window, document) {
  'use strict';

  // ----- Config -----
  var LS_INVENTORY_KEY = 'mini_todo_inventory_v1';
  var LS_LAST_LEVEL_KEY = 'mini_todo_last_level_v1';

  // Pool de 15 moedas solicitadas — todas com emoji de diamante
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

  // ----- Util -----
  function $(sel) { return document.querySelector(sel); }
  function parseLevelText(text) {
    if (text === null || text === undefined) return 1;
    var m = String(text).trim().match(/(-?\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }
  function safeJSONParse(s, fallback) { try { return JSON.parse(s); } catch (e) { return fallback; } }

  function loadInventory() { return safeJSONParse(localStorage.getItem(LS_INVENTORY_KEY), []) || []; }
  function saveInventory(inv) { try { localStorage.setItem(LS_INVENTORY_KEY, JSON.stringify(inv || [])); } catch (e) {} }
  function getLastLevel() { try { var v = localStorage.getItem(LS_LAST_LEVEL_KEY); return v === null ? null : parseInt(v, 10); } catch (e) { return null; } }
  function setLastLevel(v) { try { localStorage.setItem(LS_LAST_LEVEL_KEY, String(v)); } catch (e) {} }

  // Escolhe aleatoriamente um item do pool (permitindo repetições ao longo do tempo)
  function pickRandomItem() {
    var idx = Math.floor(Math.random() * ITEM_POOL.length);
    return ITEM_POOL[idx];
  }

  function makeItemForLevel(level){
    var base = pickRandomItem();
    return {
      uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
      code: base.id,
      name: base.name,
      emoji: base.emoji,
      desc: base.desc,
      awardedAt: new Date().toISOString(),
      level: level
    };
  }

  // ----- UI: toast -----
  function showToast(msg) {
    try {
      var t = document.createElement('div');
      t.className = 'rwd-toast';
      t.textContent = msg;
      Object.assign(t.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        background: 'linear-gradient(90deg,#111827,#2563eb)',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: '10px',
        boxShadow: '0 6px 20px rgba(2,6,23,0.12)',
        zIndex: 11000,
        fontWeight: '700',
        transition: 'opacity .4s ease, transform .4s ease'
      });
      document.body.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 1600);
      setTimeout(function () { try { document.body.removeChild(t); } catch (e) { } }, 2200);
    } catch (e) { /* swallow UI errors */ }
  }

  // ----- UI: Inventário modal/painel -----
  function createInventoryModal() {
    if ($('#rwd-inventory-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'rwd-inventory-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%,-50%)',
      minWidth: '320px',
      maxWidth: '90%',
      maxHeight: '80%',
      overflow: 'auto',
      background: '#fff',
      borderRadius: '12px',
      boxShadow: '0 10px 40px rgba(2,6,23,0.25)',
      zIndex: 12000,
      padding: '14px',
      display: 'none',
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial'
    });

    var hdr = document.createElement('div');
    Object.assign(hdr.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' });

    var title = document.createElement('div');
    title.textContent = 'Inventário';
    title.style.fontWeight = '800';
    title.style.fontSize = '16px';
    hdr.appendChild(title);

    var btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.gap = '8px';

    var btnClear = document.createElement('button');
    btnClear.textContent = 'Limpar';
    btnClear.title = 'Remover todos os itens do inventário';
    Object.assign(btnClear.style, { background: 'transparent', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: '8px' });
    btnClear.addEventListener('click', function () {
      if (!confirm('Deseja remover todos os itens do inventário?')) return;
      saveInventory([]);
      renderInventoryModal();
    });

    var btnClose = document.createElement('button');
    btnClose.textContent = 'Fechar';
    Object.assign(btnClose.style, { background: 'transparent', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: '8px' });
    btnClose.addEventListener('click', function () { modal.style.display = 'none'; });

    btns.appendChild(btnClear);
    btns.appendChild(btnClose);
    hdr.appendChild(btns);

    modal.appendChild(hdr);

    var list = document.createElement('div');
    list.id = 'rwd-inventory-list';
    modal.appendChild(list);

    document.body.appendChild(modal);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; });
  }

  function renderInventoryModal() {
    createInventoryModal();
    var modal = $('#rwd-inventory-modal');
    var list = $('#rwd-inventory-list');
    if (!list) return;
    list.innerHTML = '';
    var inv = loadInventory();
    if (!inv || !inv.length) {
      var p = document.createElement('div');
      p.textContent = 'Nenhum item recebido ainda. Suba de nível para ganhar itens!';
      p.style.opacity = '.8';
      list.appendChild(p);
    } else {
      inv.slice().reverse().forEach(function (it) {
        var row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 6px', borderBottom: '1px solid #f3f4f6' });
        var left = document.createElement('div');
        Object.assign(left.style, { display: 'flex', alignItems: 'center', gap: '10px' });
        var emoji = document.createElement('div');
        emoji.textContent = it.emoji;
        emoji.style.fontSize = '20px';
        emoji.style.width = '28px';
        emoji.style.textAlign = 'center';
        var txt = document.createElement('div');
        txt.innerHTML = '<div style="font-weight:700">' + escapeHtml(it.name) + ' <span style="font-weight:600;color:#6b7280;font-size:12px">LV ' + it.level + '</span></div>' +
          '<div style="font-size:13px;color:#6b7280">' + escapeHtml(it.desc) + '</div>';
        left.appendChild(emoji); left.appendChild(txt);

        var meta = document.createElement('div');
        var d = new Date(it.awardedAt);
        meta.textContent = d.toLocaleString();
        Object.assign(meta.style, { fontSize: '12px', color: '#9ca3af' });

        row.appendChild(left);
        row.appendChild(meta);
        list.appendChild(row);
      });
    }
    modal.style.display = 'block';
  }


  function renderInventoryPanel() {
    var sidebar = $('.progress-sidebar');
    if (!sidebar) return;
    var panel = sidebar.querySelector('#rwd-inventory-panel');
    if (!panel) return;
    var inv = loadInventory() || [];
    if (!inv.length) {
      panel.innerHTML = '<div class="rwd-inv-empty">Nenhum item recebido ainda. Suba de nível para ganhar itens!</div>';
      return;
    }
    var html = '<div class="rwd-inv-list">';
    inv.slice().reverse().forEach(function(it){
      html += '<div class="rwd-inv-item">';
      html += '<div class="rwd-inv-left"><div class="rwd-inv-emoji">' + escapeHtml(it.emoji) + '</div>';
      html += '<div class="rwd-inv-meta"><div class="rwd-inv-title">' + escapeHtml(it.name) + ' <span class="rwd-inv-lv">LV ' + it.level + '</span></div>';
      html += '<div class="rwd-inv-desc">' + escapeHtml(it.desc) + '</div></div></div>';
      html += '<div class="rwd-inv-time">' + new Date(it.awardedAt).toLocaleString() + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="rwd-inv-actions"><button id="rwd-clear-inv-compact" class="rwd-link">Limpar inventário</button></div>';
    panel.innerHTML = html;
    var btnClear = panel.querySelector('#rwd-clear-inv-compact');
    if (btnClear) btnClear.addEventListener('click', function(){
      if (!confirm('Deseja remover todos os itens do inventário?')) return;
      saveInventory([]);
      renderInventoryPanel();
    });
  }
  // ----- Inventory panel inside progress-sidebar (compact) -----
  function ensureInventoryPanel() {
    var sidebar = $('.progress-sidebar');
    if (!sidebar) return false;

    // ensure controls container (so buttons can sit side-by-side)
    var controls = sidebar.querySelector('.rwd-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'rwd-controls';
      // insert after fixed-progress-title if present, else at top
      var header = sidebar.querySelector('#fixed-progress-title');
      if (header && header.parentNode) header.parentNode.insertBefore(controls, header.nextSibling);
      else sidebar.insertBefore(controls, sidebar.firstChild);
    }

    // avoid duplicate button
    if (sidebar.querySelector('#rwd-inv-toggle')) return true;

    var actionWrap = document.createElement('div');
    actionWrap.className = 'rwd-action';

    var btn = document.createElement('button');
    btn.id = 'rwd-inv-toggle';
    btn.type = 'button';
    btn.title = 'Abrir inventário';
    btn.textContent = '🎒 Inventário';
    btn.className = 'rwd-action-btn rwd-inv-btn';
    btn.addEventListener('click', function () {
      var panel = sidebar.querySelector('#rwd-inventory-panel');
      if (panel) panel.classList.toggle('open');
    });

    actionWrap.appendChild(btn);
    controls.appendChild(actionWrap);

    // create panel element (kept as a direct child of sidebar to span width)
    if (!sidebar.querySelector('#rwd-inventory-panel')){
      var panel = document.createElement('div');
      panel.id = 'rwd-inventory-panel';
      panel.className = 'rwd-inventory-panel';
      panel.innerHTML = '<div class="rwd-inv-empty">Carregando inventário...</div>';
      sidebar.appendChild(panel);
    }

    return true;
  }

  // ----- Award logic -----
  function awardItemsUpTo(newLevel) {
    if (typeof newLevel !== 'number' || isNaN(newLevel)) return;
    var last = getLastLevel();
    if (last === null) last = newLevel;
    if (newLevel <= last) {
      if (newLevel < last) setLastLevel(newLevel);
      return;
    }
    var inv = loadInventory();
    for (var lvl = last + 1; lvl <= newLevel; lvl++) {
      var item = makeItemForLevel(lvl);
      inv.push(item);
      showToast('LV ' + lvl + ' — recebeu ' + item.emoji + ' ' + item.name + '!');
    }
    saveInventory(inv);
    setLastLevel(newLevel);
  }

  // Public method to award (used by external code)
  function publicAwardLevel(level) {
    try {
      var lvl = parseInt(level, 10);
      if (isNaN(lvl)) return;
      awardItemsUpTo(lvl);
    } catch (e) { /* noop */ }
  }

  // Expor no window para chamadas diretas
  if (!window.rewardsAwardLevel) {
    window.rewardsAwardLevel = publicAwardLevel;
  }

  // Listener de evento customizado (script.js pode disparar este evento)
  function onCustomLevelChange(e) {
    try {
      var lvl = null;
      if (e && e.detail && (typeof e.detail.level !== 'undefined')) lvl = e.detail.level;
      else if (e && e.detail && (typeof e.detail === 'number')) lvl = e.detail;
      else if (e && e.detail && e.detail.newLevel) lvl = e.detail.newLevel;
      if (lvl === null) return;
      publicAwardLevel(lvl);
    } catch (err) { /* noop */ }
  }
  document.addEventListener('mini_todo_level_change', onCustomLevelChange);

  // ----- DOM observation -----
  var badgeObserver = null;
  function initBadgeObserver() {
    if (badgeObserver) return true;
    var badge = document.getElementById('level-badge') || document.querySelector('.level-badge');
    if (!badge) return false;

    ensureInventoryPanel();
    createInventoryModal();
    try{ renderInventoryPanel(); }catch(e){}

    // Initialize lastLevel if absent
    var current = parseLevelText(badge.textContent || badge.innerText);
    var last = getLastLevel();
    if (last === null) setLastLevel(current);

    badgeObserver = new MutationObserver(function (mutations) {
      var newLevel = parseLevelText(badge.textContent || badge.innerText);
      // award if increased
      var lastNow = getLastLevel();
      if (lastNow === null) lastNow = newLevel;
      if (newLevel > lastNow) {
        awardItemsUpTo(newLevel);
        // refresh compact panel if present
        var panel = document.querySelector('#rwd-inventory-panel');
        if (panel && panel.classList.contains('open')) {
          // if compact panel open, re-render its content to show new items
          try { renderInventoryPanel(); } catch(e) {}
        }
      } else if (newLevel < lastNow) {
        // sync down if level decreased externally
        setLastLevel(newLevel);
      }
    });
    try {
      badgeObserver.observe(badge, { characterData: true, childList: true, subtree: true });
    } catch (e) {
      // fallback: observe parent
      try { badgeObserver.observe(document.body, { childList: true, subtree: true }); } catch (ee) {}
    }
    return true;
  }

  // Try to init immediately; if badge not present, watch body until it appears
  function init() {
    if (initBadgeObserver()) return;
    var bodyWatcher = new MutationObserver(function () {
      if (initBadgeObserver()) {
        try { bodyWatcher.disconnect(); } catch (e) {}
      }
    });
    try { bodyWatcher.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    // also ensure basic UI exists eventually
    setTimeout(function () { ensureInventoryPanel(); createInventoryModal(); try{ renderInventoryPanel(); }catch(e){} }, 800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Expor funções úteis para debug/uso manual
  window.rewards = window.rewards || {};
  window.rewards._loadInventory = loadInventory;
  window.rewards._saveInventory = saveInventory;
  window.rewards._getLastLevel = getLastLevel;
  window.rewards.openInventory = renderInventoryModal;

})(window, document);
