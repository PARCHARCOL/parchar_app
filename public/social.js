const socialFeed = document.querySelector("#social-feed");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function renderSocial(items) {
  if (!socialFeed) {
    return;
  }

  if (!items.length) {
    socialFeed.innerHTML = `
      <article class="empty-card">
        <h3>No hay resenas activas</h3>
        <p>Cuando alguien parcha un local y graba una resena, aparecera aqui durante 15 dias.</p>
      </article>
    `;
    return;
  }

  socialFeed.innerHTML = items
    .map(
      (item) => `
        <article class="social-card">
          <header>
            <div>
              <span class="chip">${escapeHtml(item.category)}</span>
              <h3>${escapeHtml(item.business_name)}</h3>
              <p>${escapeHtml(item.city)} · ${escapeHtml(item.address)}</p>
            </div>
            <div class="social-parches">
              <strong>${escapeHtml(item.parchar_count || 0)}</strong>
              <span>Parchar</span>
            </div>
          </header>

          <video controls preload="metadata" src="${escapeHtml(item.video_path)}"></video>

          <p class="tiny">
            Publicada: ${escapeHtml(formatDate(item.created_at))} · Activa hasta: ${escapeHtml(formatDate(item.expires_at))}
          </p>
        </article>
      `
    )
    .join("");
}

async function loadSocial() {
  try {
    const response = await fetch("/api/social/reviews");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo cargar el muro.");
    }

    renderSocial(data.items || []);
  } catch (error) {
    socialFeed.innerHTML = `
      <article class="empty-card">
        <h3>No pudimos cargar el muro</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

loadSocial();
