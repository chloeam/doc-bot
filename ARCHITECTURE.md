# Architecture Documentation

This document explains the technical architecture and design decisions behind the Google Docs AI Writing Coach add-on.

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                   Google Docs                         │
│  ┌────────────────────────────────────────────────┐  │
│  │              Document Body                      │  │
│  │  - Text content                                 │  │
│  │  - Comments with @ mentions                     │  │
│  │  - User selections/highlights                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │              Sidebar UI                         │  │
│  │  (Sidebar.html - React + Tailwind)              │  │
│  │                                                  │  │
│  │  Components:                                     │  │
│  │  - Chat interface                                │  │
│  │  - Message history                               │  │
│  │  - Selection indicator                           │  │
│  │  - Process @ Mentions button                     │  │
│  │  - API key setup                                 │  │
│  └───────────────┬──────────────────────────────────┘  │
│                  │                                     │
│                  │ google.script.run                   │
│                  ▼                                     │
│  ┌────────────────────────────────────────────────┐  │
│  │          Apps Script Backend                    │  │
│  │          (Code.gs)                              │  │
│  │                                                  │  │
│  │  Functions:                                      │  │
│  │  - onOpen() / showSidebar()                      │  │
│  │  - getDocumentContent()                          │  │
│  │  - getSelectedText()                             │  │
│  │  - handleChatMessage()                           │  │
│  │  - processAtMentions()                           │  │
│  │  - callClaude()                                  │  │
│  └───────────────┬──────────────────────────────────┘  │
└──────────────────┼──────────────────────────────────────┘
                   │
                   │ HTTP POST
                   ▼
         ┌──────────────────────┐
         │   Anthropic API       │
         │   (Claude)            │
         │                       │
         │   - Prompt caching    │
         │   - Message API       │
         │   - Model: Sonnet 3.5 │
         └──────────────────────┘
```

## Component Breakdown

### 1. Frontend: Sidebar.html

**Technology Stack:**
- React 18 (via CDN)
- Tailwind CSS (via CDN)
- Babel Standalone (for JSX transformation)

**Why This Stack?**
- **React**: Provides component-based architecture for easy state management
- **Tailwind**: Rapid UI development without custom CSS files
- **CDN-based**: No build step required - works directly in Apps Script
- **Babel Standalone**: Allows writing JSX directly in HTML file

**Key Components:**

```javascript
App Component
├── State Management
│   ├── messages[]           // Chat history
│   ├── inputValue           // Current input
│   ├── isLoading            // Request in progress
│   ├── hasSelection         // Text selected in doc
│   ├── selectedText         // The selected text
│   ├── apiKeySet            // API key configured
│   └── isProcessingMentions // Batch processing in progress
│
├── UI Sections
│   ├── Header               // Title and branding
│   ├── Selection Indicator  // Shows highlighted text
│   ├── Action Buttons       // Process mentions, refresh
│   ├── Message List         // Chat history display
│   └── Input Area           // Text input + send button
│
└── API Communication
    ├── google.script.run.handleChatMessage()
    ├── google.script.run.processAtMentions()
    ├── google.script.run.getSelectedText()
    ├── google.script.run.setClaudeApiKey()
    └── google.script.run.getApiKeyStatus()
```

**Design Decisions:**

1. **Single HTML File**: All code in one file for easy deployment to Apps Script
2. **No Build Process**: Direct execution without webpack/vite for simplicity
3. **Inline Styles**: Tailwind classes instead of separate CSS for portability
4. **Simple State**: useState only, no Redux/Context (sufficient for this scope)

### 2. Backend: Code.gs

**Technology:** Google Apps Script (JavaScript ES5+)

**Key Modules:**

#### A. Document Interaction

```javascript
getDocumentContent()
├── DocumentApp.getActiveDocument()
├── Extract full text
├── Get document metadata
└── Return structured content

getSelectedText()
├── Get current selection
├── Handle partial/full elements
└── Return selected text string
```

**Challenges:**
- Apps Script's Document API is element-based, not character-based
- Selections can be partial or span multiple elements
- Need to handle text elements vs. other element types

#### B. Claude API Integration

```javascript
callClaude(userMessage, selectedText, forceRefresh)
├── Check if cache refresh needed
├── Build system message with document context
├── Add prompt caching control
├── Build user message with context
├── Make HTTP POST to Anthropic API
└── Return parsed response
```

**Prompt Caching Implementation:**

```javascript
// Cache structure
documentCache = {
  docId: string,           // Document ID
  content: string,         // Full document text
  lastModified: timestamp, // When last cached
  cacheControl: boolean    // Cache active
}

// Cache refresh logic
needsRefresh =
  !cache.docId ||                              // No cache
  cache.docId !== current.docId ||             // Different doc
  !cache.content ||                            // No content
  (current.lastModified - cache.lastModified) > 5000  // 5s threshold
