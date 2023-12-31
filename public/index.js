console.log("The JavaScript file is linked correctly!");

document.getElementById("file").addEventListener("change", function (event) {
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
