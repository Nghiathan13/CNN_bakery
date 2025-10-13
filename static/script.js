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
  // START: Updated button variables
  const createGridButton = document.getElementById("create-grid-button");
  const predictTrayButton = document.getElementById("predict-tray-button");
  // END: Updated button variables
  const anotherImageButton = document.getElementById("another-image-button");
  const resultContainer = document.getElementById("result-container");
  const removeImageButton = document.getElementById("remove-image-button");

  // --- Camera Elements ---
  const openCameraButton = document.getElementById("camera-button");
  const cameraContainer = document.getElementById("camera-container");
  const cameraViewWrapper = document.getElementById("camera-view-wrapper");
  const cameraVideo = document.getElementById("camera-video");
  const takePictureButton = document.getElementById("take-picture-button");
  const closeCameraButton = document.getElementById("close-camera-button");
  let stream = null;

  // --- UI Functions ---
  function resetUI() {
    const canvas = document.getElementById("image-canvas-overlay");
    if (canvas) {
      canvas.remove();
    }

    placeholderIcon.style.display = "block";
    dragText.style.display = "block";
    fileTypes.style.display = "block";
    uploadLabel.parentElement.style.display = "flex";
    imagePreview.style.display = "none";
    removeImageButton.style.display = "none";
    actionButtonsContainer.style.display = "none";
    anotherImageButton.style.display = "none";
    resultContainer.style.display = "none";
    resultContainer.innerHTML = "";
    fileInput.value = "";
    stopCamera();

    // START: Added to ensure correct button states on reset
    predictTrayButton.style.display = "none";
    createGridButton.style.display = "inline-flex";
    predictButton.style.display = "inline-flex";
    // END: Added
  }

  function handleFiles(files) {
    // START: Added to ensure canvas is cleared when a new image is dropped/selected
    const canvas = document.getElementById("image-canvas-overlay");
    if (canvas) {
      canvas.remove();
    }
    // END: Added

    const file = files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        removeImageButton.style.display = "flex";
        placeholderIcon.style.display = "none";
        dragText.style.display = "none";
        fileTypes.style.display = "none";
        uploadLabel.parentElement.style.display = "none";
        actionButtonsContainer.style.display = "flex";
        anotherImageButton.style.display = "none";
        resultContainer.style.display = "none";
        resultContainer.innerHTML = "";

        // START: Ensure correct initial button visibility
        predictButton.style.display = "inline-flex";
        createGridButton.style.display = "inline-flex";
        predictTrayButton.style.display = "none";
        // END: Ensure
      };
      reader.readAsDataURL(file);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
    }
  }

  function drawGridOnImage() {
    const canvas = document.createElement("canvas");
    canvas.id = "image-canvas-overlay";
    const ctx = canvas.getContext("2d");

    const displayWidth = imagePreview.clientWidth;
    const displayHeight = imagePreview.clientHeight;
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.drawImage(imagePreview, 0, 0, displayWidth, displayHeight);

    const rows = 2;
    const cols = 3;
    const cellWidth = displayWidth / cols;
    const cellHeight = displayHeight / rows;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = `bold ${Math.min(cellWidth, cellHeight) / 4}px Montserrat`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 5;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = j * cellWidth;
        const y = i * cellHeight;
        const number = i * cols + j + 1;
        ctx.strokeRect(x, y, cellWidth, cellHeight);
        ctx.fillText(number.toString(), x + cellWidth / 2, y + cellHeight / 2);
      }
    }

    imagePreview.style.display = "none";
    dropContainer.appendChild(canvas);
  }

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

  // --- Camera Functions ---
  async function startCamera() {
    try {
      if (
        "mediaDevices" in navigator &&
        "getUserMedia" in navigator.mediaDevices
      ) {
        const constraints = { video: { facingMode: "environment" } };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
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

  // --- API Call Function ---
  async function predict(endpoint, onResult, button) {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select an image first.");
      return;
    }

    const buttonSpan = button.querySelector("span");
    const originalText = buttonSpan
      ? buttonSpan.textContent
      : button.textContent;
    if (buttonSpan) buttonSpan.textContent = "Predicting...";
    else button.textContent = "Predicting...";

    predictButton.disabled = true;
    createGridButton.disabled = true; // Disable both buttons during prediction
    predictTrayButton.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        onResult(data);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during prediction.");
    } finally {
      if (buttonSpan) buttonSpan.textContent = originalText;
      else button.textContent = originalText;
      predictButton.disabled = false;
      createGridButton.disabled = false;
      predictTrayButton.disabled = false;
      actionButtonsContainer.style.display = "none";
      anotherImageButton.style.display = "inline-flex";
    }
  }

  // --- Event Listeners ---
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  removeImageButton.addEventListener("click", resetUI);
  anotherImageButton.addEventListener("click", resetUI);

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

  predictButton.addEventListener("click", (e) =>
    predict("/predict", displaySingleResult, e.currentTarget)
  );

  // START: New logic for split buttons
  createGridButton.addEventListener("click", () => {
    drawGridOnImage();
    // Hide single predict and create grid buttons
    predictButton.style.display = "none";
    createGridButton.style.display = "none";
    // Show the actual predict tray button
    predictTrayButton.style.display = "inline-flex";
  });

  predictTrayButton.addEventListener("click", (e) =>
    predict("/predict_tray", displayTrayResult, e.currentTarget)
  );
  // END: New logic

  // --- Initial Setup ---
  resetUI();
});
