require("dotenv").config();

const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const app = express();
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios"); // for audio
const crypto = require("crypto");
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
const maxTasks = 200;

function pruneTasks() {
  const now = Date.now();
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.expiresAt <= now) {
      delete tasks[taskId];
    }
  }

  const taskIds = Object.keys(tasks);
  for (const taskId of taskIds.slice(0, Math.max(0, taskIds.length - maxTasks))) {
    delete tasks[taskId];
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

// call openai api to generate an Image - used both by Audio and Text
async function generateImage(taskId, promptText) {
  console.log("starting to generate an image");
  
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: promptText,
      n: 1,
      size: "1024x1024",
    });

    // Update the task with the result
    const imageUrl = response.data[0].url;
    tasks[taskId] = {
      status: "completed",
      imageUrl,
      expiresAt: Date.now() + taskTtlMs,
    };
    console.log("Image generation completed for task:", taskId);

    return response;
  } catch (error) {
    console.error("Error generating image:", error);
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
    generateImage(taskId, description);

    // Respond immediately with the task ID
    res.json({ taskId: taskId });
  } catch (error) {
    console.error("Error:", error);
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
  req.session.imageUrl = task.imageUrl;
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
    if (error.response) {
      console.log("axios foutje");
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("OpenAI transcription failed with status", error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error", error.message);
    }
  }
}

// Generate an image from text - only used for audio
async function generateImageFromText(req, textPrompt) {
  try {
    // Call function to generate an image from text
    const imageGenResponse = await generateImage("dummy_taskID", textPrompt);

    const imageUrl = imageGenResponse.data[0].url;
    req.session.imageUrl = imageUrl;
    return imageUrl;
  } catch (error) {
    console.error("Error generating image from text:", error);
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
    console.error("Error processing audio file:", error);
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
  // Get the image URL from query params or send it in the request
  console.log("we're now in the fetch");
  const imageUrlSession = req.session.imageUrl;

  try {
    if (!imageUrlSession) {
      return res.status(404).send("No generated image is available.");
    }
    const parsedUrl = new URL(imageUrlSession);
    if (
      parsedUrl.protocol !== "https:" ||
      !parsedUrl.hostname.endsWith(".blob.core.windows.net")
    ) {
      return res.status(400).send("Invalid generated image URL.");
    }
    const response = await fetch(imageUrlSession);
    if (!response.ok) {
      throw new Error(`Image provider returned HTTP ${response.status}`);
    }
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Forward the image content type and buffer
    res.type(response.headers.get("content-type"));
    res.send(imageBuffer);
  } catch (error) {
    console.error("Error fetching image:", error);
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
