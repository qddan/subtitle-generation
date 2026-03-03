---
description: Test frontend UI components and interactions
---

# Test Frontend UI

1. **Dashboard page** (http://localhost:3000)
   - Verify stat cards load (Total, Pending, Done, Errors)
   - Verify "Chọn Video MP4" button opens file picker
   - Verify folder path input accepts text
   - Verify "Thêm Folder" button triggers API call
   - Verify "Process All Files" button starts processing
   - Verify progress bar shows during processing
   - Verify live log updates in real-time

2. **Files page** (http://localhost:3000/files)
   - Verify file table loads with columns: #, Filename, Type, Status, Words, Actions
   - Verify "Scan Folder" button refreshes file list
   - Verify Process button appears for pending/error files
   - Verify View button appears for done files
   - Verify transcript dialog opens and shows content

3. **Theme toggle**
   - Click theme toggle in sidebar
   - Verify dark/light mode switches correctly
   - Verify all components look correct in both modes

4. **Responsive design**
   - Resize browser to mobile width
   - Verify layout adjusts properly
   - Verify stat cards stack vertically on small screens

5. **Navigation**
   - Click Dashboard link - verify active state
   - Click Files link - verify active state
   - Verify sidebar highlights current page
