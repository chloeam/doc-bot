/**
 * Google Docs AI Writing Coach Add-on
 * Integrates Claude API for conversational feedback and document editing
 */

// Configuration
const CLAUDE_API_KEY = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const BOT_MENTION = '@claude'; // The mention trigger in comments

// Cached context storage
let documentCache = {
  docId: null,
  content: null,
  cacheControl: null,
  lastModified: null
};

/**
 * Adds menu item to Google Docs on open
 */
function onOpen() {
  DocumentApp.getUi()
    .createMenu('AI Writing Coach')
    .addItem('Open Sidebar', 'showSidebar')
    .addToUi();
}

/**
 * Opens the sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('AI Writing Coach')
    .setWidth(400);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Gets the full document text and structure
 */
function getDocumentContent() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const text = body.getText();

  return {
    text: text,
    title: doc.getName(),
    docId: doc.getId(),
    lastModified: new Date().getTime()
  };
}

/**
 * Gets the currently selected/highlighted text
 */
function getSelectedText() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();

  if (!selection) {
    return null;
  }

  const elements = selection.getRangeElements();
  let selectedText = '';

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.getElement().editAsText) {
      const text = element.getElement().asText().getText();
      if (element.isPartial()) {
        selectedText += text.substring(element.getStartOffset(), element.getEndOffsetInclusive() + 1);
      } else {
        selectedText += text;
      }
    }
  }

  return selectedText || null;
}

/**
 * Calls Claude API with prompt caching
 * @param {string} userMessage - The user's message
 * @param {string} selectedText - Currently highlighted text (optional)
 * @param {boolean} forceRefresh - Force refresh the cache
 */
