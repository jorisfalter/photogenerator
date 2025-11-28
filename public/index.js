// Function to adjust padding after uploading a picture
function adjustMainPadding() {
  document.querySelector("main").style.paddingTop = "200px"; 
}

// Initialize picture upload functionality
function initPicUpload() {
  const picElement = document.getElementById("file");
  if (!picElement) return;

  picElement.addEventListener("change", handlePicChange);
  document.getElementById("uploadForm").addEventListener("submit", handlePicSubmit);
  document.addEventListener("DOMContentLoaded", showLoadingAnimation);
  observeLoadingAnimation();
}

function handlePicChange(event) {
  adjustMainPadding();

  const imagePreview = document.getElementById("imagePreview");
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = (e) => {
    const span = document.createElement("span");
    span.innerHTML = `<img class="thumb" src="${e.target.result}" title="${escape(file.name)}"/>`;
    imagePreview.insertBefore(span, null);
  };
  reader.readAsDataURL(file);

  document.querySelector(".generate-button").style.display = "block";
}

function handlePicSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.target);
  
  // Show loading animation
  document.getElementById("loadingAnimationId").style.display = "block";
  document.getElementById("uploadForm").style.display = "none";

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
  .then((response) => response.json())
  .then((data) => {
    if (data.taskId) {
      pollStatus(data.taskId);
    } else {
      console.error("No task ID returned from server");
      document.getElementById("loadingAnimationId").innerHTML = 
        '<p style="color: red;">❌ Error: No task ID received. Please try again.</p>' +
        '<a href="/image"><button>Try Again</button></a>';
    }
  })
  .catch((error) => {
    console.error("Error uploading image:", error);
    document.getElementById("loadingAnimationId").innerHTML = 
      '<p style="color: red;">❌ Upload failed. Please try again.</p>' +
      '<a href="/image"><button>Try Again</button></a>';
  });
}

function showLoadingAnimation() {
  const form = document.getElementById("uploadForm");
  form.addEventListener("submit", () => {
    document.getElementById("loadingAnimationId").style.display = "block";
  });
}

function observeLoadingAnimation() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "style" && mutation.target.style.display === "block") {
        startCountdown();
      }
    });
  });

  observer.observe(document.getElementById("loadingAnimationId"), { attributes: true });
}

