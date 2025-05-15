// Helper script to display all mappings between YouTube IDs and database video IDs

function displayAllMappings() {
  const mappings = {};
  let count = 0;

  // Scan all local storage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("db_video_id_")) {
      const youtubeId = key.replace("db_video_id_", "");
      const dbVideoId = localStorage.getItem(key);
      mappings[youtubeId] = dbVideoId;
      count++;
    }
  }

  console.log(`Found ${count} video ID mappings:`);
  console.table(mappings);

  return mappings;
}

// Export the function to make it available in the console
window.displayAllMappings = displayAllMappings;

// Execute immediately when loaded
displayAllMappings();

// Instructions for using in browser console:
console.log(`
To check all video ID mappings:
  1. Open browser console (F12)
  2. Type: displayAllMappings()
  
To clear all mappings:
  1. Type: localStorage.clear()
  
To set a mapping manually:
  1. Type: localStorage.setItem('db_video_id_YOUTUBE_ID', 'DATABASE_ID')
     (Replace YOUTUBE_ID and DATABASE_ID with actual values)
`);
