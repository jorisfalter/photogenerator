// adjust padding after uploading a pic
// Function to call after a picture is uploaded and processed
function adjustMainPadding() {
  document.querySelector("main").style.paddingTop = "200px"; // Adjust this value to the header's height
  // console.log("padding adjusted");
}

// pic upload
const picElement = document.getElementById("file");
if (picElement) {
  document.getElementById("file").addEventListener("change", function (event) {
    adjustMainPadding();

    var imagePreview = document.getElementById("imagePreview");
    var files = event.target.files; // FileList object
    f = files[0];
    // console.log(files[0]);

    var reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = (function (theFile) {
      return function (e) {
        // Render thumbnail.
        var span = document.createElement("span");
        span.innerHTML = [
          '<img class="thumb" src="',
          e.target.result,
          '" title="',
          escape(theFile.name),
          '"/>',
        ].join("");
        imagePreview.insertBefore(span, null);
      };
    })(f);

    // Read in the image file as a data URL.
    reader.readAsDataURL(f);

    var button = document.querySelector(".generate-button");
    button.style.display = "block"; // Make the button take up space
  });

  document
    .getElementById("uploadForm")
    .addEventListener("submit", function (event) {
      event.preventDefault(); // Stop the form from submitting normally

      // console.log("submission intercepted");

      // Create a FormData object, passing the form as a parameter
      var formData = new FormData(this);
      const statusMessage = document.getElementById("statusMessage");
      statusMessage.textContent = "Processing..."; // Provide immediate feedback

      fetch("/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.taskId) {
            console.log("starting polling function");
            pollStatus(data.taskId); // Start polling for status
          } else {
            console.error("No task ID returned from server");
            statusMessage.textContent =
              "Failed to start the image generation process.";
          }
        })
        .catch((error) => console.error("Error uploading image:", error));
    });

  // do animation while waiting
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("uploadForm");
    form.addEventListener("submit", function () {
      // Show loading animation
      document.getElementById("loadingAnimationId").style.display = "block";
    });
  });

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.attributeName === "style") {
        let displayStyle = mutation.target.style.display;
        if (displayStyle === "block") {
          startCountdown();
        }
      }
    });
  });

  observer.observe(document.getElementById("loadingAnimationId"), {
    attributes: true, //configure it to listen to attribute changes
  });
}

// Polling solution as Heroku doesn't allow to wait longer than 30 seconds
function pollStatus(taskId) {
  fetch(`/status/${taskId}`)
    .then((response) => response.json())
    .then((data) => {
      console.log("polling");
      if (data.status === "completed") {
        window.location.href = `/result/${taskId}`; // Redirect to the result page
      } else if (data.status === "pending") {
        setTimeout(() => pollStatus(taskId), 5000); // Poll every 5 seconds
      } else {
        console.error("Task failed or unknown status");
      }
    })
    .catch((error) => console.error("Error polling task status:", error));
}

