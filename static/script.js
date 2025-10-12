document.addEventListener("DOMContentLoaded", () => {
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

  function resetUI() {
    // Show placeholder elements
    placeholderIcon.style.display = "block";
    dragText.style.display = "block";
    fileTypes.style.display = "block";
    uploadLabel.style.display = "inline-block";

    // Hide image preview and remove button
    imagePreview.style.display = "none";
    removeImageButton.style.display = "none";

    // Hide action buttons and results
    predictButton.style.display = "none";
    anotherImageButton.style.display = "none";
    resultContainer.style.display = "none";

    // Reset file input
    fileInput.value = "";
  }

  function handleFiles(files) {
    const file = files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = "block";
        removeImageButton.style.display = "flex";

        // Hide placeholder elements
        placeholderIcon.style.display = "none";
        dragText.style.display = "none";
        fileTypes.style.display = "none";

        // Hide upload buttons and show predict button
        uploadLabel.style.display = "none";
        anotherImageButton.style.display = "none";
        predictButton.style.display = "inline-block";

        // Hide previous results
        resultContainer.style.display = "none";
      };
      reader.readAsDataURL(file);
      fileInput.files = files; // Update file input to allow prediction
    }
  }

  // Event Listeners
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
  removeImageButton.addEventListener("click", () => resetUI());

  // Drag and Drop Listeners
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
      anotherImageButton.style.display = "inline-block";
    }
  });

  // Initial setup
  resetUI();
});
