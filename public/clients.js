const userForm =
  document.querySelector(
    "#user-form"
  );

const businessForm =
  document.querySelector(
    "#business-form"
  );

const userMessage =
  document.querySelector(
    "#user-message"
  );

const businessMessage =
  document.querySelector(
    "#business-message"
  );

const videoInput =
  document.querySelector(
    "#video-input"
  );

const videoStatus =
  document.querySelector(
    "#video-status"
  );

const videoDurationInput =
  document.querySelector(
    "#video-duration-seconds"
  );

const useLocationButton =
  document.querySelector(
    "#use-location"
  );

function setMessage(
  element,
  text,
  isError = false
) {
  element.textContent = text;

  element.classList.toggle(
    "error",
    isError
  );

  element.classList.toggle(
    "success",
    !isError
  );
}

async function extractVideoDuration(
  file
) {
  return new Promise(
    (resolve, reject) => {
      const tempVideo =
        document.createElement(
          "video"
        );

      tempVideo.preload =
        "metadata";

      tempVideo.muted = true;

      tempVideo.src =
        URL.createObjectURL(file);

      tempVideo.onloadedmetadata =
        () => {
          const seconds =
            tempVideo.duration;

          URL.revokeObjectURL(
            tempVideo.src
          );

          if (
            !Number.isFinite(
              seconds
            )
          ) {
            reject(
              new Error(
                "No pudimos leer la duracion del video."
              )
            );

            return;
          }

          resolve(seconds);
        };

      tempVideo.onerror =
        () => {
          URL.revokeObjectURL(
            tempVideo.src
          );

          reject(
            new Error(
              "El archivo no parece un video valido."
            )
          );
        };
    }
  );
}

videoInput?.addEventListener(
  "change",
  async () => {
    videoStatus.textContent =
      "";

    videoDurationInput.value =
      "";

    const file =
      videoInput.files?.[0];

    if (!file) {
      return;
    }

    try {
      const seconds =
        await extractVideoDuration(
          file
        );

      const rounded =
        Number(
          seconds.toFixed(2)
        );

      if (
        rounded < 10 ||
        rounded > 13
      ) {
        videoInput.value =
          "";

        setMessage(
          videoStatus,
          `Duracion invalida (${rounded}s). Debe durar entre 10 y 13 segundos.`,
          true
        );

        return;
      }

      videoDurationInput.value =
        String(rounded);

      setMessage(
        videoStatus,
        `Video validado: ${rounded}s.`,
        false
      );
    } catch (error) {
      videoInput.value =
        "";

      setMessage(
        videoStatus,
        error.message,
        true
      );
    }
  }
);

useLocationButton?.addEventListener(
  "click",
  () => {
    if (
      !navigator.geolocation
    ) {
      setMessage(
        businessMessage,
        "Tu navegador no permite geolocalizacion.",
        true
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latInput =
          businessForm.querySelector(
            "input[name='latitude']"
          );

        const lngInput =
          businessForm.querySelector(
            "input[name='longitude']"
          );

        latInput.value =
          position.coords.latitude.toFixed(
            6
          );

        lngInput.value =
          position.coords.longitude.toFixed(
            6
          );

        setMessage(
          businessMessage,
          "Ubicacion cargada correctamente.",
          false
        );
      },
      () => {
        setMessage(
          businessMessage,
          "No pudimos obtener tu ubicacion.",
          true
        );
      }
    );
  }
);

userForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    setMessage(
      userMessage,
      "Guardando usuario..."
    );

    const payload =
      Object.fromEntries(
        new FormData(
          userForm
        ).entries()
      );

    try {
      const response =
        await fetch(
          "/api/users/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "No se pudo crear el usuario."
        );
      }

      userForm.reset();

      setMessage(
        userMessage,
        data.message ||
          "Usuario creado."
      );
    } catch (error) {
      setMessage(
        userMessage,
        error.message,
        true
      );
    }
  }
);

businessForm?.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    setMessage(
      businessMessage,
      "Subiendo negocio y videos..."
    );

    const formData =
      new FormData(
        businessForm
      );

    const duration =
      Number(
        formData.get(
          "videoDurationSeconds"
        )
      );

    if (
      !Number.isFinite(
        duration
      ) ||
      duration < 10 ||
      duration > 13
    ) {
      setMessage(
        businessMessage,
        "Debes subir un video valido entre 10 y 13 segundos.",
        true
      );

      return;
    }

    try {
      const response =
        await fetch(
          "/api/businesses",
          {
            method: "POST",

            body: formData,
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data.error ||
            "No se pudo registrar el negocio."
        );
      }

      businessForm.reset();

      videoDurationInput.value =
        "";

      videoStatus.textContent =
        "";

      setMessage(
        businessMessage,
        "Negocio enviado para revision correctamente.",
        false
      );
    } catch (error) {
      setMessage(
        businessMessage,
        error.message,
        true
      );
    }
  }
);