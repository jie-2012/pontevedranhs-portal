// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://vykcbiupbdtegtcdtzda.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OEUink5V4daPeQbXuNlyAw_bCehIOZd';

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Helper Function: Sanitize HTML para maiwasan ang XSS Injection
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Helper Function: Linisin ang email/identifier para Pangalan/Role lang ang idisplay
function formatDisplayName(rawUser) {
  if (!rawUser) return "Admin";
  
  let name = String(rawUser).trim();
  
  if (name.toLowerCase().includes("admin") || name.toLowerCase().includes("junjie")) {
    return "Admin";
  }

  if (name.includes(' - ')) {
    name = name.split(' - ')[0];
  }
  
  if (name.includes('@')) {
    name = name.split('@')[0];
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ==========================================
// 2. USER SESSION & NAVBAR MANAGEMENT
// ==========================================
let storedUser = localStorage.getItem("loggedInUser");
let currentUserRaw = storedUser || "admin@deped.gov.ph"; 
let currentUserDisplay = formatDisplayName(currentUserRaw);

document.addEventListener("DOMContentLoaded", () => {
  const navUsername = document.getElementById("nav-username");
  if (navUsername) {
    navUsername.innerText = currentUserDisplay;
  }

  if (document.getElementById("all-posts-feed")) {
    fetchPosts('All');
  }

  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", handleCreatePost);
  }

  const loginForm = document.querySelector('form[onsubmit*="handleAuthSubmit"]') || document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleAuthSubmit);
  }
});

// ==========================================
// 3. FETCH & DISPLAY POSTS
// ==========================================
async function fetchPosts(category = 'All') {
  const feedGrid = document.getElementById("all-posts-feed");
  if (!feedGrid) return;

  feedGrid.innerHTML = "<p style='color: #64748b;'>Kina-karga ang mga anunsyo...</p>";

  try {
    if (!supabaseClient) {
      feedGrid.innerHTML = "<p style='color: #dc2626;'>Mali ang Supabase configuration. Paki-check ang SUPABASE_URL at SUPABASE_KEY.</p>";
      return;
    }

    let query = supabaseClient.from('posts').select('*').order('created_at', { ascending: false });

    if (category !== 'All') {
      query = query.eq('category', category);
    }

    const { data: posts, error } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      feedGrid.innerHTML = "<p style='color: #dc2626;'>Nagka-error sa pag-load ng mga post. Paki-check ang database table.</p>";
      return;
    }

    if (!posts || posts.length === 0) {
      feedGrid.innerHTML = "<p style='color: #64748b;'>Wala pang naitatalang post sa kategoryang ito.</p>";
      return;
    }

    feedGrid.innerHTML = posts.map(post => renderPostCard(post)).join('');

  } catch (err) {
    console.error("Unexpected error:", err);
    feedGrid.innerHTML = "<p style='color: #dc2626;'>Nagkaroon ng hindi inaasahang error.</p>";
  }
}

function renderPostCard(post) {
  const rawAuthor = post.author || "Admin";
  const displayAuthor = formatDisplayName(rawAuthor);
  const postDate = post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Ngayon';

  const isOwner = (currentUserRaw.toLowerCase() === rawAuthor.toLowerCase());
  const isAdmin = (currentUserRaw.toLowerCase().includes("admin") || 
                   currentUserDisplay.toLowerCase().includes("admin") || 
                   currentUserRaw.toLowerCase().includes("junjie"));

  const deleteBtnHTML = (isOwner || isAdmin)
    ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">🗑️ Burahin</button>`
    : '';

  let mediaHTML = '';
  if (post.image_url) {
    const safeUrl = escapeHTML(post.image_url);
    const urlLower = safeUrl.toLowerCase();
    if (urlLower.endsWith('.mp4') || urlLower.endsWith('.mov') || urlLower.endsWith('.webm') || urlLower.endsWith('.mkv')) {
      mediaHTML = `
        <video controls style="max-width:100%; border-radius:8px; margin-top: 10px; display: block;">
          <source src="${safeUrl}" type="video/mp4">
          Hindi masuportahan ng iyong browser ang video player na ito.
        </video>`;
    } else {
      mediaHTML = `<img src="${safeUrl}" alt="Post Media" style="max-width:100%; border-radius:8px; margin-top: 10px; display: block;" onerror="this.style.display='none'">`;
    }
  }

  const safeContent = escapeHTML(post.content || post.text || '');
  const safeAuthor = escapeHTML(displayAuthor);

  return `
    <div class="post-card" style="background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); text-align: left;">
      <div class="post-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color: #1e3a8a; font-size: 1.1rem;">📌 ${safeAuthor}</strong> 
          <small style="color: #64748b; margin-left: 5px;">(${postDate})</small>
        </div>
        ${deleteBtnHTML}
      </div>
      <p style="margin: 15px 0; color: #334155; line-height: 1.5; white-space: pre-line;">${safeContent}</p>
      ${mediaHTML}
    </div>
  `;
}

