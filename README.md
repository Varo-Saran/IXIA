# iXiA AI Chatbot

## Hugging Face API Configuration

The chat experience can now stream responses from Hugging Face's Inference API when a valid access token is available.

1. Create a `.env` file in the project root (next to `package.json`) and add:
   ```bash
   HUGGINGFACE_TOKEN=hf_your_access_token
   # Optional overrides
   # HUGGINGFACE_MODEL=tiiuae/falcon-7b-instruct
   # HUGGINGFACE_TIMEOUT_MS=20000
   # HUGGINGFACE_BASE_URL=https://api-inference.huggingface.co/models
   ```
2. If you are running purely in the browser without build tooling, expose the token before loading `Ixia.js`:
   ```html
   <script>
     window.HUGGINGFACE_TOKEN = 'hf_your_access_token';
     // Optional: window.HUGGINGFACE_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct';
   </script>
   ```
3. Reload the app. When the token is present, chat requests are sent to the configured Hugging Face model and will automatically fall back to the local scripted responses if the API is unavailable.

> **Security reminder:** Never commit personal access tokens to version control or expose them in production client-side bundles.
