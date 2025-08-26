// Updated attemptHatchEgg — only the function (drop into your script or replace the existing function)
function attemptHatchEgg(){
  try {
    var egg = window.incubatorSelectedEgg;
    if (!egg || String(egg.code || '').indexOf('ovo_') !== 0) return;

    var LS = 'mini_todo_inventory_v1';
    var inv = [];
    try { inv = JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch(e){ inv = []; }

    // try remove the corresponding egg: by UID first, then by code (remove only 1)
    var removed = false;
    for (var i = 0; i < inv.length; i++) {
      var it = inv[i];
      if (!it) continue;
      if ((egg.uid && it.uid === egg.uid) || (it.code === egg.code && !removed)) {
        inv.splice(i, 1);
        removed = true;
        break;
      }
    }
    if (!removed) {
      // nothing to hatch (probably already used) - abort silently
      return;
    }

    // build new item (strip 'ovo_' from code)
    var base = egg.code.replace(/^ovo_/, '');
    // try to use egg emoji without the egg glyph (if present)
    var rawEmoji = String(egg.emoji || '').replace(/🥚/g, '').trim();
    var petEmoji = rawEmoji || '🐾';
    // Normalize base to Title Case with single spaces and no diacritics
    function normalizeToTitle(s) {
      if (!s) return '';
      // replace underscores and extra spaces, remove non-word characters except space, remove diacritics
      var t = String(s).replace(/[_]+/g,' ').replace(/\s+/g,' ').trim();
      try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(e) {}
      // lowercase then Title Case each word
      return t.split(' ').map(function(w){ return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }).join(' ');
    }
    var petName = normalizeToTitle(base);
    if (!petName) petName = base;

    var petItem = {
      uid: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8),
      code: base,
      name: petName,
      emoji: petEmoji,
      desc: 'Nascido de um ovo',
      awardedAt: new Date().toISOString(),
      level: 0
    };

    // add pet to inventory
    inv.push(petItem);
    localStorage.setItem(LS, JSON.stringify(inv));

    // notify changes (to update inventory UI / slot)
    try {
      document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: egg.code, delta: -1 } }));
      document.dispatchEvent(new CustomEvent('mini_todo_inventory_changed', { detail: { code: petItem.code, delta: +1 } }));
    } catch(e){}

    // update preview on page (if exists) — now ONLY tries the standardized pattern and falls back to SVG
    try {
      var img = document.getElementById('incubator-page-preview') || document.getElementById('incubator-preview') || document.querySelector('.incubator-preview img');
      if (img) {
        // single candidate in format: /assets/Title Case With Spaces.png
        var candidate = '/assets/' + petName + '.png';

        // inline SVG fallback (emoji)
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400">' +
                  '<rect width="100%" height="100%" fill="#fff" rx="16" />' +
                  '<text x="50%" y="50%" font-size="160" text-anchor="middle" dominant-baseline="middle">' + petEmoji + '</text>' +
                  '<text x="50%" y="88%" font-size="28" text-anchor="middle" fill="#333">' + petName + '</text>' +
                  '</svg>';
        var svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

        img.onerror = function(){ img.onerror = null; img.src = svgDataUrl; };
        img.src = candidate;

        // also store the selected image path in the pet item (if possible) so inventory can reference it later
        try {
          petItem.image = candidate;
          // persist update to inventory with image path
          localStorage.setItem(LS, JSON.stringify(inv));
        } catch(e){}
      }
    } catch(e){
      // silent fallback to SVG if something fails
      try {
        var img = document.getElementById('incubator-page-preview') || document.getElementById('incubator-preview') || document.querySelector('.incubator-preview img');
        if (img) {
          var svg2 = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="100%" height="100%" fill="#fff" rx="16" /><text x="50%" y="50%" font-size="160" text-anchor="middle" dominant-baseline="middle">' + petEmoji + '</text><text x="50%" y="88%" font-size="28" text-anchor="middle" fill="#333">' + petName + '</text></svg>';
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg2);
        }
      } catch(ee){}
    }

    // small visual toast
    try {
      var t = document.createElement('div');
      t.className = 'rwd-toast';
      t.textContent = 'Ovo chocou! Nasceu um ' + petName + ' ' + petEmoji;
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
        fontWeight: '700'
      });
      document.body.appendChild(t);
      setTimeout(function(){ t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, 1600);
      setTimeout(function(){ try { document.body.removeChild(t); } catch(e){} }, 2200);
    } catch(e){}
  } catch (e) {
    console.error('attemptHatchEgg error', e);
  }
}
