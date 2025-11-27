# How to Set Up Figma Integration

## Step 1: Get Your Figma Personal Access Token

1. Go to [Figma Settings](https://www.figma.com/settings)
2. Navigate to **Account** → **Personal Access Tokens**
3. Click **Create a new personal access token**
4. Give it a name (e.g., "BugSnap Integration")
5. Copy the token (it starts with `figd_`)
   - ⚠️ **Important**: You can only see this token once! Save it securely.

## Step 2: Find Your Figma File Key

### Method 1: From the URL (Easiest)

1. Open your Figma file in the browser
2. Look at the URL in your address bar
3. The URL format is:
   ```
   https://www.figma.com/file/FILE_KEY/File-Name
   ```
4. The **FILE_KEY** is the alphanumeric code right after `/file/`

**Example:**
- URL: `https://www.figma.com/file/ABC123xyz456/My-Design-System`
- File Key: `ABC123xyz456`

### Method 2: From the Share Link

1. In Figma, click the **Share** button (top right)
2. Click **Copy link**
3. The link will look like: `https://www.figma.com/file/FILE_KEY/...`
4. Extract the FILE_KEY from the URL

### Method 3: From the File Menu

1. In Figma, go to **File** → **Copy link**
2. The link contains the FILE_KEY

## Step 3: Configure in BugSnap

1. Go to **Integrations** in BugSnap
2. Click **Connect Figma**
3. Enter your **Personal Access Token** (from Step 1)
4. Enter your **File Key or URL** (from Step 2)
   - You can paste the full URL or just the file key - both work!
5. (Optional) Enter a **Node ID** if you want to compare a specific frame
6. Click **Save** - BugSnap will validate your connection

## Step 4: Using Figma Review

1. Capture or upload a screenshot in the Editor
2. Click the **"Figma Review"** button in the toolbar
3. Select a frame from your Figma file (if you didn't set a Node ID)
4. Click **"Compare with Figma Design"**
5. Review the AI-powered comparison results:
   - **Match Score**: How closely your implementation matches the design (0-100%)
   - **Improvement Suggestions**: Categorized by severity (Critical, Major, Minor)
   - **Side-by-side Comparison**: Visual comparison of both images

## Troubleshooting

### "Figma API Error: 403"
- Your token might be invalid or expired
- Check that you copied the full token (starts with `figd_`)
- Create a new token if needed

### "Invalid Figma File Key"
- Make sure you're using the correct file key from the URL
- The file key is case-sensitive
- Try pasting the full URL instead of just the key

### "Failed to load Figma frames"
- Check your internet connection
- Verify the file key is correct
- Make sure the file is accessible (not private/restricted)

### Can't find the file key?
- Make sure you're looking at the file URL, not a prototype or dev mode URL
- The file URL always contains `/file/` in the path
- If you're in a team, make sure you have access to the file

## Tips

- **File Key vs Node ID**: 
  - File Key = The entire Figma file
  - Node ID = A specific frame/component within the file
  - Leave Node ID empty to select from all frames

- **Multiple Files**: You can configure multiple Figma integrations by switching between different file keys

- **Best Practices**:
  - Use descriptive token names
  - Keep your tokens secure (don't share them)
  - Use specific Node IDs if you're always comparing the same frame

