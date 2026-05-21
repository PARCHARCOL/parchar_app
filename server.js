// RUT PDF

if (
  req.files
    ?.rutDocument?.[0]
) {

  const uploadedRut =
    await new Promise(
      (
        resolve,
        reject
      ) => {

        cloudinary.uploader.upload_stream(
          {
            resource_type:
              "raw",

            folder:
              "parchar/rut",

            format:
              "pdf",
          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;
            }

            resolve(
              result
            );
          }
        ).end(
          req.files
            .rutDocument[0]
            .buffer
        );
      }
    );

  rutUrl =
    uploadedRut.secure_url;
}
// RUT PDF

if (
  req.files
    ?.rutDocument?.[0]
) {

  const uploadedRut =
    await new Promise(
      (
        resolve,
        reject
      ) => {

        cloudinary.uploader.upload_stream(
          {
            resource_type:
              "auto",

            folder:
              "parchar/rut",
          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;
            }

            resolve(
              result
            );
          }
        ).end(
          req.files
            .rutDocument[0]
            .buffer
        );
      }
    );

  rutUrl =
    uploadedRut.secure_url;
}
// CAMARA COMERCIO PDF

if (
  req.files
    ?.commerceDocument?.[0]
) {

  const uploadedCommerce =
    await new Promise(
      (
        resolve,
        reject
      ) => {

        cloudinary.uploader.upload_stream(
          {
            resource_type:
              "raw",

            folder:
              "parchar/commerce",

            format:
              "pdf",
          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;
            }

            resolve(
              result
            );
          }
        ).end(
          req.files
            .commerceDocument[0]
            .buffer
        );
      }
    );

  commerceUrl =
    uploadedCommerce.secure_url;
}
// CAMARA COMERCIO PDF

if (
  req.files
    ?.commerceDocument?.[0]
) {

  const uploadedCommerce =
    await new Promise(
      (
        resolve,
        reject
      ) => {

        cloudinary.uploader.upload_stream(
          {
            resource_type:
              "auto",

            folder:
              "parchar/commerce",
          },

          (
            error,
            result
          ) => {

            if (error) {

              reject(
                error
              );

              return;
            }

            resolve(
              result
            );
          }
        ).end(
          req.files
            .commerceDocument[0]
            .buffer
        );
      }
    );

  commerceUrl =
    uploadedCommerce.secure_url;
}