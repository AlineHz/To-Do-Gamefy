/* onboarding.js
   Onboarding / primeiro uso — modal passo-a-passo para apresentar a app ao usuário.
   - Detecta primeira visita via localStorage key: 'mini_todo_onboard_v1'
   - Mostra passos que destacam: adicionar página/lista/tarefa, ganhar pontos, subir de level e ganhar moeda, usar "Estou com sorte" (slot), adicionar ovo na incubadora e chocar ao completar a página.
   - Fornece botão para criar uma tarefa de exemplo (simula preenchimento dos inputs e clique nos botões presentes na página).
   - Emite evento 'mini_todo_onboarding_completed' quando o usuário finalizar.

   Integra com a UI existente (usa IDs: #new-page-title, #btn-add-page, #new-list-title, #btn-add-list, #new-task-text, #btn-add-task, slot/incubadora). See index.html and script.js for these IDs.
*/
(function(document, window){
  'use strict';

  var LS_KEY = 'mini_todo_onboard_v1';
  var AUTO_CREATE_PAGE_ID = '__onboard_sample_page__';

  function hasSeen(){ try { return localStorage.getItem(LS_KEY) === '1'; } catch(e){ return false; } }
  function markSeen(){ try { localStorage.setItem(LS_KEY, '1'); } catch(e){} }

  // small helper to create elements
  function el(tag, attrs, children){
    var node = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs){
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function(c){ node.appendChild(c); });
    return node;
  }

  // inject CSS for modal + highlight
  function ensureStyles(){ if (document.getElementById('onboard-styles')) return;
    var css = "\n#onboard-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:120000;font-family:Inter,Segoe UI,Roboto,Arial,sans-serif}"
            +"\n#onboard-panel{width:680px;max-width:94%;background:#fff;border-radius:12px;padding:18px;box-shadow:0 16px 50px rgba(2,6,23,0.35)}"
            +"\n#onboard-panel h2{margin:0 0 6px 0;font-size:18px}" 
            +"\n#onboard-panel p{margin:6px 0 12px;color:#374151}" 
            +"\n.onboard-controls{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}"
            +"\n.onboard-btn{padding:8px 12px;border-radius:8px;border:1px solid #e6e9ee;background:#fff;cursor:pointer}"
            +"\n.onboard-btn.primary{background:#10b981;color:#fff;border:0}"
            +"\n.onboard-skip{position:absolute;right:14px;top:12px;border:none;background:transparent;color:#6b7280;cursor:pointer}"
            +"\n.onboard-step-meta{display:flex;gap:12px;align-items:center}"
            +"\n.onboard-step-number{width:46px;height:46px;border-radius:999px;background:linear-gradient(180deg,#eefaf3,#d1fae6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#059669}"
            +"\n.onboard-highlighter{position:relative;z-index:120010;box-shadow:0 0 0 3px rgba(99,102,241,0.12),0 6px 20px rgba(2,6,23,0.16);transition:box-shadow .18s ease,transform .12s ease}"
            +"\n.onboard-pulse{animation:onboardPulse 1100ms ease-in-out infinite}"
            +"\n@keyframes onboardPulse{0%{transform:scale(1)}50%{transform:scale(1.04)}100%{transform:scale(1)}}"
            +"\n.onboard-external-hint{font-size:13px;color:#6b7280;margin-top:6px}"
            +"\n.onboard-create-sample{margin-top:8px;text-align:left}"
            ;
    var s = document.createElement('style'); s.id = 'onboard-styles'; s.innerHTML = css; document.head.appendChild(s);
  }

  // steps definition
  var steps = [
    {
      id: 'welcome',
      title: 'Bem-vindo(a)!',
      text: 'Esta é sua nova app de checklists gamificada. Você pode criar páginas, listas e tarefas. Ao completar tarefas você ganha pontos e sobe de level — e ao subir de level você ganha moedas especiais.',
      selector: null,
      action: null
    },
    {
      id: 'add-page',
      title: 'Criar uma página',
      text: 'Use o campo "Nova página" no topo para criar uma nova página. Vamos criar uma página de exemplo se quiser — ou você pode criar manualmente.',
      selector: '#new-page-title',
      action: function(){ focusAndPulse('#new-page-title'); }
    },
    {
      id: 'add-list',
      title: 'Adicionar uma lista',
      text: 'Dentro da página você pode criar listas (grupos de tarefas). Insira o título e escolha data/repetição se quiser. Vamos criar uma lista de exemplo automaticamente, se preferir.',
      selector: '#new-list-title',
      action: function(){ focusAndPulse('#new-list-title'); }
    },
    {
      id: 'add-task',
      title: 'Adicionar tarefas',
      text: 'Adicione tarefas e marque-as quando concluídas. Cada tarefa completa concede pontos (por padrão 5 pts). Experimente criar uma tarefa agora — podemos criar uma para você.',
      selector: '#new-task-text',
      action: function(){ focusAndPulse('#new-task-text'); }
    },
    {
      id: 'points-levels',
      title: 'Pontos e níveis',
      text: 'Pontos acumulados somam para subir de nível. Quando você sobe de level, o sistema concede uma moeda colecionável — que pode ser usada no painel "Estou com sorte".',
      selector: '#level-badge',
      action: function(){ focusAndPulse('#level-badge'); }
    },
    {
      id: 'slot',
      title: 'Estou com sorte (Slot)',
      text: 'Gire o caça-níquel usando moedas para tentar ganhar ovos. Os ovos vão para o inventário e podem ser colocados na incubadora.',
      selector: '#rwd-slot-panel, #rwd-slot-coin-select, #rwd-slot-spin',
      action: function(){ focusAndPulse('#rwd-slot-panel'); }
    },
    {
      id: 'incubator',
      title: 'Incubadora',
      text: 'Coloque um ovo na incubadora e acompanhe o progresso. Quando todas as tarefas da página estiverem concluídas, o ovo choca e você ganha o pet!',
      selector: '#incubator-preview, #incubator-modal, #incubator-panel, #incubator-page-preview',
      action: function(){ focusAndPulse('#incubator-preview'); }
    },
    {
      id: 'finish',
      title: 'Pronto para começar!',
      text: 'Deseja que criemos uma página/lista/tarefa de exemplo para você testar agora? Você pode pular ou criar manualmente. Boa sorte — e divirta-se! 🎉',
      selector: null,
      action: null
    }
  ];

  // modal state
  var modal, stepIndex = 0, highlightedEl = null;

  function buildModal(){
    ensureStyles();
    modal = el('div',{id:'onboard-modal',role:'dialog','aria-modal':'true'});
    var panel = el('div',{id:'onboard-panel'});
    var skip = el('button',{class:'onboard-skip',type:'button',text:'Pular (não mostrar novamente)'});
    skip.addEventListener('click', function(){ finish(true); });
    panel.appendChild(skip);

    var header = el('div',{class:'onboard-step-meta'});
    var num = el('div',{class:'onboard-step-number',text:'1'});
    var headText = el('div',{},[]);
    var title = el('h2',{text:''});
    var desc = el('p',{text:''});
    headText.appendChild(title); headText.appendChild(desc);
    header.appendChild(num); header.appendChild(headText);
    panel.appendChild(header);

    // example create button area
    var createArea = el('div',{class:'onboard-create-sample'});
    var createSampleBtn = el('button',{class:'onboard-btn',type:'button',text:'Criar página/lista/tarefa de exemplo'});
    createSampleBtn.addEventListener('click', createSampleContent);
    createArea.appendChild(createSampleBtn);
    panel.appendChild(createArea);

    // actions
    var controls = el('div',{class:'onboard-controls'});
    var prev = el('button',{class:'onboard-btn',type:'button',text:'Anterior'});
    var next = el('button',{class:'onboard-btn primary',type:'button',text:'Próximo'});
    var finishBtn = el('button',{class:'onboard-btn primary',type:'button',text:'Concluir e não mostrar novamente'});
    prev.addEventListener('click', function(){ goTo(stepIndex-1); });
    next.addEventListener('click', function(){ goTo(stepIndex+1); });
    finishBtn.addEventListener('click', function(){ finish(false); });
    controls.appendChild(prev); controls.appendChild(next); controls.appendChild(finishBtn);
    panel.appendChild(controls);

    modal.appendChild(panel);
    document.body.appendChild(modal);

    // keyboard navigation
    modal.addEventListener('keydown', function(ev){ if (ev.key === 'ArrowRight') goTo(stepIndex+1); if (ev.key === 'ArrowLeft') goTo(stepIndex-1); if (ev.key==='Escape') finish(true); });

    renderStep();
  }

  function renderStep(){
    if (!modal) return;
    var panel = modal.firstElementChild;
    var num = panel.querySelector('.onboard-step-number');
    var title = panel.querySelector('h2');
    var desc = panel.querySelector('p');
    var createArea = panel.querySelector('.onboard-create-sample');

    if (stepIndex < 0) stepIndex = 0;
    if (stepIndex >= steps.length) stepIndex = steps.length-1;

    var s = steps[stepIndex];
    num.textContent = String(stepIndex+1);
    title.textContent = s.title || '';
    desc.textContent = s.text || '';

    // show create sample button only on the task-related steps
    createArea.style.display = (s.id === 'add-page' || s.id === 'add-list' || s.id === 'add-task' || s.id === 'finish') ? 'block' : 'none';

    // highlight target element if present
    removeHighlight();
    if (s.selector){
      var sel = s.selector.split(',').map(function(t){ return t.trim(); }).find(function(t){ return document.querySelector(t); });
      var target = sel ? document.querySelector(sel) : null;
      if (target){
        addHighlight(target);
        // try to scroll element into view
        try{ target.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); } catch(e){}
      } else {
        // if selector not found, provide an external hint
        var ext = panel.querySelector('.onboard-external-hint');
        if (!ext){ ext = el('div',{class:'onboard-external-hint'}); panel.insertBefore(ext, panel.querySelector('.onboard-controls')); }
        ext.textContent = 'Elemento de interface não encontrado na página atualmente. Você pode prosseguir.';
      }
    } else {
      // remove any existing hint
      var ext2 = panel.querySelector('.onboard-external-hint'); if (ext2) ext2.parentNode.removeChild(ext2);
    }

    // run step action if any (but don't be intrusive)
    try{ if (typeof s.action === 'function') s.action(); } catch(e){}
  }

  function goTo(idx){ stepIndex = Math.max(0, Math.min(steps.length-1, idx)); renderStep(); }

  function addHighlight(node){
    if (!node) return; highlightedEl = node; node.classList.add('onboard-highlighter','onboard-pulse');
  }
  function removeHighlight(){ if (highlightedEl){ try{ highlightedEl.classList.remove('onboard-highlighter','onboard-pulse'); } catch(e){} highlightedEl = null; } }

  function focusAndPulse(sel){ var eln = document.querySelector(sel); if (!eln) return; try{ if (eln.focus) eln.focus(); eln.classList.add('onboard-highlighter'); setTimeout(function(){ eln.classList.remove('onboard-highlighter'); }, 2200); }catch(e){} }

  // Create sample content by simulating input + clicks on the app's controls (best-effort)
  function createSampleContent(){
    try{
      // 1) create page (if new-page-title and btn-add-page exist)
      var newPage = document.getElementById('new-page-title');
      var addPageBtn = document.getElementById('btn-add-page');
      if (newPage && addPageBtn){ newPage.value = 'Página do Onboarding'; addPageBtn.click(); }

      // 2) create list (if new-list-title and btn-add-list exist) — give a tiny delay to allow page creation
      setTimeout(function(){
        var newList = document.getElementById('new-list-title');
        var addListBtn = document.getElementById('btn-add-list');
        if (newList && addListBtn){ newList.value = 'Lista de Boas-Vindas'; addListBtn.click(); }

        // 3) create a task
        setTimeout(function(){
          var newTask = document.getElementById('new-task-text');
          var addTaskBtn = document.getElementById('btn-add-task');
          if (newTask && addTaskBtn){ newTask.value = 'Tarefa de exemplo: marcar como concluída'; addTaskBtn.click(); }

          // briefly flash the created elements to show success
          flashCreatedElements();
        }, 300);
      }, 350);
    }catch(e){ console.error('onboarding: createSampleContent error', e); }
  }

  function flashCreatedElements(){
    ['#pages-list','.lists','#tasks','#new-task-text'].forEach(function(sel){ var n = document.querySelector(sel); if (n){ n.classList.add('onboard-highlighter'); setTimeout(function(){ try{ n.classList.remove('onboard-highlighter'); }catch(e){} },1500); } });
  }

  function finish(skipAll){
    removeHighlight();
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    try{ if (skipAll) markSeen(); else markSeen(); } catch(e){}
    try{ document.dispatchEvent(new CustomEvent('mini_todo_onboarding_completed', { detail: { skipped: !!skipAll } })); } catch(e){}
  }

  // Public API (exposed for debug / manual open)
  window.Onboarding = window.Onboarding || {};
  window.Onboarding.open = function(force){ if (force) { try{ localStorage.removeItem(LS_KEY); }catch(e){} } if (!hasSeen() || force) { if (!modal) buildModal(); else renderStep(); modal.focus(); } };
  window.Onboarding.markSeen = function(){ markSeen(); };

  // auto-run on first load
  function tryAutoOpen(){ if (!hasSeen() && document.readyState !== 'loading') buildModal(); if (!hasSeen() && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(buildModal, 260); }); }

  tryAutoOpen();

  // make it easy for developer to tweak copy by editing window.Onboarding.steps
  window.Onboarding.steps = steps;

})(document, window);
