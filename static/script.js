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

  // Camera Elements
  const openCameraButton = document.getElementById("camera-button");
  const cameraContainer = document.getElementById("camera-container");
  const takePictureButton = document.getElementById("take-picture-button");
  const closeCameraButton = document.getElementById("close-camera-button");

  // --- State Variables ---
  let croppedImageDataURLs = [];
  let allPredictions = [];
  let stream = null;
  let currentImageFile = null;

  // --- UI & Display Functions ---

  function resetUI() {
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
    currentImageFile = null;
    croppedImageDataURLs = [];
  }

  function handleFiles(files) {
    const file = files[0];
    if (file) {
      currentImageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        removeImageButton.style.display = "flex";
        placeholderContent.style.display = "none";
        uploadLabel.parentElement.style.display = "none";
        actionButtonsContainer.style.display = "flex";
        resultContainer.style.display = "none";
        resultContainer.innerHTML = "";
        postPredictionButtons.style.display = "none";
      };
      reader.readAsDataURL(file);
    }
  }

  function createPaymentButton(amount) {
    const paymentButton = document.createElement("button");
    paymentButton.id = "payment-button";
    paymentButton.className = "btn btn-success";
    paymentButton.style.marginTop = "1.5rem";
    paymentButton.innerHTML = '<i class="fas fa-qrcode"></i> Pay Now';
    paymentButton.dataset.amount = amount;
    return paymentButton;
  }

  function displayTrayResult(data) {
    if (data.error) {
      resultContainer.innerHTML = <h2>Error</h2><p>${data.error}</p>;
      resultContainer.style.display = "block";
      return;
    }

    const { predictions, total_price } = data;

    // Lọc bỏ các item "nothing" trước khi hiển thị
    const visiblePredictions = predictions.filter(
      (p) => p.item_name !== "nothing"
    );

    // Dùng map với index để tạo lại số thứ tự tuần tự
    let tableRows = visiblePredictions
      .map(
        (p, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${p.item_name}</td>
            <td>${p.price.toLocaleString("vi-VN")}</td>
        </tr>`
      )
      .join("");

    resultContainer.innerHTML = `
        <h2>Prediction Result</h2>
        <table class="result-table">
            <thead>
                <tr><th>Position</th><th>Item</th><th>Price</th></tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="2">Total Price</td>
                    <td colspan="1">${total_price.toLocaleString(
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

  // Main Prediction
  predictButton.addEventListener("click", async () => {
    if (!currentImageFile) {
      alert("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", currentImageFile);
    predictButton.querySelector("span").textContent = "Predicting...";
    predictButton.disabled = true;

    try {
      const response = await fetch("/detect_and_predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      // Store original predictions and cropped images received from the backend
      if (data.predictions) {
        allPredictions = data.predictions; // <-- Lưu kết quả gốc
      }
      if (data.cropped_images) {
        croppedImageDataURLs = data.cropped_images;
        previewCropsButton.style.display = "inline-flex";
      } else {
        previewCropsButton.style.display = "none";
      }

      displayTrayResult(data); // Gọi hàm hiển thị kết quả
    } catch (error) {
      alert("An error occurred during prediction.");
      console.error("Prediction error:", error);
    } finally {
      predictButton.querySelector("span").textContent = "Predict";
      predictButton.disabled = false;
      actionButtonsContainer.style.display = "none";
      postPredictionButtons.style.display = "flex";
    }
  });

  // Preview Modal
  previewCropsButton.addEventListener("click", () => {
    modalGrid.innerHTML = "";

    // Kết hợp thông tin dự đoán và ảnh crop
    const combinedItems = allPredictions.map((prediction, index) => ({
      ...prediction,
      image: croppedImageDataURLs[index],
    }));

    // Lọc bỏ các mục "nothing"
    const visibleItems = combinedItems.filter(
      (item) => item.item_name !== "nothing"
    );

    // Dùng forEach với index để tạo lại số thứ tự và caption
    visibleItems.forEach((item, index) => {
      const cropWrapper = document.createElement("div");
      cropWrapper.className = "crop-item";

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = Item ${index + 1}: ${item.item_name};

      const caption = document.createElement("p");
      caption.className = "crop-caption";
      caption.textContent = ${index + 1}. ${item.item_name}; // Sử dụng index + 1

      cropWrapper.appendChild(img);
      cropWrapper.appendChild(caption);
      modalGrid.appendChild(cropWrapper);
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

  // Payment Modal
  document.addEventListener("click", async (event) => {
    if (event.target && event.target.id === "payment-button") {
      const amount = event.target.dataset.amount;
      if (!amount) return;

      paymentDetails.textContent = `Total Price: ${parseInt(
        amount
      ).toLocaleString("vi-VN")} VND`;
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
        paymentDetails.textContent =
          "Error creating QR code. Please try again.";
        qrCodeImage.src = "";
      }
    }
  });

  closePaymentModalBtn.addEventListener("click", () => {
    paymentModal.style.display = "none";
  });

  paymentSuccessButton.addEventListener("click", () => {
    paymentModal.style.display = "none";
    resetUI();
  });

  // --- Initial Setup ---
  resetUI();
});
