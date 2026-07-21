require("dotenv").config();

const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const app = express();
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios"); // for audio
const crypto = require("crypto");
const fs = require("fs");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const openAiApiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
const sessionKey = process.env.SESSION_SECRET || process.env.SESSION_KEY;

if (!openAiApiKey || !sessionKey) {
  throw new Error("OPENAI_API_KEY/API_KEY and SESSION_SECRET/SESSION_KEY are required");
}

app.set("view engine", "ejs"); // Set EJS as the template engine
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.static("public"));

const session = require("express-session");
const MemoryStore = require("memorystore")(session);
app.use(
  session({
    secret: sessionKey,
    store: new MemoryStore({ checkPeriod: 60 * 60 * 1000 }),
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000,
    },
  })
);

const tasks = {}; // List of tasks which are brought to the background. This would ideally be a persistent storage solution
const taskTtlMs = 60 * 60 * 1000;
const maxTasks = 12;
const generatedImageDirectory = "/tmp/ai-juniors-images";

fs.mkdirSync(generatedImageDirectory, { recursive: true });

function deleteTask(taskId) {
  const task = tasks[taskId];
  if (task && task.imagePath) {
    fs.unlink(task.imagePath, (error) => {
      if (error && error.code !== "ENOENT") {
        logOperationalError("Generated image cleanup failed", error);
      }
    });
  }
  delete tasks[taskId];
}

function pruneTasks() {
  const now = Date.now();
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.expiresAt <= now) {
      deleteTask(taskId);
    }
  }

  const taskIds = Object.keys(tasks);
  for (const taskId of taskIds.slice(0, Math.max(0, taskIds.length - maxTasks))) {
    deleteTask(taskId);
  }
}

setInterval(pruneTasks, 10 * 60 * 1000).unref();

const uploadLimits = { fileSize: 10 * 1024 * 1024, files: 1 };
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits,
  fileFilter: (_req, file, callback) => {
    callback(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype));
  },
});
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: uploadLimits,
  fileFilter: (_req, file, callback) => {
    callback(null, /^audio\/[a-z0-9.+-]+$/i.test(file.mimetype));
  },
});
const generationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many generation requests. Please try again later." },
});
const openai = new OpenAI({ apiKey: openAiApiKey });

function logOperationalError(stage, error) {
  const name = error && error.name ? error.name : "Error";
  const status = error && error.status ? error.status : "unknown";
  const code = error && error.code ? error.code : "unknown";
  console.error(`${stage}: ${name} status=${status} code=${code}`);
}

// call openai api to generate an Image - used both by Audio and Text
async function generateImage(taskId, promptText) {
  console.log("starting to generate an image");
  
  try {
    const response = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt: promptText,
      n: 1,
      size: "1024x1024",
      quality: "low",
    });

    const imageBase64 = response.data[0] && response.data[0].b64_json;
    if (!imageBase64) {
      throw new Error("Image provider returned no image data");
    }

    const imagePath = path.join(generatedImageDirectory, `${taskId}.png`);
    await fs.promises.writeFile(imagePath, Buffer.from(imageBase64, "base64"));
    const imageUrl = `/generated/${taskId}`;
    tasks[taskId] = {
      status: "completed",
      imageUrl,
      imagePath,
      imageMimeType: "image/png",
      expiresAt: Date.now() + taskTtlMs,
    };
    console.log("Image generation completed");

    return imageUrl;
  } catch (error) {
    logOperationalError("Image generation failed", error);
    // Update task status to failed
    tasks[taskId] = {
      status: "failed",
      imageUrl: null,
      error: "Image generation failed",
      expiresAt: Date.now() + taskTtlMs,
    };
    throw error;
  }
}

///////////////////// Pics ////////////////////////////
// Describe the pic first
app.post("/upload", generationLimiter, imageUpload.single("picture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A JPEG, PNG, or WebP image is required" });
    }
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    };

    // create the payload to send it to openai to get a description
    const payload = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this drawing, without mentioning it's a drawing. Do not use the words: whimsical and childlike",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    };

    // Call openai to ask a description of the image
    const response = await openai.chat.completions.create(payload, {
      headers: headers,
    });

    const descriptionInput = response.choices[0].message.content;
    const description =
      "Generate a photo realistic image of:" 
      +descriptionInput+ 
      "Convert this description into a real-life interpretation. Make it look like it could be real.";

    // Start on the image generation
    // Generate a unique task ID
    const taskId = crypto.randomUUID();

    // Save the task information in a database or in-memory store, For demonstration purposes, we're using an in-memory object
    pruneTasks();
    tasks[taskId] = {
      status: "pending",
      imageUrl: null,
      expiresAt: Date.now() + taskTtlMs,
    };

    // Call function to generate an image from text
    // const imageGenResponse = await
    void generateImage(taskId, description).catch(() => {});

    // Respond immediately with the task ID
    res.json({ taskId: taskId });
  } catch (error) {
    logOperationalError("Image upload processing failed", error);
    res.status(500).json({ error: "Error processing image" });
  }
});

