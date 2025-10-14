document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const fileInput = document.getElementById("file-input");
  const uploadLabel = document.querySelector('label[for="file-input"]');
  const dropContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const placeholderIcon = document.getElementById("image-placeholder-icon");
  const dragText = document.querySelector(".drag-text");
  const fileTypes = document.querySelector(".file-types");
  const actionButtonsContainer = document.getElementById(
    "action-buttons-container"
  );
  const predictButton = document.getElementById("predict-button");
  const createGridButton = document.getElementById("create-grid-button");
  const predictTrayButton = document.getElementById("predict-tray-button");
  const resultContainer = document.getElementById("result-container");
  const removeImageButton = document.getElementById("remove-image-button");

  // START: New elements for post-prediction and modal
  const postPredictionButtons = document.getElementById(
    "post-prediction-buttons"
  );
  const previewCropsButton = document.getElementById("preview-crops-button");
  const previewModal = document.getElementById("preview-modal");
  const closeModalButton = document.querySelector(".close-modal");
  const modalGrid = document.getElementById("modal-grid");
  let croppedImageDataURLs = []; // Array to store cropped images for preview
  // END: New elements

  // --- Grid Control Elements & State ---
  const gridControlsContainer = document.getElementById(
    "grid-controls-container"
  );
  const btnPlusX = document.getElementById("grid-plus-x");
  const btnMinusX = document.getElementById("grid-minus-x");
  const btnPlusY = document.getElementById("grid-plus-y");
  const btnMinusY = document.getElementById("grid-minus-y");

  let loadedImage = new Image();
  let gridParams = {
    rows: 2,
    cols: 3,
    marginX: 0.1,
    marginY: 0.1,
  };

  // --- Camera Elements ---
  const openCameraButton = document.getElementById("camera-button");
  const cameraContainer = document.getElementById("camera-container");
  const takePictureButton = document.getElementById("take-picture-button");
  const closeCameraButton = document.getElementById("close-camera-button");
  let stream = null;

  // --- UI Functions ---
  function resetUI() {
    const canvas = document.getElementById("image-canvas-overlay");
    if (canvas) canvas.remove();

    placeholderIcon.style.display = "block";
    dragText.style.display = "block";
    fileTypes.style.display = "block";
    uploadLabel.parentElement.style.display = "flex";
    imagePreview.style.display = "none";

    removeImageButton.style.display = "none";
    actionButtonsContainer.style.display = "none";
    postPredictionButtons.style.display = "none"; // Hide the new container
    resultContainer.style.display = "none";
    resultContainer.innerHTML = "";
    fileInput.value = "";
    stopCamera();

    gridControlsContainer.style.display = "none";
    gridControlsContainer.classList.remove("visible");
    gridParams = { rows: 2, cols: 3, marginX: 0.1, marginY: 0.1 };
    croppedImageDataURLs = []; // Clear stored images

    predictTrayButton.style.display = "none";
    createGridButton.style.display = "inline-flex";
    predictButton.style.display = "inline-flex";
  }

  function handleFiles(files) {
    const canvas = document.getElementById("image-canvas-overlay");
    if (canvas) canvas.remove();
    gridControlsContainer.style.display = "none";
    gridControlsContainer.classList.remove("visible");
    gridParams = { rows: 2, cols: 3, marginX: 0.1, marginY: 0.1 };
    croppedImageDataURLs = [];

    const file = files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        loadedImage.src = e.target.result;
        loadedImage.onload = () => {
          imagePreview.src = loadedImage.src;
          imagePreview.style.display = "block";
          removeImageButton.style.display = "flex";
          placeholderIcon.style.display = "none";
          dragText.style.display = "none";
          fileTypes.style.display = "none";
          uploadLabel.parentElement.style.display = "none";
          actionButtonsContainer.style.display = "flex";
          postPredictionButtons.style.display = "none";
          resultContainer.style.display = "none";
          resultContainer.innerHTML = "";
          predictButton.style.display = "inline-flex";
          createGridButton.style.display = "inline-flex";
          predictTrayButton.style.display = "none";
        };
      };
      reader.readAsDataURL(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
    }
  }

  function redrawGrid() {
    let canvas = document.getElementById("image-canvas-overlay");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "image-canvas-overlay";
      dropContainer.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");
    const displayWidth = imagePreview.clientWidth;
    const displayHeight = imagePreview.clientHeight;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    const startX = displayWidth * gridParams.marginX;
    const startY = displayHeight * gridParams.marginY;
    const gridWidth = displayWidth * (1 - 2 * gridParams.marginX);
    const gridHeight = displayHeight * (1 - 2 * gridParams.marginY);
    const cellWidth = gridWidth / gridParams.cols;
    const cellHeight = gridHeight / gridParams.rows;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = `bold ${Math.min(cellWidth, cellHeight) / 4}px Montserrat`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 5;
    for (let i = 0; i < gridParams.rows; i++) {
      for (let j = 0; j < gridParams.cols; j++) {
        const x = startX + j * cellWidth;
        const y = startY + i * cellHeight;
        const number = i * gridParams.cols + j + 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        ctx.fillText(number.toString(), x + cellWidth / 2, y + cellHeight / 2);
      }
    }
  }

  // ... (display functions, camera functions remain unchanged)
  function displaySingleResult(data) {
    resultContainer.innerHTML = `
        <h2>Prediction Result</h2>
        <p><strong>🍰 Item:</strong> <span>${data.item_name}</span></p>
        <p><strong>💵 Price:</strong> <span>${data.price}</span> VND</p>
        <p><strong>✅ Confidence:</strong> <span>${data.confidence}</span>%</p>
        `;
    resultContainer.style.display = "block";
  }

  function displayTrayResult(data) {
    const { predictions, total_price } = data;
    let tableRows = predictions
      .map(
        (p) => `
        <tr>
            <td>${p.position}</td>
            <td>${p.item_name}</td>
            <td>${p.price.toLocaleString("vi-VN")}</td>
            <td>${Math.round(p.confidence)}%</td>
        </tr>
        `
      )
      .join("");

    resultContainer.innerHTML = `
        <h2>Tray Prediction Result</h2>
        <table class="result-table">
            <thead>
            <tr>
                <th>Position</th>
                <th>Item</th>
                <th>Price</th>
                <th>Confidence</th>
            </tr>
            </thead>
            <tbody>
            ${tableRows}
            </tbody>
            <tfoot>
            <tr class="total-row">
                <td colspan="2">Total Price</td>
                <td colspan="2">${total_price.toLocaleString("vi-VN")} VND</td>
            </tr>
            </tfoot>
        </table>
        `;
    resultContainer.style.display = "block";
  }

  async function startCamera() {
    try {
      if (
        "mediaDevices" in navigator &&
        "getUserMedia" in navigator.mediaDevices
      ) {
        const constraints = { video: { facingMode: "environment" } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        const cameraVideo = document.getElementById("camera-video");
        cameraVideo.srcObject = stream;
        cameraContainer.style.display = "flex";
      } else {
        alert("Your browser does not support camera access.");
      }
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert(
        "Could not access the camera. Please ensure you have a camera and have granted permission."
      );
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    cameraContainer.style.display = "none";
  }

  function takePicture() {
    const cameraVideo = document.getElementById("camera-video");
    const canvas = document.createElement("canvas");
    canvas.width = cameraVideo.videoWidth;
    canvas.height = cameraVideo.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], "camera-capture.jpg", {
        type: "image/jpeg",
      });
      handleFiles([file]);
      stopCamera();
    }, "image/jpeg");
  }

  // START: Updated predictTrayWithCroppedImages function
  async function predictTrayWithCroppedImages(button) {
    gridControlsContainer.classList.remove("visible");
    const buttonSpan = button.querySelector("span");
    buttonSpan.textContent = "Cropping...";

    const scaleX = loadedImage.naturalWidth / imagePreview.clientWidth;
    const scaleY = loadedImage.naturalHeight / imagePreview.clientHeight;
    const originalStartX =
      imagePreview.clientWidth * gridParams.marginX * scaleX;
    const originalStartY =
      imagePreview.clientHeight * gridParams.marginY * scaleY;
    const originalGridWidth =
      imagePreview.clientWidth * (1 - 2 * gridParams.marginX) * scaleX;
    const originalGridHeight =
      imagePreview.clientHeight * (1 - 2 * gridParams.marginY) * scaleY;
    const originalCellWidth = originalGridWidth / gridParams.cols;
    const originalCellHeight = originalGridHeight / gridParams.rows;

    const cropPromises = [];
    croppedImageDataURLs = []; // Clear previous previews

    for (let i = 0; i < gridParams.rows; i++) {
      for (let j = 0; j < gridParams.cols; j++) {
        const sx = originalStartX + j * originalCellWidth;
        const sy = originalStartY + i * originalCellHeight;

        const promise = new Promise((resolve) => {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = originalCellWidth;
          tempCanvas.height = originalCellHeight;
          const tempCtx = tempCanvas.getContext("2d");
          tempCtx.drawImage(
            loadedImage,
            sx,
            sy,
            originalCellWidth,
            originalCellHeight,
            0,
            0,
            originalCellWidth,
            originalCellHeight
          );

          // Store Data URL for preview
          croppedImageDataURLs.push(tempCanvas.toDataURL("image/jpeg"));

          tempCanvas.toBlob((blob) => {
            const position = i * gridParams.cols + j + 1;
            resolve(
              new File([blob], `crop_${position}.jpg`, { type: "image/jpeg" })
            );
          }, "image/jpeg");
        });
        cropPromises.push(promise);
      }
    }

    const croppedFiles = await Promise.all(cropPromises);

    buttonSpan.textContent = "Predicting...";
    predictButton.disabled = true;
    createGridButton.disabled = true;
    predictTrayButton.disabled = true;

    const formData = new FormData();
    croppedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/predict_tray", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        displayTrayResult(data);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during prediction.");
    } finally {
      buttonSpan.textContent = "Predict Tray";
      predictButton.disabled = false;
      createGridButton.disabled = false;
      predictTrayButton.disabled = false;
      actionButtonsContainer.style.display = "none";
      postPredictionButtons.style.display = "flex"; // Show the container with both buttons
    }
  }
  // END: Updated function

  // --- Event Listeners ---
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  removeImageButton.addEventListener("click", resetUI);
  document
    .getElementById("another-image-button")
    .addEventListener("click", resetUI); // Attach to the new button

  dropContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropContainer.classList.add("dragover");
  });
  dropContainer.addEventListener("dragleave", () => {
    dropContainer.classList.remove("dragover");
  });
  dropContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    dropContainer.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  openCameraButton.addEventListener("click", startCamera);
  closeCameraButton.addEventListener("click", stopCamera);
  takePictureButton.addEventListener("click", takePicture);

  predictButton.addEventListener("click", async (e) => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select an image first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    const button = e.currentTarget;
    const buttonSpan = button.querySelector("span");
    buttonSpan.textContent = "Predicting...";
    try {
      const response = await fetch("/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        displaySingleResult(data);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred.");
    } finally {
      buttonSpan.textContent = "Predict Single";
      actionButtonsContainer.style.display = "none";
      postPredictionButtons.style.display = "flex";
      previewCropsButton.style.display = "none"; // Hide preview for single predict
    }
  });

  createGridButton.addEventListener("click", () => {
    redrawGrid();
    predictButton.style.display = "none";
    createGridButton.style.display = "none";
    predictTrayButton.style.display = "inline-flex";
    gridControlsContainer.style.display = "block";
    setTimeout(() => gridControlsContainer.classList.add("visible"), 10);
  });

  predictTrayButton.addEventListener("click", (e) =>
    predictTrayWithCroppedImages(e.currentTarget)
  );

  btnPlusX.addEventListener("click", () => {
    gridParams.marginX = Math.max(0, gridParams.marginX - 0.02);
    redrawGrid();
  });
  btnMinusX.addEventListener("click", () => {
    gridParams.marginX = Math.min(0.49, gridParams.marginX + 0.02);
    redrawGrid();
  });
  btnPlusY.addEventListener("click", () => {
    gridParams.marginY = Math.max(0, gridParams.marginY - 0.02);
    redrawGrid();
  });
  btnMinusY.addEventListener("click", () => {
    gridParams.marginY = Math.min(0.49, gridParams.marginY + 0.02);
    redrawGrid();
  });

  // START: Modal event listeners
  previewCropsButton.addEventListener("click", () => {
    modalGrid.innerHTML = ""; // Clear previous images
    croppedImageDataURLs.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      modalGrid.appendChild(img);
    });
    previewModal.style.display = "block";
  });
  closeModalButton.addEventListener("click", () => {
    previewModal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target == previewModal) {
      previewModal.style.display = "none";
    }
  });
  // END: Modal event listeners

  // --- Initial Setup ---
  resetUI();
});