// recording
const audioElement = document.getElementById("startRecord");
let recorder;
let audioStream;
if (audioElement) {
  //// new recording script because ios cannot handle mediarecorder

  // Function to initialize recording
  console.log("initialising recording");
  // document.getElementById("startRecord").disabled = true; // Disable at start

  async function initRecording() {
    console.log("initialising recording");

    try {
      console.log("getting user media");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("setting recorder");
      audioStream = stream;
      // Create a new instance of RecordRTC with the audio stream
      recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav", // Specify desired output format
        recorderType: RecordRTC.StereoAudioRecorder, // Explicitly set for Safari compatibility
        numberOfAudioChannels: 1, // Mono audio may be beneficial for compatibility
        // desiredSampRate: 16000, // Optional: Specify sample rate
      });
      console.log("recorder set", recorder);
    } catch (error) {
      console.error("Error accessing the microphone:", error);
      throw error; // Propagate error to be caught in the click handler
    }
  }

  document.getElementById("startRecord").addEventListener("click", async () => {
    document.getElementById("startRecord").disabled = true;
    try {
      // Call initRecording to set up
      await initRecording();
      console.log(recorder);
      if (recorder) {
        recorder.startRecording();
        document.getElementById("startRecord").style.display = "none";
        document.getElementById("stopRecord").style.display = "inline-block";
      } else {
        console.log("Recorder not initialized");
        document.getElementById("startRecord").disabled = false;
      }
    } catch (error) {
      console.log("Initialization failed", error);
      document.getElementById("startRecord").disabled = false;
    }
  });

  document.getElementById("stopRecord").addEventListener("click", () => {
    if (recorder) {
      recorder.stopRecording(() => {
        let blob = recorder.getBlob();
        let audioUrl = URL.createObjectURL(blob);
        document.getElementById("audioPlayback").src = audioUrl;
        document.getElementById("audioPlayback").hidden = false;
        document.getElementById("resetRecord").style.display = "inline-block";
        document.getElementById("uploadRecord").style.display = "inline-block";
      });

      // document.getElementById("startRecord").disabled = true;
      // document.getElementById("stopRecord").disabled = true;
      document.getElementById("startRecord").style.display = "none";
      document.getElementById("stopRecord").style.display = "none";
    }
  });

  // Reset recording
  document.getElementById("resetRecord").addEventListener("click", () => {
    recorder.reset();
    // audioStream.getTracks().forEach((track) => track.stop()); // Optional: Stop the audio stream
    document.getElementById("startRecord").style.display = "inline-block";
    document.getElementById("audioPlayback").hidden = true;
    document.getElementById("resetRecord").style.display = "none";
    document.getElementById("uploadRecord").style.display = "none";
    document.getElementById("startRecord").disabled = false;
  });

  // Assuming recorder is your RecordRTC instance
  document.getElementById("uploadRecord").addEventListener("click", () => {
    if (recorder && recorder.getBlob()) {
      startCountdown();
      document.getElementById("loadingAnimationId").style.display = "block";

      const audioBlob = recorder.getBlob(); // Get the recorded blob directly from RecordRTC
      const formData = new FormData();
      formData.append("audioFile", audioBlob, "recording.wav"); // Append the blob to FormData

      // Call the endpoint
      fetch("/upload-audio", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          console.log(data);
          // Handle the response here
          if (data.success) {
            alert(`Transcribed Text: ${data.description}`);
            // Construct a URL with query parameters
            const queryParams = `image_url=${encodeURIComponent(
              data.image_url
            )}&description=${encodeURIComponent(data.description)}`;
            window.location.href = `/result?${queryParams}`; // Redirect
          }
        })
        .catch((error) => console.error("Error:", error));
    } else {
      console.log("Recorder not initialized or recording not stopped.");
    }
  });
}

//// end recording

// countdown
function startCountdown() {
  let countdownElement = document.getElementById("countdown");
  let countdownTime = parseInt(countdownElement.textContent, 10);

  let timer = setInterval(() => {
    countdownTime--;
    countdownElement.textContent = countdownTime;

    if (countdownTime <= 0) {
      clearInterval(timer);
      document.getElementById("loadingAnimationId").textContent =
        "Done thinking!";
      observer.disconnect(); // Stop observing when countdown finishes
    }
  }, 1000);
}

// auto copyright update
document.addEventListener("DOMContentLoaded", function () {
  var currentYear = new Date().getFullYear();
  document.getElementById("current-year").textContent = currentYear;
});

// header-logo button
function redirectToHome() {
  window.location.href = "/";
}

// result page
const resultElement = document.getElementById("downloadImageButton");
if (resultElement) {
  // Download button
  document
    .getElementById("downloadImageButton")
    .addEventListener("click", () => {
      fetch("/fetch-openai-image")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.blob();
        })
        .then((blob) => {
          // Create a URL for the blob
          const url = window.URL.createObjectURL(blob);
          // Create a new anchor element
          const a = document.createElement("a");
          a.href = url;
          // Set the filename you want for the downloaded file
          a.download = "my-cool-ai-image.jpg";
          // Append the anchor to the body, trigger click to download, and then remove the anchor
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        })
        .catch((error) => {
          console.error("Error downloading image through proxy:", error);
        });
    });

  // Share button
  document.getElementById("shareImageButton").addEventListener("click", () => {
    fetch("/fetch-openai-image")
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.blob();
      })
      .then((blob) => {
        // Assuming the MIME type of the image is known, e.g., 'image/jpeg'
        const file = new File([blob], "shared-image.jpg", {
          type: "image/jpeg",
        });

        // Check if the Web Share API supports file sharing
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator
            .share({
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
      .catch((error) => {
        console.error("Error fetching image:", error);
      });
  });
}
