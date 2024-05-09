require("dotenv").config();

const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const app = express();
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios"); // for audio
const fs = require("fs");
const fetch = require("node-fetch");
const uuid = require("uuid");

app.set("view engine", "ejs"); // Set EJS as the template engine

app.use(express.static("public"));

const session = require("express-session");
app.use(
  session({
    secret: process.env.SESSION_KEY || "your secret key", // update this!
    resave: false,
    saveUninitialized: true,
    // cookie: { secure: true }, // turn off for local
  })
);

const tasks = {}; // List of tasks which are brought to the background. This would ideally be a persistent storage solution

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });
const openAiApiKey = process.env.API_KEY;
const openai = new OpenAI({ apiKey: openAiApiKey });
let image_url_pass; // variable to pass the image url to the download

// call openai api to generate an Image - used both by Audio and Text
async function generateImage(taskId, promptText) {
  console.log("starting to generate an image");
  // in the new offloaded process, I should add a "try" here

  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: promptText,
    n: 1,
    size: "1024x1024",
  });

  // Update the task with the result
  const imageUrl = response.data[0].url;
  tasks[taskId] = { status: "completed", imageUrl: imageUrl };
  // console.log("tasks");
  // console.log(taskId);
  // console.log(tasks[taskId]);

  return response;
}

///////////////////// Pics ////////////////////////////
// Describe the pic first
app.post("/upload", upload.single("picture"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    };

    // create the payload to send it to openai to get a description
    const payload = {
      model: "gpt-4-vision-preview",
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
              image_url: `data:image/jpeg;base64,${base64Image}`,
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
    console.log(descriptionInput);
    const description =
      "Generate a photo realistic image of:" 
      +descriptionInput+ 
      "Convert this description into a real-life interpretation. Make it look like it could be real.";

    // Start on the image generation
    // Generate a unique task ID
    const taskId = uuid.v4(); // Ensure you have 'uuid' installed and imported

    // Save the task information in a database or in-memory store, For demonstration purposes, we're using an in-memory object
    tasks[taskId] = { status: "pending", imageUrl: null };

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
    res.json({ status: task.status, imageUrl: task.imageUrl });
  } else {
    res.status(404).json({ error: "Task not found" });
  }
});

app.get("/result/:taskId", (req, res) => {
  const taskId = req.params.taskId;
  const task = tasks[taskId];

  // image_url_pass = task.imageUrl;
  req.session.imageUrl = task.imageUrl;
  // console.log("req.session.imageUrl pic");
  // console.log(req.session.imageUrl);

  if (task && task.status === "completed") {
    res.render("result", {
      image_url: task.imageUrl,
      description: "picInputNoDescription", // the results page expects a description variable for the audio, so we send a hardcoded string
      // description: task.description, // Assuming you stored the description as well
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

app.get("/test", (req, res) => {
  res.render("result");
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
    console.log(response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log("axios foutje");
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error", error.message);
    }
    console.error(error.config);
  }
}

// Generate an image from text - only used for audio
async function generateImageFromText(req, textPrompt) {
  try {
    // Call function to generate an image from text
    const imageGenResponse = await generateImage("dummy_taskID", textPrompt);

    image_url = imageGenResponse.data[0].url;
    // image_url_pass = image_url;
    req.session.imageUrl = image_url;
    console.log("req.session.imageUrl audio");
    console.log(req.session.imageUrl);

    return image_url;
  } catch (error) {
    console.error("Error generating image from text:", error);
    throw error;
  }
}

//// audio endpoint - what is this again?
app.post("/upload-audio", upload.single("audioFile"), async (req, res) => {
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
  console.log(req.session.imageUrl);
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

// to download the pics
app.get("/fetch-openai-image", async (req, res) => {
  // Get the image URL from query params or send it in the request
  console.log("we're now in the fetch");
  console.log(req.session.imageUrl);
  // const imageUrl = image_url_pass;
  const imageUrlSession = req.session.imageUrl;
  console.log("imageUrlSession:");
  console.log(imageUrlSession);

  try {
    const response = await fetch(imageUrlSession);
    const imageBuffer = await response.buffer();

    // Forward the image content type and buffer
    res.type(response.headers.get("content-type"));
    res.send(imageBuffer);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).send("Error fetching image");
  }
});
