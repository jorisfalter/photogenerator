document.getElementById("uploadForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var formData = new FormData(this);
  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => console.log(data))
    .catch((error) => console.error(error));
});