```

**Why 5 Second Threshold?**
- Balances freshness vs. efficiency
- Most edits happen in bursts; this captures the latest version
- Claude's cache persists for ~5 minutes, so we stay within that window

#### C. Comment Processing

```javascript
processAtMentions()
├── getAllComments()
│   └── Drive API v2 comments.list()
│
├── For each comment with @claude:
│   ├── Check if already replied
│   ├── Get anchored text
│   ├── callClaudeForComment()
│   ├── parseClaudeAction()
│   └── Execute action:
│       ├── insertSuggestion() → reply with edit
│       └── replyToComment() → reply with discussion
│
└── Return results summary
```

**@ Mention Flow:**

```
User Comment: "@claude make this more concise"
        ↓
extractAnchoredText() → "The selected paragraph text..."
        ↓
callClaudeForComment() → {
  comment: "@claude make this more concise",
  anchoredText: "The selected paragraph text...",
  fullDocument: "[entire document]"
}
        ↓
Claude Response:
  ACTION: SUGGEST_EDIT
  NEW_TEXT: "Concise version of paragraph"
        ↓
parseClaudeAction() → {
  type: "SUGGEST_EDIT",
  newText: "Concise version of paragraph"
}
        ↓
insertSuggestion() → Post reply with suggested text
```

#### D. Structured Output Parsing

**Claude's Response Format:**

```
ACTION: SUGGEST_EDIT
NEW_TEXT: [the revised text]

or

ACTION: REPLY_TO_COMMENT
RESPONSE: [discussion response]

or

ACTION: IGNORE
```

**Parser:**

```javascript
parseClaudeAction(response)
├── Find "ACTION:" line
├── Extract action type
├── Based on type:
│   ├── SUGGEST_EDIT → extract NEW_TEXT
│   ├── REPLY_TO_COMMENT → extract RESPONSE
│   └── IGNORE → return ignore
└── Return structured object
```

**Why This Format?**
- Simple to parse (no JSON parsing errors)
- Clear delimiters
- Easy for Claude to generate consistently
- Human-readable for debugging

### 3. API Layer: Claude Integration

**Model Choice:** `claude-3-5-sonnet-20241022`

**Why Sonnet?**
- Best balance of speed, capability, and cost
- Excellent at following structured output formats
- Strong writing/editing capabilities
- Supports prompt caching

**Alternative Models:**

| Model | Use Case | Speed | Cost |
|-------|----------|-------|------|
| Claude 3.5 Sonnet | Default - balanced | Fast | Medium |
| Claude 3 Opus | Maximum quality | Slow | High |
| Claude 3 Haiku | Maximum speed/cost efficiency | Very Fast | Low |

**Prompt Engineering:**

**Chat System Prompt:**
```
You are an AI writing coach integrated into Google Docs.
You provide helpful, constructive feedback on writing.

DOCUMENT CONTEXT:
[Full document cached here]

When responding to chat messages, be conversational and helpful.
Provide specific suggestions and explain your reasoning.
```

**Comment System Prompt:**
```
You are an AI writing coach integrated into Google Docs.
You analyze comments and determine the appropriate action.

DOCUMENT CONTEXT:
[Full document cached here]

RESPOND WITH:
- ACTION: SUGGEST_EDIT + NEW_TEXT for edits
- ACTION: REPLY_TO_COMMENT + RESPONSE for questions
- ACTION: IGNORE for non-bot comments

Analyze intent carefully.
```

**Prompt Caching Strategy:**

```javascript
{
  "system": [
    {
      "type": "text",
      "text": "System prompt + full document...",
      "cache_control": { "type": "ephemeral" }  // ← Cache this!
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": "New question..."  // ← Only this is new
    }
  ]
}
```

**Token Savings:**

- **Without caching**: ~2000 tokens per request (document)
- **With caching**: ~100 tokens per request (just the question)
- **Savings**: ~95% reduction on follow-up questions

**Cost Example:**
- Document: 2000 tokens
- Question: 100 tokens
- Response: 200 tokens

Without caching:
- Input: 2100 tokens × $3/MTok = $0.0063
- Output: 200 tokens × $15/MTok = $0.003
- **Total: $0.0093 per message**

With caching (after first):
- Input: 100 tokens × $3/MTok = $0.0003
- Cached: 2000 tokens × $0.30/MTok = $0.0006
- Output: 200 tokens × $15/MTok = $0.003
- **Total: $0.0039 per message (58% savings)**

## Data Flow Diagrams

### Chat Message Flow

```
User types message in sidebar
        ↓
React: handleSendMessage()
        ↓
Add message to local state
        ↓
google.script.run.handleChatMessage(message, hasSelection)
        ↓
Apps Script: handleChatMessage()
        ↓
getSelectedText() if hasSelection
        ↓
callClaude(message, selectedText, forceRefresh=false)
        ↓
Check cache → Build payload → POST to Claude
        ↓
Parse response
        ↓
Return { success, response, selectedText, usage }
        ↓
React: Add assistant message to state
        ↓
UI updates with response
```

### @ Mention Processing Flow

```
User clicks "Process @ Mentions"
        ↓
React: handleProcessMentions()
        ↓
