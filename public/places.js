const titleEl = document.querySelector("#category-title");

const subtitleEl = document.querySelector(
  "#category-subtitle"
);

const resultsEl = document.querySelector(
  "#results"
);

const titleByCategory = {
  moto: "Planes en moto",

  carro: "Planes en carro",

  romantico:
    "Plan romantico",

  bbb:
    "Bueno, bonito y barato",
};

const subtitleByCategory = {
  moto:
    "Sitios cercanos para ir en moto.",

  carro:
    "Sitios cercanos para ir en carro.",

  romantico:
    "Lugares romanticos en la ciudad o alrededores.",

  bbb:
    "Sitios buenos, bonitos y baratos en la ciudad o cerca.",
};

const categoryChip = {
  moto: "Moto",

  carro: "Carro",

  romantico:
    "Romantico",

  bbb: "BBB",
};

function escapeHtml(value) {

  return String(
    value || ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function renderCards(items) {

  if (!items.length) {

    resultsEl.innerHTML = `
      <article class="empty-card">

        <h3>
          Aun no hay sitios publicados en esta categoria.
        </h3>

        <p>
          Pidele a los duenos de los locales que entren a
          <strong>Clientes</strong>
          y registren su negocio con video.
        </p>

      </article>
    `;

    return;
  }

  resultsEl.innerHTML = items
    .map((item) => {

      return `
        <article class="place-card">

          <header>

            <p class="chip">
              ${escapeHtml(
                categoryChip[
                  item.category
                ] ||
                  item.category
              )}
            </p>

            <h3>
              ${escapeHtml(
                item.business_name
              )}
            </h3>

          </header>

          <p>
            <strong>Ubicacion:</strong>
            ${escapeHtml(
              item.address
            )},
            ${escapeHtml(
              item.city
            )}
          </p>

          <p>
            <strong>Oferta:</strong>
            ${escapeHtml(
              item.products
            )}
          </p>

          <p>
            ${escapeHtml(
              item.description
            )}
          </p>

          <video
            controls
            preload="metadata"
            src="${escapeHtml(
              item.video_path
            )}"
            style="
              width:100%;
              border-radius:14px;
              margin-top:10px;
            "
          ></video>

          <p class="tiny">

            ❤️ Contacto:
            ${escapeHtml(
              item.owner_phone
            )}

            (${escapeHtml(
              item.owner_name
            )})

          </p>

        </article>
      `;
    })
    .join("");
}

async function loadPlaces() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const category =
    params.get(
      "category"
    ) || "";

  titleEl.textContent =
    titleByCategory[
      category
    ] ||
    "Sitios disponibles";

  subtitleEl.textContent =
    subtitleByCategory[
      category
    ] ||
    "Sitios registrados.";

  resultsEl.innerHTML =
    `
    <p class='loading'>
      Cargando lugares...
    </p>
  `;

  try {

    const response =
      await fetch(
        "/api/businesses/approved"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
          "No se pudo cargar la informacion"
      );
    }

    const filtered =
      (
        data.items || []
      ).filter(
        (item) =>
          
       String(item.category)
       .toLowerCase() ===
       String(category)
       .toLowerCase()


      );

    renderCards(
      filtered
    );

  } catch (error) {

    resultsEl.innerHTML = `
      <article class="empty-card">

        <h3>
          No pudimos cargar los sitios.
        </h3>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>

      </article>
    `;
  }
}

loadPlaces();