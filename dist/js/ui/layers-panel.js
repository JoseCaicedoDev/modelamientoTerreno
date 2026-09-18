// Lista de capas cargadas por la persona usuaria: mostrar u ocultar, encuadrar y quitar.

export function createLayersPanel({ list, empty, onToggle, onZoom, onRemove }) {
  const items = new Map();

  function refreshEmpty() {
    empty.hidden = items.size > 0;
  }

  function iconButton(label, path, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layer-action';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    button.addEventListener('click', action);
    return button;
  }

  function add({ id, nombre, elementos }) {
    const item = document.createElement('li');
    item.className = 'layer-item';

    const toggle = document.createElement('label');
    toggle.className = 'layer-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.addEventListener('change', () => onToggle?.(id, checkbox.checked));
    const title = document.createElement('span');
    title.className = 'layer-name';
    title.textContent = nombre;
    title.title = nombre;
    const count = document.createElement('span');
    count.className = 'layer-count';
    count.textContent = `${elementos} elem.`;
    toggle.append(checkbox, title);

    item.append(
      toggle,
      count,
      iconButton('Encuadrar la capa', '<path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4"/><circle cx="12" cy="12" r="3.2"/>', () => onZoom?.(id)),
      iconButton('Quitar la capa', '<path d="M5 7h14"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12h10l1-12"/><path d="M9 7V4h6v3"/>', () => {
        item.remove();
        items.delete(id);
        refreshEmpty();
        onRemove?.(id);
      })
    );

    list.append(item);
    items.set(id, item);
    refreshEmpty();
  }

  refreshEmpty();

  return Object.freeze({ add, get size() { return items.size; } });
}
