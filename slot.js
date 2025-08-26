
/*
  slot_fixed3.js - Estou com sorte (slot machine)
  Ajuste solicitado:
   - Identifica a moeda utilizada no momento do clique em "Girar" e consome essa moeda imediatamente.
   - Garante consistência: o ovo premiado (se houver jackpot) é criado usando a mesma moeda que foi consumida no momento da aposta.
   - Ajuste de formatação: o nome amigável do ovo remove prefixes como "moeda", "coin" etc. e aplica Title Case.
   - NOVO: se o usuário **não tiver moedas no inventário**, removemos a opção de "créditos numéricos" e desabilitamos o botão "Girar".
*/

(function(window, document){
  'use strict';

  // --- util: formata um nome amigável a partir de metadados/código da moeda ---
  function formatFriendlyName(metaOrCode){
    try {
      var s = '';
      if (!metaOrCode) return '';
      if (typeof metaOrCode === 'string') s = metaOrCode;
      else if (metaOrCode.name) s = metaOrCode.name;
      else if (metaOrCode.code) s = metaOrCode.code;
      s = String(s || '').trim();

      // remove prefixos comuns: "moeda", "moeda_", "coin", "coin-", "moeda-", "moeda:" (case-insensitive)
      s = s.replace(/^(moeda|coin)[\s_\-:\.]+/i, '');

      // se ainda contiver "moeda" no início por alguma variação, remover novamente (seguro)
      s = s.replace(/^\s*moeda[\s_\-:\.]+/i, '');

      // substituir underscores/traços por espaço
      s = s.replace(/[_\-]+/g, ' ');

      // remover palavras como "moeda" que possam aparecer no meio (ex: "Corgi moeda")
      s = s.replace(/\bmoeda\b/ig, '');
      s = s.replace(/\bcoin\b/ig, '');

      // trim novamente e reduzir múltiplos espaços a um
      s = s.replace(/\s+/g, ' ').trim();
      if (!s) return '';

      // Title Case: capitaliza a primeira letra de cada palavra
      s = s.toLowerCase().split(' ').map(function(w){
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');

      return s;
    } catch(e){ return String(metaOrCode || '').replace(/[_\-]/g,' '); }
  }


  // --- Adicionado: função utilitária para ler a moeda selecionada no caça-níquel ---
  function getSelectedCoinValue() {
    try {
      // tenta select com id 'coin', 'moeda', 'bet-coin' ou name 'coin'
      var el = document.getElementById('coin') || document.getElementById('moeda') || document.querySelector('select[name="coin"]') || document.querySelector('.coin-select') || document.querySelector('select.coin');
      if (el) {
        var v = el.value;
        // se for um <option> com atributo data-value
        if (el.selectedOptions && el.selectedOptions[0] && el.selectedOptions[0].dataset && el.selectedOptions[0].dataset.value) {
          v = el.selectedOptions[0].dataset.value;
        }
        // tentar converter para número, se falhar retorna string original
        var num = parseFloat(String(v).replace(/[^0-9\.-]/g,''));
        if (!isNaN(num)) return num;
        return v;
      }
      // fallback: procurar inputs radio marcados com name coin
      var radios = document.querySelectorAll('input[name="coin"]');
      for (var i=0;i<radios.length;i++){
        if (radios[i].checked) {
          var rv = radios[i].value || radios[i].dataset.value;
          var num2 = parseFloat(String(rv).replace(/[^0-9\.-]/g,''));
          if (!isNaN(num2)) return num2;
          return rv;
        }
      }
      // último recurso: valor default definido na variável global 'selectedCoin' ou 'currentCoin'
      if (window.selectedCoin !== undefined) return window.selectedCoin;
      if (window.currentCoin !== undefined) return window.currentCoin;
    } catch(e) { console.error('getSelectedCoinValue error', e); }
    return 1; // coin default
  }


  // Keys
  var LS_CREDITS = 'mini_todo_slots_credits_v1';        // fallback numeric credits (retrocompat)
  var LS_INVENTORY_KEY = 'mini_todo_inventory_v1';      // inventário usado pelo rewards.js
  var DEFAULT_CREDITS = 10;

  // símbolos dos rolos (permanece igual)
  var EMOJIS = ['🍒','🍋','🔔','💎','🍀','7️⃣','⭐','🍊'];

  // util
  function $(s){ return document.querySelector(s); }
  function safeJSONParse(s, fallback){ try { return JSON.parse(s||'null') || fallback; } catch(e){ return fallback; } }

  // ----- Inventário helpers (lê/escreve mesmo formato de rewards.js) -----

  // Helper: determina se um item do inventário é uma MOEDA
  function isCoinItem(it){
    if (!it) return false;
    // Regra: nome contém "moeda" (case-insensitive) ou code começa com "moeda_"
    var nameOk = it.name && /moeda/i.test(it.name);
    var codeOk = it.code && /^moeda[_\-]/i.test(it.code);
    return !!(nameOk || codeOk);
  }
  function loadInventory(){
    return safeJSONParse(localStorage.getItem(LS_INVENTORY_KEY), []) || [];
  }
  function saveInventory(inv){
    try { localStorage.setItem(LS_INVENTORY_KEY, JSON.stringify(inv || [])); } catch(e){}
  }
  function countCoinsByCode(code){
    if (!code) return 0;
    var inv = loadInventory();
    return inv.reduce(function(acc, it){ return acc + ((it && it.code === code) ? 1 : 0); }, 0);
  }
  function uniqueCodesInInventory(){
    var inv = loadInventory();
    var map = {};
    inv.forEach(function(it){ if (it && it.code && isCoinItem(it)) map[it.code] = it; });
    return Object.keys(map).map(function(c){ return { code: c, sample: map[c] }; });
  }
  function findAnyMetadataForCode(code){
    var inv = loadInventory();
    for (var i=0;i<inv.length;i++){
      if (inv[i] && inv[i].code === code) return inv[i];
    }
    // fallback minimal meta
    return { code: code, name: code, emoji: '💎', desc: '' };
  }

  // remove 'n' items of given code from inventory (removes oldest-first). returns true if removed n, false otherwise.
  function consumeCoins(code, n){
    if (!code || n <= 0) return false;
    var inv = loadInventory();
    var kept = [];
    var removed = 0;
    for (var i=0;i<inv.length;i++){
      if (removed < n && inv[i] && inv[i].code === code){
        removed++;
        continue; // skip (consume)
      }
      kept.push(inv[i]);
    }
    if (removed < n) return false;
    saveInventory(kept);
    // dispatch small event so inventory UI can update if present
    document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: code, delta: -n } }));
    return true;
  }

  // add 'n' items of given code to inventory (creates items using sample metadata)
  function addCoins(code, n){
    if (!code || n <= 0) return;
    var inv = loadInventory();
    var meta = findAnyMetadataForCode(code);
    for (var i=0;i<n;i++){
      inv.push({
        uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
        code: meta.code || code,
        name: meta.name || ('Moeda ' + code),
        emoji: meta.emoji || '💎',
        desc: meta.desc || '',
        awardedAt: new Date().toISOString(),
        level: (meta.level || 0)
      });
    }
    saveInventory(inv);
    document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: code, delta: +n } }));
  }

  // ----- Numeric credits fallback (retrocompat) -----
  function getNumericCredits(){
    try { var v = parseInt(localStorage.getItem(LS_CREDITS),10); return isNaN(v) ? DEFAULT_CREDITS : v; } catch(e){ return DEFAULT_CREDITS; }
  }
  function setNumericCredits(v){ try { localStorage.setItem(LS_CREDITS, String(Math.max(0, Math.floor(v)))); } catch(e){} }
  function changeNumericCredits(delta){ setNumericCredits(getNumericCredits() + delta); updateCreditsUI(); }

  // ----- Slot UI / logic -----

  function createNode(html){
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.firstElementChild;
  }

  // Decide se usar inventário: true se houver pelo menos 1 tipo de moeda no inventário
  function hasInventoryCoins(){
    var arr = uniqueCodesInInventory();
    return arr && arr.length > 0;
  }

  // Current selected coin code (id). If null => no coin selected.
  function getSelectedCoinCode(){
    var sel = document.getElementById('rwd-slot-coin-select');
    if (!sel) return null;
    var v = sel.value;
    // treat empty string as null (no selection)
    if (v === '') return null;
    return v || null;
  }

  // Atualiza a UI de créditos: mostra quantidade da moeda selecionada; se não houver moedas desabilita a ação
  function updateCreditsUI(){
    var el = document.getElementById('rwd-slot-credits');
    var spinBtn = document.getElementById('rwd-slot-spin');
    var labelAvail = document.getElementById('rwd-slot-coin-available');
    if (!el) return;
    if (hasInventoryCoins()){
      var code = getSelectedCoinCode();
      if (!code){
        // se houver moedas, mas nenhuma selecionada, tenta selecionar a primeira que tenha quantidade > 0
        var opts = document.querySelectorAll('#rwd-slot-coin-select option');
        if (opts && opts.length) {
          for (var i=0;i<opts.length;i++){
            if (opts[i].value && countCoinsByCode(opts[i].value) > 0){
              code = opts[i].value;
              document.getElementById('rwd-slot-coin-select').value = code;
              break;
            }
          }
          // se ainda não encontrou, pega o primeiro option com value (mesmo zero)
          if (!code){
            for (var j=0;j<opts.length;j++){ if (opts[j].value){ code = opts[j].value; document.getElementById('rwd-slot-coin-select').value = code; break; } }
          }
        }
      }
      var cnt = code ? countCoinsByCode(code) : 0;
      el.textContent = cnt + ' × ' + (findAnyMetadataForCode(code).emoji || '') ;
      if (labelAvail) labelAvail.textContent = '(' + cnt + ' disponíveis)';
      if (spinBtn) spinBtn.disabled = (cnt <= 0);
      // ensure select enabled
      var sel = document.getElementById('rwd-slot-coin-select');
      if (sel) sel.disabled = false;
    } else {
      // **NOVO**: sem moedas -> desabilitar jogar e remover fallback a créditos numéricos
      el.textContent = '—';
      if (labelAvail) labelAvail.textContent = '(sem moedas)';
      if (spinBtn) spinBtn.disabled = true;
      var sel = document.getElementById('rwd-slot-coin-select');
      if (sel){
        sel.innerHTML = '';
        // colocar texto informativo, mas manter o select desabilitado para evitar seleção de créditos
        var opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Sem moedas disponíveis';
        opt.disabled = true;
        sel.appendChild(opt);
        sel.disabled = true;
      }
    }
  }

  // mostra mensagem curta
  function showSlotMessage(text, short){
    var el = document.getElementById('rwd-slot-msg');
    if (!el) return;
    el.textContent = text;
    el.style.opacity = '1';
    if (short !== true){
      setTimeout(function(){ if (el) el.style.opacity = '0.6'; }, 2400);
    } else {
      setTimeout(function(){ if (el) el.textContent = ''; }, 1200);
    }
  }

  function randomEmoji(){ return EMOJIS[Math.floor(Math.random()*EMOJIS.length)]; }

  // Remove or add créditos dependendo do modo
  // delta negativo => gastar (consumir)
  // delta positivo => ganhar (adicionar)
  // agora aceita parâmetro opcional 'coinCode' para forçar uso de uma moeda específica
  function changeCredits(delta, coinCode){
    if (hasInventoryCoins()){
      // if coinCode explicitly passed as '', treat as null -> numeric fallback
      if (coinCode === '') coinCode = null;

      var code = coinCode || getSelectedCoinCode();
      if (!code){
        showSlotMessage('Selecione uma moeda primeiro.', true);
        return false;
      }
      if (delta < 0){
        var need = Math.abs(delta);
        var success = consumeCoins(code, need);
        if (!success){
          showSlotMessage('Moedas insuficientes', true);
          return false;
        }
        updateCreditsUI();
        return true;
      } else if (delta > 0){
        addCoins(code, delta);
        updateCreditsUI();
        return true;
      }
      return true;
    } else {
      // **Alterado**: não mais usar fallback automático para créditos numéricos quando inventário vazio.
      // Antes: fallback numeric
      // Agora: rejeitar operações de mudança de crédito se não houver inventário de moedas.
      showSlotMessage('Nenhuma moeda disponível; operação não permitida.', true);
      return false;
    }
  }

  // Gira a máquina: assegura que aposta é válida (não maior que saldo)
  function spinAction(){
    var bet = 1;
    var usedCoin = null;
    var usedInventory = hasInventoryCoins();

    // **Novo comportamento**: se não houver moedas em inventário, impedir jogar (removendo fallback a créditos)
    if (!usedInventory){
      showSlotMessage('Sem moedas no inventário — jogo desabilitado.');
      return;
    }

    if (usedInventory){
      usedCoin = getSelectedCoinCode(); // can be null if select has ''
      if (!usedCoin){
        // if there are inventory coins but no valid selection, try to pick first available
        var opts = document.querySelectorAll('#rwd-slot-coin-select option');
        for (var i=0;i<opts.length;i++){
          var val = opts[i].value;
          if (val && countCoinsByCode(val) > 0){ usedCoin = val; break; }
        }
        // if still null, try first non-empty value option
        if (!usedCoin){
          for (var j=0;j<opts.length;j++){ if (opts[j].value){ usedCoin = opts[j].value; break; } }
        }
      }
      var available = usedCoin ? countCoinsByCode(usedCoin) : 0;
      if (bet > available){
        showSlotMessage('Moedas insuficientes', true);
        return;
      }
    }

    // decide outcome: 50% win (TRIPLE), 50% lose (ALL DIFFERENT)
    var WIN_PROB = 0.5;
    var willWin = Math.random() < WIN_PROB;
    var targetResults = [null, null, null];

    if (willWin){
      // vitória = todos os 3 símbolos iguais
      var symbol = randomEmoji();
      targetResults = [symbol, symbol, symbol];
    } else {
      // derrota = todos os 3 símbolos diferentes
      var a = randomEmoji();
      var b = randomEmoji();
      var c = randomEmoji();
      while (b === a) b = randomEmoji();
      while (c === a || c === b) c = randomEmoji();
      targetResults = [a, b, c];
    }

    // disable UI durante o giro
    var spinBtn = document.getElementById('rwd-slot-spin');
    if(spinBtn){
      spinBtn.disabled = true;
      spinBtn.textContent = 'Girando...';
    }

    // consume bet immediately, forcing the usedCoin (must exist in inventory because of earlier check)
    var consumed = changeCredits(-bet, usedCoin);
    if (!consumed){
      if(spinBtn){
        spinBtn.disabled = false;
        spinBtn.textContent = 'Girar';
      }
      return;
    }

    var reels = Array.from(document.querySelectorAll('.rwd-reel'));
    var spins = [30 + Math.floor(Math.random()*10), 36 + Math.floor(Math.random()*10), 42 + Math.floor(Math.random()*10)];
    var intervals = [];
    var results = [null,null,null];

    reels.forEach(function(reel, i){
      var count = 0;
      intervals[i] = setInterval(function(){
        reel.textContent = randomEmoji();
        count++;
        if (count >= spins[i]){
          clearInterval(intervals[i]);
          reel.textContent = targetResults[i];
          results[i] = reel.textContent;
          if (results.every(function(r){ return r !== null; })){
            finalizeSpin(results, bet, usedCoin);
            if(spinBtn){
              spinBtn.disabled = false;
              spinBtn.textContent = 'Girar';
            }
          }
        }
      }, 60 + i*40);
    });
  }


  // Finaliza rodada: calcula ganhos (em unidades de moeda/bet) e adiciona ao inventário (ou numeric)
  // agora recebe 'usedCoin' (string|null) que indica qual moeda foi usada na aposta (ou null para fallback)
  function finalizeSpin(results, bet, usedCoin){
    var msg = '';
    var creditsWon = 0;
    var isJackpot = (results[0] === results[1] && results[1] === results[2]);
    var eggCode; // definido para evento

    if (isJackpot){
      // comportamento padrão (numérico) — usado como valor base (mas pode ser sobrescrito se criarmos ovo)
      creditsWon = bet * 10;
      msg = 'Jackpot! Você ganhou ' + creditsWon + ' moedas!';
    } else {
      creditsWon = 0;
      msg = 'Que pena — sem combinação.';
    }

    if (isJackpot){
      if (usedCoin){
        // criar ovo baseado na moeda usada no momento da aposta
        try {
          var meta = findAnyMetadataForCode(usedCoin) || { code: usedCoin, name: usedCoin, emoji: '🥚' };
          var codeLower = String(meta.code || usedCoin || '').toLowerCase();
          var baseCode = codeLower.replace(/^moeda[_\-]?/, '');
          if (!baseCode) baseCode = codeLower;

          eggCode = 'ovo_' + baseCode;
          var friendlyName = formatFriendlyName(meta || usedCoin);
          if (!friendlyName) friendlyName = String(meta.name || meta.code || usedCoin).replace(/^Moeda\s+/i, '');
          var eggName = 'Ovo de ' + friendlyName;
          var rawEmoji = String(meta.emoji || '');
          rawEmoji = rawEmoji.replace(/[♦◆🔷🔶💎💠◇️]/g,'').trim();
          var eggEmoji = rawEmoji ? (rawEmoji + '🥚') : '🥚';

          var eggItem = {
            uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
            code: eggCode,
            name: eggName,
            emoji: eggEmoji,
            desc: 'Ovo premiado por Jackpot (' + (friendlyName) + ')',
            awardedAt: new Date().toISOString(),
            level: 0
          };

          var inv = loadInventory() || [];
          inv.push(eggItem);
          saveInventory(inv);
          document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: eggCode, delta: +1 } }));
          msg = 'Jackpot! Você ganhou um ' + eggName + ' 🥚';
          creditsWon = 0; // não adicionar créditos quando damos ovo
          showToast(msg);
        } catch(e){
          console.error('Erro ao criar ovo de jackpot:', e);
          // fallback para crédito em caso de erro
          changeCredits(creditsWon);
          showToast('Jackpot! +' + creditsWon + ' moedas');
        }
      } else {
        // sem moeda usada (modo créditos) -> não ocorrerá nesta versão pois removemos fallback. Ainda assim manter fallback seguro
        try {
          eggCode = 'ovo_misterioso';
          var eggItem2 = {
            uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
            code: eggCode,
            name: 'Ovo Misterioso',
            emoji: '🥚',
            desc: 'Ovo premiado por Jackpot (modo créditos)',
            awardedAt: new Date().toISOString(),
            level: 0
          };
          var inv2 = loadInventory() || [];
          inv2.push(eggItem2);
          saveInventory(inv2);
          document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: eggCode, delta: +1 } }));
          msg = 'Jackpot! Você ganhou um Ovo Misterioso 🥚';
          creditsWon = 0;
          showToast(msg);
        } catch(e){
          // se falhar por algum motivo (p.ex. localStorage indisponível), cai para créditos
          changeCredits(creditsWon);
          showToast('Jackpot! +' + creditsWon + ' moedas');
        }
      }
    } else {
      // não é jackpot: aplicar créditos normalmente (se houver)
      if (creditsWon > 0){
        changeCredits(creditsWon);
        showToast('Jackpot! +' + creditsWon + ' moedas');
      }
    }

    showSlotMessage(msg);
    updateCreditsUI();

    // Notifica com detalhes (inclui egg quando criado)
    if (isJackpot){
      try {
        var extra = { credits: creditsWon };
        if (typeof eggCode !== 'undefined') extra.egg = eggCode;
        document.dispatchEvent(new CustomEvent('mini_todo_slot_jackpot', { detail: extra }));
      } catch(e){}
    }
  }



  // small toast helper
  function showToast(msg){
    try {
      var t = document.createElement('div');
      t.className = 'rwd-toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function(){ t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 1600);
      setTimeout(function(){ try{ document.body.removeChild(t); } catch(e){} }, 2200);
    } catch(e){}
  }

  // ----- UI creation / wiring (adds select para escolher moeda) -----
  function ensureSlotUI(){
    var sidebar = document.querySelector('.progress-sidebar');
    if (!sidebar) return false;
    if (sidebar.querySelector('#rwd-slot-toggle')) return true;

    var wrapper = document.createElement('div');
    wrapper.className = 'rwd-slot-wrapper';
    wrapper.style.marginTop = '8px';

    var btn = document.createElement('button');
    btn.id = 'rwd-slot-toggle';
    btn.type = 'button';
    btn.className = 'rwd-action-btn rwd-slot-btn';
    btn.textContent = '🎰 Estou com sorte';
    btn.title = 'Abrir Estou com sorte';
    btn.addEventListener('click', function(){ var p = sidebar.querySelector('#rwd-slot-panel'); if (p) p.classList.toggle('open'); });

    var action = document.createElement('div'); action.className = 'rwd-action'; action.appendChild(btn);

    var controls = sidebar.querySelector('.rwd-controls');
    if (controls) controls.appendChild(action);
    else {
      var inv = sidebar.querySelector('.rwd-inv-wrapper');
      if (inv && inv.parentNode) inv.parentNode.insertBefore(action, inv.nextSibling);
      else sidebar.insertBefore(action, sidebar.firstChild);
    }

    // panel (com select de moeda)
    var panel = document.createElement('div');
    panel.id = 'rwd-slot-panel';
    panel.className = 'rwd-slot-panel';
    panel.innerHTML = '\
      <div class="rwd-slot-row">\
        <div class="rwd-reels">\
          <div class="rwd-reel" data-index="0">-</div>\
          <div class="rwd-reel" data-index="1">-</div>\
          <div class="rwd-reel" data-index="2">-</div>\
        </div>\
      </div>\
      <div class="rwd-slot-controls">\
        <div class="rwd-slot-center" style="display:flex;gap:8px;align-items:center;">\
          <label style="font-size:13px">Moeda: \
            <select id="rwd-slot-coin-select" style="min-width:140px"></select> \
            <span id="rwd-slot-coin-available" style="font-size:12px;color:#6b7280;margin-left:6px"></span>\
          </label>\
        </div>\
        <div class="rwd-slot-right">\
          <button id="rwd-slot-spin" class="rwd-slot-spin" style="margin-left:8px">Girar</button>\
        </div>\
      </div>\
      <div class="rwd-slot-footer"><div id="rwd-slot-msg" class="rwd-slot-msg"></div></div>';

    sidebar.appendChild(panel);

    // events
    panel.querySelector('#rwd-slot-spin').addEventListener('click', spinAction);
    // when coin selection changes, update UI
    panel.addEventListener('change', function(e){
      if (e.target && e.target.id === 'rwd-slot-coin-select') updateCreditsUI();
    });

    populateCoinSelect();
    updateCreditsUI();
    return true;
  }

  // popula select com tipos de moeda (a partir do inventário). Se não houver moedas, mostra informação e desabilita select/ação.
  function populateCoinSelect(){
    var sel = document.getElementById('rwd-slot-coin-select');
    if (!sel) return;
    sel.innerHTML = '';
    var uniques = uniqueCodesInInventory();
    if (uniques && uniques.length){
      uniques.forEach(function(u){
        var meta = u.sample || findAnyMetadataForCode(u.code);
        if (!isCoinItem(meta)) return;
        var opt = document.createElement('option');
        opt.value = u.code;
        opt.textContent = (meta.emoji ? (meta.emoji + ' ') : '') + (meta.name || u.code) + ' (' + countCoinsByCode(u.code) + ')';
        sel.appendChild(opt);
      });
      sel.disabled = false;
      // if there is at least one option, ensure spin button enabled/disabled according to counts
      var firstVal = sel.options && sel.options[0] && sel.options[0].value;
      if (firstVal) document.getElementById('rwd-slot-coin-select').value = firstVal;
    } else {
      // sem moedas: não adicionar opção de "usar créditos numéricos" — apenas informar e desabilitar
      var opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Sem moedas disponíveis';
      opt.disabled = true;
      sel.appendChild(opt);
      sel.disabled = true;
    }
  }

  // atualiza select quando o inventário muda (ou quando modal de inventário é usado)
  document.addEventListener('mini_todo_inventory_changed', function(){ populateCoinSelect(); updateCreditsUI(); });
  // também atualiza sempre que inventário for alterado externamente (heurística: observe localStorage via evento custom)
  window.addEventListener('storage', function(e){
    if (e.key === LS_INVENTORY_KEY) { populateCoinSelect(); updateCreditsUI(); }
  });

  // init on DOM ready
  function init(){
    ensureSlotUI();
    // Nota: não criamos/forçamos créditos numéricos quando inventário vazio — compatibilidade mantida em localStorage,
    // mas o jogo ficará desabilitado até que o usuário possua moedas no inventário.
    populateCoinSelect();
    updateCreditsUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // expose for debug
  window.slotMachine = window.slotMachine || {};
  window.slotMachine.getCredits = function(){ var c = getSelectedCoinCode(); return hasInventoryCoins() ? (c ? countCoinsByCode(c) : 0) : getNumericCredits(); };
  window.slotMachine.setCredits = function(v){ if (!hasInventoryCoins()) setNumericCredits(v); };
  window.slotMachine.open = function(){ var sb = document.querySelector('.progress-sidebar'); if (sb){ var p = sb.querySelector('#rwd-slot-panel'); if (p) p.classList.add('open'); } };

})(window, document);



// --- Adicionado: sincronizar seleção de moeda para window.selectedCoin ---
(function bindCoinSync(){
  try {
    var els = [];
    var s = document.getElementById('coin') || document.getElementById('moeda') || document.querySelector('select[name=\"coin\"]') || document.querySelector('.coin-select') || document.querySelector('select.coin');
    if (s) els.push(s);
    var radios = document.querySelectorAll('input[name=\"coin\"]');
    if (radios && radios.length) for (var i=0;i<radios.length;i++) els.push(radios[i]);
    els.forEach(function(el){
      el.addEventListener('change', function(){
        try { window.selectedCoin = getSelectedCoinValue(); } catch(e){}
      });
    });
    // init
    window.selectedCoin = getSelectedCoinValue();
  } catch(e){ console.error('bindCoinSync error', e); }
})();
