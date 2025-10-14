document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const fileInput = document.getElementById("file-input");
  const uploadLabel = document.querySelector('label[for="file-input"]');
  const dropContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const placeholderContent = document.getElementById("placeholder-content");
  const actionButtonsContainer = document.getElementById(
    "action-buttons-container"
  );
  const predictButton = document.getElementById("predict-button");
  const createGridButton = document.getElementById("create-grid-button");
  const predictTrayButton = document.getElementById("predict-tray-button");
  const resultContainer = document.getElementById("result-container");
  const removeImageButton = document.getElementById("remove-image-button");
  const postPredictionButtons = document.getElementById(
    "post-prediction-buttons"
  );
  const previewCropsButton = document.getElementById("preview-crops-button");

  // Preview Modal Elements
  const previewModal = document.getElementById("preview-modal");
  const closeModalButton = previewModal.querySelector(".close-modal");
  const modalGrid = document.getElementById("modal-grid");

  // Payment Modal Elements
  const paymentModal = document.getElementById("payment-modal");
  const closePaymentModalBtn = document.getElementById("close-payment-modal");
  const qrCodeImage = document.getElementById("qr-code-image");
  const paymentDetails = document.getElementById("payment-details");
  const paymentSuccessButton = document.getElementById(
    "payment-success-button"
  );

  // Grid Control Elements
  const gridControlsContainer = document.getElementById(
    "grid-controls-container"
  );
  const btnPlusX = document.getElementById("grid-plus-x");
  const btnMinusX = document.getElementById("grid-minus-x");
  const btnPlusY = document.getElementById("grid-plus-y");
  const btnMinusY = document.getElementById("grid-minus-y");

  // Camera Elements
  const openCameraButton = document.getElementById("camera-button");
  const cameraContainer = document.getElementById("camera-container");
  const takePictureButton = document.getElementById("take-picture-button");
  const closeCameraButton = document.getElementById("close-camera-button");

  // --- State Variables ---
  let croppedImageDataURLs = [];
  let loadedImage = new Image();
  let gridParams = { rows: 2, cols: 3, marginX: 0.1, marginY: 0.1 };
  let stream = null;

  // --- UI & Display Functions ---

  function resetUI() {
    const canvas = document.getElementById("image-canvas-overlay");
    if (canvas) canvas.remove();

    placeholderContent.style.display = "flex";
    uploadLabel.parentElement.style.display = "flex";
    imagePreview.style.display = "none";

    removeImageButton.style.display = "none";
    actionButtonsContainer.style.display = "none";
    postPredictionButtons.style.display = "none";
    resultContainer.style.display = "none";
    resultContainer.innerHTML = "";
    fileInput.value = "";
    stopCamera();

    gridControlsContainer.style.display = "none";
    gridControlsContainer.classList.remove("visible");
    gridParams = { rows: 2, cols: 3, marginX: 0.1, marginY: 0.1 };
    croppedImageDataURLs = [];

    predictTrayButton.style.display = "none";
    createGridButton.style.display = "inline-flex";
    predictButton.style.display = "inline-flex";
  }

  function handleFiles(files) {
    const file = files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        loadedImage.src = e.target.result;
        loadedImage.onload = () => {
          imagePreview.src = loadedImage.src;
          imagePreview.style.display = "block";
          removeImageButton.style.display = "flex";
          placeholderContent.style.display = "none";
          uploadLabel.parentElement.style.display = "none";
          actionButtonsContainer.style.display = "flex";
          resultContainer.style.display = "none";
          resultContainer.innerHTML = "";
          postPredictionButtons.style.display = "none";
        };
      };
      reader.readAsDataURL(file);
    }
  }

  function createPaymentButton(amount) {
    const paymentButton = document.createElement("button");
    paymentButton.id = "payment-button";
    paymentButton.className = "btn btn-success";
    paymentButton.style.marginTop = "1.5rem";
    paymentButton.innerHTML = `<i class="fas fa-qrcode"></i> Thanh toán ngay`;
    paymentButton.dataset.amount = amount;
    return paymentButton;
  }

  function displaySingleResult(data) {
    const priceFormatted = data.price.toLocaleString("vi-VN");
    resultContainer.innerHTML = `
        <h2>Prediction Result</h2>
        <p><strong>🍰 Item:</strong> <span>${data.item_name}</span></p>
        <p><strong>💵 Price:</strong> <span>${priceFormatted}</span> VND</p>
        <p><strong>✅ Confidence:</strong> <span>${data.confidence}</span>%</p>
        `;

    const paymentButton = createPaymentButton(data.price);
    resultContainer.appendChild(paymentButton);
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
        </tr>`
      )
      .join("");

    resultContainer.innerHTML = `
        <h2>Tray Prediction Result</h2>
        <table class="result-table">
            <thead>
                <tr><th>Position</th><th>Item</th><th>Price</th><th>Confidence</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="2">Total Price</td>
                    <td colspan="2">${total_price.toLocaleString(
                      "vi-VN"
                    )} VND</td>
                </tr>
            </tfoot>
        </table>`;

    const paymentButton = createPaymentButton(total_price);
    resultContainer.appendChild(paymentButton);
    resultContainer.style.display = "block";
  }

  // --- Core Logic Functions ---

  function redrawGrid() {
    let canvas = document.getElementById("image-canvas-overlay");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "image-canvas-overlay";
      dropContainer.appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");
    const { clientWidth: displayWidth, clientHeight: displayHeight } =
      imagePreview;
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

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      document.getElementById("camera-video").srcObject = stream;
      cameraContainer.style.display = "flex";
    } catch (err) {
      alert("Could not access camera. Please grant permission.");
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
    const video = document.getElementById("camera-video");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      const file = new File([blob], "camera.jpg", { type: "image/jpeg" });
      handleFiles([file]);
      stopCamera();
    }, "image/jpeg");
  }

  async function predictTrayWithCroppedImages(button) {
    const buttonSpan = button.querySelector("span");
    buttonSpan.textContent = "Cropping...";

    const scaleX = loadedImage.naturalWidth / imagePreview.clientWidth;
    const scaleY = loadedImage.naturalHeight / imagePreview.clientHeight;

    const cropPromises = [];
    croppedImageDataURLs = [];

    for (let i = 0; i < gridParams.rows; i++) {
      for (let j = 0; j < gridParams.cols; j++) {
        const sx =
          (imagePreview.clientWidth * gridParams.marginX +
            j *
              ((imagePreview.clientWidth * (1 - 2 * gridParams.marginX)) /
                gridParams.cols)) *
          scaleX;
        const sy =
          (imagePreview.clientHeight * gridParams.marginY +
            i *
              ((imagePreview.clientHeight * (1 - 2 * gridParams.marginY)) /
                gridParams.rows)) *
          scaleY;
        const sWidth =
          ((imagePreview.clientWidth * (1 - 2 * gridParams.marginX)) /
            gridParams.cols) *
          scaleX;
        const sHeight =
          ((imagePreview.clientHeight * (1 - 2 * gridParams.marginY)) /
            gridParams.rows) *
          scaleY;

        const promise = new Promise((resolve) => {
          const canvas = document.createElement("canvas");
          canvas.width = sWidth;
          canvas.height = sHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            loadedImage,
            sx,
            sy,
            sWidth,
            sHeight,
            0,
            0,
            sWidth,
            sHeight
          );
          croppedImageDataURLs.push(canvas.toDataURL("image/jpeg"));
          canvas.toBlob(
            (blob) => resolve(new File([blob], `crop_${i}_${j}.jpg`)),
            "image/jpeg"
          );
        });
        cropPromises.push(promise);
      }
    }

    const croppedFiles = await Promise.all(cropPromises);
    buttonSpan.textContent = "Predicting...";

    const formData = new FormData();
    croppedFiles.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/predict_tray", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      displayTrayResult(data);
    } catch (error) {
      alert("An error occurred during prediction.");
    } finally {
      // Ẩn các nút điều khiển lưới sau khi dự đoán xong
      gridControlsContainer.style.display = "none";
      gridControlsContainer.classList.remove("visible");

      buttonSpan.textContent = "Predict Tray";
      actionButtonsContainer.style.display = "none";
      postPredictionButtons.style.display = "flex";
      previewCropsButton.style.display = "inline-flex";
    }
  }

  // --- Event Listeners ---

  // File handling
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  removeImageButton.addEventListener("click", resetUI);
  document
    .getElementById("another-image-button")
    .addEventListener("click", resetUI);
  dropContainer.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropContainer.classList.add("dragover");
  });
  dropContainer.addEventListener("dragleave", () =>
    dropContainer.classList.remove("dragover")
  );
  dropContainer.addEventListener("drop", (e) => {
    e.preventDefault();
    dropContainer.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  // Camera
  openCameraButton.addEventListener("click", startCamera);
  closeCameraButton.addEventListener("click", stopCamera);
  takePictureButton.addEventListener("click", takePicture);

  // Predictions
  predictButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    predictButton.querySelector("span").textContent = "Predicting...";

    try {
      const response = await fetch("/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      displaySingleResult(data);
    } catch (error) {
      alert("An error occurred.");
    } finally {
      predictButton.querySelector("span").textContent = "Predict Single";
      actionButtonsContainer.style.display = "none";
      postPredictionButtons.style.display = "flex";
      previewCropsButton.style.display = "none";
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

  // Grid controls
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

  // Preview Modal
  previewCropsButton.addEventListener("click", () => {
    modalGrid.innerHTML = "";
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

  // --- Payment Modal Event Listeners ---
  document.addEventListener("click", async (event) => {
    // Listener cho nút "Thanh toán ngay"
    if (event.target && event.target.id === "payment-button") {
      const amount = event.target.dataset.amount;
      if (!amount) return;

      paymentDetails.textContent = `Số tiền: ${parseInt(amount).toLocaleString(
        "vi-VN"
      )} VND`;
      qrCodeImage.src = "https://i.gifer.com/ZZ5H.gif"; // Loading spinner
      paymentModal.style.display = "block";

      try {
        const response = await fetch("/generate_qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amount }),
        });
        if (!response.ok) throw new Error("Failed to generate QR");

        const imageBlob = await response.blob();
        qrCodeImage.src = URL.createObjectURL(imageBlob);
      } catch (error) {
        paymentDetails.textContent = "Lỗi khi tạo mã QR. Vui lòng thử lại.";
        qrCodeImage.src = "";
      }
    }
  });

  // Listener cho nút X để đóng modal (hành động hủy)
  closePaymentModalBtn.addEventListener("click", () => {
    paymentModal.style.display = "none";
  });

  // Listener cho nút "Thanh toán thành công" (hành động hoàn tất)
  paymentSuccessButton.addEventListener("click", () => {
    paymentModal.style.display = "none"; // Đóng modal
    resetUI(); // Quay về màn hình ban đầu
  });

  // Đóng modal preview crops khi click ra ngoài
  window.addEventListener("click", (event) => {
    if (event.target == previewModal) {
      previewModal.style.display = "none";
    }
  });

  // --- Initial Setup ---
  resetUI();
});
