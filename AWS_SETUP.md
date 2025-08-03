# 🔧 AWS Setup Guide for Claude AI Documentation Generator

This guide will help you set up AWS credentials to use Claude AI for documentation generation.

## Quick Fix

**The error you're seeing means AWS credentials are missing. Here's how to fix it:**

### Step 1: Create Environment File

1. Copy the example file:
   ```bash
   cd server
   cp .env.example .env
   ```

2. Edit the `.env` file with your AWS credentials

### Step 2: Get AWS Credentials

You have several options:

#### Option A: Use AWS CLI (Recommended)
If you have AWS CLI configured:
```bash
aws configure list
```

If configured, your credentials are in `~/.aws/credentials`. You can use those same values.

#### Option B: Create New IAM User
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create a new user with programmatic access
3. Attach the `AmazonBedrockFullAccess` policy
4. Save the Access Key ID and Secret Access Key

#### Option C: Use Environment Variables
Instead of `.env` file, you can set:
```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret" 
export AWS_REGION="us-east-1"
```

### Step 3: Configure Your .env File

Edit `server/.env`:
```env
# Replace with your actual AWS credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...your-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0

# Optional: GitHub token for private repos
GITHUB_TOKEN=ghp_your-github-token

PORT=4000
```

### Step 4: Verify Bedrock Access

Make sure Claude is available in your AWS region:
1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Check if Claude models are available in your region
3. You may need to request access to Claude models

### Step 5: Test the Setup

1. Restart your server:
   ```bash
   npm start
   ```

2. Test the connection:
   ```bash
   curl -X POST http://localhost:4000/api/test-bedrock
   ```

## Troubleshooting

### Error: "No credentials found"
- Check your `.env` file exists in the `server/` directory
- Verify the credentials are correct (no extra spaces)
- Make sure you restarted the server after adding credentials

### Error: "Access denied"
- Your AWS user needs `AmazonBedrockFullAccess` permissions
- Check if Claude models are enabled in your AWS region
- You may need to request model access in Bedrock console

### Error: "Region not supported"
- Claude is available in: `us-east-1`, `us-west-2`, `eu-west-3`
- Update your `AWS_REGION` in `.env`

### Error: "Model not found"
- Make sure you have access to Claude models in Bedrock
- Try the model ID: `us.anthropic.claude-3-5-haiku-20241022-v1:0`

## Alternative: Mock Mode for Testing

If you want to test without AWS, I can create a mock mode that simulates documentation generation:

```env
# Add this to your .env for testing without AWS
MOCK_AI_RESPONSES=true
```

## Cost Considerations

- Claude Haiku costs approximately $0.0002-$0.0003 per 1000 tokens
- Documenting a typical 10-file repository costs ~$0.01-$0.05
- Set up billing alerts in AWS if you're concerned about costs

## Security Notes

- Never commit your `.env` file to git
- The `.env` file is already in `.gitignore`
- Consider using AWS IAM roles instead of access keys for production

## Need Help?

If you're still having issues:
1. Check that your AWS account has Bedrock enabled
2. Verify you're in a supported region
3. Test with a simple AWS CLI command first
4. Consider using the mock mode for initial testing