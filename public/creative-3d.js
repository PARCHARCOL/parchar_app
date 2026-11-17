window.Creative3D = {
  create(viewport, callbacks) {
    let engine, failed = false, pending = [];
    const loading = document.createElement("img"); loading.className = "world-loading-logo"; loading.alt = "Parchar"; loading.src = "/assets/parchar-logo-home.png"; viewport.append(loading);
    const fallback = (reason, remember = false) => { if (failed) return; failed = true; if (remember) { try { localStorage.setItem("parchar_world_light_until_v1", String(Date.now() + 7 * 86400000)); } catch {} } engine?.destroy(); loading.remove(); callbacks.onFallback(reason); };
    const ready = (async () => {
      try {
        await Promise.resolve();
        try { if (Number(localStorage.getItem("parchar_world_light_until_v1")) > Date.now()) { fallback("Vista ligera activada para mantener la fluidez en este dispositivo."); return; } } catch {}
        if (navigator.connection?.saveData || navigator.deviceMemory && navigator.deviceMemory < 2) { fallback("Modo de ahorro del dispositivo: vista ligera."); return; }
        const [{ createWorld }, response] = await Promise.all([import("/creative-world-3d.module.js?v=1"), fetch("/assets/creative-world/manifest.json?v=1")]);
        if (!response.ok) throw new Error("world_unavailable");
        const map = await response.json();
        map.zones = [{ id: "centro", name: "El encuentro", x: 160, y: 165 }, { id: "bosque", name: "Bosque de luz", x: -3600, y: -2500 }, { id: "valle", name: "Valle de cristal", x: 4200, y: -3100 }, { id: "horizonte", name: "Tierras lejanas", x: 32000, y: 15000 }];
        engine = createWorld(viewport, map, { ...callbacks, onFallback: (reason) => fallback(reason, true) });
        engine.setPosts(pending); loading.remove(); viewport.classList.add("world-ready", "world-is-3d");
        return map;
      } catch { fallback("Este dispositivo no pudo abrir el mundo 3D. Puedes usar la vista ligera."); }
    })();
    return { ready, refresh() { engine?.refresh(); }, bounds() { return engine?.bounds() || CreativeSpace.queryBounds(160, 165); }, forward(n) { engine?.forward(n); }, move(x, z) { engine?.move(x, z); }, focus(x, z) { engine?.focus(x, z); }, reset() { engine?.focus(160, 165); }, focusCreature(id) { engine?.focusCreature(id); }, setPosts(posts) { pending = posts; engine?.setPosts(posts); }, setActive(active) { engine?.setActive(active); }, destroy() { failed = true; engine?.destroy(); loading.remove(); } };
  }
};
