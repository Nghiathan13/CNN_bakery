document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const fileInput = document.getElementById("file-input");
  const uploadLabel = document.querySelector('label[for="file-input"]');
  const dropContainer = document.getElementById("image-preview-container");
  const imagePreview = document.getElementById("image-preview");
  const placeholderIcon = document.getElementById("image-placeholder-icon");
  const dragText = document.querySelector(".drag-text");
  const fileTypes = document.querySelector(".file-types");
  const predictButton = document.getElementById("predict-button");
  const predictButtonText = predictButton.querySelector("span");
  const anotherImageButton = document.getElementById("another-image-button");
  const resultContainer = document.getElementById("result-container");
  const removeImageButton = document.getElementById("remove-image-button");
  const itemName = document.getElementById("item-name");
  const itemPrice = document.getElementById("item-price");
  const itemConfidence = document.getElementById("item-confidence");

  // --- Camera Elements ---
  const openCameraButton = document.getElementById("camera-button");
  const cameraContainer = document.getElementById("camera-container");
  const cameraVideo = document.getElementById("camera-video");
  const takePictureButton = document.getElementById("take-picture-button");
  const closeCameraButton = document.getElementById("close-camera-button");
  let stream = null; // To hold the camera stream

  // --- UI Functions ---
  function resetUI() {
    placeholderIcon.style.display = "block";
    dragText.style.display = "block";
    fileTypes.style.display = "block";
    uploadLabel.parentElement.style.display = "flex"; // Show upload container

    imagePreview.style.display = "none";
    removeImageButton.style.display = "none";

    predictButton.style.display = "none";
    anotherImageButton.style.display = "none";
    resultContainer.style.display = "none";

    fileInput.value = "";
    stopCamera();
  }

  function handleFiles(files) {
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

        uploadLabel.parentElement.style.display = "none"; // Hide upload container
        anotherImageButton.style.display = "none";
        predictButton.style.display = "inline-flex";

        resultContainer.style.display = "none";
      };
      reader.readAsDataURL(file);
      // Create a new FileList and assign it to the file input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
    }
  }

  // --- Camera Functions ---
  async function startCamera() {
    try {
      if ("mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices) {
        const constraints = {
          video: {
            facingMode: "environment", // Prefer the rear camera
          },
        };
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
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      handleFiles([file]); // Use the existing file handler
      stopCamera(); // Close camera after taking picture
    }, "image/jpeg");
  }

  // --- Event Listeners ---
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  removeImageButton.addEventListener("click", resetUI);
  anotherImageButton.addEventListener("click", resetUI);

  // Drag and Drop
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

  // Camera Listeners
  openCameraButton.addEventListener("click", startCamera);
  closeCameraButton.addEventListener("click", stopCamera);
  takePictureButton.addEventListener("click", takePicture);

  // Predict Logic
  predictButton.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please select an image first.");
      return;
    }

    predictButtonText.textContent = "Predicting...";
    predictButton.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        itemName.textContent = data.item_name;
        itemPrice.textContent = data.price;
        itemConfidence.textContent = data.confidence;
        resultContainer.style.display = "block";
      }
    } catch (error) { 
      console.error("Error:", error);
      alert("An error occurred during prediction.");
    } finally {
      predictButtonText.textContent = "Predict";
      predictButton.disabled = false;
      predictButton.style.display = "none";
      anotherImageButton.style.display = "inline-flex";
    }
  });

  // --- Initial Setup ---
  resetUI();
});