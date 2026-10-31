(() => {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const make = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  };
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };
  const ACCENTS = ['violet', 'green', 'amber', 'cyan'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  let profile = {};

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Theme: light/dark + accent palettes ---------- */
  function setAccent(name) {
    if (!ACCENTS.includes(name)) return false;
    root.dataset.accent = name;
    store.set('accent', name);
    document.dispatchEvent(new Event('themechange'));
    return true;
  }

  function initTheme() {
    const savedMode = store.get('mode');
    const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    root.dataset.theme = savedMode || system;
    const savedAccent = store.get('accent');
    root.dataset.accent = ACCENTS.includes(savedAccent) ? savedAccent : 'violet';

    $('mode-toggle').addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      store.set('mode', next);
      document.dispatchEvent(new Event('themechange'));
      toast(cap(next) + ' mode');
    });
    $('accent-toggle').addEventListener('click', () => {
      const next = ACCENTS[(ACCENTS.indexOf(root.dataset.accent) + 1) % ACCENTS.length];
      setAccent(next);
      toast('Accent: ' + next);
    });
  }

  /* ---------- Boot screen (once per session) ---------- */
  function boot() {
    const el = $('boot');
    if (!el) return Promise.resolve();
    let seen = null;
    try { seen = sessionStorage.getItem('booted'); } catch (e) { /* ignore */ }
    if (reduce || seen) { el.remove(); return Promise.resolve(); }

    const lines = [
      '> booting portfolio v1.0',
      '> loading profile.json ........ OK',
      '> compiling styles ............ OK',
      '> mounting projects ........... OK',
      '> welcome, visitor.'
    ];
    const out = $('boot-log');
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { sessionStorage.setItem('booted', '1'); } catch (e) { /* ignore */ }
        document.removeEventListener('keydown', finish);
        el.classList.add('done');
        setTimeout(() => { el.remove(); resolve(); }, 450);
      };
      el.addEventListener('click', finish);
      document.addEventListener('keydown', finish);
      let i = 0;
      const next = () => {
        if (done) return;
        if (i >= lines.length) { setTimeout(finish, 350); return; }
        out.textContent += lines[i++] + '\n';
        setTimeout(next, 260);
      };
      next();
    });
  }

  /* ---------- Animated network background ---------- */
  function initBackground() {
    const c = $('bg');
    const ctx = c && c.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, pts = [], rgb = '199,125,255', raf = 0;
    const mouse = { x: -9999, y: -9999 };

    const readColor = () => {
      const v = getComputedStyle(root).getPropertyValue('--accent-rgb').trim();
      if (v) rgb = v.replace(/\s/g, '');
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((w * h) / 16000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35
      }));
      draw(false);
    };
    function draw(move) {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (move) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.fillStyle = 'rgba(' + rgb + ',0.8)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 120) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.35 * (1 - d / 120)) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (md < 170) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.6 * (1 - md / 170)) + ')';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    const loop = () => { draw(true); raf = requestAnimationFrame(loop); };

    readColor();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('themechange', () => { readColor(); if (reduce) draw(false); });
    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) loop();
    });
    if (!reduce) loop();
  }

  /* ---------- Cursor glow ---------- */
  function initCursor() {
    const g = $('cursor-glow');
    if (!g || reduce || !window.matchMedia('(pointer: fine)').matches) return;
    window.addEventListener('pointermove', (e) => {
      g.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
      g.classList.add('on');
    }, { passive: true });
  }

  /* ---------- 3D tilt + spotlight on cards ---------- */
  function bindTilt(card) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (x * 100) + '%');
      card.style.setProperty('--my', (y * 100) + '%');
      if (!reduce && e.pointerType === 'mouse') {
        card.style.setProperty('--ry', ((x - 0.5) * 8) + 'deg');
        card.style.setProperty('--rx', ((0.5 - y) * 8) + 'deg');
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }

  /* ---------- Scroll progress, reveal and active nav ---------- */
  function initScroll() {
    const bar = $('progress');
    const onScroll = () => {
      const h = root.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((s) => s.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach((s) => io.observe(s));

    const links = Array.from(document.querySelectorAll('.topnav a'));
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
  }

  /* ---------- Typing roles ---------- */
  function typeRoles(roles) {
    const out = $('typed');
    if (!roles || !roles.length) return;
    if (reduce) { out.textContent = roles[0]; return; }
    let r = 0, i = 0, deleting = false;
    const tick = () => {
      const word = roles[r];
      out.textContent = word.slice(0, i);
      let delay = deleting ? 35 : 75;
      if (!deleting && i === word.length) { deleting = true; delay = 1400; }
      else if (deleting && i === 0) { deleting = false; r = (r + 1) % roles.length; delay = 400; }
      i += deleting ? -1 : 1;
      setTimeout(tick, delay);
    };
    tick();
  }

  /* ---------- Render profile.json ---------- */
  function linkButtons(container, links) {
    Object.entries(links || {}).forEach(([label, url]) => {
      const href = label.toLowerCase() === 'email' ? 'mailto:' + url : url;
      const a = make('a', '', cap(label));
      a.href = href;
      if (!href.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      container.appendChild(a);
    });
  }

  function render(p) {
    const name = p.name || '';
    document.title = (name || 'Portfolio') + ' | Portfolio';

    const nameEl = $('name');
    nameEl.textContent = '';
    nameEl.setAttribute('aria-label', name);
    const words = name.split(' ');
    let i = 0;
    words.forEach((word, wi) => {
      const w = make('span', 'word');
      w.setAttribute('aria-hidden', 'true');
      Array.from(word).forEach((ch) => {
        const s = make('span', 'letter', ch);
        s.style.setProperty('--i', i++);
        w.appendChild(s);
      });
      nameEl.appendChild(w);
      if (wi < words.length - 1) nameEl.appendChild(document.createTextNode(' '));
    });

    $('tagline').textContent = p.tagline || '';
    $('bio').textContent = p.bio || '';

    const facts = $('facts');
    (p.facts || []).forEach((f) => {
      const row = make('div');
      row.appendChild(make('dt', '', f.label));
      row.appendChild(make('dd', '', f.value));
      facts.appendChild(row);
    });
    if (!(p.facts || []).length) facts.hidden = true;

    const groups = p.skillGroups || (p.skills ? [{ group: 'Skills', items: p.skills }] : []);
    const skills = $('skills');
    groups.forEach((g) => {
      const box = make('div', 'skill-group');
      box.appendChild(make('h3', '', '// ' + g.group.toLowerCase()));
      const ul = make('ul', 'chips');
      g.items.forEach((s) => ul.appendChild(make('li', '', s)));
      box.appendChild(ul);
      skills.appendChild(box);
    });

    const projects = $('projects');
    (p.projects || []).forEach((proj, n) => {
      const card = make('article', 'card');
      card.appendChild(make('span', 'idx', String(n + 1).padStart(2, '0')));
      card.appendChild(make('h3', '', proj.title));
      if (proj.tags && proj.tags.length) {
        const tags = make('div', 'tags');
        proj.tags.forEach((t) => tags.appendChild(make('span', 'tag', t)));
        card.appendChild(tags);
      }
      card.appendChild(make('p', '', proj.desc));
      if (proj.link) {
        const a = make('a', '', 'View project →');
        a.href = proj.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
        card.appendChild(a);
      }
      bindTilt(card);
      projects.appendChild(card);
    });

    linkButtons($('links'), p.links);
    linkButtons($('contact-links'), p.links);
    $('footer').textContent = (p.footer || '') + ' · © ' + new Date().getFullYear();
  }

  /* ---------- Live GitHub data (cached 1 hour, hidden on failure) ---------- */
  function countUp(node, to) {
    if (reduce || to < 1) { node.textContent = to; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 900);
      node.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function ghFetch(user) {
    const key = 'gh-' + user;
    const raw = store.get(key);
    if (raw) {
      try {
        const c = JSON.parse(raw);
        if (Date.now() - c.t < 3600000) return c.d;
      } catch (e) { /* ignore bad cache */ }
    }
    const [u, r] = await Promise.all([
      fetch('https://api.github.com/users/' + user),
      fetch('https://api.github.com/users/' + user + '/repos?sort=updated&per_page=100')
    ]);
    if (!u.ok || !r.ok) throw new Error('GitHub API unavailable');
    const uj = await u.json();
    const rj = await r.json();
    const d = {
      user: { public_repos: uj.public_repos, followers: uj.followers },
      repos: rj.map((x) => ({
        name: x.name, description: x.description, language: x.language,
        stargazers_count: x.stargazers_count, html_url: x.html_url, fork: x.fork
      }))
    };
    store.set(key, JSON.stringify({ t: Date.now(), d }));
    return d;
  }

  async function loadGithub(links) {
    const m = ((links && links.github) || '').match(/github\.com\/([^/?#]+)/);
    if (!m) return;
    try {
      const { user, repos: all } = await ghFetch(m[1]);
      const repos = all.filter((r) => !r.fork);
      if (!repos.length) return;

      const stars = repos.reduce((s, r) => s + r.stargazers_count, 0);
      const langCount = {};
      repos.forEach((r) => { if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1; });
      const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const stats = $('gh-stats');
      [['Public repos', user.public_repos], ['Followers', user.followers], ['Stars earned', stars], ['Languages', Object.keys(langCount).length]]
        .forEach(([label, val]) => {
          const box = make('div', 'stat');
          const b = make('b', '', '0');
          box.appendChild(b);
          box.appendChild(make('span', '', label));
          stats.appendChild(box);
          countUp(b, val);
        });

      const total = langs.reduce((s, l) => s + l[1], 0);
      const wrap = $('gh-langs');
      langs.forEach(([lang, n]) => {
        const pct = Math.round((n / total) * 100);
        const row = make('div', 'lang');
        row.appendChild(make('span', '', lang));
        const bar = make('div', 'bar');
        const fill = make('i');
        bar.appendChild(fill);
        row.appendChild(bar);
        row.appendChild(make('em', '', pct + '%'));
        wrap.appendChild(row);
        setTimeout(() => { fill.style.width = pct + '%'; }, 200);
      });

      const grid = $('repos');
      repos.slice(0, 6).forEach((r) => {
        const card = make('article', 'card');
        card.appendChild(make('h3', '', r.name));
        card.appendChild(make('p', '', r.description || 'No description yet.'));
        card.appendChild(make('span', 'meta', [r.language, '★ ' + r.stargazers_count].filter(Boolean).join('  ·  ')));
        const a = make('a', '', 'View repository →');
        a.href = r.html_url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        card.appendChild(a);
        bindTilt(card);
        grid.appendChild(card);
      });

      $('github').hidden = false;
      $('nav-github').hidden = false;
    } catch (e) { /* leave the GitHub section hidden */ }
  }

  /* ---------- Interactive terminal ---------- */
  function initTerminal() {
    const log = $('term-log');
    const form = $('term-form');
    const input = $('term-input');
    const history = [];
    let hpos = 0;

    const print = (text, cls) => {
      log.appendChild(make('div', 'term-line' + (cls ? ' ' + cls : ''), text));
      log.scrollTop = log.scrollHeight;
    };
    const echo = (cmd) => {
      const d = make('div', 'term-line');
      d.appendChild(make('span', 'prompt', 'visitor@portfolio:~$ '));
      d.appendChild(document.createTextNode(cmd));
      log.appendChild(d);
    };

    const commands = {
      help() {
        ['Available commands:',
          '  about       who I am',
          '  skills      what I work with',
          '  projects    things I have built',
          '  links       where to find me',
          '  whoami      short intro',
          '  theme <violet|green|amber|cyan>',
          '  clear       clear the screen'].forEach((l) => print(l));
      },
      about() { print(profile.bio || 'No bio yet.'); },
      whoami() { print((profile.name || 'visitor') + ' — ' + (profile.tagline || '')); },
      skills() {
        (profile.skillGroups || []).forEach((g) => print(g.group + ': ' + g.items.join(', ')));
      },
      projects() {
        (profile.projects || []).forEach((p, i) => {
          print((i + 1) + '. ' + p.title + ' — ' + p.desc);
          if (p.link) print('   ' + p.link, 'dim');
        });
      },
      links() {
        Object.entries(profile.links || {}).forEach(([k, v]) => print(k + ': ' + v));
      },
      theme(arg) {
        if (!arg) { print('Usage: theme <' + ACCENTS.join('|') + '>'); return; }
        if (setAccent(arg)) print('Accent set to ' + arg + '.');
        else print('Unknown theme "' + arg + '". Try: ' + ACCENTS.join(', ') + '.');
      },
      date() { print(new Date().toString()); },
      sudo() { print('Nice try. Permission denied.'); },
      clear() { log.textContent = ''; }
    };

    function run(raw) {
      const line = raw.trim();
      if (!line) return;
      echo(line);
      history.push(line);
      hpos = history.length;
      const [cmd, ...args] = line.split(/\s+/);
      const fn = commands[cmd.toLowerCase()];
      if (fn) fn(args[0] ? args[0].toLowerCase() : '');
      else print('command not found: ' + cmd + ". Type 'help'.", 'dim');
      log.scrollTop = log.scrollHeight;
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value); input.value = ''; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && history.length) {
        e.preventDefault(); hpos = Math.max(0, hpos - 1); input.value = history[hpos];
      } else if (e.key === 'ArrowDown' && history.length) {
        e.preventDefault(); hpos = Math.min(history.length, hpos + 1); input.value = history[hpos] || '';
      }
    });
    document.querySelectorAll('.quick button').forEach((b) => {
      b.addEventListener('click', () => run(b.dataset.cmd));
    });
    print('Welcome' + (profile.name ? ', you are viewing ' + profile.name + "'s portfolio" : '') + '.', 'dim');
    print("Type 'help' to see what you can do.", 'dim');
  }

  /* ---------- Easter egg: Konami code ---------- */
  function initKonami() {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    document.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === seq[pos]) {
        pos++;
        if (pos === seq.length) { pos = 0; setAccent('green'); toast('Cheat code unlocked: matrix mode'); }
      } else {
        pos = k === seq[0] ? 1 : 0;
      }
    });
  }

  /* ---------- Start ---------- */
  async function main() {
    root.classList.add('js');
    initTheme();
    initBackground();
    initCursor();
    initKonami();
    const booted = boot();

    try {
      const res = await fetch('profile.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('profile.json returned ' + res.status);
      profile = await res.json();
    } catch (e) {
      console.error(e);
      $('bio').textContent = 'Could not load profile.json. Check it for a missing comma or quote.';
      initScroll();
      await booted;
      $('top').classList.add('ready');
      return;
    }

    render(profile);
    initScroll();
    initTerminal();
    await booted;
    $('top').classList.add('ready');
    typeRoles(profile.roles);
    if (profile.githubLive !== false) loadGithub(profile.links);
  }

  main();
})();