// Function to poll status
function pollStatus(taskId) {
  fetch(`/status/${taskId}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "completed") {
        window.location.href = `/result/${taskId}`;
      } else if (data.status === "pending") {
        setTimeout(() => pollStatus(taskId), 5000);
      } else if (data.status === "failed") {
        document.getElementById("loadingAnimationId").innerHTML = 
          '<p style="color: red;">❌ Image generation failed. Please try again.</p>' +
          '<a href="/image"><button>Try Again</button></a>';
      } else {
        console.error("Task failed or unknown status");
        document.getElementById("loadingAnimationId").innerHTML = 
          '<p style="color: red;">❌ Something went wrong. Please try again.</p>' +
          '<a href="/image"><button>Try Again</button></a>';
      }
    })
    .catch((error) => {
      console.error("Error polling task status:", error);
      document.getElementById("loadingAnimationId").innerHTML = 
        '<p style="color: red;">❌ Connection error. Please try again.</p>' +
        '<a href="/image"><button>Try Again</button></a>';
    });
}

// Initialize recording functionality
function initRecording() {
  const audioElement = document.getElementById("startRecord");
  if (!audioElement) return;

  let recorder;
  let audioStream;

  audioElement.addEventListener("click", async () => {
    audioElement.disabled = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream = stream;
      recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
      });
      recorder.startRecording();
      audioElement.style.display = "none";
      document.getElementById("stopRecord").style.display = "inline-block";
    } catch (error) {
      console.error("Error accessing the microphone:", error);
      audioElement.disabled = false;
    }
  });

  document.getElementById("stopRecord").addEventListener("click", () => {
    if (recorder) {
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        const audioUrl = URL.createObjectURL(blob);
        document.getElementById("audioPlayback").src = audioUrl;
        document.getElementById("audioPlayback").hidden = false;
        document.getElementById("resetRecord").style.display = "inline-block";
        document.getElementById("uploadRecord").style.display = "inline-block";
      });

      audioElement.style.display = "none";
      document.getElementById("stopRecord").style.display = "none";
    }
  });

  document.getElementById("resetRecord").addEventListener("click", () => {
    recorder.reset();
    audioStream.getTracks().forEach((track) => track.stop());
    audioElement.style.display = "inline-block";
    document.getElementById("audioPlayback").hidden = true;
    document.getElementById("resetRecord").style.display = "none";
    document.getElementById("uploadRecord").style.display = "none";
    audioElement.disabled = false;
  });

  document.getElementById("uploadRecord").addEventListener("click", () => {
    if (recorder && recorder.getBlob()) {
      startCountdown();
      document.getElementById("loadingAnimationId").style.display = "block";

      const audioBlob = recorder.getBlob();
      const formData = new FormData();
      formData.append("audioFile", audioBlob, "recording.wav");

      fetch("/upload-audio", {
        method: "POST",
        body: formData,
      })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert(`Transcribed Text: ${data.description}`);
          const queryParams = `image_url=${encodeURIComponent(data.image_url)}&description=${encodeURIComponent(data.description)}`;
          window.location.href = `/result?${queryParams}`;
        }
      })
      .catch((error) => console.error("Error uploading audio:", error));
    } else {
      console.log("Recorder not initialized or recording not stopped.");
    }
  });
}

// Countdown functionality
function startCountdown() {
  let countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;
  
  let countdownTime = parseInt(countdownElement.textContent, 10);

  let timer = setInterval(() => {
    countdownTime--;
    countdownElement.textContent = countdownTime;

    if (countdownTime <= 0) {
      clearInterval(timer);
      const loadingDiv = document.getElementById("loadingAnimationId");
      loadingDiv.innerHTML = 
        '<div class="spinner"></div>' +
        '<p>Almost there! Still generating...</p>';
    }
  }, 1000);
}

// Set the current year in the footer
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("current-year").textContent = new Date().getFullYear();
});

// Redirect to home function
function redirectToHome() {
  window.location.href = "/";
}

// Initialize download and share functionality for result page
function initResultPage() {
  const resultElement = document.getElementById("downloadImageButton");
  if (!resultElement) return;

  resultElement.addEventListener("click", downloadImage);
  document.getElementById("shareImageButton").addEventListener("click", shareImage);
}

function downloadImage() {
  fetch("/fetch-openai-image")
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-cool-ai-image.jpg";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    })
    .catch((error) => console.error("Error downloading image:", error));
}

function shareImage() {
  fetch("/fetch-openai-image")
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.blob();
    })
    .then((blob) => {
      const file = new File([blob], "shared-image.jpg", { type: "image/jpeg" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: "Check out this cool image",
          text: "Generated with AI",
        })
        .then(() => console.log("Share was successful."))
        .catch((error) => console.error("Sharing failed", error));
      } else {
        console.log("Your browser does not support sharing files.");
      }
    })
    .catch((error) => console.error("Error fetching image:", error));
}

// Initialize FAQ dropdown functionality
function initFaqDropdowns() {
  document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');
  
    faqQuestions.forEach(question => {
      question.addEventListener('click', function() {
        const faqItem = this.parentElement;
        const faqAnswer = this.nextElementSibling;
  
        if (faqItem.classList.contains('open')) {
          faqItem.classList.remove('open');
          faqAnswer.style.maxHeight = '0px';
        } else {
          faqItem.classList.add('open');
          faqAnswer.style.maxHeight = faqAnswer.scrollHeight + 'px';
        }
  
        faqQuestions.forEach(q => {
          if (q !== this && q.parentElement.classList.contains('open')) {
            q.parentElement.classList.remove('open');
            q.nextElementSibling.style.maxHeight = '0px';
          }
        });
      });
    });
  });
}

// Initialize app
function initApp() {
  initPicUpload();
  initRecording();
  initResultPage();
  initFaqDropdowns();
}

document.addEventListener('DOMContentLoaded', initApp);
