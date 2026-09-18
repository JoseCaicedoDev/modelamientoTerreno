// Coordina las herramientas interactivas: solo una puede estar activa a la vez.
// Cada herramienta registra cómo se activa y cómo se desactiva; el controlador
// se encarga de apagar la anterior y de mantener el estado de su botón.

export function createToolController() {
  const tools = new Map();
  let activeName = null;

  function register(name, { button, activate, deactivate }) {
    tools.set(name, { button, activate, deactivate });
  }

  function syncButtons() {
    tools.forEach((tool, name) => {
      if (!tool.button) return;
      const active = name === activeName;
      tool.button.classList.toggle('active', active);
      tool.button.setAttribute('aria-pressed', String(active));
    });
  }

  function activate(name) {
    if (name === activeName) return;
    const previous = tools.get(activeName);
    previous?.deactivate?.();
    activeName = tools.has(name) ? name : null;
    syncButtons();
    tools.get(activeName)?.activate?.();
  }

  function toggle(name) {
    activate(activeName === name ? null : name);
  }

  function deactivateAll() {
    activate(null);
  }

  return Object.freeze({
    register,
    activate,
    toggle,
    deactivateAll,
    current: () => activeName,
    isActive: name => activeName === name
  });
}
