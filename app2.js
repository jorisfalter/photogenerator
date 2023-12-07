const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const app = express();

app.set("view engine", "ejs"); // Set EJS as the template engine

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
  const imagePath = req.file.path;

  exec(`python3 analyze_image.py "${imagePath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: "Error analyzing image" });
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }

    try {
      const output = JSON.parse(stdout);
      res.render("result", {
        image_url: output.image_url,
        description: output.description,
      });
    } catch (parseError) {
      console.error(`Error parsing stdout: ${parseError}`);
      res
        .status(500)
        .render("error", { error: "Error parsing analysis results" });
    }
  });
});

// Root route to serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3000; // Fallback to 3000 if process.env.PORT is not set
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
