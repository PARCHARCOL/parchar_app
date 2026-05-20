const titleEl = document.querySelector("#category-title");
const subtitleEl = document.querySelector("#category-subtitle");
const resultsEl = document.querySelector("#results");

const titleByCategory = {
  moto: "Planes en moto",
  carro: "Planes en carro",
  romantico: "Plan romantico",
  bbb: "Bueno, bonito y barato",
};

const subtitleByCategory = {
  moto: "Sitios cercanos para ir en moto.",
  carro: "Sitios cercanos para ir en carro.",
  romantico: "Lugares romanticos en la ciudad o alrededores.",
  bbb: "Sitios buenos, bonitos y baratos en la ciudad o cerca.",
};

const categoryChip = {
  moto: "Moto",
  carro: "Carro",
  romantico: "Romantico",
  bbb: "BBB",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCards(items) {
  if (!items.length) {
    resultsEl.innerHTML = `
      <article class="empty-card">
        <h3>Aun no hay sitios publicados en esta categoria.</h3>
        <p>
          Pidele a los duenos de los locales que entren a <strong>Clientes</strong>
          y registren su negocio con video de 10 a 13 segundos.
        </p>
      </article>
    `;
    return;
  }

  resultsEl.innerHTML = items
    .map((item) => {
      const distance =
        item.distanceKm === null ? "Distancia no disponible" : `${item.distanceKm} km`;

      return `
        <article class="place-card">
          <header>
            <p class="chip">${escapeHtml(categoryChip[item.category] || item.category)}</p>
            <h3>${escapeHtml(item.businessName)}</h3>
          </header>
          <p><strong>Ubicacion:</strong> ${escapeHtml(item.address)}, ${escapeHtml(
            item.city
          )}</p>
          <p><strong>Distancia:</strong> ${distance}</p>
          <p><strong>Oferta:</strong> ${escapeHtml(item.products)}</p>
          <p>${escapeHtml(item.description)}</p>
          <video controls preload="metadata" src="${escapeHtml(item.videoUrl)}"></video>
          <p class="tiny">
            ❤️ Video: ${Number(item.videoSeconds).toFixed(1)}s | 📞 Contacto:
            ${escapeHtml(item.ownerPhone)} (${escapeHtml(item.ownerName)})
          </p>
        </article>
      `;
    })
    .join("");
}

async function loadPlaces() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category") || "";
  const lat = params.get("lat");
  const lng = params.get("lng");
  const url = new URL("/api/businesses", window.location.origin);
  if (category) url.searchParams.set("category", category);
  if (lat && lng) {
    url.searchParams.set("lat", lat);
    url.searchParams.set("lng", lng);
    url.searchParams.set("radiusKm", "80");
  }

  titleEl.textContent = titleByCategory[category] || "Sitios disponibles";
  subtitleEl.textContent =
    subtitleByCategory[category] || "Sitios registrados por clientes.";

  resultsEl.innerHTML = "<p class='loading'>Cargando lugares...</p>";

  try {
    const response = await fetch(url.toString());
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "No se pudo cargar la informacion");
    }
    renderCards(data.items || []);
  } catch (error) {
    resultsEl.innerHTML = `
      <article class="empty-card">
        <h3>No pudimos cargar los sitios.</h3>
        <p>${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

loadPlaces();
