# AI-Juniors Photo Generator

A web application that helps primary school children create AI-generated images in a safe, educational environment. Students can generate images by uploading drawings or recording voice descriptions.

## 🌟 Features

- **Drawing to Image**: Upload a hand-drawn picture and watch AI transform it into a photorealistic image
- **Voice to Image**: Record your thoughts and ideas, and AI will generate an image from your description
- **Child-Friendly UI**: Clean, intuitive interface designed for young learners
- **Real-time Progress**: Animated loading spinner with countdown timer
- **Mobile Responsive**: Works seamlessly on tablets, phones, and desktops
- **Image Management**: Download or share generated images

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Template Engine**: EJS
- **AI Services**: OpenAI (GPT-4o for vision, DALL-E 3 for image generation)
- **Session Management**: express-session
- **File Uploads**: Multer
- **Audio Processing**: RecordRTC

## 📋 Prerequisites

- Node.js 18.16.1 or higher
- OpenAI API key with access to GPT-4o and DALL-E 3

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd photogenerator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   SESSION_SECRET=your_session_secret_here
   ```

4. **Start the development server**

   ```bash
   npm start
   ```

5. **Open your browser**

   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
photogenerator/
├── public/                 # Static assets
│   ├── style.css          # Main stylesheet
│   ├── index.js           # Client-side JavaScript
│   ├── *.svg, *.png       # Icons and images
│   └── *.webp             # Background images
├── views/                 # EJS templates
│   ├── partials/          # Reusable components
│   │   ├── head.ejs
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── index.ejs          # Homepage
│   ├── image.ejs          # Image generation options
│   ├── inputPic.ejs       # Drawing upload page
│   ├── inputAudio.ejs     # Voice recording page
│   ├── result.ejs         # Generated image display
│   ├── about.ejs          # About page
│   ├── donate.ejs         # Donation page
│   ├── FAQ.ejs            # FAQ page
│   └── error.ejs          # Error page
├── testpics/              # Test images
├── app2.js                # Main Express application
├── package.json           # Dependencies and scripts
└── .env                   # Environment variables (not in git)
```

## 🎯 How It Works

### Drawing to Image Flow

1. Student uploads a hand-drawn picture
2. Image is sent to OpenAI's GPT-4o vision model for description
3. Description is enhanced with prompt engineering
4. DALL-E 3 generates a photorealistic image based on the description
5. Result is displayed with download/share options

### Voice to Image Flow

1. Student records their voice describing an image
2. Audio is converted to text using OpenAI's Whisper
3. Text is used as a prompt for DALL-E 3
4. Generated image is displayed with options

## 🔧 Environment Variables

| Variable         | Description                   | Required |
| ---------------- | ----------------------------- | -------- |
| `OPENAI_API_KEY` | Your OpenAI API key           | Yes      |
| `SESSION_SECRET` | Secret for session encryption | Yes      |

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome)

## 🚢 Deployment

### Heroku

1. **Create a Heroku app**

   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**

   ```bash
   heroku config:set OPENAI_API_KEY=your_key
   heroku config:set SESSION_SECRET=your_secret
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Render / Railway

1. Connect your GitHub repository
2. Set environment variables in the dashboard
3. Deploy automatically on push

### Important Notes

- No build step required - this is a traditional Node.js app
- The start command (`node app2.js`) is specified in `package.json`
- Make sure to set all environment variables before deployment

## 🎨 Styling & Customization

The UI uses a bright, colorful design with:

- Custom color scheme (primary: `#f4ce75`)
- Background with AI-generated images mosaic
- Responsive design with mobile-first approach
- Accessible components with proper contrast

To customize colors, edit the CSS variables in `public/style.css`.

## 🔒 Security Features

- Session-based state management
- File upload validation
- Error handling for API failures
- Safe prompt engineering to ensure child-appropriate content

## 📝 License

ISC

## 👥 Contributing

This is an educational project for AI-Juniors. For questions or contributions, please contact the project maintainer.

## 🙏 Acknowledgments

- OpenAI for GPT-4o and DALL-E 3 APIs
- RecordRTC for audio recording functionality
- The educational community for feedback and support

## 📞 Support

For issues or questions, please open an issue on the GitHub repository or visit [ai-juniors.com](https://ai-juniors.com)

---

**Made with ❤️ for education by AI-Juniors**
