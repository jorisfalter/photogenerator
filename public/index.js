// adjust padding after uploading a pic
// Function to call after a picture is uploaded and processed
function adjustMainPadding() {
  document.querySelector("main").style.paddingTop = "200px"; // Adjust this value to the header's height
  console.log("padding adjusted");
}

// pic upload
const picElement = document.getElementById("file");
if (picElement) {
  document.getElementById("file").addEventListener("change", function (event) {
    adjustMainPadding();

    var imagePreview = document.getElementById("imagePreview");
    var files = event.target.files; // FileList object
    f = files[0];
    console.log(files[0]);

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

const audioElement = document.getElementById("startRecord");
if (audioElement) {
  //// new recording script because ios cannot handle mediarecorder
  let recorder;
  let audioStream;

  // Function to initialize recording
  function initRecording() {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        audioStream = stream;
        // Create a new instance of RecordRTC with the audio stream
        recorder = RecordRTC(stream, {
          type: "audio",
          mimeType: "audio/wav", // Specify desired output format
          recorderType: RecordRTC.StereoAudioRecorder, // For broader compatibility
          numberOfAudioChannels: 1, // Mono audio
          desiredSampRate: 16000, // Optional: Specify sample rate
        });
      })
      .catch((error) => {
        console.error("Error accessing the microphone:", error);
      });
  }

  document.getElementById("startRecord").addEventListener("click", () => {
    if (recorder) {
      recorder.startRecording();
      document.getElementById("startRecord").style.display = "none";
      document.getElementById("stopRecord").style.display = "inline-block";
    } else {
      console.log("Recorder not initialized");
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
    document.getElementById("audioPlayback").style.display = "none";
    document.getElementById("resetRecord").style.display = "none";
    document.getElementById("uploadRecord").style.display = "none";
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

  // Call initRecording to set up
  initRecording();

  //// end recording
}

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
