# How Authentication Works - Multi-User Access Explained

## The Question
"If my IT team creates one OAuth app and gives the same credentials to all employees, how does each person only access their own documents?"

## The Answer: OAuth Token Flow

### Step 1: IT Creates ONE OAuth App
```
Google Cloud Console
    ↓
Create OAuth App: "Company DocuGen"
    ↓
Downloads: credentials.json
    ↓
Shares with all employees
```

### Step 2: Each Employee Authenticates Individually

**Employee A's Machine:**
```
1. A runs: npx docugen-mcp
2. DocuGen uses shared credentials.json
3. Opens browser → "Company DocuGen wants access to your Google account"
4. A logs in: alice@company.com
5. Google returns: Token_A (specific to Alice)
6. Saved locally: ~/.docugen/token.json (contains Token_A)
```

**Employee B's Machine:**
```
1. B runs: npx docugen-mcp
2. DocuGen uses same shared credentials.json
3. Opens browser → "Company DocuGen wants access to your Google account"
4. B logs in: bob@company.com
5. Google returns: Token_B (specific to Bob)
6. Saved locally: ~/.docugen/token.json (contains Token_B)
```

### Step 3: Accessing Documents

**When Alice uses DocuGen:**
```javascript
// DocuGen sends to Google:
{
  request: "List documents",
  oauth_app_id: "company-docugen",  // Same for everyone
  access_token: "Token_A"            // Unique to Alice
}

// Google checks:
// - Token_A belongs to alice@company.com
// - Returns: Only Alice's documents
```

**When Bob uses DocuGen:**
```javascript
// DocuGen sends to Google:
{
  request: "List documents",
  oauth_app_id: "company-docugen",  // Same for everyone
  access_token: "Token_B"            // Unique to Bob
}

// Google checks:
// - Token_B belongs to bob@company.com
// - Returns: Only Bob's documents
```

## Key Security Points

### 1. Tokens are User-Specific
- Even though everyone uses the same OAuth app credentials
- Each person's TOKEN is different
- Token determines whose account is accessed

### 2. Tokens are Stored Locally
```
Alice's Computer:
~/.docugen/token.json → Contains Alice's token

Bob's Computer:
~/.docugen/token.json → Contains Bob's token

These never mix!
```

### 3. Google Enforces Access Control
- Google knows Token_A = alice@company.com
- Google knows Token_B = bob@company.com
- Impossible for Alice to access Bob's docs with her token

## Visual Diagram

```
                    Shared OAuth App
                   (credentials.json)
                          |
        __________________|__________________
        |                 |                 |
    Employee A        Employee B        Employee C
        |                 |                 |
    Logs in as A      Logs in as B     Logs in as C
        |                 |                 |
    Gets Token_A      Gets Token_B     Gets Token_C
        |                 |                 |
    Sees A's docs     Sees B's docs    Sees C's docs
```

## Common Misconceptions

### ❌ Wrong: "Same OAuth app = Same access"
✅ **Right:** Same OAuth app = Same doorway, different keys

### ❌ Wrong: "Shared credentials = Security risk"
✅ **Right:** Shared OAuth app credentials are safe. Personal tokens provide security.

### ❌ Wrong: "Token stored in credentials.json"
✅ **Right:** 
- `credentials.json` = OAuth app identity (shared)
- `token.json` = User's personal access token (private, local)

## Technical Details

### What's in credentials.json (Shared)
```json
{
  "installed": {
    "client_id": "123456-abc.apps.googleusercontent.com",
    "client_secret": "company-oauth-secret",
    "redirect_uris": ["http://localhost"]
  }
}
```
This just identifies the app to Google, not the user.

### What's in token.json (Personal)
```json
{
  "access_token": "ya29.user-specific-token-here",
  "refresh_token": "1//user-specific-refresh-token",
  "scope": "https://www.googleapis.com/auth/documents",
  "token_type": "Bearer",
  "expiry_date": 1234567890
}
```
This identifies the USER and provides access to their account.

## File Locations

Each user's token is stored separately:
- **Windows:** `C:\Users\[Username]\.docugen\token.json`
- **Mac:** `/Users/[Username]/.docugen/token.json`
- **Linux:** `/home/[Username]/.docugen/token.json`

These paths are unique per user account on the machine.

## Multi-User on Same Machine

If multiple people use the same computer (different OS accounts):
- Alice logs into Windows as "Alice"
- Bob logs into Windows as "Bob"
- Each has their own token in their own user directory
- No conflict!

If using same OS account (not recommended):
- Would need to delete token.json between users
- Or use TOKEN_PATH environment variable to separate

## Summary

1. **OAuth App** = The application's identity (shared)
2. **Access Token** = The user's identity (personal)
3. **Result** = Each user only sees their own documents

The same way 1000 people can use the Gmail app on their phones - same app, different accounts, different emails. DocuGen works the same way!