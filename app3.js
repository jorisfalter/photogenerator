const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const app = express();

// ... other configurations ...

const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('picture'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const base64Image = imageBuffer.toString('base64');

        const openAiApiKey = process.env.API_KEY; // Ensure your API key is loaded from environment variables

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAiApiKey}`
        };

        const payload = {
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "What’s in this image?"
                        },
                        {
                            type: "image_url",
                            image_url: `data:image/jpeg;base64,${base64Image}`
                        }
                    ]
                }
            ],
            max_tokens: 300
        };

        const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers: headers });

        const descriptionInput = response.data.choices[0].message.content;
        const description = "the following is a description of a drawing made by a child, I would like you to turn it into a photo realistic image, suitable for children: " + descriptionInput;

        // ... logic to handle the description and generate an image ...

        res.render('result', {
            image_url: /* URL of the generated image */,
            description: description
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).render('error', { error: 'Error processing image' });
    }
});

// ... other routes and server start ...
