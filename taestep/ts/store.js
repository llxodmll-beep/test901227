/* TAESTEP 저장소 — 교안을 읽고 저장한다
   · 올려 둔 교안: decks/<이름>.json + decks/index.json (GitHub 저장소 → GitHub Pages 로 배포)
   · 고치는 중인 교안: 이 기기(IndexedDB)에 자동 보관 → [저장] 을 누르면 GitHub 저장소에 올림
   · 내 그림: 편집 중에는 교안 안에 들어 있다가, 저장할 때 media/ 파일로 올리고 주소로 바꾼다 */
'use strict';
const TSStore = (() => {
  const ROOT = 'taestep/';            // 저장소 안에서 이 앱이 있는 폴더
  const fileId = t => String(t || '').replace(/[\\/:*?"<>|#%&+]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '새 교안';
  const bust = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();

  /* ---------- 이 기기 보관 (IndexedDB) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('taestep', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('drafts', { keyPath: 'id' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('drafts', mode); const q = fn(t.objectStore('drafts')); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  const draftGet = id => tx('readonly', s => s.get(id)).catch(() => null);
  const draftPut = deck => tx('readwrite', s => s.put(deck)).catch(() => null);
  const draftDel = id => tx('readwrite', s => s.delete(id)).catch(() => null);
  const draftAll = () => tx('readonly', s => s.getAll()).catch(() => []);

  /* ---------- 읽기 ---------- */
  async function index() { try { const r = await fetch(bust('decks/index.json'), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) { } return { items: [] }; }
  const meta = d => ({ id: d.id, title: d.title || d.id, subtitle: d.subtitle || '', audience: d.audience || '', minutes: d.minutes || 0, slides: (d.slides || []).length, theme: d.theme || 'midnight', modified: d.modified || '' });
  async function list() {
    const [ix, drafts] = await Promise.all([index(), draftAll()]);
    const map = new Map((ix.items || []).map(x => [x.id, Object.assign({}, x, { where: 'repo' })]));
    (drafts || []).forEach(d => { const r = map.get(d.id); if (!r) map.set(d.id, Object.assign(meta(d), { where: 'device' })); else if ((d.modified || '') > (r.modified || '')) map.set(d.id, Object.assign(meta(d), { where: 'both' })); });
    return [...map.values()].sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
  }
  async function repoDeck(id) { try { const r = await fetch(bust('decks/' + encodeURIComponent(id) + '.json'), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) { } return null; }
  /* 올려 둔 것과 이 기기 것 중 새것을 연다. 이미 올라간 이 기기 사본은 지운다 */
  async function load(id) {
    const [r, d] = await Promise.all([repoDeck(id), draftGet(id)]);
    if (r) r.id = id;
    if (d && r && (r.modified || '') >= (d.modified || '')) { draftDel(id); return r; }
    return d || r;
  }

  /* ---------- GitHub 저장 ---------- */
  function repo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i); const seg = location.pathname.split('/').filter(Boolean);
    const auto = m ? { owner: m[1], repo: seg[0] && seg[0] !== 'taestep' ? decodeURIComponent(seg[0]) : m[1] + '.github.io' } : { owner: 'llxodmll-beep', repo: 'test901227' };
    let own = null, old = null;
    try { own = JSON.parse(localStorage.getItem('taestep:gh') || 'null'); } catch (e) { }
    try { old = JSON.parse(localStorage.getItem(`gyoan:gh@${auto.owner}/${auto.repo}`) || 'null'); } catch (e) { }
    return Object.assign({ branch: 'main', token: '' }, auto, old && old.token ? { token: old.token } : {}, own || {});
  }
  const setToken = token => { try { if (token) localStorage.setItem('taestep:gh', JSON.stringify({ token })); else localStorage.removeItem('taestep:gh'); } catch (e) { } };
  const b64 = str => { const u = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = b => new TextDecoder().decode(Uint8Array.from(atob(String(b).replace(/\s/g, '')), c => c.charCodeAt(0)));
  async function gh(path, opt) {
    const c = repo(); if (!c.token) { const e = new Error('GitHub 연결이 필요합니다'); e.code = 'notoken'; throw e; }
    const url = `https://api.github.com/repos/${c.owner}/${c.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url + (opt && opt.method === 'PUT' ? '' : `?ref=${encodeURIComponent(c.branch)}&t=${Date.now()}`), Object.assign({ headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json' } }, opt || {}));
    if (r.status === 404) return null;
    if (!r.ok) { const e = new Error(r.status === 401 ? 'GitHub 토큰이 만료되었거나 틀렸습니다' : r.status === 403 ? 'GitHub 토큰에 저장 권한이 없습니다' : 'GitHub 저장 실패 (' + r.status + ')'); e.status = r.status; throw e; }
    return r.json();
  }
  async function put(path, base64, message) {
    const c = repo(); const cur = await gh(path);
    return gh(path, { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: c.branch, sha: cur ? cur.sha : undefined }) });
  }
  /* 교안 저장: 교안 안의 내 그림 → media/ 파일로 올리고, 교안과 목록을 올린다 */
  async function save(deck, onStep) {
    const say = t => { if (onStep) onStep(t); };
    deck.id = deck.id || fileId(deck.title); deck.app = 'taestep'; deck.modified = new Date().toISOString();
    let n = 0;
    const up = async holder => {
      if (!holder || !/^data:image\//.test(holder.src || '')) return;
      const m = holder.src.match(/^data:image\/(\w+);base64,(.+)$/); if (!m) return;
      const name = `media/${fileId(deck.id).replace(/\s/g, '-')}-${Date.now().toString(36)}${n++}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
      say('그림 올리는 중…'); await put(ROOT + name, m[2], `TAESTEP 그림: ${deck.title}`); holder.src = name;
    };
    for (const s of deck.slides) { await up(s.bg); await up(s.image); }
    say('교안 올리는 중…');
    await put(`${ROOT}decks/${deck.id}.json`, b64(JSON.stringify(deck, null, 1)), `TAESTEP 교안 저장: ${deck.title}`);
    say('목록 고치는 중…');
    const cur = await gh(ROOT + 'decks/index.json'); let ix = { items: [] };
    if (cur) { try { ix = JSON.parse(unb64(cur.content)); } catch (e) { } }
    ix.items = (ix.items || []).filter(x => x.id !== deck.id); ix.items.unshift(meta(deck));
    const c = repo();
    await gh(ROOT + 'decks/index.json', { method: 'PUT', body: JSON.stringify({ message: `TAESTEP 목록: ${deck.title}`, content: b64(JSON.stringify(ix, null, 1)), branch: c.branch, sha: cur ? cur.sha : undefined }) });
    await draftPut(deck); // 배포(1~2분)가 끝날 때까지는 이 기기 사본으로 연다
    return deck;
  }
  async function media() { try { const r = await fetch(bust('media/index.json'), { cache: 'no-store' }); if (r.ok) return (await r.json()).items || []; } catch (e) { } return []; }
  return { fileId, list, load, repoDeck, draftGet, draftPut, draftDel, save, repo, setToken, media, meta };
})();
