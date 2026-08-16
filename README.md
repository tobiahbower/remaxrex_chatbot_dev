# RE/MAX Rex Chatbot Development

This repository contains the development code for the RE/MAX Rex AI chatbot integration.

## Project Structure

- `remaxrex.com/` - Main website files
  - `worker/` - Cloudflare Worker for chatbot backend
  - `assets/` - Chat widget CSS and JavaScript
  - `data/` - Knowledge base files (markdown and JSON)
- `mail.remaxrex.com/` - Email service files
- `remaxrex.remaxrex.com/` - Agent portal files
- `rex-fl.remax.com/` - Property listing platform files

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm
- Cloudflare account with Workers AI enabled
- Wrangler CLI installed globally: `npm install -g wrangler`

### Worker Setup

1. **Navigate to the worker directory:**
   ```bash
   cd remaxrex.com/worker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Cloudflare Workers:**
   - Login to Cloudflare: `wrangler login`
   - Update `wrangler.toml` with your Cloudflare account details if needed

4. **Deploy the worker:**
   ```bash
   npm run deploy
   ```

### Frontend Integration

The chat widget is already integrated into `remaxrex.com/index.html`. The configuration is set up to point to the deployed Cloudflare Worker endpoint.

To update the endpoint:
1. Edit `remaxrex.com/index.html`
2. Find the `REMAXREX_CHAT_CONFIG` script tag
3. Update the `endpoint` URL to your deployed worker URL

### Knowledge Base

The knowledge base is located in `remaxrex.com/data/`:
- `knowledge.md` - Main knowledge content in markdown format
- `knowledge.json` - Configuration for retrieval mode

To update the knowledge base:
1. Edit `remaxrex.com/data/knowledge.md`
2. Re-deploy the worker to apply changes
3. For production, deploy these files to your web server at `https://remaxrex.com/data/`

### Local Development

To test the chatbot locally:
1. Deploy the worker first (required for API access)
2. Use Live Server or similar to serve `remaxrex.com/index.html`
3. The worker is configured to allow requests from localhost ports 5500, 3000, and 8000

## Features

- **AI-powered chatbot** using Cloudflare Workers AI (Llama 3.2)
- **Knowledge base** with company information, services, and agents
- **Markdown rendering** for formatted responses
- **Property search referrals** to rex-fl.remax.com
- **Responsive design** with RE/MAX branding

## Deployment

### Worker Deployment
```bash
cd remaxrex.com/worker
npm run deploy
```

### Knowledge Base Deployment
For production, upload the contents of `remaxrex.com/data/` to your web server at the `/data/` path.

## Maintenance

- Update `knowledge.md` when company information changes
- Re-deploy worker after knowledge base updates
- Monitor Cloudflare Workers logs for errors
- Update listing count in knowledge base periodically

## Support

For issues or questions, contact:
- Email: info@remaxrex.com
- Phone: 1-561 220 1520
