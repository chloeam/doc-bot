# Claude Developer Guide

This document contains important context and lessons learned for AI assistants (like Claude) working on this Google Apps Script project.

## Project Overview

This is a Google Docs add-on called "AI Writing Coach" that integrates Claude API to provide writing assistance directly within Google Docs. Users can:
- Chat with Claude in a sidebar
- Use @claude mentions in document comments to get targeted help
- Receive suggestions and edits inline

## Critical Context: Current Date & API Versions

**Current Date**: January 2026

When searching for documentation or making assumptions about API methods:
- Always verify API methods exist before using them
- Google's APIs evolve - don't assume methods work based on naming conventions alone
- Use WebSearch to verify current API documentation
- Check the official Google Developers documentation for the exact method signatures

## Key Technical Learnings

### 1. Drive API v3 for Comment Replies

**IMPORTANT**: To reply to a Google Docs comment, you MUST use:

```javascript
Drive.Replies.create(
  {
    content: 'Your reply text here'
  },
  fileId,
  commentId
)
```

**Common Mistakes**:
- ❌ `Drive.Comments.create(resource, fileId, commentId)` - This creates a NEW comment, not a reply
- ❌ `Drive.Replies.insert()` - This is Drive API v2, not v3
- ✅ `Drive.Replies.create()` - Correct method for Drive API v3

### 2. OAuth Scopes Matter

This project requires the `https://www.googleapis.com/auth/drive` scope (full Drive access) because:
- `drive.readonly` - Too restrictive, can't post replies
- `drive.file` - Only works with app-created files, not user-owned documents
- `drive` - Required to read comments and post replies on any user-owned document

### 3. Drive API Advanced Service Configuration

In `appsscript.json`, you must explicitly enable the Drive API advanced service:

```json
{
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "version": "v3",
        "serviceId": "drive"
      }
    ]
  }
}
```

Without this configuration, `Drive.Comments.list()` and `Drive.Replies.create()` will fail silently or with cryptic errors.

### 4. Drive API v2 vs v3 Field Names

When migrating from v2 to v3, field names changed:

**Comments**:
- v2: `items` → v3: `comments`
- v2: `commentId` → v3: `id`

**Example**:
```javascript
// v2
const comments = Drive.Comments.list(docId, {
  fields: 'items(commentId,content,anchor,replies,status)'
});

// v3
const response = Drive.Comments.list(docId, {
  fields: 'comments(id,content,anchor,replies,resolved)'
});
```

### 5. Debugging Philosophy

When encountering bugs:
1. **Add granular logging first** before writing fixes
2. Use `Logger.log()` at every critical step
3. Check Apps Script execution logs (Executions tab → Cloud logs)
4. Don't assume - verify what's actually happening
5. Error messages like "Extra args block must be a javascript object literal" indicate incorrect parameter structure

### 6. Google Apps Script Limitations

- DocumentApp doesn't have a native `getComments()` method
- Must use Drive API to access comments
- Apps Script's advanced services are wrappers around REST APIs
- Method signatures in Apps Script match the REST API structure

## Development Workflow

### Deploying Changes

```bash
clasp push
```

This deploys:
- `Code.gs` - Main script logic
- `Sidebar.html` - UI for the sidebar
- `appsscript.json` - Project manifest

### Testing @ Mentions

1. Open a Google Doc with the add-on installed
2. Add a comment with "@claude [your request]"
3. Open the AI Writing Coach sidebar (Extensions → AI Writing Coach → Show Sidebar)
4. Click "Process @ Mentions"
5. Check Apps Script execution logs for detailed output

### Viewing Logs

1. Open Apps Script editor
2. Navigate to "Executions" (alarm icon in left sidebar)
3. Click on the most recent execution
4. Expand "Cloud logs" to see all `Logger.log()` output

## Common Gotchas

### "File not found" Errors

This error can mean:
- OAuth scope is too restrictive (e.g., `drive.file` when you need `drive`)
- The user hasn't authorized the new scopes
- The file ID is incorrect

### Silent Failures

When Drive API methods fail without proper error handling:
- They may return empty arrays/objects
- Errors are caught but not surfaced to the user
- Always check execution logs, not just UI messages

### API Method Discovery

When you need to use a Google API method:
1. Search for official Google Developers documentation
2. Verify the method exists in the version you're using (v2 vs v3)
3. Check the exact parameter structure (positional vs named parameters)
4. Test with logging before assuming it works

## Architecture Notes

### Comment Processing Flow

1. `getAllComments()` - Retrieves all comments via Drive API
2. `processAtMentions()` - Filters for @claude mentions, calls Claude API
3. `parseClaudeAction()` - Parses Claude's response for action type
4. Action execution:
   - `REPLY_TO_COMMENT` → `replyToComment()`
   - `SUGGEST_EDIT` → `insertSuggestion()` → `replyToComment()`

### Claude API Integration

- Uses Anthropic's REST API (`https://api.anthropic.com/v1/messages`)
- Model: `claude-sonnet-4-5-20250929`
- Implements prompt caching for efficiency
- Structured output parsing for action types

## Resources

- [Advanced Drive Service Documentation](https://developers.google.com/apps-script/advanced/drive)
- [Drive API v3 Reference](https://developers.google.com/drive/api/v3/reference)
- [Drive API: Manage comments and replies](https://developers.google.com/workspace/drive/api/guides/manage-comments)
- [Apps Script Best Practices](https://developers.google.com/apps-script/guides/support/best-practices)

## Verification Checklist

Before deploying a fix:
- [ ] Verified API method exists in official documentation
- [ ] Added logging at each step for debugging
- [ ] Tested with actual Google Doc
- [ ] Checked execution logs for errors
- [ ] Confirmed OAuth scopes are sufficient
- [ ] Updated ARCHITECTURE.md if needed

## Next Steps / Known Issues

### 1. Claude is responding to entire document instead of anchored text
Currently, when processing @mentions, Claude receives the full document context rather than just the text that the comment is anchored to. This causes Claude to respond based on the entire document rather than the specific highlighted text.

**Issue**: The `comment.anchor` field contains information about where the comment is anchored, but the code is sending the full document to Claude instead of extracting just the anchored text.

**Fix needed**:
- Parse the `anchor` field to identify the exact text range
- Extract only that specific text to send to Claude as context
- Update the prompt to make it clear Claude should focus on the anchored text

### 2. New feature: Ask Claude for feedback on your writing
Add a new action type that allows users to request general feedback on their writing via comments.

**Feature idea**:
- User adds a comment like "@claude give me feedback on this section"
- Claude analyzes the anchored text for:
  - Clarity and readability
  - Grammar and style issues
  - Suggestions for improvement
  - Tone and voice consistency
- Returns feedback as a comment reply

**Implementation considerations**:
- Add new action type: `GIVE_FEEDBACK`
- Update Claude prompt to recognize feedback requests
- Consider different feedback modes (concise vs detailed, style vs grammar, etc.)

### 3. Verify all Drive API calls actually exist
During this debugging session, we discovered multiple cases where API methods were assumed to exist but didn't work as expected (e.g., `Drive.Comments.create()` vs `Drive.Replies.create()`).

**Audit needed**:
- `Drive.Comments.list()` - ✓ Verified working
- `Drive.Replies.create()` - ✓ Verified working with fields parameter
- Any other Drive API calls in the codebase

**Process**:
1. Search codebase for all `Drive.` API calls
2. Cross-reference each with official Drive API v3 documentation
3. Verify parameter structure matches documentation
4. Add tests or logging to confirm they work as expected
