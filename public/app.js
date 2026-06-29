// ListLift frontend. Anonymous uid in localStorage acts as the credit wallet.
const $ = (id) => document.getElementById(id);
const uid = (() => {
  let u = localStorage.getItem('listlift_uid');
  if (!u) { u = crypto.randomUUID(); localStorage.setItem('listlift_uid', u); }
  return u;
})();

let lastListing = null;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 1800);
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-listlift-uid': uid },
    body: JSON.stringify({ ...body, uid }),
  });
  return res;
}

async function init() {
  const cfg = await (await fetch('/api/config')).json();
  $('price-amount').textContent = cfg.price.display;
  $('price-credits').textContent = cfg.price.credits;
  if (cfg.mockMode) {
    $('mode-badge').textContent = 'demo mode (no live keys yet)';
    $('paywall-note').textContent = 'Demo: checkout is simulated until live test keys are added.';
  }
  await api('/api/visit');
  refreshBalance();
}

async function refreshBalance() {
  const res = await fetch(`/api/balance?uid=${encodeURIComponent(uid)}`);
  if (!res.ok) return;
  const { balance } = await res.json();
  const line = balance.paidCredits > 0
    ? `${balance.paidCredits} paid listing${balance.paidCredits === 1 ? '' : 's'} left`
    : balance.freeRemaining > 0
      ? `${balance.freeRemaining} free listing left`
      : 'Free listing used';
  $('balance-line').textContent = line;
}

function renderListing(l) {
  lastListing = l;
  $('out-title').textContent = l.title;
  $('title-count').textContent = `${l.title.length}/140`;
  const chips = $('out-tags-chips');
  chips.innerHTML = '';
  l.tags.forEach((t) => {
    const span = document.createElement('span');
    span.className = 'tag'; span.textContent = t;
    chips.appendChild(span);
  });
  $('out-tags').textContent = l.tags.join(', ');
  $('out-desc').textContent = l.description;
  $('out-materials').textContent = (l.materials || []).join(', ') || '—';
  $('out-alt').textContent = l.alt_text || '—';
  $('result').classList.remove('hidden');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('gen-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('gen-btn');
  const data = Object.fromEntries(new FormData(e.target).entries());
  btn.disabled = true; btn.textContent = 'Generating…';
  try {
    const res = await api('/api/generate', data);
    if (res.status === 402) {
      $('paywall').classList.remove('hidden');
      $('paywall').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(err.message || 'Something went wrong. Try again.');
      return;
    }
    const { listing, mode } = await res.json();
    $('result-mode').textContent = mode === 'live' ? 'AI-generated' : 'sample';
    renderListing(listing);
    refreshBalance();
  } catch {
    toast('Network error. Try again.');
  } finally {
    btn.disabled = false; btn.textContent = '✨ Generate my Etsy listing';
  }
});

$('another-btn').addEventListener('click', () => {
  $('result').classList.add('hidden');
  $('form-card').scrollIntoView({ behavior: 'smooth' });
});

$('csv-btn').addEventListener('click', async () => {
  if (!lastListing) return;
  const res = await api('/api/export.csv', { listings: [lastListing] });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'listlift-listings.csv'; a.click();
  URL.revokeObjectURL(url);
});

$('buy-btn').addEventListener('click', async () => {
  const btn = $('buy-btn');
  btn.disabled = true; btn.textContent = 'Redirecting…';
  try {
    const res = await api('/api/checkout', {});
    const data = await res.json();
    if (data.url) { window.location.href = data.url; }
    else { toast(data.message || 'Checkout unavailable.'); }
  } catch {
    toast('Could not start checkout.');
  } finally {
    btn.disabled = false; btn.textContent = 'Unlock 10 listings → checkout';
  }
});

// copy buttons
document.addEventListener('click', (e) => {
  const b = e.target.closest('.copy');
  if (!b) return;
  const el = $(b.dataset.copy);
  const text = el ? el.textContent : '';
  navigator.clipboard.writeText(text).then(() => toast('Copied!'));
});

init();