function callClaude(userMessage, selectedText, forceRefresh) {
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY not set. Please set it in Script Properties.');
  }

  const docContent = getDocumentContent();

  // Check if we need to refresh cache
  const needsRefresh = forceRefresh ||
                       !documentCache.docId ||
                       documentCache.docId !== docContent.docId ||
                       !documentCache.content ||
                       (docContent.lastModified - documentCache.lastModified) > 5000; // 5 seconds threshold

  // Build the system message with document context
  const systemMessages = [];

  if (needsRefresh) {
    // Create cached system message with full document
    systemMessages.push({
      type: 'text',
      text: `You are an AI writing coach integrated into Google Docs. You provide helpful, constructive feedback on writing.

DOCUMENT CONTEXT:
Title: ${docContent.title}

Full Document Text:
${docContent.text}

---

When responding to chat messages, be conversational and helpful. Provide specific suggestions and explain your reasoning.`,
      cache_control: { type: 'ephemeral' }
    });

    // Update cache
    documentCache = {
      docId: docContent.docId,
      content: docContent.text,
      lastModified: docContent.lastModified,
      cacheControl: true
    };
  } else {
    // Use existing cached context
    systemMessages.push({
      type: 'text',
      text: `You are an AI writing coach integrated into Google Docs. You provide helpful, constructive feedback on writing.

DOCUMENT CONTEXT:
Title: ${docContent.title}

Full Document Text:
${documentCache.content}

---

When responding to chat messages, be conversational and helpful. Provide specific suggestions and explain your reasoning.`,
      cache_control: { type: 'ephemeral' }
    });
  }

  // Build user message
  let userMessageText = '';
  if (selectedText) {
    userMessageText = `[User has highlighted the following text in the document:]
"${selectedText}"

[User's question:]
${userMessage}`;
  } else {
    userMessageText = userMessage;
  }

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemMessages,
    messages: [
      {
        role: 'user',
        content: userMessageText
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(CLAUDE_API_URL, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode !== 200) {
    Logger.log('Claude API Error: ' + responseBody);
    throw new Error('Claude API returned error: ' + responseCode);
  }

  const result = JSON.parse(responseBody);

  return {
    response: result.content[0].text,
    usage: result.usage,
    cachedTokens: result.usage.cache_read_input_tokens || 0
  };
}

/**
 * Handles chat message from sidebar
 * @param {string} message - User's message
 * @param {boolean} hasSelection - Whether user has text selected
 */
function handleChatMessage(message, hasSelection) {
  try {
    const selectedText = hasSelection ? getSelectedText() : null;
    const result = callClaude(message, selectedText, false);

    return {
      success: true,
      response: result.response,
      selectedText: selectedText,
      usage: result.usage
    };
  } catch (error) {
    Logger.log('Error in handleChatMessage: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Gets all comments from the document
 */
function getAllComments() {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  try {
    // Use Drive API v3 to get comments
    const response = Drive.Comments.list(docId, {
      fields: 'comments(id,content,anchor,replies,resolved)'
    });

    Logger.log('Retrieved ' + (response.comments ? response.comments.length : 0) + ' comments');
    return response.comments || [];
  } catch (error) {
    Logger.log('Error getting comments: ' + error.toString());
    // Check if it's a Drive API not enabled error
    if (error.toString().indexOf('Drive') !== -1 || error.toString().indexOf('not found') !== -1) {
      throw new Error('Drive API not enabled. Please enable Drive API in Advanced Services.');
    }
    return [];
  }
}

/**
 * Gets the text that a comment is anchored to
 * @param {string} anchor - The comment anchor data
 */
function getAnchoredText(anchor) {
  if (!anchor) return null;

  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();

  try {
    // Parse anchor to get position
    // This is simplified - actual implementation would need to parse the anchor structure
    const text = body.getText();

    // For MVP, return a snippet around the comment
    // In production, you'd parse the actual anchor positions
    return text.substring(0, 200) + '...'; // Placeholder
  } catch (error) {
    Logger.log('Error getting anchored text: ' + error.toString());
    return null;
  }
}

/**
 * Processes @ mentions in comments
 */
function processAtMentions() {
  if (!CLAUDE_API_KEY) {
    return {
      success: false,
      error: 'CLAUDE_API_KEY not set. Please set it in Script Properties.'
    };
  }

  try {
    const comments = getAllComments();
    const docContent = getDocumentContent();
    const results = [];

    Logger.log('=== Processing @ Mentions ===');
    Logger.log('Total comments found: ' + comments.length);

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      Logger.log('\n--- Comment ' + (i+1) + ' (ID: ' + comment.id + ') ---');
      Logger.log('Content preview: ' + (comment.content ? comment.content.substring(0, 100) : 'null'));

      // Check if comment mentions the bot
      if (!comment.content || comment.content.toLowerCase().indexOf(BOT_MENTION.toLowerCase()) === -1) {
        Logger.log('Skipping: No @claude mention');
        continue;
      }

      Logger.log('✓ Contains @claude mention');

      // Check if already replied
      const hasReply = comment.replies && comment.replies.some(r =>
        r.content && r.content.indexOf('[AI Writing Coach]') !== -1
      );

      if (hasReply) {
        Logger.log('Skipping: Already has AI Writing Coach reply');
        continue; // Skip already processed comments
      }

      Logger.log('✓ No previous reply found');

      const anchoredText = getAnchoredText(comment.anchor);
      Logger.log('Anchored text: ' + (anchoredText ? anchoredText.substring(0, 50) + '...' : 'null'));

      // Call Claude with structured prompt
      Logger.log('Calling Claude API...');
      const claudeResponse = callClaudeForComment(
        comment.content,
        anchoredText,
        docContent
      );

      Logger.log('Claude response received (length: ' + claudeResponse.response.length + ')');
      Logger.log('Claude response preview: ' + claudeResponse.response.substring(0, 200));

      // Parse response and take action
      const action = parseClaudeAction(claudeResponse.response);
      Logger.log('Parsed action type: ' + action.type);

      if (action.type === 'SUGGEST_EDIT') {
        Logger.log('Executing: SUGGEST_EDIT');
        Logger.log('New text preview: ' + action.newText.substring(0, 100));
        insertSuggestion(comment, action.newText);
        results.push({
          commentId: comment.id,
          action: 'SUGGEST_EDIT',
          success: true
        });
        Logger.log('✓ Suggestion inserted successfully');
      } else if (action.type === 'REPLY_TO_COMMENT') {
        Logger.log('Executing: REPLY_TO_COMMENT');
        Logger.log('Reply text preview: ' + action.response.substring(0, 100));
        const replySuccess = replyToComment(comment.id, action.response);
        results.push({
          commentId: comment.id,
          action: 'REPLY_TO_COMMENT',
          success: replySuccess
        });
        Logger.log(replySuccess ? '✓ Reply posted successfully' : '✗ Reply failed');
      } else {
        Logger.log('Action: IGNORE (no action taken)');
      }
      // IGNORE - do nothing
    }

    return {
      success: true,
      processed: results.length,
      results: results
    };
  } catch (error) {
    Logger.log('Error in processAtMentions: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Calls Claude for comment processing with structured output
 */
function callClaudeForComment(commentText, anchoredText, docContent) {
  const systemPrompt = `You are an AI writing coach integrated into Google Docs. You analyze comments and determine the appropriate action.

DOCUMENT CONTEXT:
Title: ${docContent.title}

Full Document Text:
${docContent.text}

---

When processing comments, you MUST respond with one of these structured formats:

For directive/command comments (user wants you to edit the text):
ACTION: SUGGEST_EDIT
NEW_TEXT: [your revised version of the anchored text]

For question/exploratory comments (user wants discussion):
ACTION: REPLY_TO_COMMENT
RESPONSE: [your thoughtful reply to their question]

For comments not meant for you:
ACTION: IGNORE

Analyze the intent carefully. Commands like "rewrite this", "make this clearer", "fix grammar" should be SUGGEST_EDIT.
Questions like "is this clear?", "what do you think?", "any suggestions?" should be REPLY_TO_COMMENT.`;

  let userMessage = `Comment: "${commentText}"`;
  if (anchoredText) {
    userMessage += `\n\nAnchored Text: "${anchoredText}"`;
  }

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(CLAUDE_API_URL, options);
  const result = JSON.parse(response.getContentText());

  return {
    response: result.content[0].text,
    usage: result.usage
  };
}

/**
 * Parses Claude's structured response
 */
function parseClaudeAction(response) {
  const lines = response.split('\n');

  // Look for ACTION line
  const actionLine = lines.find(l => l.trim().startsWith('ACTION:'));
  if (!actionLine) {
    return { type: 'IGNORE' };
  }

  const action = actionLine.replace('ACTION:', '').trim();

  if (action === 'SUGGEST_EDIT') {
    // Find NEW_TEXT
    const newTextIndex = response.indexOf('NEW_TEXT:');
    if (newTextIndex === -1) {
      return { type: 'IGNORE' };
    }
    const newText = response.substring(newTextIndex + 9).trim();
    return { type: 'SUGGEST_EDIT', newText: newText };
  } else if (action === 'REPLY_TO_COMMENT') {
    // Find RESPONSE
    const responseIndex = response.indexOf('RESPONSE:');
    if (responseIndex === -1) {
      return { type: 'IGNORE' };
    }
    const responseText = response.substring(responseIndex + 9).trim();
    return { type: 'REPLY_TO_COMMENT', response: responseText };
  } else {
    return { type: 'IGNORE' };
  }
}

/**
 * Inserts a suggestion edit at comment location
 * Note: Google Docs API doesn't support programmatic suggestions yet
 * This is a simplified version that replies with the suggestion
 */
function insertSuggestion(comment, newText) {
  // Since we can't create actual suggestions programmatically,
  // we'll reply to the comment with the suggested text
  const replyText = `[AI Writing Coach - Suggested Edit]\n\n${newText}\n\n(Note: Please manually apply this suggestion as the API doesn't support automatic suggestion mode)`;
  replyToComment(comment.id, replyText);
}

/**
 * Replies to a comment
 */
function replyToComment(commentId, replyText) {
  const doc = DocumentApp.getActiveDocument();
  const docId = doc.getId();

  try {
    Logger.log('Attempting to reply to comment ID: ' + commentId);
    // Drive API v3 uses Replies.create() to create a reply to an existing comment
    const reply = Drive.Replies.create(
      {
        content: '[AI Writing Coach]\n\n' + replyText
      },
      docId,
      commentId,
      {
        fields: 'id,content'
      }
    );
    Logger.log('Reply created successfully with ID: ' + reply.id);
    return true;
  } catch (error) {
    Logger.log('Error replying to comment: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return false;
  }
}

/**
 * Sets the Claude API key
 */
function setClaudeApiKey(apiKey) {
  PropertiesService.getScriptProperties().setProperty('CLAUDE_API_KEY', apiKey);
  return { success: true };
}

/**
 * Gets current API key status (without revealing the key)
 */
function getApiKeyStatus() {
  const key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  return {
    isSet: !!key,
    preview: key ? key.substring(0, 8) + '...' : null
  };
}
