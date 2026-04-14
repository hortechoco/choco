// theme.js — inicialización inmediata + toggle de tema (cookie, sin localStorage)
// Cargar ANTES de cualquier otro script para evitar flash de tema incorrecto.
(function () {
  function _leer() {
    return document.cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('horte-tema='))?.split('=')[1] ?? 'dark';
  }
  function _guardar(t) {
    document.cookie = `horte-tema=${t}; path=/; max-age=${365 * 86400}; SameSite=Strict`;
  }
  function _sincronizar(t) {
    document.querySelectorAll('.btn-toggle-tema i').forEach(el => {
      el.className = `bi ${t === 'dark' ? 'bi-sun' : 'bi-moon'}`;
    });
  }

  // Aplicar tema antes del primer render
  const tema = _leer();
  document.documentElement.setAttribute('data-bs-theme', tema);

  document.addEventListener('DOMContentLoaded', () => {
    _sincronizar(_leer());
    document.querySelectorAll('.btn-toggle-tema').forEach(btn => {
      btn.addEventListener('click', () => {
        const actual = document.documentElement.getAttribute('data-bs-theme');
        const nuevo  = actual === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-bs-theme', nuevo);
        _guardar(nuevo);
        _sincronizar(nuevo);
      });
    });
  });
})();
