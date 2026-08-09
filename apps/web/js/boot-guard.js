(() => {
  const VERSION = '92.1.0';
  const show = (title, detail) => {
    let box = document.getElementById('lmos-boot-error');
    if (!box) {
      box = document.createElement('div');
      box.id = 'lmos-boot-error';
      box.style.cssText = 'position:fixed;z-index:99999;left:16px;right:16px;bottom:16px;padding:14px 16px;background:#fff4f2;border:1px solid #d85c4a;border-radius:12px;color:#671f18;font:14px system-ui;box-shadow:0 8px 30px #0003';
      document.body.appendChild(box);
    }
    box.innerHTML = `<strong>${title}</strong><br><span>${String(detail || 'Error desconocido').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</span><br><small>LA MAGDALENA OS ${VERSION}</small>`;
  };
  window.addEventListener('error', (event) => show('La aplicación encontró un error al iniciar.', event.message));
  window.addEventListener('unhandledrejection', (event) => show('Una operación no pudo completarse.', event.reason?.message || event.reason));
  window.LMOS_HEALTH = { version: VERSION, startedAt: new Date().toISOString() };
})();
