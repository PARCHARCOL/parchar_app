const titleEl = document.querySelector(
  "#category-title"
);

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

function isValidCoordinate(
  latitude,
  longitude
) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getCoordsFromUrl(
  params
) {
  const latitude = Number(
    params.get("lat")
  );
  const longitude = Number(
    params.get("lng")
  );

  if (
    !isValidCoordinate(
      latitude,
      longitude
    )
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function requestUserCoords() {
  return new Promise(
    (resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude:
              position.coords
                .latitude,
            longitude:
              position.coords
                .longitude,
          });
        },
        () => resolve(null),
        {
          enableHighAccuracy: true,
          timeout: 7000,
          maximumAge: 60000,
        }
      );
    }
  );
}

function calculateDistanceKm(
  from,
  item
) {
  const toLatitude =
    Number(item.latitude);
  const toLongitude =
    Number(item.longitude);

  if (
    !from ||
    !isValidCoordinate(
      toLatitude,
      toLongitude
    )
  ) {
    return null;
  }

  const earthRadiusKm = 6371;
  const degreesToRadians =
    Math.PI / 180;
  const dLat =
    (toLatitude -
      from.latitude) *
    degreesToRadians;
  const dLng =
    (toLongitude -
      from.longitude) *
    degreesToRadians;
  const lat1 =
    from.latitude *
    degreesToRadians;
  const lat2 =
    toLatitude *
    degreesToRadians;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;
  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}

function formatDistance(
  km
) {
  if (!Number.isFinite(km)) {
    return "";
  }

  if (km < 1) {
    return `${Math.max(
      1,
      Math.round(km * 1000)
    )} m`;
  }

  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }

  return `${Math.round(km)} km`;
}

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

function renderCards(
  items,
  hasUserCoords
) {

  if (!items.length) {

    resultsEl.innerHTML = `
      <article class="empty-card">

        <h3>
          Aun no hay sitios activos en esta categoria.
        </h3>

        <p>
          Parchar mostrara solo negocios
          seleccionados y aprobados.
        </p>

      </article>
    `;

    return;
  }

  resultsEl.innerHTML = items
    .map(
      (item) => {

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

            <p class="distance-line">
              <strong>Distancia:</strong>

              ${
                item.distanceKm !== null &&
                item.distanceKm !==
                  undefined
                  ? `A ${escapeHtml(
                      formatDistance(
                        item.distanceKm
                      )
                    )} de ti`
                  : hasUserCoords
                    ? "No disponible para este local"
                    : "Permite ubicacion para calcularla"
              }
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

            ${
              item.video_path
                ? `
              <video
                controls
                preload="metadata"
                class="place-video"
                src="${escapeHtml(
                  item.video_path
                )}"
              ></video>
            `
                : `
              <div class="video-missing">
                Video no disponible
              </div>
            `
            }

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
      }
    )
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
    "Negocios seleccionados por Parchar.";

  resultsEl.innerHTML =
    `
    <p class='loading'>
      Cargando lugares...
    </p>
  `;

  try {

    let userCoords =
      getCoordsFromUrl(
        params
      );

    if (!userCoords) {
      subtitleEl.textContent =
        "Calculando distancia desde tu ubicacion...";
      userCoords =
        await requestUserCoords();
    }

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
      )
        .filter(
          (item) =>

            String(
              item.category
            )
              .toLowerCase() ===

            String(
              category
            )
              .toLowerCase()
        )
        .filter(
          (item) =>

            item.status ===
            "activo"
        )
        .map(
          (item) => ({
            ...item,
            distanceKm:
              calculateDistanceKm(
                userCoords,
                item
              ),
          })
        )
        .sort(
          (a, b) => {
            if (
              a.distanceKm === null &&
              b.distanceKm === null
            ) {
              return 0;
            }

            if (
              a.distanceKm === null
            ) {
              return 1;
            }

            if (
              b.distanceKm === null
            ) {
              return -1;
            }

            return (
              a.distanceKm -
              b.distanceKm
            );
          }
        );

    if (userCoords) {
      subtitleEl.textContent =
        "Sitios ordenados por cercania a tu ubicacion.";
    } else {
      subtitleEl.textContent =
        "No se pudo leer tu ubicacion. Puedes permitirla para ver distancias.";
    }

    renderCards(
      filtered,
      Boolean(userCoords)
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
