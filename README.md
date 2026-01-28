# Google Docs AI Writing Coach

A Google Docs add-on that integrates Claude AI to provide intelligent writing feedback and editing assistance directly within your documents.

## Features

### 1. Sidebar Chat Interface
- **Conversational Feedback**: Ask Claude questions about your writing in a chat interface
- **Context-Aware Responses**: Highlight text in your document and ask questions about it
- **Full Document Context**: Claude has access to your entire document for comprehensive feedback
- **Prompt Caching**: Efficient API usage through automatic document caching

### 2. Document Integration with @ Mentions
- **Comment-Based Editing**: @ mention Claude in document comments for smart responses
- **Automatic Intent Detection**: Claude determines whether to suggest edits or provide discussion
- **Batch Processing**: Process multiple @ mentions at once with the "Process @ Mentions" button
- **Two Response Types**:
  - **Suggest Edit**: For directive commands like "rewrite this" or "fix grammar"
  - **Reply in Thread**: For questions like "is this clear?" or "any suggestions?"

## Prerequisites

- A Google account with access to Google Docs
- A Claude API key from Anthropic ([Get one here](https://console.anthropic.com/))
- Basic familiarity with Google Apps Script

## Setup Instructions

### Step 1: Create a New Apps Script Project

1. Open a Google Doc (any doc will work)
2. Go to **Extensions** > **Apps Script**
3. This will open the Apps Script editor

### Step 2: Add the Code Files

1. **Delete the default Code.gs** that appears
2. **Create appsscript.json**:
   - Click the "+" next to Files
   - Select "JSON"
   - Delete the default file if asked, or rename it to `appsscript.json`
   - Copy the contents of `appsscript.json` from this repo

3. **Create Code.gs**:
   - Click the "+" next to Files
   - Select "Script"
   - Name it `Code`
   - Copy the contents of `Code.gs` from this repo

4. **Create Sidebar.html**:
   - Click the "+" next to Files
   - Select "HTML"
   - Name it `Sidebar`
   - Copy the contents of `Sidebar.html` from this repo

### Step 3: Enable Required Services

1. In the Apps Script editor, click the "+" next to **Services**
2. Find and add **Google Drive API** (version v2)
3. Click **Add**

### Step 4: Save and Deploy

1. Click the **Save** icon (disk icon)
2. Name your project (e.g., "AI Writing Coach")
3. Click **Deploy** > **Test deployments**
4. Click **Install**

### Step 5: Configure Your API Key

1. Open your Google Doc
2. Refresh the page
3. You should see **AI Writing Coach** in the menu bar
4. Click **AI Writing Coach** > **Open Sidebar**
5. The sidebar will prompt you to enter your Claude API key
6. Paste your API key and click **Save API Key**

**Alternative Method (for advanced users)**:
- In Apps Script editor, go to **Project Settings** (gear icon)
- Under **Script Properties**, add a property:
  - Property: `CLAUDE_API_KEY`
  - Value: Your Claude API key

## Usage Guide

### Using the Chat Interface

1. **Open the sidebar**: **AI Writing Coach** > **Open Sidebar**

2. **Ask general questions**:
   ```
   "Can you review my introduction for clarity?"
   "What's the tone of this document?"
   "Any suggestions for improving this?"
   ```

3. **Get feedback on specific text**:
   - Highlight text in your document
   - Notice the yellow "Text selected" indicator in the sidebar
   - Ask your question (e.g., "Is this sentence clear?")
   - Claude will consider the highlighted text as the focus

### Using @ Mentions in Comments

1. **Add a comment to your document**:
   - Highlight the text you want feedback on
   - Click the comment icon or press Ctrl+Alt+M (Cmd+Option+M on Mac)

2. **@ Mention Claude**:
   - In the comment, type `@claude` followed by your request
   - Examples:
     - `@claude rewrite this to be more concise`
     - `@claude fix the grammar here`
     - `@claude is this paragraph clear?`
     - `@claude what do you think about this argument?`

3. **Process the mentions**:
   - Click the **Process @ Mentions** button in the sidebar
   - Claude will analyze each @ mention and respond appropriately:
     - **Commands** (rewrite, fix, improve) → Suggested edit in comment reply
     - **Questions** (is this clear?, what do you think?) → Discussion reply

### Intent Detection

Claude automatically detects your intent:

- **Commands/Directives** → `SUGGEST_EDIT`
  - "rewrite this"
  - "make this more formal"
  - "fix grammar"
  - "simplify this"

- **Questions/Discussion** → `REPLY_TO_COMMENT`
  - "is this clear?"
  - "what do you think?"
  - "any suggestions?"
  - "how does this sound?"

## How It Works

### Prompt Caching

The add-on uses Claude's prompt caching feature to minimize API costs:

1. **First request**: The full document is sent to Claude and cached
2. **Subsequent requests**: Only the new message is sent; the cached document is reused
3. **Auto-refresh**: Cache refreshes automatically if the document changes significantly

This can reduce token costs by up to 90% for follow-up questions!

### Architecture

```
┌─────────────────┐
│  Google Docs    │
│                 │
│  ┌───────────┐  │
│  │ Sidebar   │  │ ← React + Tailwind UI
│  │ (React)   │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ Apps      │  │ ← Google Apps Script
│  │ Script    │  │   (Code.gs)
│  └─────┬─────┘  │
└────────┼────────┘
         │
         ▼
   ┌─────────────┐
   │  Claude API │  ← Anthropic API
   │  (Cached)   │
   └─────────────┘
```

## Limitations & Notes

### Current Limitations

1. **Comment Suggestions**: Google Docs API doesn't support programmatic suggestion mode, so edit suggestions are posted as comment replies rather than actual "suggestion edits" in the document

2. **Anchored Text Extraction**: The current implementation uses a simplified method to get anchored text. For production use, you'd want more robust anchor parsing

3. **Drive API v2**: Uses Drive API v2 for comment access (v3 is recommended for production)

4. **No Streaming**: Responses appear all at once rather than streaming (Apps Script limitation)

### Best Practices

- **API Costs**: Each chat message uses tokens. Be mindful of API usage
- **Cache Efficiency**: The cache stays active for ~5 minutes. Multiple questions in quick succession are very cost-efficient
- **Document Size**: Very large documents (100k+ words) may hit token limits
- **Rate Limits**: Anthropic API has rate limits; if processing many @ mentions, you may need delays

### Security Notes

- **API Key Storage**: Your API key is stored in Script Properties (accessible only to you)
- **Document Privacy**: Your document content is sent to Anthropic's API. Review Anthropic's privacy policy
- **Sharing**: If you share your document, others won't have access to your API key

## Troubleshooting

### "CLAUDE_API_KEY not set" Error

**Solution**: Set your API key through the sidebar or Script Properties

### "Drive API not enabled" Error

**Solution**: Enable Google Drive API in Services (see Step 3 above)

### No @ mentions being processed

**Possible causes**:
- Make sure you're using `@claude` (lowercase)
- Ensure the comment hasn't been replied to already by the bot
- Check if the API key is valid

### Chat not responding

**Possible causes**:
- Check browser console for errors (F12)
- Verify API key is set correctly
- Check Anthropic API status

## Development & Customization

### Changing the @ Mention Trigger

Edit `Code.gs`:
```javascript
const BOT_MENTION = '@claude'; // Change to your preferred trigger
```

### Adjusting the AI Model

Edit `Code.gs`:
```javascript
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929'; // Change model here
```

Available models:
- `claude-sonnet-4-5-20250929` (recommended, latest Sonnet 4.5)
- `claude-opus-4-5-20251101` (most capable, slower/expensive)
- `claude-3-haiku-20240307` (fastest, cheaper)

### Customizing the System Prompt

Edit the `callClaude()` and `callClaudeForComment()` functions in `Code.gs` to adjust how Claude responds.

## API Costs

Approximate costs with Claude 3.5 Sonnet:

- **With caching** (follow-up questions): ~$0.001-0.003 per message
- **Without caching** (first message): ~$0.01-0.03 per message
- **@ mention processing**: ~$0.01-0.05 per comment

A typical document session (5-10 questions) costs ~$0.05-0.15.

## Credits

Built with:
- [Claude AI](https://www.anthropic.com/claude) by Anthropic
- [React](https://react.dev/) for the UI
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Google Apps Script](https://developers.google.com/apps-script) for integration

## License

This is a personal/hobbyist project. Feel free to use and modify as needed.

## Support

This is a hobby project with no official support, but feel free to:
- Open issues for bugs
- Submit pull requests for improvements
- Fork and customize for your needs

---

**Happy Writing! 📝✨**
