

const businessList = document.querySelector(
  "#admin-business-list"
);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function approveBusiness(id) {
  try {
    const response = await fetch(
      `/api/admin/businesses/${id}/approve`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo aprobar."
      );
    }

    loadBusinesses();
  } catch (error) {
    alert(error.message);
  }
}

async function rejectBusiness(id) {
  try {
    const response = await fetch(
      `/api/admin/businesses/${id}/reject`,
      {
        method: "POST",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudo rechazar."
      );
    }

    loadBusinesses();
  } catch (error) {
    alert(error.message);
  }
}

function renderBusinesses(items) {
  if (!items.length) {
    businessList.innerHTML = `
      <div class="glass-card">
        <h3>
          No hay negocios pendientes
        </h3>
      </div>
    `;

    return;
  }

  businessList.innerHTML = items
    .map(
      (item) => `
      <article class="glass-card admin-card">

        <h3>
          ${escapeHtml(
            item.businessName
          )}
        </h3>

        <p>
          <strong>Dueño:</strong>
          ${escapeHtml(
            item.ownerName
          )}
        </p>

        <p>
          <strong>Telefono:</strong>
          ${escapeHtml(
            item.ownerPhone
          )}
        </p>

        <p>
          <strong>Ciudad:</strong>
          ${escapeHtml(item.city)}
        </p>

        <p>
          <strong>Categoria:</strong>
          ${escapeHtml(
            item.category
          )}
        </p>

        <p>
          <strong>Red social:</strong>
          ${escapeHtml(
            item.socialLink || "-"
          )}
        </p>

        <p>
          <strong>Descripcion:</strong>
          ${escapeHtml(
            item.description
          )}
        </p>

        <div class="admin-actions">

          <button
            class="submit-btn"
            onclick="approveBusiness(${item.id})"
          >
            Aprobar
          </button>

          <button
            class="ghost-btn"
            onclick="rejectBusiness(${item.id})"
          >
            Rechazar
          </button>

        </div>

      </article>
    `
    )
    .join("");
}

async function loadBusinesses() {
  try {
    const response = await fetch(
      "/api/admin/businesses"
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "No se pudieron cargar negocios."
      );
    }

    renderBusinesses(
      data.items || []
    );
  } catch (error) {
    businessList.innerHTML = `
      <div class="glass-card">
        <h3>
          Error cargando negocios
        </h3>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>
      </div>
    `;
  }
}

loadBusinesses();

