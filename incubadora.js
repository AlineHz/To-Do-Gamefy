
/* Incubadora-assets-fixed.js
   - Versão final ajustada para buscar imagens apenas dentro da pasta `/assets/` (ex.: `/assets/Gato-angora.png`).
   - Ajuste: não permite selecionar itens do tipo "moeda" (moedas/coins/creditos).
   - Estratégia:
     * tenta `item.image`/`item.icon`/`item.img` primeiro;
     * cria variantes do nome (sem acento, lowercase, com '-' e '_', urlencoded) e testa extensões [.png,.jpg,.jpeg,.webp,.svg] dentro de `/assets/`;
     * testa cada URL sequencialmente com `Image()` (timeout 1.5s) e usa o primeiro que carregar; se nada for encontrado, usa o fallback SVG.
   - Quando o usuário confirmar a seleção, se for encontrada uma imagem ela será salva em `finalItem.image`.
*/

(function(document){
  'use strict';

  function createEl(tag, attrs, children){
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs){
      if (k === 'html') el.innerHTML = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function(c){ el.appendChild(c); });
    return el;
  }

  function ensureStyles(){
    if (document.getElementById('incubator-styles')) return;
    var css = `
#incubator-modal { position: fixed; inset: 0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.45); z-index: 99999; }
#incubator-panel { width: 560px; max-width: 95%; background: white; border-radius: 10px; padding: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); font-family: sans-serif; }
#incubator-panel h2 { margin:0 0 8px 0; font-size:18px; }
#incubator-list { display:flex; flex-direction:column; gap:8px; max-height:300px; overflow:auto; margin:8px 0 12px 0; }
.incubator-item { display:flex; align-items:center; gap:10px; padding:8px; border-radius:8px; border:1px solid #eee; }
.incubator-item .emoji { font-size:28px; width:48px; text-align:center; }
.incubator-item .meta { flex:1; }
.incubator-actions { display:flex; gap:8px; justify-content: flex-end; }
.small-btn { padding:6px 8px; border-radius:6px; border:1px solid #ccc; background:#fff; cursor:pointer; }
.small-btn:hover { filter:brightness(0.95); }
#incubator-confirm { border-top:1px solid #f0f0f0; margin-top:10px; padding-top:10px; display:none; }
#incubator-confirm .confirm-emoji { font-size:48px; }
#incubator-confirm .confirm-title { font-weight:600; margin-top:6px; }
#incubator-confirm .confirm-desc { font-size:13px; color:#666; margin-top:4px; }
`;
    var style = document.createElement('style');
    style.id = 'incubator-styles';
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  var LS_SELECTED_KEY = 'mini_todo_incubator_selected_v1';

  function saveSelectedEggToStorage(item){
    try {
      var payload = Object.assign({}, item || {});
      payload.__savedAt = new Date().toISOString();
      localStorage.setItem(LS_SELECTED_KEY, JSON.stringify(payload));
    } catch(e){ }
  }

  function loadSelectedEggFromStorage(){
    try {
      var raw = localStorage.getItem(LS_SELECTED_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
  }

  function clearSelectedEggStorage(){
    try { localStorage.removeItem(LS_SELECTED_KEY); } catch(e){}
  }

  // normalize name variants (no accents, hyphen, underscore, encoded)
  function normalizeNameVariants(name){
    if (!name) return [''];
    var s = String(name).trim();
    var normalized = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    var lower = normalized.toLowerCase();
    var variants = [];
    variants.push(s);
    variants.push(normalized);
    variants.push(lower);
    variants.push(lower.replace(/\s+/g,'-'));
    variants.push(lower.replace(/\s+/g,'_'));
    variants.push(encodeURIComponent(s));
    variants.push(encodeURIComponent(normalized));
    return variants.filter(function(v,i,a){ return v && a.indexOf(v) === i; });
  }

  // --- helpers para detecção de "Ovo de" ---
  function normalizeNoAccentLower(s){
    if (!s) return '';
    var str = String(s);
    return (str.normalize ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : str).toLowerCase();
  }
  function isOvoDe(nameOrCode){
    var s = normalizeNoAccentLower(nameOrCode || '');
    return s.indexOf('ovo de') !== -1; // procura substring 'ovo de'
  }
  // retorna lista de candidatos específicos para "Ovo.png"
  function ovoCandidatesList(){
    return ['/assets/Ovo.png','/assets/ovo.png','assets/Ovo.png','assets/ovo.png','Ovo.png','ovo.png'];
  }
  // ------------------------------------------------

  function buildAssetCandidatesForAssets(name, code){
    // se for "Ovo de ..." forçar procurar Ovo.png
    if (isOvoDe(name || code || '')) {
      return ovoCandidatesList();
    }

    var exts = ['png','jpg','jpeg','webp','svg'];
    var base = '/assets/'; // only this base as you specified
    var variants = normalizeNameVariants(name || code || '');
    if (code && variants.indexOf(code) === -1) variants.push(code);
    var candidates = [];
    variants.forEach(function(v){
      exts.forEach(function(ext){ candidates.push(base + v + '.' + ext); });
    });
    // also try relative filenames (in case assets are referenced without leading slash)
    variants.forEach(function(v){ exts.forEach(function(ext){ candidates.push(v + '.' + ext); }); });
    return candidates;
  }

  function findFirstValidFromList(list, cb){
    var i = 0;
    function next(){
      if (i >= list.length) { try { console.warn('Incubadora: nenhum asset encontrado. Testadas:', list); } catch(e){} cb(null); return; }
      var url = list[i++];
      var img = new Image();
      var done = false;
      var to = setTimeout(function(){ if (done) return; done = true; img.onload = img.onerror = null; next(); }, 1500);
      img.onload = function(){ if (done) return; done = true; clearTimeout(to); img.onload = img.onerror = null; cb(url); };
      img.onerror = function(){ if (done) return; done = true; clearTimeout(to); img.onload = img.onerror = null; next(); };
      img.src = url;
    }
    next();
  }

  // Inserir preview na página principal
  function insertPreviewOnPage(item){
    if (!item) return;
    try {
      var target = document.getElementById('global-progress') || document.querySelector('.progress-sidebar');
      if (!target) { target = document.querySelector('.content') || document.body; }

      ['incubator-preview-row','incubator-page-preview','incubator-preview'].forEach(function(id){
        var ex = document.getElementById(id); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
      });

      var previewRow = document.createElement('div');
      previewRow.id = 'incubator-preview-row';
      previewRow.style.display = 'flex';
      previewRow.style.gap = '12px';
      previewRow.style.alignItems = 'flex-start';
      previewRow.style.marginTop = '8px';

      var imgContainer = document.createElement('div');
      imgContainer.style.flex = '0 0 160px';
      imgContainer.style.maxWidth = '40%';
      imgContainer.style.minWidth = '80px';
      imgContainer.style.height = '160px';
      imgContainer.style.display = 'flex';
      imgContainer.style.alignItems = 'center';
      imgContainer.style.justifyContent = 'center';
      imgContainer.style.background = '#fafafa';
      imgContainer.style.border = '1px solid #eee';
      imgContainer.style.borderRadius = '8px';

      var imgEl = document.createElement('img');
      imgEl.id = 'incubator-page-preview';
      imgEl.alt = 'Preview do ovo/pet';
      imgEl.style.display = 'block';
      imgEl.style.maxWidth = '100%';
      imgEl.style.maxHeight = '100%';
      imgEl.style.objectFit = 'contain';
      imgEl.style.visibility = 'hidden'; // escondido até carregar com sucesso
      imgContainer.appendChild(imgEl);

      var messagesContainer = document.createElement('div');
      messagesContainer.id = 'incubator-messages';
      messagesContainer.style.flex = '1 1 auto';
      messagesContainer.style.display = 'flex';
      messagesContainer.style.flexDirection = 'column';
      messagesContainer.style.justifyContent = 'center';
      messagesContainer.style.padding = '6px 8px';
      messagesContainer.style.borderLeft = '1px solid rgba(0,0,0,0.06)';
      messagesContainer.style.minHeight = '64px';

      var messageEl = document.createElement('div');
      messageEl.id = 'incubator-message-text';
      messageEl.style.fontSize = '14px';
      messageEl.style.lineHeight = '1.3';
      messageEl.style.fontWeight = '500';
      messageEl.style.color = '#333';
      messagesContainer.appendChild(messageEl);

      // === ALTERAÇÃO: manter somente mensagens motivacionais ===
      var messages = [
        'Continue assim — você está fazendo progresso!',
        'Cada passo conta. Mantenha o foco!',
        'Força e paciência — grandes coisas estão por vir!'
      ];
      function chooseMessage(){ return messages[Math.floor(Math.random() * messages.length)]; }
      messageEl.textContent = chooseMessage();
      // =======================================================

      previewRow.appendChild(imgContainer);
      previewRow.appendChild(messagesContainer);

      var rowEl = null;
      if (target.classList && target.classList.contains('progress')) { rowEl = target.parentNode; }
      else if (target.classList && target.classList.contains('progress-row')) { rowEl = target; }
      else { rowEl = (target.querySelector && target.querySelector('.progress-row')) || document.querySelector('.progress-row') || target; }

      if (rowEl && rowEl.parentNode) { rowEl.parentNode.insertBefore(previewRow, rowEl.nextSibling); }
      else { target.appendChild(previewRow); }

      // fallback SVG
      function setFallback(){
        try{
          var emoji = (item.emoji || '🥚').replace(/[♦◆🔷🔶💎💠◇️]/g,'').trim() || '🥚';
          var title = (item.name || item.code || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
          var svg = '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"800\" height=\"400\">' +
                    '<rect width=\"100%\" height=\"100%\" fill=\"#fff\" rx=\"16\" />' +
                    '<text x=\"50%\" y=\"40%\" font-size=\"160\" text-anchor=\"middle\" dominant-baseline=\"middle\">' + emoji + '</text>' +
                    '<text x=\"50%\" y=\"82%\" font-size=\"28px\" text-anchor=\"middle\" fill=\"#333\">' + title + '</text>' +
                    '</svg>';
          imgEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          imgEl.style.visibility = 'visible';
        }catch(e){ console.error(e); }
      }

      // construção de variantes simples (sem acento, '-', '_', prefixos pet_, pet-)
      function normalizeVariants(name){
        if (!name) return [''];
        var s = String(name).trim();
        var normalized = s.normalize ? s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'') : s;
        var lower = normalized.toLowerCase();
        var v = [s, normalized, lower, lower.replace(/\\s+/g,'-'), lower.replace(/\\s+/g,'_')];
        var more = [];
        v.forEach(function(x){ if (x){ more.push('pet-' + x); more.push('pet_' + x); more.push('pet' + x); } });
        v = v.concat(more);
        // também aceitar urlencoded
        v = v.concat(v.map(function(x){ return encodeURIComponent(x); }));
        return v.filter(function(x,i,a){ return x && a.indexOf(x)===i; });
      }

      function buildCandidates(name){
        var exts = ['png','jpg','jpeg','webp','svg'];
        var bases = ['/assets/','assets/'];
        var variants = normalizeVariants(name);
        var out = [];
        bases.forEach(function(b){
          variants.forEach(function(v){
            exts.forEach(function(ext){ out.push(b + v + '.' + ext); });
          });
        });
        // também tentar apenas o filename relativo
        variants.forEach(function(v){ exts.forEach(function(ext){ out.push(v + '.' + ext); }); });
        return out;
      }

      function findFirstValid(list, cb){
        var i = 0;
        function next(){
          if (i >= list.length){ try { console.warn('Incubadora: nenhum asset encontrado. Testadas:', list); } catch(e){} cb(null); return; }
          var url = list[i++], tester = new Image(), done = false;
          var to = setTimeout(function(){ if (done) return; done = true; tester.onload = tester.onerror = null; next(); }, 1200);
          tester.onload = function(){ if (done) return; done = true; clearTimeout(to); tester.onload = tester.onerror = null; cb(url); };
          tester.onerror = function(){ if (done) return; done = true; clearTimeout(to); tester.onload = tester.onerror = null; next(); };
          tester.src = url;
        }
        next();
      }

      // Se for "Ovo de ..." -> forçar procurar Ovo.png (curto-circuito aqui, antes do known)
      if (isOvoDe(item.name || item.code || '')) {
        var ovoList = ovoCandidatesList();
        findFirstValid(ovoList, function(found){
          if (found){
            imgEl.onload = function(){ imgEl.style.visibility = 'visible'; };
            imgEl.onerror = function(){ console.warn('Incubadora: erro ao carregar asset encontrado', found); setFallback(); };
            imgEl.src = found;
            try { item.image = found; } catch(e){}
          } else {
            setFallback();
          }
          window.incubatorPagePreview = imgEl;
        });
        return; // já tratamos o caso "Ovo de"
      }

      // se item já tem image declarado, usa direto
      var known = item.image || item.icon || item.img || item.sprite;
      if (known){
        imgEl.onload = function(){ imgEl.style.visibility = 'visible'; };
        imgEl.onerror = function(){ console.warn('Incubadora: falha ao carregar known image', known); setFallback(); };
        imgEl.src = known;
        window.incubatorPagePreview = imgEl;
        return;
      }

      var candidates = buildCandidates(item.name || item.code || '');
      findFirstValid(candidates, function(found){
        if (found){
          imgEl.onload = function(){ imgEl.style.visibility = 'visible'; };
          imgEl.onerror = function(){ console.warn('Incubadora: erro ao carregar asset encontrado', found); setFallback(); };
          imgEl.src = found;
          try { item.image = found; } catch(e) {}
        } else {
          setFallback();
        }
        window.incubatorPagePreview = imgEl;
      });

      var nameForLookup = item.name || item.code || '';
      var candidates = buildAssetCandidatesForAssets(nameForLookup, item.code);

      // evitar mostrar o alt — colocar um transparente temporário enquanto carrega
      imgEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

      findFirstValidFromList(candidates, function(foundUrl){
        if (foundUrl){
          imgEl.src = foundUrl;
          try { item.image = foundUrl; } catch(e){}
        } else {
          var emoji = (item.emoji || '🥚').replace(/[♦◆🔷🔶💎💠◇️]/g,'').trim() || '🥚';
          var title = (item.name || item.code || '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
          var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">' +
                    '<rect width="100%" height="100%" fill="#fff" rx="16" />' +
                    '<text x="50%" y="40%" font-size="160" text-anchor="middle" dominant-baseline="middle">' + emoji + '</text>' +
                    '<text x="50%" y="82%" font-size="28px" text-anchor="middle" fill="#333">' + title + '</text>' +
                    '</svg>';
          var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          imgEl.src = url;
        }
        window.incubatorPagePreview = imgEl;
      });

    } catch (e) {
      console.error('Erro ao inserir preview na página:', e);
    }
  }

  // Heurística mais robusta para identificar ovos e pets (mantida)
  function isEggOrPet(item){
    if (!item) return false;
    try {
      var code = String(item.code || '').toLowerCase();
      var name = String(item.name || '').toLowerCase();
      var status = String(item.status || '').toLowerCase();
      var type = String(item.type || '').toLowerCase();
      var desc = String(item.desc || '').toLowerCase();
      var tags = '';
      try { tags = (item.tags || []).join(' ').toLowerCase(); } catch(e){}

      if (code.indexOf('ovo_') === 0 || code.indexOf('egg_') === 0) return true;
      if (code.indexOf('pet_') === 0) return true;
      if (item.hatched === true) return true;

      var kw = ['chocado','hatched','eclodido','nasceu','pet','animal'];
      for (var i=0;i<kw.length;i++){ if (status.indexOf(kw[i]) !== -1) return true; if (name.indexOf(kw[i]) !== -1) return true; if (desc.indexOf(kw[i]) !== -1) return true; if (type.indexOf(kw[i]) !== -1) return true; if (tags.indexOf(kw[i]) !== -1) return true; }

      var emoji = String(item.emoji || '').trim();
      if (emoji && emoji !== '🥚' && emoji.length <= 3) return true;

      var petProps = ['level','rarity','hp','attack','defense','behavior','stats','growth'];
      for (var j=0;j<petProps.length;j++){ if (typeof item[petProps[j]] !== 'undefined') return true; }

      var hasImage = !!(item.image || item.icon || item.sprite || item.img);
      if (hasImage && name && name.indexOf('ovo') === -1 && code.indexOf('ovo_') !== 0) return true;

      return false;
    } catch(e){ return false; }
  }

  // --- nova função: detectar itens do tipo "moeda" / "coin" / "creditos" ---
  function isCoin(item){
    if (!item) return false;
    try {
      var code = String(item.code || '').toLowerCase();
      var name = String(item.name || '').toLowerCase();
      var desc = String(item.desc || '').toLowerCase();
      var type = String(item.type || '').toLowerCase();
      var tags = '';
      try { tags = (item.tags || []).join(' ').toLowerCase(); } catch(e){}

      var kw = ['moeda','moedas','coin','coins','credit','credito','creditos','crédito','créditos','gold','gems','gem','dinheiro','saldo','currency','moedinha','💰','🪙'];
      for (var i=0;i<kw.length;i++){
        var k = kw[i];
        if (name.indexOf(k) !== -1) return true;
        if (code.indexOf(k) !== -1) return true;
        if (desc.indexOf(k) !== -1) return true;
        if (type.indexOf(k) !== -1) return true;
        if (tags.indexOf(k) !== -1) return true;
      }

      // heurística adicional: itens que tenham só propriedade 'amount' e sem propriedades de pet
      var petProps = ['level','rarity','hp','attack','defense','behavior','stats','growth','hatched','sprite'];
      var hasPetProp = false;
      for (var j=0;j<petProps.length;j++){ if (typeof item[petProps[j]] !== 'undefined') { hasPetProp = true; break; } }
      if (!hasPetProp && typeof item.amount !== 'undefined') return true;

      return false;
    } catch(e){ return false; }
  }

  function openModal(){
    ensureStyles();

    var modal = createEl('div',{id:'incubator-modal','role':'dialog','aria-modal':'true'});
    var panel = createEl('div',{id:'incubator-panel'});
    modal.appendChild(panel);

    var title = createEl('h2',{text:'Incubadora — selecione um ovo ou pet'});
    panel.appendChild(title);

    var list = createEl('div',{id:'incubator-list'});
    panel.appendChild(list);

    // confirmation area (segunda etapa)
    var confirm = createEl('div',{id:'incubator-confirm'});
    // conteúdo será preenchido dinamicamente ao clicar em Selecionar
    panel.appendChild(confirm);

    var footer = createEl('div',{class:'incubator-actions'});
    var btnClose = createEl('button',{class:'small-btn', type:'button', text:'Fechar'});
    footer.appendChild(btnClose);
    panel.appendChild(footer);

    // populate items from inventory
    try {
      var inv = (typeof loadInventory === 'function') ? loadInventory() : (JSON.parse(localStorage.getItem('mini_todo_inventory_v1')||'[]')||[]);

      // Filtrar com a heurística robusta e excluir moedas (ajuste solicitado)
      var eggsAndPets = inv.filter(function(it){ return isEggOrPet(it) && !isCoin(it); });

      if (!eggsAndPets.length){
        list.appendChild(createEl('div',{text:'Nenhum ovo ou pet encontrado no inventário.'}));
      } else {
        eggsAndPets.forEach(function(it, idx){
          var itemEl = createEl('div',{class:'incubator-item'});
          var emoji = createEl('div',{class:'emoji', text: it.emoji || '🥚'});
          var meta = createEl('div',{class:'meta'});
          var name = createEl('div',{text: it.name || it.code});
          var descText = it.desc || (it.hatched ? '(Pet já chocado)' : '');
          var desc = createEl('div',{text: descText, style: 'font-size:12px;color:#666;'});
          meta.appendChild(name); meta.appendChild(desc);

          // botão: "Selecionar" segue o mesmo fluxo para ovos e pets
          var btnSelect = createEl('button',{class:'small-btn', type:'button', text:'Selecionar'});

          // ao clicar, abrimos a segunda etapa: confirmação
          btnSelect.addEventListener('click', function(){
            openConfirmStep(it, confirm, modal);
          });

          itemEl.appendChild(emoji); itemEl.appendChild(meta); itemEl.appendChild(btnSelect);
          list.appendChild(itemEl);
        });
      }
    } catch(e){
      console.error('Incubadora: erro ao carregar inventário', e);
      list.appendChild(createEl('div',{text:'Erro ao carregar inventário.'}));
    }

    btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function(ev){ if (ev.target === modal) closeModal(); });

    document.body.appendChild(modal);

    // openConfirmStep: mostra detalhes e botões Confirmar / Cancelar
    function openConfirmStep(item, container, modalRoot){
      // limpar conteúdo
      container.innerHTML = '';
      container.style.display = 'block';

      var left = createEl('div',{},[]);
      var emojiEl = createEl('div',{class:'confirm-emoji', text: item.emoji || '🥚'});
      left.appendChild(emojiEl);

      var right = createEl('div',{},[]);
      var titleEl = createEl('div',{class:'confirm-title', text: item.name || item.code});
      var descText = item.desc || (item.hatched ? '(Pet já chocado)' : '');
      var descEl = createEl('div',{class:'confirm-desc', text: descText});
      right.appendChild(titleEl); right.appendChild(descEl);

      var row = createEl('div',{},[]);
      row.style.display = 'flex';
      row.style.gap = '12px';
      row.appendChild(left); row.appendChild(right);

      var actions = createEl('div',{class:'incubator-actions'});
      var btnConfirm = createEl('button',{class:'small-btn', type:'button', text:'Confirmar seleção'});
      var btnCancel = createEl('button',{class:'small-btn', type:'button', text:'Cancelar'});
      actions.appendChild(btnCancel); actions.appendChild(btnConfirm);

      container.appendChild(row);
      container.appendChild(actions);

      // cancelar apenas esconde a confirmação
      btnCancel.addEventListener('click', function(){
        container.style.display = 'none';
        container.innerHTML = '';
      });

      // confirmar: persiste e insere preview na página principal e fecha modal
      btnConfirm.addEventListener('click', function(){
        try {
          var finalItem = Object.assign({}, item);

          // prevenção extra: não permitir confirmar se for moeda
          if (isCoin(finalItem)) {
            try { alert('Itens do tipo moeda não podem ser selecionados na incubadora.'); } catch(e){}
            return;
          }

          if (!finalItem.name || String(finalItem.name||'').trim() === ''){
            if (finalItem.code){
              var human = String(finalItem.code).replace(/^.*[._\-]/,'').replace(/[_\-]/g,' ').trim();
              human = human.charAt(0).toUpperCase() + human.slice(1);
              finalItem.name = human || ('Pet ' + (finalItem.emoji || '').trim());
            } else {
              finalItem.name = (finalItem.emoji || 'Pet').toString() + ' Pet';
            }
          }

          // tentar localizar asset para o nome gerado / existente e salvar em finalItem.image se encontrar
          var candidates = buildAssetCandidatesForAssets(finalItem.name, finalItem.code);

          // Se for "Ovo de ..." garantir que use Ovo.png (também no momento de confirmação)
          if (isOvoDe(finalItem.name || finalItem.code || '')) {
            candidates = ovoCandidatesList();
          }

          findFirstValidFromList(candidates, function(foundUrl){
            if (foundUrl){ finalItem.image = foundUrl; }
            try {
              window.incubatorSelectedEgg = Object.assign({}, finalItem);
              window.incubatorSelectedEggSelectedAt = new Date().toISOString();
            } catch(e){ console.error(e); }
            try { saveSelectedEggToStorage(window.incubatorSelectedEgg); } catch(e){}
            try { insertPreviewOnPage(window.incubatorSelectedEgg); } catch(e){ console.error('Erro ao inserir preview após confirmação:', e); }
            closeModal();
          });

        } catch(e){ console.error(e); }
      });
    }
  }

  function closeModal(){
    var m = document.getElementById('incubator-modal');
    if (m) m.parentNode.removeChild(m);
  }

  // inject button next to slot toggle
  function injectButton(){
    var ref = document.getElementById('rwd-slot-toggle');
    if (!ref) return;
    if (document.getElementById('rwd-incubator-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'rwd-incubator-btn';
    btn.type = 'button';
    btn.className = 'rwd-action-btn rwd-slot-btn';
    btn.textContent = 'Incubadora';
    btn.title = 'Abrir Incubadora';
    btn.style.marginLeft = '8px';
    btn.addEventListener('click', openModal);
    ref.parentNode.insertBefore(btn, ref.nextSibling);
  }

  // restore persisted selection on load
  function restoreSelectedEggIfAny(){
    try {
      var saved = loadSelectedEggFromStorage();
      if (saved && saved.code) {
        window.incubatorSelectedEgg = Object.assign({}, saved);
        window.incubatorSelectedEggSelectedAt = saved.__savedAt || new Date().toISOString();
        var attempts = 0;
        function tryInsert(){
          attempts++;
          insertPreviewOnPage(saved);
          if (attempts < 4) setTimeout(tryInsert, 350);
        }
        tryInsert();
      }
    } catch(e){ }
  }


  // --- Observador para sincronizar seleção quando o ovo choca automaticamente ---
  (function(){
    var _lastPreviewImgSrc = null;

    function isEggImageSrc(src){
      if(!src) return false;
      try {
        var s = src.toLowerCase();
        if (s.indexOf('ovo') !== -1) return true;
        if (s.indexOf('egg') !== -1) return true;
        // filenames like 'ovo-de-bulldog.png' or 'egg_bulldog.webp'
        var fn = s.split('/').pop().split('?')[0];
        if (/^ovo[_\-]/.test(fn) || /^egg[_\-]/.test(fn)) return true;
      } catch(e){}
      return false;
    }

    function deriveInfoFromImgSrc(src){
      try {
        var fn = (src||'').split('/').pop().split('?')[0];
        fn = decodeURIComponent(fn);
        var name = fn.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').trim();
        if (!name) name = fn;
        var code = name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9_\-]/g,'');
        return { name: name, code: (code?('pet_'+code):('pet_'+Math.random().toString(36).slice(2,8))), image: src, hatched: true };
      } catch(e){ return { name: 'Pet', code: 'pet_auto_'+Date.now(), image: src, hatched: true }; }
    }

    function trySyncPreviewToSelection(){
      try {
        var preview = document.getElementById('incubator-preview-row');
        if (!preview) return;
        var img = preview.querySelector('img');
        if (!img || !img.src) return;
        var src = img.src;
        if (src === _lastPreviewImgSrc) return;
        _lastPreviewImgSrc = src;
        // If the new preview looks like a pet (not an egg), update selection
        if (!isEggImageSrc(src)) {
          var info = deriveInfoFromImgSrc(src);
          // avoid selecting coin-like items derived from image filename
          if (isCoin(info)) return;
          // try to reuse previous saved info's properties
          var prev = null;
          try { prev = loadSelectedEggFromStorage() || window.incubatorSelectedEgg || {}; } catch(e){ prev = window.incubatorSelectedEgg || {}; }
          info = Object.assign({}, prev, info);
          // set as current selection and persist
          try { window.incubatorSelectedEgg = Object.assign({}, info); window.incubatorSelectedEggSelectedAt = new Date().toISOString(); } catch(e){}
          try { saveSelectedEggToStorage(window.incubatorSelectedEgg); } catch(e){}
          try { insertPreviewOnPage(window.incubatorSelectedEgg); } catch(e){}
        }
      } catch(e){}
    }

    // Observe changes to the preview container and image src attributes
    function startHatchObserver(){
      try {
        var body = document.body;
        if (!body) return;
        var mo = new MutationObserver(function(muts){
          try { for (var i=0;i<muts.length;i++){ var m = muts[i]; if (m.type === 'attributes' && m.attributeName==='src') { trySyncPreviewToSelection(); } } } catch(e){}
          // also attempt a sync on any subtree change
          trySyncPreviewToSelection();
        });
        mo.observe(body, { childList:true, subtree:true, attributes:true, attributeFilter:['src'] });
        // periodic fallback
        setInterval(trySyncPreviewToSelection, 800);
      } catch(e){}
    }

    // start when DOM is ready (defensive)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(startHatchObserver, 500);
    } else {
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(startHatchObserver, 500); });
    }
  })();


  document.addEventListener('DOMContentLoaded', function(){ setTimeout(injectButton, 300); restoreSelectedEggIfAny(); });
  setTimeout(injectButton, 2000);
  setTimeout(restoreSelectedEggIfAny, 2400);

})(document);
