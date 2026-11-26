/* TAESTEP 저장소 — 교안을 읽고 저장한다
   · 올려 둔 교안(저장본): decks/<이름>.json + decks/index.json (GitHub 저장소 → GitHub Pages 로 배포)
   · 작업본: 고치는 중인 교안. 이 기기(IndexedDB)에 자동 보관 → [저장] 을 누르면 GitHub 저장소에 올림
       _base   = 이 작업본이 시작한 저장본의 저장 시각 (저장 직전에 저장소 것과 다르면 그 사이 다른 곳에서 저장한 것)
       _synced = 저장소에 올렸고 배포(1~2분)를 기다리는 사본 — 저장본으로 친다
   · 보관함: 사용자가 고르지 않은 쪽(작업본 · 되돌리기 전 모습)을 30일 동안 둔다. 고르지 않은 내용을 지우지 않는다.
   · 저장 이력: 저장할 때마다 GitHub 에 커밋이 남으므로, 그 기록이 곧 판 목록이다.
   · 내 그림: 편집 중에는 교안 안에 들어 있다가, 저장할 때 media/ 파일로 올리고 주소로 바꾼다 */
'use strict';
const TSStore = (() => {
  const ROOT = 'taestep/';
  const fileId = t => String(t || '').replace(/[\\/:*?"<>|#%&+]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '새 교안';
  const bust = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
  const KEEP_DAYS = 30;

  /* ---------- 이 기기 보관 (IndexedDB) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('taestep', 2);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('drafts')) d.createObjectStore('drafts', { keyPath: 'id' }); if (!d.objectStoreNames.contains('kept')) d.createObjectStore('kept', { keyPath: 'key' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const draftGet = id => tx('drafts', 'readonly', s => s.get(id)).catch(() => null);
  const draftPut = deck => tx('drafts', 'readwrite', s => s.put(deck)).then(() => true).catch(() => false); // false = 보관 공간 부족 등
  const draftDel = id => tx('drafts', 'readwrite', s => s.delete(id)).catch(() => null);
  const draftAll = () => tx('drafts', 'readonly', s => s.getAll()).catch(() => []);
  /* 보관함 (30일) */
  const keepPut = (deck, why) => { const at = new Date().toISOString(); const d = JSON.parse(JSON.stringify(deck)); delete d._synced; return tx('kept', 'readwrite', s => s.put({ key: `${deck.id}@${at}`, id: deck.id, title: deck.title || deck.id, at, why: why || '', slides: (deck.slides || []).length, deck: d })).then(() => true).catch(() => false); };
  async function keepList(id) { const all = await tx('kept', 'readonly', s => s.getAll()).catch(() => []); const limit = Date.now() - KEEP_DAYS * 864e5; const old = all.filter(k => new Date(k.at).getTime() < limit); for (const k of old) await tx('kept', 'readwrite', s => s.delete(k.key)).catch(() => null); return all.filter(k => !old.includes(k) && (!id || k.id === id)).sort((a, b) => b.at.localeCompare(a.at)); }
  const keepDel = key => tx('kept', 'readwrite', s => s.delete(key)).catch(() => null);

  /* ---------- 읽기 ---------- */
  async function index() { try { const r = await fetch(bust('decks/index.json'), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch (e) { } return { items: [] }; }
  const meta = d => ({ id: d.id, title: d.title || d.id, subtitle: d.subtitle || '', audience: d.audience || '', minutes: d.minutes || 0, slides: (d.slides || []).length, theme: d.theme || 'midnight', modified: d.modified || '' });
  const pending = (d, r) => !!d && !d._synced && (!r || (d.modified || '') > (r.modified || '')); // 저장 안 한 변경이 있는 작업본
  async function list() {
    const [ix, drafts] = await Promise.all([index(), draftAll()]);
    const map = new Map((ix.items || []).map(x => [x.id, Object.assign({}, x, { where: 'repo' })]));
    (drafts || []).forEach(d => { const r = map.get(d.id); if (!r) map.set(d.id, Object.assign(meta(d), { where: d._synced ? 'repo' : 'device' })); else if ((d.modified || '') > (r.modified || '')) map.set(d.id, Object.assign(meta(d), { where: d._synced ? 'repo' : 'both' })); });
    return [...map.values()].sort((a, b) => (b.modified || '').localeCompare(a.modified || ''));
  }
  async function repoDeck(id) { try { const r = await fetch(bust('decks/' + encodeURIComponent(id) + '.json'), { cache: 'no-store' }); if (r.ok) { const d = await r.json(); d.id = id; return d; } } catch (e) { } return null; }
  /* 저장본과 작업본을 둘 다 준다 (편집 화면이 어느 쪽으로 열지 정함). 이미 배포된 사본은 치운다 */
  async function open(id) {
    let [repo, draft] = await Promise.all([repoDeck(id), draftGet(id)]);
    if (draft && repo && (repo.modified || '') >= (draft.modified || '') && (draft._synced || same(draft, repo))) { await draftDel(id); draft = null; }
    return { repo, draft };
  }
  /* 발표 · 목록용: 둘 중 새것 */
  async function load(id) { const { repo, draft } = await open(id); if (draft && (!repo || (draft.modified || '') > (repo.modified || ''))) return draft; return repo || draft; }
  const strip = d => { const o = Object.assign({}, d); delete o.modified; delete o._base; delete o._synced; return JSON.stringify(o); };
  const same = (a, b) => strip(a) === strip(b);
  /* 달라진 장 수 */
  function diff(a, b) { const A = (a && a.slides) || [], B = (b && b.slides) || []; let n = Math.abs(A.length - B.length); for (let i = 0; i < Math.min(A.length, B.length); i++) if (JSON.stringify(A[i]) !== JSON.stringify(B[i])) n++; return n; }

  /* ---------- GitHub ---------- */
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
  const err = (msg, o) => Object.assign(new Error(msg), o);
  async function api(url, opt, needToken) {
    const c = repo(); if (needToken && !c.token) throw err('GitHub 연결이 필요합니다', { code: 'notoken' });
    if (navigator.onLine === false) throw err('인터넷에 연결되어 있지 않습니다', { code: 'offline' });
    let r; try { r = await fetch(url, Object.assign({ headers: Object.assign({ Accept: 'application/vnd.github+json' }, c.token ? { Authorization: 'Bearer ' + c.token } : {}) }, opt || {})); } catch (e) { throw err('인터넷 연결이 끊겼거나 GitHub 에 닿지 않습니다', { code: 'offline' }); }
    if (r.status === 404) return null;
    if (!r.ok) throw err(r.status === 401 ? 'GitHub 토큰이 만료되었거나 틀렸습니다' : r.status === 403 ? 'GitHub 토큰에 저장 권한이 없거나 요청이 너무 많습니다' : r.status === 409 || r.status === 422 ? '저장소의 파일이 방금 바뀌었습니다 — 다시 저장해 주세요' : 'GitHub 요청 실패 (' + r.status + ')', { status: r.status });
    return r.json();
  }
  const base = () => { const c = repo(); return `https://api.github.com/repos/${c.owner}/${c.repo}`; };
  const cUrl = path => `${base()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const getFile = (path, ref) => api(`${cUrl(path)}?ref=${encodeURIComponent(ref || repo().branch)}&t=${Date.now()}`);
  const putFile = (path, content, message, sha) => api(cUrl(path), { method: 'PUT', body: JSON.stringify({ message, content, branch: repo().branch, sha: sha || undefined }) }, true);
  async function put(path, base64, message) { const cur = await getFile(path); return putFile(path, base64, message, cur && cur.sha); }
  /* 큰 파일(1MB 초과)은 contents 가 내용을 주지 않으므로 blob 으로 다시 읽는다 */
  async function fileText(f) { if (!f) return null; if (f.content) return unb64(f.content); const b = await api(`${base()}/git/blobs/${f.sha}`); return b ? unb64(b.content) : null; }
  /* 저장소에 지금 올라가 있는 교안 (배포를 기다리지 않고 바로 읽음) */
  async function remote(id) { const f = await getFile(`${ROOT}decks/${id}.json`); if (!f) return null; try { const d = JSON.parse(await fileText(f)); d.id = id; return { deck: d, sha: f.sha }; } catch (e) { return { deck: null, sha: f.sha }; } }

  /* 교안 저장: 다른 곳에서 먼저 저장했는지 확인 → 내 그림을 media/ 로 올림 → 교안 · 목록을 올림
     opt.force = 다른 곳의 저장본을 덮어씀 */
  async function save(deck, onStep, opt) {
    const say = t => { if (onStep) onStep(t); };
    deck.id = deck.id || fileId(deck.title); deck.app = 'taestep';
    if (!repo().token) throw err('GitHub 연결이 필요합니다', { code: 'notoken' });
    say('저장소 확인 중…');
    const path = `${ROOT}decks/${deck.id}.json`; const cur = await remote(deck.id);
    if (cur && cur.deck && !(opt && opt.force) && (cur.deck.modified || '') !== (deck._base || '') && !same(cur.deck, deck)) throw err('이 교안이 다른 곳에서 먼저 저장되었습니다', { code: 'conflict', remote: cur.deck });
    let n = 0;
    const up = async holder => {
      if (!holder || !/^data:image\//.test(holder.src || '')) return;
      const m = holder.src.match(/^data:image\/([\w+]+);base64,(.+)$/); if (!m) return;
      const name = `media/${fileId(deck.id).replace(/\s/g, '-')}-${Date.now().toString(36)}${n++}.${m[1] === 'jpeg' ? 'jpg' : m[1].replace('+xml', '')}`;
      say(`그림 올리는 중… (${n})`); await put(ROOT + name, m[2], `TAESTEP 그림: ${deck.title}`); holder.src = name;
    };
    if (deck.bg) await up(deck.bg);
    for (const s of deck.slides) { await up(s.bg); await up(s.image); for (const e of (s.els || [])) if (e.type === 'image') await up(e); }
    say('교안 올리는 중…');
    const out = JSON.parse(JSON.stringify(deck)); out.modified = new Date().toISOString(); delete out._base; delete out._synced;
    await putFile(path, b64(JSON.stringify(out, null, 1)), `TAESTEP 교안 저장: ${deck.title}`, cur && cur.sha);
    deck.modified = out.modified; deck._base = out.modified;
    say('목록 고치는 중…');
    try { const ixf = await getFile(ROOT + 'decks/index.json'); let ix = { items: [] }; if (ixf) { try { ix = JSON.parse(await fileText(ixf)); } catch (e) { } }
      ix.items = (ix.items || []).filter(x => x.id !== deck.id); ix.items.unshift(meta(deck));
      await putFile(ROOT + 'decks/index.json', b64(JSON.stringify(ix, null, 1)), `TAESTEP 목록: ${deck.title}`, ixf && ixf.sha); } catch (e) { console.warn('목록 갱신 실패', e); }
    return deck;
  }
  /* 저장 이력(판 목록) · 그때의 교안 */
  async function history(id) { const c = repo(); const a = await api(`${base()}/commits?sha=${encodeURIComponent(c.branch)}&path=${encodeURIComponent(`${ROOT}decks/${id}.json`)}&per_page=30&t=${Date.now()}`); return (a || []).map(x => ({ sha: x.sha, at: x.commit.committer.date, msg: x.commit.message.split('\n')[0] })); }
  async function version(id, sha) { const f = await getFile(`${ROOT}decks/${id}.json`, sha); const d = JSON.parse(await fileText(f)); d.id = id; return d; }
  async function media() { try { const r = await fetch(bust('media/index.json'), { cache: 'no-store' }); if (r.ok) return (await r.json()).items || []; } catch (e) { } return []; }
  return { fileId, list, load, open, repoDeck, draftGet, draftPut, draftDel, keepPut, keepList, keepDel, save, remote, history, version, repo, setToken, media, meta, same, diff, pending };
})();
