(() => {
  const colors = ["#18112c", "#ffffff", "#36e5d0", "#ffcc58", "#f252ae", "#57aaff"];
  const avatars = ["turquesa", "rosa", "dorado", "azul", "violeta"];
  function draw(canvas, item, text = true, transparent = false) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      ctx.fillStyle = colors.includes(item.background) ? item.background : colors[0];
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    for (const stroke of item.strokes || []) {
      if (!stroke.points?.length) continue;
      ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width * canvas.width / 800; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); stroke.points.forEach(([x, y], i) => { if (i) ctx.lineTo(x * canvas.width, y * canvas.height); else ctx.moveTo(x * canvas.width, y * canvas.height); });
      if (stroke.points.length === 1) { const [x, y] = stroke.points[0]; ctx.arc(x * canvas.width, y * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.stroke();
    }
    if (text && item.text) {
      ctx.font = `bold ${canvas.width / 17}px system-ui`; ctx.textBaseline = "top";
      const lines = []; let line = "";
      for (const char of item.text) {
        if (char === "\n" || ctx.measureText(line + char).width > canvas.width - 40) { lines.push(line); line = char === "\n" ? "" : char; } else line += char;
      }
      if (line) lines.push(line);
      const size = canvas.width / 17 * 1.3;
      ctx.fillStyle = "#120b28e8"; ctx.fillRect(8, 8, canvas.width - 16, Math.min(canvas.height - 16, lines.length * size + 24));
      ctx.fillStyle = "#fff"; lines.slice(0, Math.floor((canvas.height - 40) / size)).forEach((value, i) => ctx.fillText(value, 20, 20 + i * size));
    }
  }
  function card(item, internal = false) {
    const article = document.createElement("article"); article.className = "wall-post"; article.dataset.id = item.id;
    const art = document.createElement("canvas"); art.width = 320; art.height = 240; art.setAttribute("role", "img"); art.setAttribute("aria-label", item.text || `Dibujo de ${item.alias}`); draw(art, item);
    const author = document.createElement("div"); author.className = "wall-author";
    const avatar = document.createElement("span"); avatar.className = `wall-avatar-icon avatar-${avatars.includes(item.avatar) ? item.avatar : avatars[0]}`; avatar.textContent = [...item.alias][0]?.toUpperCase() || "P"; avatar.setAttribute("aria-hidden", "true");
    const name = document.createElement("strong"); name.textContent = item.alias;
    if (/^[a-z-]{2,24}$/.test(item.creatureAvatar || "")) { const image=document.createElement("img"); image.src=`/assets/creative-world/beings/${item.creatureAvatar}.webp`; image.alt=""; image.className="world-avatar-preview"; avatar.replaceChildren(image); }
    author.append(avatar, name);
    const open = document.createElement("button"); open.type = "button"; open.className = "panzoom-exclude"; open.textContent = "Ver creación"; open.dataset.open = item.id;
    article.append(art, author);
    if (internal) { const status = document.createElement("p"); status.textContent = `${item.status} · ${item.reports || 0} reportes`; article.append(status); }
    article.append(open); return article;
  }
  function discovery(item, found = false) {
    const seed = [...String(item.id)].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0);
    const kind = seed % 3;
    const button = document.createElement("button");
    button.type = "button"; button.className = `world-discovery discovery-${kind} panzoom-exclude`;
    button.dataset.open = item.id; button.dataset.found = String(found);
    button.setAttribute("aria-label", `${found ? "Volver a abrir" : "Descubrir"} la creación de ${item.alias}`);
    button.title = `Creación de ${item.alias}`;
    const object = document.createElement("img"); object.src = `/assets/creative-world/discoveries/${kind}.webp`; object.alt = ""; object.draggable = false;
    button.append(object);
    if (item.strokes?.length) {
      const art = document.createElement("canvas"); art.width = 320; art.height = 240; art.setAttribute("aria-hidden", "true");
      draw(art, item, false, true); button.append(art);
    }
    const whisper = document.createElement("span"); whisper.className = "discovery-whisper"; whisper.textContent = item.text ? [...item.text].slice(0, 38).join("") + ([...item.text].length > 38 ? "…" : "") : item.alias;
    const light = document.createElement("span"); light.className = "discovery-light"; light.setAttribute("aria-hidden", "true");
    button.append(whisper, light); return button;
  }
  window.CreativeRender = { draw, card, discovery, colors, avatars };
})();
