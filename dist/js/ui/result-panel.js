// Panel de resultados compartido por el perfil, la medición, la inundación y el drenaje.
// Opera sobre el marcado ya presente en index.html: no construye la estructura, solo la muestra,
// la oculta, la minimiza y rellena las estadísticas.

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

export function createResultPanel({
  panel,
  stats,
  pane,
  visibleClass,
  onClose,
  closeButton,
  collapseButton
}) {
  closeButton?.addEventListener('click', () => {
    onClose?.();
  });

  // Minimizar deja solo la cabecera: el panel ocupa buena parte del mapa y hay que poder
  // apartarlo sin perder la simulación que se está mirando.
  function setCollapsed(collapsed) {
    panel.classList.toggle('is-collapsed', collapsed);
    if (!collapseButton) return;
    collapseButton.textContent = collapsed ? '+' : '–';
    collapseButton.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const accion = collapsed ? 'Ampliar' : 'Minimizar';
    collapseButton.title = collapsed ? 'Ampliar el panel' : 'Minimizar para ver el mapa';
    collapseButton.setAttribute('aria-label', `${accion} ${panel.getAttribute('aria-label') ?? 'el panel'}`);
  }

  collapseButton?.addEventListener('click', () => {
    setCollapsed(!panel.classList.contains('is-collapsed'));
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

  return Object.freeze({
    show,
    hide,
    setStats,
    setCollapsed,
    get hidden() { return panel.hidden; },
    get collapsed() { return panel.classList.contains('is-collapsed'); }
  });
}
