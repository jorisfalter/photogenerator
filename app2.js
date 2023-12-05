const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const app = express();

// Configure multer (file upload middleware)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Serve static files from 'public' directory
app.use(express.static("public"));

app.post("/upload", upload.single("picture"), (req, res) => {
  // Image is uploaded and now present in req.file.path
  const imagePath = req.file.path;

  // Call Python script with the uploaded image path
  exec(`python3 analyze_image.py "${imagePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).send("Error analyzing image");
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);

    // Send response back to client with the analysis result
    res.send(stdout);
  });
});

// Root route to serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
