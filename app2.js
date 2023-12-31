require("dotenv").config();

const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const app = express();
const OpenAI = require("openai");
const path = require("path");

app.set("view engine", "ejs"); // Set EJS as the template engine

app.use(express.static("public"));

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: multer.memoryStorage() });
const openAiApiKey = process.env.API_KEY; // Ensure your API key is loaded from environment variables
const openai = new OpenAI({ apiKey: openAiApiKey });

app.post("/upload", upload.single("picture"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString("base64");

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    };

    const payload = {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "can you describe this drawing?",
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

    const response = await openai.chat.completions.create(payload, {
      headers: headers,
    });

    const descriptionInput = response.choices[0].message.content;
    console.log(descriptionInput);
    const description =
      "the following is a description of a drawing made by a child, I would like you to turn it into a photo realistic image, suitable for children: " +
      descriptionInput;

    // ... logic to handle the description and generate an image ...
    const imageGenResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: description,
      n: 1,
      size: "1024x1024",
    });
    image_url = imageGenResponse.data[0].url;

    res.render("result", {
      image_url: image_url,
      description: description,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).render("error", { error: "Error processing image" });
  }
});

// Root route to serve the index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/test", (req, res) => {
  res.render("result-test");
});

// Start server
const PORT = process.env.PORT || 3000; // Fallback to 3000 if process.env.PORT is not set
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
