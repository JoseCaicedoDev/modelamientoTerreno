// Panel de resultados compartido por el perfil, la medición, la inundación y el drenaje.
// Opera sobre el marcado ya presente en index.html; no construye la estructura.

export function createStat(label, value) {
  const item = document.createElement('div');
  item.className = 'result-stat';
  const name = document.createElement('span');
  const result = document.createElement('strong');
  name.textContent = label;
  result.textContent = value;
  item.append(name, result);
  return item;
}

export function createResultPanel({ panel, stats, pane, visibleClass, onClose, closeButton }) {
  closeButton?.addEventListener('click', () => {
    onClose?.();
  });

  function show() {
    panel.hidden = false;
    if (pane && visibleClass) pane.classList.add(visibleClass);
  }

  function hide() {
    panel.hidden = true;
    if (pane && visibleClass) pane.classList.remove(visibleClass);
  }

  function setStats(entries) {
    if (!stats) return;
    stats.replaceChildren(...entries.map(([label, value]) => createStat(label, value)));
  }

  return Object.freeze({ show, hide, setStats, get hidden() { return panel.hidden; } });
}
