const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const path = require("path");
const app = express();
const { spawn } = require("child_process");

app.set("view engine", "ejs"); // Set EJS as the template engine

// // Configure multer (file upload middleware)
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/");
//   },
//   filename: function (req, file, cb) {
//     cb(
//       null,
//       file.fieldname + "-" + Date.now() + path.extname(file.originalname)
//     );
//   },
// });

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({ storage: storage });

// Serve static files from 'public' directory
app.use(express.static("public"));

app.post("/upload", upload.single("picture"), (req, res) => {
  //   const imagePath = req.file.path;

  //   exec(`python3 analyze_image.py "${imagePath}"`, (error, stdout, stderr) => {
  //     if (error) {
  //       console.error(`exec error: ${error}`);
  //       return res.status(500).json({ error: "Error analyzing image" });
  //     }
  //     if (stderr) {
  //       console.error(`stderr: ${stderr}`);
  //     }

  //     try {
  //       const output = JSON.parse(stdout);
  //       res.render("result", {
  //         image_url: output.image_url,
  //         description: output.description,
  //       });
  //     } catch (parseError) {
  //       console.error(`Error parsing stdout: ${parseError}`);
  //       res
  //         .status(500)
  //         .render("error", { error: "Error parsing analysis results" });
  //     }
  //   });

  const imageBuffer = req.file.buffer;
  console.log("going to python");
  const pythonProcess = spawn("python3", ["analyze_image.py"]);

  let stdoutData = "";
  let stderrData = "";

  pythonProcess.stdout.on("data", (data) => {
    stdoutData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`exec error: ${stderrData}`);
      return res.status(500).json({ error: "Error analyzing image" });
    }

    try {
      const output = JSON.parse(stdoutData);
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

  // Write the image buffer to the Python process
  pythonProcess.stdin.write(imageBuffer);
  pythonProcess.stdin.end();
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
