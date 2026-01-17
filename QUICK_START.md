# Quick Start Guide

Get your AI Writing Coach up and running in 10 minutes!

## Part 1: Get Your Claude API Key (2 minutes)

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** in the dashboard
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)
6. Save it somewhere safe (you'll need it in Part 3)

## Part 2: Install the Add-on (5 minutes)

### Step 1: Open Apps Script

1. Open any Google Doc (or create a new one)
2. Click **Extensions** → **Apps Script**
3. A new tab will open with the Apps Script editor

### Step 2: Add the Files

**File 1: appsscript.json**
1. In the left sidebar, you'll see a file called `Code.gs`
2. Click the **⋮** (three dots) next to **Files**
3. Click **Project settings** (gear icon on left)
4. Check the box **Show "appsscript.json" manifest file**
5. Go back to **Editor** (code icon on left)
6. Click on `appsscript.json` in the files list
7. Delete everything and paste the contents from this repo's `appsscript.json`

**File 2: Code.gs**
1. Click on `Code.gs` in the files list
2. Delete everything and paste the contents from this repo's `Code.gs`

**File 3: Sidebar.html**
1. Click the **+** next to **Files**
2. Choose **HTML**
3. Name it `Sidebar`
4. Delete any default content and paste the contents from this repo's `Sidebar.html`

### Step 3: Enable Drive API

1. Click the **+** next to **Services** (in the left sidebar)
2. Scroll to find **Drive API**
3. Select **Drive API** and click **Add**
4. Make sure version is set to **v2**

### Step 4: Save and Authorize

1. Click the **💾 Save** button (or Ctrl+S / Cmd+S)
2. Name your project: **AI Writing Coach**
3. Click **Run** → **onOpen** (at the top)
4. You'll be asked to authorize the script:
   - Click **Review permissions**
   - Choose your Google account
   - Click **Advanced** → **Go to AI Writing Coach (unsafe)**
   - Click **Allow**

### Step 5: Test It

1. Go back to your Google Doc
2. Refresh the page (F5 or Cmd+R)
3. You should now see **AI Writing Coach** in the menu bar!

## Part 3: Configure Your API Key (2 minutes)

### Method 1: Through the Sidebar (Easiest)

1. In your Google Doc, click **AI Writing Coach** → **Open Sidebar**
2. The sidebar will open and ask for your API key
3. Paste your Claude API key from Part 1
4. Click **Save API Key**
5. Done! 🎉

### Method 2: Through Script Properties (Alternative)

1. Go back to the Apps Script editor
2. Click **Project Settings** (gear icon on left)
3. Scroll down to **Script Properties**
4. Click **Add script property**
5. Property name: `CLAUDE_API_KEY`
6. Property value: Paste your API key
7. Click **Save**

## Part 4: Start Using It! (1 minute)

### Try the Chat

1. Open the sidebar: **AI Writing Coach** → **Open Sidebar**
2. Type a question: `"What's the tone of this document?"`
3. Hit Enter or click the send button
4. Claude will respond!

### Try @ Mentions

1. Highlight some text in your document
2. Add a comment (Ctrl+Alt+M / Cmd+Option+M)
3. Type: `@claude make this more concise`
4. Click anywhere to save the comment
5. In the sidebar, click **Process @ Mentions**
6. Claude will reply with a suggested edit!

## Common Issues

### "AI Writing Coach" doesn't appear in the menu

**Fix**:
- Make sure you ran the `onOpen` function in Apps Script
- Refresh your Google Doc (F5)
- Wait a few seconds after refreshing

### "CLAUDE_API_KEY not set" error

**Fix**:
- Double-check you entered the API key correctly
- Make sure it starts with `sk-ant-`
- Try Method 2 above (Script Properties)

### "Drive API not enabled" error

**Fix**:
- Go to Apps Script → Services
- Click + and add Drive API v2
- Save and try again

### Nothing happens when I click buttons

**Fix**:
- Open browser console (F12)
- Look for error messages
- Make sure you authorized the script
- Try refreshing the page

## Next Steps

Once everything is working:

1. **Read the README.md** for detailed feature documentation
2. **Experiment with different prompts** to see what Claude can do
3. **Try both chat mode and @ mentions** to see which you prefer
4. **Check your API usage** at console.anthropic.com

## Tips for Best Results

✅ **Do:**
- Highlight specific text before asking questions
- Use clear, specific commands in @ mentions
- Ask follow-up questions to refine suggestions
- Review Claude's suggestions before applying them

❌ **Don't:**
- Process the same @ mentions multiple times (it costs API credits)
- Share your API key with others
- Expect perfect responses every time (it's AI, not magic!)

---

**You're all set! Happy writing! 📝✨**

Need help? Check the full [README.md](README.md) or open an issue on GitHub.
