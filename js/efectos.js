// FORTALECER · efectos visuales: barra transparente sobre la franja, indicador del menú,
// cifras que cuentan, aparición al bajar y onda al pulsar un botón.
(() => {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raiz = document.documentElement;

  function barra() {
    const band = document.querySelector('main .band');
    raiz.classList.toggle('con-band', !!band);
    raiz.classList.toggle('bajo', !band || scrollY > Math.max(40, band.offsetHeight - 120));
  }
  addEventListener('scroll', barra, { passive: true });
  addEventListener('resize', () => { barra(); indicador(); });

  function indicador() {
    const nav = document.querySelector('.tnav'), ind = nav?.querySelector('.tind');
    if (!ind) return;
    const act = nav.querySelector(':scope > .tab[aria-current], :scope > .nv > .tab[aria-current]');
    if (!act) { ind.style.opacity = 0; return; }
    const r = act.getBoundingClientRect(), n = nav.getBoundingClientRect();
    ind.style.width = (r.width - 26) + 'px';
    ind.style.transform = `translateX(${r.left - n.left + 13}px)`;
    ind.style.opacity = 1;
  }

  function contar(el) {
    const fin = parseFloat(String(el.dataset.contar).replace(',', '.'));
    if (isNaN(fin)) return;
    const dec = +(el.dataset.dec || 0), t0 = performance.now(), dur = 900;
    const f = v => v.toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (quieto) { el.textContent = f(fin); return; }
    const paso = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(fin * e); if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(x => {
    if (!x.isIntersecting) return;
    io.unobserve(x.target);
    if (x.target.dataset.contar != null) contar(x.target);
  }), { threshold: .2 }) : null;

  function pintado() {
    barra(); indicador();
    const band = document.querySelector('main .band');
    if (band && !quieto) band.classList.add('entra');
    document.querySelectorAll('main [data-contar]').forEach(el => io ? io.observe(el) : contar(el));
  }
  document.addEventListener('f-pintado', pintado);
  new MutationObserver(() => { barra(); indicador(); }).observe(document.getElementById('top') || document.body, { childList: true });

  if (!quieto) document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn, .dd-it, .fab');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2;
    const o = document.createElement('span');
    o.className = 'onda';
    o.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(o); setTimeout(() => o.remove(), 700);
  });
})();
