// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
// PALITAN ANG DALAWANG ITO NG IYONG TUNAY NA SUPABASE CREDENTIALS
const SUPABASE_URL = 'https://vykcbiupbdtegtcdtzda.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OEUink5V4daPeQbXuNlyAw_bCehIOZd';

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ==========================================
// 2. USER SESSION & NAVBAR MANAGEMENT
// ==========================================
let storedUser = localStorage.getItem("loggedInUser");
let currentUser = "Estudyante"; // Default fallback

if (storedUser) {
  try {
    let parsedData = JSON.parse(storedUser);
    currentUser = parsedData.name || parsedData.email || storedUser;
  } catch (e) {
    currentUser = storedUser;
  }
}

// Kapag nag-load ang DOM
document.addEventListener("DOMContentLoaded", () => {
  // Update Username sa Navbar
  const navUsername = document.getElementById("nav-username");
  if (navUsername) {
    navUsername.innerText = currentUser;
  }

  // Load Posts sa Feed (kung nasa feed.html)
  if (document.getElementById("all-posts-feed")) {
    fetchPosts('All');
  }

  // Event Listener para sa Post Form (Upload)
  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) {
    uploadForm.addEventListener("submit", handleCreatePost);
  }

  // Event Listener para sa Login Form (kung nasa index.html)
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

    // Render cards
    feedGrid.innerHTML = posts.map(post => renderPostCard(post)).join('');

  } catch (err) {
    console.error("Unexpected error:", err);
    feedGrid.innerHTML = "<p style='color: #dc2626;'>Nagkaroon ng hindi inaasahang error.</p>";
  }
}

// Function para sa Post Card HTML
function renderPostCard(post) {
  const postAuthor = post.author || "Anonymous";
  const postDate = post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Ngayon';

  const isOwner = (currentUser.toLowerCase() === postAuthor.toLowerCase());
  const isAdmin = (currentUser.toLowerCase().includes("admin"));

  // Ipakita ang delete button kapag owner o admin
  const deleteBtnHTML = (isOwner || isAdmin)
    ? `<button class="delete-post-btn" onclick="deletePost('${post.id}')">🗑️ Burahin</button>`
    : '';

  // Automatic detection kung Image ba o Video ang URL
  let mediaHTML = '';
  if (post.image_url) {
    const url = post.image_url.toLowerCase();
    if (url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') || url.endsWith('.mkv')) {
      mediaHTML = `
        <video controls style="max-width:100%; border-radius:8px; margin-top: 10px; display: block;">
          <source src="${post.image_url}" type="video/mp4">
          Hindi masuportahan ng iyong browser ang video player na ito.
        </video>`;
    } else {
      mediaHTML = `<img src="${post.image_url}" alt="Post Media" style="max-width:100%; border-radius:8px; margin-top: 10px; display: block;" onerror="this.style.display='none'">`;
    }
  }

  return `
    <div class="post-card">
      <div class="post-header">
        <div>
          <strong style="color: #1e3a8a;">📌 ${postAuthor}</strong> 
          <small style="color: #64748b; margin-left: 5px;">(${postDate})</small>
        </div>
        ${deleteBtnHTML}
      </div>
      <p style="margin: 15px 0; color: #334155; line-height: 1.5;">${post.content || post.text || ''}</p>
      ${mediaHTML}
    </div>
  `;
}

// ==========================================
// 4. CREATE POST FUNCTION (DIRECT STORAGE UPLOAD)
// ==========================================
async function handleCreatePost(event) {
  event.preventDefault();

  const textInput = document.getElementById("post-text");
  const fileInput = document.getElementById("post-file");
  const categoryInput = document.getElementById("post-category");

  const text = textInput ? textInput.value : "";
  const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;
  const category = categoryInput ? categoryInput.value : "Academics & Clubs";

  if (!text.trim()) {
    alert("Mangyaring maglagay ng mensahe.");
    return;
  }

  let imageUrl = null;

  try {
    // 1. Kung may na-upload na file (Image/Video) sa Supabase Storage
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

      // Kunin ang Public Link ng na-upload na file
      const { data: publicUrlData } = supabaseClient
        .storage
        .from('post-images')
        .getPublicUrl(fileName);

      imageUrl = publicUrlData.publicUrl;
    }

    // 2. I-save sa Supabase 'posts' table
    const { error: insertError } = await supabaseClient
      .from('posts')
      .insert([
        {
          author: currentUser,
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
      textInput.value = "";
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
// 6. FILTER & MODAL CONTROLS
// ==========================================
function filterPosts(category) {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  
  if (event && event.target) {
    event.target.classList.add('active');
  }

  fetchPosts(category);
}

function openPostModal(category = 'Academics & Clubs') {
  const modal = document.getElementById("post-modal");
  const categoryInput = document.getElementById("post-category");
  
  if (categoryInput) categoryInput.value = category;
  if (modal) modal.style.display = "flex";
}

function closePostModal() {
  const modal = document.getElementById("post-modal");
  if (modal) modal.style.display = "none";
}

function handleLogout() {
  if (confirm("Sigurado ka bang gusto mong mag-logout?")) {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
  }
}

// ==========================================
// 7. LOGIN / AUTHENTICATION HANDLER
// ==========================================
async function handleAuthSubmit(event) {
  event.preventDefault();

  // Hanapin ang kahit anong visible text o email input sa loob ng form
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

  // Awtomatikong maglagay ng Admin badge kung admin o pangalan mo
  if (userIdentifier.toLowerCase().includes("admin") || userIdentifier.toLowerCase().includes("junjie")) {
    userIdentifier = "Admin - " + userIdentifier;
  }

  // Save sa localStorage at lipat sa feed
  localStorage.setItem("loggedInUser", userIdentifier);
  alert("Maligayang pagbabalik! Pagpasok sa portal...");
  window.location.href = "feed.html";
}