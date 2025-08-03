# Node.js API Server

Express.js server that handles documentation generation using AWS Bedrock and GitHub integration.

## Files

- `server.js` - Main Express server
- `documentationGenerator.js` - Core documentation generation logic
- `services/` - Service modules for GitHub, chat, and conversation handling

## Running

```bash
cd node-api
npm install
npm start
```

## Environment Variables

Set these in `../config/.env`:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY` 
- `AWS_REGION`
- `BEDROCK_MODEL_ID`
- `GITHUB_TOKEN`
- `PORT`