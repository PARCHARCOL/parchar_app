window.Creative3D = {
  create(viewport, callbacks) {
    let engine, failed = false, active = true, pending = [];
    const loading = document.createElement("img"); loading.className = "world-loading-logo"; loading.alt = "Parchar"; loading.src = "/assets/parchar-logo-home.png"; viewport.append(loading);
    const fallback = (reason, remember = false) => { if (failed) return; failed = true; if (remember) { try { localStorage.setItem("parchar_world_light_until_v1", String(Date.now() + 3600000)); localStorage.setItem("parchar_world_light_version", "211"); } catch {} } engine?.destroy(); loading.remove(); callbacks.onFallback(reason); };
    const ready = (async () => {
      try {
        await Promise.resolve();
        try { if (localStorage.getItem("parchar_world_light_version") === "211" && Number(localStorage.getItem("parchar_world_light_until_v1")) > Date.now()) { fallback("Vista ligera activada temporalmente tras un intento anterior. Puedes reintentar el 3D."); return; } } catch {}
        if (navigator.connection?.saveData || navigator.deviceMemory && navigator.deviceMemory < 2) { fallback("Modo de ahorro del dispositivo: vista ligera."); return; }
        const [{ createWorld }, response] = await Promise.all([import("/creative-world-3d.module.js?v=4"), fetch("/assets/creative-world/manifest.json?v=1")]);
        if (!response.ok) throw new Error("world_unavailable");
        const map = await response.json();
        map.zones = [{ id: "centro", name: "El encuentro", x: 160, y: 165 }, { id: "cascadas", name: "Cascadas", x: -20, y: -15 }, { id: "bosque", name: "Bosque de luz", x: -3600, y: -2500 }, { id: "valle", name: "Valle de cristal", x: 4200, y: -3100 }, { id: "horizonte", name: "Tierras lejanas", x: 32000, y: 15000 }];
        engine = createWorld(viewport, map, { ...callbacks, onFallback: (reason) => fallback(reason, true) });
        engine.setActive(active);
        let timeout;
        try { await Promise.race([engine.ready, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("world_assets_timeout")), 45000); })]); } finally { clearTimeout(timeout); }
        if (failed) return;
        engine.setPosts(pending); await new Promise(requestAnimationFrame);
        viewport.querySelector(".world-webgl").style.visibility = "visible";
        loading.remove(); viewport.classList.add("world-ready", "world-is-3d");
        return map;
      } catch (error) {
        const graphics = /webgl|context|gpu/i.test(error?.message || "");
        viewport.dataset.worldFailure = graphics ? "graphics" : error?.message === "world_assets_timeout" ? "timeout" : "load";
        console.warn("Parchar world initialization:", error);
        fallback(graphics ? "El navegador no pudo iniciar los gráficos 3D. Puedes reintentar o continuar en vista ligera." : "No se completó la carga del mundo 3D. Comprueba tu conexión y pulsa Reintentar 3D.");
      }
    })();
    return { ready, place(value) { return engine?.place(value) || false; }, refresh() { engine?.refresh(); }, bounds() { return engine?.bounds() || CreativeSpace.queryBounds(160, 165); }, forward(n) { engine?.forward(n); }, move(x, z) { engine?.move(x, z); }, focus(x, z) { engine?.focus(x, z); }, reset() { engine?.focus(160, 165); }, focusCreature(id) { engine?.focusCreature(id); }, setPosts(posts) { pending = posts; engine?.setPosts(posts); }, setActive(value) { active = value; engine?.setActive(value); }, destroy() { failed = true; engine?.destroy(); loading.remove(); } };
  }
};