// ==========================================
// 4. CREATE POST FUNCTION
// ==========================================
async function handleCreatePost(event) {
  event.preventDefault();

  const textInput = document.getElementById("post-text");
  const fileInput = document.getElementById("post-file");
  const categoryInput = document.getElementById("post-category");

  const text = textInput ? textInput.value : "";
  const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;
  const category = categoryInput ? categoryInput.value : "Academics";

  if (!text.trim()) {
    alert("Mangyaring maglagay ng mensahe.");
    return;
  }

  let imageUrl = null;

  try {
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('post-images')
        .upload(fileName, file);

      if (uploadError) {
        alert("Nagka-error sa pag-upload ng media: " + uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabaseClient
        .storage
        .from('post-images')
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    const { error: insertError } = await supabaseClient
      .from('posts')
      .insert([
        {
          author: currentUserRaw, 
          content: text,
          image_url: imageUrl,
          category: category
        }
      ]);

    if (insertError) {
      alert("Nagka-error sa pag-save ng post: " + insertError.message);
    } else {
      alert("Matagumpay na na-post ang anunsyo!");
      closePostModal();
      if (textInput) textInput.value = "";
      if (fileInput) fileInput.value = "";
      fetchPosts('All');
    }

  } catch (err) {
    console.error("Error creating post:", err);
  }
}

// ==========================================
// 5. DELETE POST FUNCTION
// ==========================================
async function deletePost(postId) {
  if (!confirm("Sigurado ka bang gusto mong burahin ang post na ito?")) return;

  try {
    const { error } = await supabaseClient
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      alert("Nagka-error sa pagbura: " + error.message);
    } else {
      alert("Matagumpay na nabura ang post!");
      fetchPosts('All');
    }
  } catch (err) {
    console.error("Error deleting post:", err);
  }
}

// ==========================================
// 6. FILTER, MODAL & LOGOUT CONTROLS
// ==========================================
function filterPosts(category, evt) {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  const currentEvent = evt || window.event;
  if (currentEvent && currentEvent.target) {
    currentEvent.target.classList.add('active');
  }

  fetchPosts(category);
}

function openPostModal(category = 'Academics') {
  const modal = document.getElementById("post-modal");
  const categoryInput = document.getElementById("post-category");
  
  if (categoryInput) categoryInput.value = category;
  if (modal) modal.style.display = "flex";
}

function closePostModal() {
  const modal = document.getElementById("post-modal");
  if (modal) modal.style.display = "none";
}

window.handleLogout = function() {
  if (confirm("Sigurado ka bang gusto mong mag-logout?")) {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
  }
};

// ==========================================
// 7. LOGIN / AUTHENTICATION HANDLER
// ==========================================
async function handleAuthSubmit(event) {
  event.preventDefault();

  const inputs = event.target.querySelectorAll('input');
  let userIdentifier = "";

  inputs.forEach(input => {
    if (input.type !== 'password' && input.type !== 'submit' && input.value.trim() !== "") {
      userIdentifier = input.value.trim();
    }
  });

  if (!userIdentifier) {
    alert("Mangyaring ilagay ang iyong LRN o DepEd Email.");
    return;
  }

  localStorage.setItem("loggedInUser", userIdentifier);
  alert("Maligayang pagbabalik! Pagpasok sa portal...");
  window.location.href = "feed.html";
}