google.script.run.processAtMentions()
        ↓
Apps Script: processAtMentions()
        ↓
getAllComments() via Drive API
        ↓
Filter: contains "@claude" AND not already replied
        ↓
For each comment:
├── getAnchoredText(comment.anchor)
├── getDocumentContent()
├── callClaudeForComment(comment, anchor, doc)
├── parseClaudeAction(response)
└── Execute:
    ├── SUGGEST_EDIT → insertSuggestion()
    └── REPLY_TO_COMMENT → replyToComment()
        ↓
Return { success, processed, results[] }
        ↓
React: Show status message
```

## Security Considerations

### API Key Storage

**Current Implementation:**
- Stored in Script Properties (user-scoped)
- Not accessible to other users
- Not version-controlled

**Security Level:** Medium
- ✅ Not in code
- ✅ Not shared with document
- ⚠️ Accessible via Script Properties UI
- ⚠️ Transmitted to client for display (masked)

**Production Improvements:**
- Use OAuth for Anthropic API (when available)
- Server-side key management
- Key rotation policies
- Usage monitoring

### Data Privacy

**What's Sent to Anthropic:**
- Full document text
- User questions
- Selected text
- Comment text

**What's NOT Sent:**
- User identity
- Document metadata (beyond title)
- Edit history
- Sharing settings

**Compliance:**
- Review Anthropic's privacy policy
- Consider GDPR/data residency requirements
- Add user consent flow for production

### Script Permissions

**Required Scopes:**
```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/documents.currentonly",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

**Why These?**
- `documents.currentonly`: Access only the current document (not all user docs)
- `script.container.ui`: Show sidebar UI

**Additional Runtime Permissions:**
- Drive API access (for comments)

## Performance Optimization

### Current Optimizations

1. **Prompt Caching**: 90%+ token reduction on follow-ups
2. **Lazy Loading**: Sidebar loads only when opened
3. **Debounced Selection**: Don't check selection on every keystroke
4. **Batch @ Mention Processing**: Process all at once vs. one-by-one

### Potential Improvements

1. **Streaming Responses**:
   - Challenge: Apps Script doesn't support streaming
   - Workaround: Could use polling with temporary storage

2. **Incremental Document Updates**:
   - Current: Send full document each time
   - Improvement: Send diffs for large documents
   - Challenge: Complex diff logic

3. **Client-Side Caching**:
   - Cache document locally in sidebar
   - Reduce calls to getDocumentContent()

4. **Response Queuing**:
   - Queue multiple @ mentions
   - Process in parallel (with rate limiting)

## Testing Strategy

### Manual Testing Checklist

- [ ] Sidebar opens correctly
- [ ] API key setup flow works
- [ ] Chat sends and receives messages
- [ ] Selection highlighting works
- [ ] @ mention detection works
- [ ] SUGGEST_EDIT action works
- [ ] REPLY_TO_COMMENT action works
- [ ] Error handling displays correctly
- [ ] Cache reduces token usage
- [ ] Multiple documents work independently

### Unit Testing (Future)

```javascript
// Example test structure
function testParseClaudeAction() {
  const input = "ACTION: SUGGEST_EDIT\nNEW_TEXT: Hello";
  const result = parseClaudeAction(input);
  assertEqual(result.type, "SUGGEST_EDIT");
  assertEqual(result.newText, "Hello");
}
```

### Integration Testing (Future)

- Mock Claude API responses
- Test full flow without real API calls
- Verify prompt structure matches expectations

## Deployment

### Current: Manual

1. Copy code to Apps Script editor
2. Save and authorize
3. Test in document

### Future: Automated (clasp)

```bash
npm install -g @google/clasp
clasp login
clasp create --type docs --title "AI Writing Coach"
clasp push
clasp deploy
```

## Monitoring & Debugging

### Logging

```javascript
Logger.log('Error: ' + error.toString());
```

**Access Logs:**
- Apps Script Editor → Executions
- View logs for each function call

### Client-Side Debugging

```javascript
// In Sidebar.html
console.log('Message sent:', message);
console.error('Error:', error);
```

**Access Console:**
- F12 in browser
- Check for errors
- Monitor network requests

### API Usage Monitoring

- Check Anthropic Console for usage
- Monitor costs
- Track cache hit rates (in response.usage)

## Future Enhancements

### Planned Features

1. **Streaming Responses**: Show response as it generates
2. **Multiple Conversations**: Separate chat threads per topic
3. **Document History**: Compare versions with AI feedback
4. **Custom Prompts**: User-definable system prompts
5. **Style Guides**: Enforce custom writing styles
6. **Collaborative Editing**: Multi-user AI suggestions

### Technical Debt

1. **Anchor Parsing**: Implement proper anchor position extraction
2. **Error Recovery**: Better retry logic for API failures
3. **Rate Limiting**: Implement client-side rate limiting
4. **Testing**: Add automated tests
5. **Drive API v3**: Migrate from v2 to v3

---

**Last Updated:** 2025-01-17
