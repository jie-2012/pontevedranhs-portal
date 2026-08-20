// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://vykcbiupbdtegtcdtzda.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OEUink5V4daPeQbXuNlyAw_bCehIOZd';

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function formatDisplayName(rawUser) {
  if (!rawUser || rawUser.toLowerCase() === 'guest') return "Guest";
  let name = String(rawUser).trim();
  if (name.toLowerCase().includes("admin") || name.toLowerCase().includes("junjie")) return "Admin";
  if (name.includes(' - ')) name = name.split(' - ')[0];
  if (name.includes('@')) name = name.split('@')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ==========================================
// 2. USER SESSION (GUEST BY DEFAULT)
// ==========================================
let storedUser = localStorage.getItem("loggedInUser");
let currentUserRaw = storedUser || "Guest"; 
let currentUserDisplay = storedUser ? formatDisplayName(storedUser) : "Guest";

document.addEventListener("DOMContentLoaded", () => {
  const navUsername = document.getElementById("nav-username");
  if (navUsername) navUsername.innerText = currentUserDisplay;

  // Itago ang "Gumawa ng Post" button kapag Guest
  const createPostBtn = document.querySelector("button[onclick*='openPostModal']");
  if (createPostBtn && !storedUser) {
    createPostBtn.style.display = "none";
  }

  if (document.getElementById("all-posts-feed")) fetchPosts('All');

  const uploadForm = document.getElementById("upload-form");
  if (uploadForm) uploadForm.addEventListener("submit", handleCreatePost);
});

// ==========================================
// 3. FETCH & DISPLAY POSTS WITH REACTIONS & COMMENTS
// ==========================================
async function fetchPosts(category = 'All') {
  const feedGrid = document.getElementById("all-posts-feed");
  if (!feedGrid) return;

  feedGrid.innerHTML = "<p style='color: #64748b;'>Kina-karga ang mga anunsyo...</p>";

  try {
    let query = supabaseClient.from('posts').select('*, reactions(*), comments(*)').order('created_at', { ascending: false });
    if (category !== 'All') query = query.eq('category', category);

    const { data: posts, error } = await query;
    if (error) {
      console.error(error);
      feedGrid.innerHTML = "<p style='color: #dc2626;'>Nagka-error sa pag-load ng posts.</p>";
      return;
    }

    if (!posts || posts.length === 0) {
      feedGrid.innerHTML = "<p style='color: #64748b;'>Wala pang naitatalang post sa kategoryang ito.</p>";
      return;
    }

    feedGrid.innerHTML = posts.map(post => renderPostCard(post)).join('');
  } catch (err) {
    console.error(err);
  }
}

function renderPostCard(post) {
  const rawAuthor = post.author || "Admin";
  const displayAuthor = formatDisplayName(rawAuthor);
  const postDate = post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Ngayon';

  // I-verify kung admin o owner ang tumitingin para sa delete button
  const isOwner = storedUser && (currentUserRaw.toLowerCase() === rawAuthor.toLowerCase());
  const isAdmin = storedUser && (currentUserRaw.toLowerCase().includes("admin") || currentUserDisplay.toLowerCase().includes("admin") || currentUserRaw.toLowerCase().includes("junjie"));

  const deleteBtnHTML = (isOwner || isAdmin)
    ? `<button onclick="deletePost('${post.id}')" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">🗑️ Burahin</button>`
    : '';

  let mediaHTML = '';
  if (post.image_url) {
    const safeUrl = escapeHTML(post.image_url);
    if (safeUrl.match(/\.(mp4|mov|webm|mkv)$/i)) {
      mediaHTML = `<video controls style="max-width:100%; border-radius:8px; margin-top:10px;"><source src="${safeUrl}"></video>`;
    } else {
      mediaHTML = `<img src="${safeUrl}" style="max-width:100%; border-radius:8px; margin-top:10px;">`;
    }
  }

  // Reactions count & user check
  const likes = (post.reactions || []).filter(r => r.type === 'like');
  const hearts = (post.reactions || []).filter(r => r.type === 'heart');
  const userLiked = likes.some(r => r.user_identifier === currentUserRaw);
  const userHearted = hearts.some(r => r.user_identifier === currentUserRaw);

  // Comments HTML
  const commentsList = (post.comments || []).map(c => `
    <div style="background:#f1f5f9; padding:8px 12px; border-radius:8px; margin-top:6px; font-size:0.9rem;">
      <strong style="color:#1e3a8a;">${escapeHTML(formatDisplayName(c.author))}</strong>: ${escapeHTML(c.content)}
    </div>
  `).join('');

  return `
    <div class="post-card" style="background:white; padding:20px; border-radius:12px; margin-bottom:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05); text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color:#1e3a8a;">📌 ${escapeHTML(displayAuthor)}</strong> 
          <small style="color:#64748b;">(${postDate})</small>
        </div>
        ${deleteBtnHTML}
      </div>
      <p style="margin:15px 0; color:#334155; line-height:1.5; white-space:pre-line;">${escapeHTML(post.content || '')}</p>
      ${mediaHTML}

      <!-- Like & Heart Buttons -->
      <div style="display:flex; gap:15px; margin-top:15px; border-top:1px solid #e2e8f0; padding-top:10px;">
        <button onclick="toggleReaction('${post.id}', 'like')" style="background:none; border:none; cursor:pointer; font-weight:bold; color:${userLiked ? '#2563eb' : '#64748b'};">
          👍 Like (${likes.length})
        </button>
        <button onclick="toggleReaction('${post.id}', 'heart')" style="background:none; border:none; cursor:pointer; font-weight:bold; color:${userHearted ? '#dc2626' : '#64748b'};">
          ❤️ Heart (${hearts.length})
        </button>
        <button onclick="toggleCommentBox('${post.id}')" style="background:none; border:none; cursor:pointer; font-weight:bold; color:#64748b;">
          💬 Komento (${(post.comments || []).length})
        </button>
      </div>

      <!-- Comment Section -->
      <div id="comments-section-${post.id}" style="display:none; margin-top:10px;">
        <div style="max-height:150px; overflow-y:auto; margin-bottom:10px;">
          ${commentsList || "<p style='font-size:0.85rem; color:#94a3b8;'>Wala pang komento.</p>"}
        </div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="comment-input-${post.id}" placeholder="Isulat ang komento..." style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
          <button onclick="addComment('${post.id}')" style="background:#1e3a8a; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">Ipadala</button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// 4. LIKE, HEART & COMMENT ACTIONS
// ==========================================
async function toggleReaction(postId, type) {
  if (!storedUser) return alert("Mag-login muna para makapag-react.");

  const { data: existing } = await supabaseClient
    .from('reactions')
    .select('*')
    .eq('post_id', postId)
    .eq('user_identifier', currentUserRaw)
    .eq('type', type);

  if (existing && existing.length > 0) {
    await supabaseClient.from('reactions').delete().eq('id', existing[0].id);
  } else {
    await supabaseClient.from('reactions').insert([{ post_id: postId, user_identifier: currentUserRaw, type: type }]);
  }
  fetchPosts('All');
}

function toggleCommentBox(postId) {
  const box = document.getElementById(`comments-section-${postId}`);
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

async function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input ? input.value.trim() : "";

  if (!storedUser) return alert("Mag-login muna para makapag-comment.");
  if (!text) return alert("Maglagay ng komento.");

  const { error } = await supabaseClient
    .from('comments')
    .insert([{ post_id: postId, author: currentUserRaw, content: text }]);

  if (error) {
    alert("Nagka-error sa pag-comment: " + error.message);
  } else {
    input.value = "";
    fetchPosts('All');
  }
}

// ==========================================
// 5. POST & DELETE HANDLERS
// ==========================================
async function handleCreatePost(event) {
  event.preventDefault();
  if (!storedUser) return alert("Mag-login muna bilang Admin.");

  const textInput = document.getElementById("post-text");
  const fileInput = document.getElementById("post-file");
  const categoryInput = document.getElementById("post-category");

  const text = textInput ? textInput.value : "";
  const file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;
  const category = categoryInput ? categoryInput.value : "Academics";

  if (!text.trim()) return alert("Maglagay ng mensahe.");

  let imageUrl = null;
  if (file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const { error: uploadError } = await supabaseClient.storage.from('post-images').upload(fileName, file);
    if (uploadError) return alert("Upload error: " + uploadError.message);
    
    const { data: publicUrlData } = supabaseClient.storage.from('post-images').getPublicUrl(fileName);
    imageUrl = publicUrlData.publicUrl;
  }

  await supabaseClient.from('posts').insert([{ author: currentUserRaw, content: text, image_url: imageUrl, category: category }]);
  alert("Matagumpay na na-post!");
  closePostModal();
  if (textInput) textInput.value = "";
  if (fileInput) fileInput.value = "";
  fetchPosts('All');
}

async function deletePost(postId) {
  if (!storedUser) return alert("Wala kang permiso na magbura ng post.");
  if (!confirm("Sigurado ka bang gusto mong burahin ang post na ito?")) return;
  await supabaseClient.from('posts').delete().eq('id', postId);
  fetchPosts('All');
}

function openPostModal() { document.getElementById("post-modal").style.display = "flex"; }
function closePostModal() { document.getElementById("post-modal").style.display = "none"; }
window.handleLogout = function() {
  if (confirm("Mag-logout?")) {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
  }
};