// polling
app.get("/status/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks[taskId];

  if (task) {
    res.json({ 
      status: task.status, 
      imageUrl: task.imageUrl,
      error: task.error || null
    });
  } else {
    res.status(404).json({ error: "Task not found" });
  }
});

app.get("/generated/:taskId", (req, res) => {
  pruneTasks();
  const task = tasks[req.params.taskId];
  if (!task || task.status !== "completed" || !task.imagePath) {
    return res.status(404).send("Generated image not found.");
  }
  res.type(task.imageMimeType || "image/png");
  res.sendFile(task.imagePath);
});

app.get("/result/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks[taskId];

  // Check if task exists first
  if (!task) {
    return res.status(404).render("error", {
      error: "Task not found.",
    });
  }

  // image_url_pass = task.imageUrl;
  req.session.imageTaskId = taskId;
  // console.log("req.session.imageUrl pic");
  // console.log(req.session.imageUrl);

  if (task.status === "completed") {
    res.render("result", {
      image_url: task.imageUrl,
      description: "picInputNoDescription", // the results page expects a description variable for the audio, so we send a hardcoded string
      // description: task.description, // Assuming you stored the description as well
    });
  } else if (task.status === "failed") {
    res.status(500).render("error", {
      error: `Image generation failed: ${task.error || "Unknown error"}`,
    });
  } else {
    res.status(404).render("error", {
      error: "No completed task found or task not yet completed.",
    });
  }
});

///////////////////// General stuff - should move this down ////////////////////////////
// Root route to serve the index.html file
app.get("/", (req, res) => {
  // res.sendFile(path.join(__dirname, "public", "index.html"));
  res.render("index");
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/test", (req, res) => {
  res.render("result");
});

app.get('/FAQ', (req, res) => {
  res.render("FAQ");
});

app.get('/about', (req, res) => {
  res.render("about");
});

app.get('/error', (req, res) => {
  res.render("error");
});


// Start server
const PORT = process.env.PORT || 3000; // Fallback to 3000 if process.env.PORT is not set
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

///////////////////// Audio ////////////////////////////
// Convert speech to text
async function convertSpeechToText(audioBuffer, fileName) {
  const formData = new FormData();
  // Append the buffer directly, specifying filename and content type
  formData.append("file", audioBuffer, {
    filename: fileName,
    contentType: "audio/mpeg",
  });
  formData.append("model", "whisper-1"); // Make sure this model name is up to date

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${openAiApiKey}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    logOperationalError("Audio transcription failed", error);
  }
}

// Generate an image from text - only used for audio
async function generateImageFromText(req, textPrompt) {
  try {
    const taskId = crypto.randomUUID();
    pruneTasks();
    tasks[taskId] = {
      status: "pending",
      imageUrl: null,
      expiresAt: Date.now() + taskTtlMs,
    };
    const imageUrl = await generateImage(taskId, textPrompt);
    req.session.imageTaskId = taskId;
    return imageUrl;
  } catch (error) {
    logOperationalError("Audio image generation failed", error);
    throw error;
  }
}

//// audio endpoint - what is this again?
app.post("/upload-audio", generationLimiter, audioUpload.single("audioFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  try {
    const textObject = await convertSpeechToText(req.file.buffer, "aFileName");
    const text = textObject.text;
    const image_url = await generateImageFromText(req, text);
    console.log("we will now render the image");
    // Optionally, further process the text or directly send it back
    // res.json({ success: true, audioInput: text, imageUrl: image_url });
    // res.render("result", {
    //   image_url: image_url,
    //   description: "dit komt later",
    // });
    res.json({
      success: true,
      image_url: image_url,
      description: text,
    });
  } catch (error) {
    logOperationalError("Audio upload processing failed", error);
    res.status(500).send("Error processing audio file.");
  }
});

// only for audio
app.get("/result", (req, res) => {
  // Extract query parameters
  const { image_url, description } = req.query;
  console.log("we're now in the result page");
  res.render("result", {
    image_url: image_url,
    description: description,
  });
});

app.get("/inputPic", (req, res) => {
  res.render("inputPic");
});

app.get("/inputAudio", (req, res) => {
  res.render("inputAudio");
});

app.get("/chat", (req, res) => {
  res.render("chat");
});

app.get("/image", (req, res) => {
  res.render("image");
});

app.get("/donate", (req, res) => {
  res.render("donate");
});

// to download the pics
app.get("/fetch-openai-image", async (req, res) => {
  console.log("we're now in the fetch");
  const task = tasks[req.session.imageTaskId];

  try {
    if (!task || task.status !== "completed" || !task.imagePath) {
      return res.status(404).send("No generated image is available.");
    }
    res.type(task.imageMimeType || "image/png");
    res.sendFile(task.imagePath);
  } catch (error) {
    logOperationalError("Generated image fetch failed", error);
    res.status(500).send("Error fetching image");
  }
});

// Route to serve the FAQ page
app.get('/FAQ', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'FAQ.html'));
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(413).json({ error: "Upload is too large" });
  }
  console.error("Unhandled request error:", error.name);
  return res.status(500).json({ error: "Unexpected server error" });
});
