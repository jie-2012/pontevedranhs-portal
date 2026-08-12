// ==========================================
// 1. KONEKSYON SA SUPABASE
// ==========================================
const SUPABASE_URL = 'https://vykcbiupbdtegtcdtzda.supabase.co';
const SUPABASE_KEY = 'sb_publishable_OEUink5V4daPeQbXuNlyAw_bCehIOZd'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Encrypted Hash ng Admin Email para sa proteksyon ng iyong privacy
const ADMIN_EMAIL_HASH = "8ba7bdf3545b6db7f5ed64c3f5ea6c4d7e98d91bcfbbd405fbdf9a2c3a516016";

// Helper function para sa pagsusuri ng admin identity (SHA-256)
async function hashEmail(email) {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let isRegisterMode = false;

// Pag-load ng page, i-check ang session, posts, at carousel
document.addEventListener("DOMContentLoaded", () => {
  checkUserSession();
  loadPosts();
  updateDynamicSchoolYear();
  startSchoolCarousel();
  checkUrlParameters();
});

// ==========================================
// 2. TOGGLE AUTH MODE (LOGIN / REGISTER)
// ==========================================
function toggleAuthMode(event) {
  if (event) event.preventDefault();

  isRegisterMode = !isRegisterMode;

  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const fullnameGroup = document.getElementById('fullname-group');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');

  if (isRegisterMode) {
    if (authTitle) authTitle.textContent = "Gumawa ng Account";
    if (authSubtitle) authSubtitle.textContent = "Mag-register bilang Mag-aaral o Guro";
    if (fullnameGroup) fullnameGroup.style.display = "block";
    if (submitBtn) submitBtn.textContent = "Mag-register";
    if (toggleText) {
      toggleText.innerHTML = 'May account ka na? <a href="#" onclick="toggleAuthMode(event)" style="color: #1e3a8a; font-weight: bold; text-decoration: none;">Mag-login dito</a>';
    }
  } else {
    if (authTitle) authTitle.textContent = "Portal Login";
    if (authSubtitle) authSubtitle.textContent = "Pontevedra NHS Student & Faculty Access";
    if (fullnameGroup) fullnameGroup.style.display = "none";
    if (submitBtn) submitBtn.textContent = "Mag-login";
    if (toggleText) {
      toggleText.innerHTML = 'Wala pang account? <a href="#" onclick="toggleAuthMode(event)" style="color: #1e3a8a; font-weight: bold; text-decoration: none;">Mag-register dito</a>';
    }
  }
}

// ==========================================
// 3. AUTH SUBMISSION (LOGIN AT REGISTER)
// ==========================================
async function handleAuthSubmit(e) {
  e.preventDefault();

  const email = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;

  if (isRegisterMode) {
    const fullnameInput = document.getElementById('reg-fullname');
    const fullname = fullnameInput ? fullnameInput.value : '';

    const { data, error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullname }
      }
    });

    if (error) {
      alert("Error sa registration: " + error.message);
    } else {
      alert("Matagumpay ang registration! Pwede ka nang mag-login.");
      document.getElementById('auth-form').reset();
      toggleAuthMode();
    }
  } else {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      alert("Maling Email o Password: " + error.message);
    } else {
      alert("Maligayang pagbabalik!");
      checkUserSession();
    }
  }
}

// ==========================================
// 4. CHECK USER SESSION & UPDATE UI (WITH SECURE ADMIN DETECTION)
// ==========================================
async function checkUserSession() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  const navBtn = document.getElementById('nav-login-btn');
  const authTitle = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const authForm = document.getElementById('auth-form');

  if (user) {
    const displayName = user.user_metadata?.full_name || user.email;
    const userHash = await hashEmail(user.email);
    const isAdmin = (userHash === ADMIN_EMAIL_HASH);

    if (navBtn) {
      navBtn.innerText = isAdmin ? `👑 Admin (${displayName})` : `👤 ${displayName}`;
    }
    
    if (authTitle) {
      authTitle.innerText = isAdmin 
        ? `Naka-login ka bilang Admin: ${displayName}` 
        : `Naka-login ka na bilang: ${displayName}`;
    }
    
    if (submitBtn) {
      submitBtn.innerText = `Mag-logout`;
    }

    if (authForm) {
      authForm.onsubmit = async function(e) {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        alert("Naka-logout ka na.");
        location.reload();
      };
    }

    // I-render muli ang posts para lumitaw ang Admin Delete buttons
    loadPosts();
    checkUrlParameters();
  }
}

// ==========================================
// 5. MODAL CONTROL FOR POSTING
// ==========================================
async function openPostModal(category) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  
  if (!user) {
    alert("Kailangan mo munang mag-login bago makapag-post!");
    window.location.href = "#login";
    return;
  }
  
  const postCategory = document.getElementById('post-category');
  const modalTitle = document.getElementById('modal-category-title');
  const postModal = document.getElementById('post-modal');

  if (postCategory) postCategory.value = category;
  if (modalTitle) modalTitle.innerText = `Mag-post sa ${category}`;
  if (postModal) postModal.style.display = "flex";
}

function closePostModal() {
  const postModal = document.getElementById('post-modal');
  if (postModal) postModal.style.display = "none";
}

// ==========================================
// 6. UPLOAD / POST SUBMISSION
// ==========================================
const uploadFormElement = document.getElementById('upload-form');
if (uploadFormElement) {
  uploadFormElement.addEventListener('submit', async function(e) {
    e.preventDefault();

    const { data: { user } } = await supabaseClient.auth.getUser();
    const authorName = user?.user_metadata?.full_name || user?.email || "Anonymous";

    const category = document.getElementById('post-category').value;
    const text = document.getElementById('post-text').value;
    const image = document.getElementById('post-image').value;
    const video = document.getElementById('post-video').value;

    const newPost = {
      id: Date.now(), // Unique ID para sa madaling pag-delete
      author: authorName,
      date: new Date().toLocaleDateString('tl-PH'),
      text: text,
      image: image,
      video: video,
      category: category
    };

    let posts = JSON.parse(localStorage.getItem('campus_posts')) || [];
    posts.unshift(newPost);
    localStorage.setItem('campus_posts', JSON.stringify(posts));

    document.getElementById('upload-form').reset();
    closePostModal();
    loadPosts();
    filterPosts(category);
  });
}

// ==========================================
// 7. ADMIN FEATURE: DELETE POST
// ==========================================
async function deletePost(postId) {
  if (!confirm("Sigurado ka bang gusto mong burahin ang post na ito?")) return;

  let posts = JSON.parse(localStorage.getItem('campus_posts')) || [];
  posts = posts.filter(post => post.id !== postId);
  localStorage.setItem('campus_posts', JSON.stringify(posts));

  loadPosts();
  checkUrlParameters();
}

// ==========================================
// 8. LOAD POSTS FOR HOMEPAGE
// ==========================================
async function loadPosts() {
  const posts = JSON.parse(localStorage.getItem('campus_posts')) || [];
  const { data: { user } } = await supabaseClient.auth.getUser();
  
  let isAdmin = false;
  if (user) {
    const userHash = await hashEmail(user.email);
    isAdmin = (userHash === ADMIN_EMAIL_HASH);
  }

  const containerAcademics = document.getElementById('posts-academics');
  const containerSports = document.getElementById('posts-sports');
  const containerEvents = document.getElementById('posts-events');

  if (containerAcademics) containerAcademics.innerHTML = '';
  if (containerSports) containerSports.innerHTML = '';
  if (containerEvents) containerEvents.innerHTML = '';

  posts.forEach(post => {
    const deleteBtnHTML = isAdmin ? `<button onclick="deletePost(${post.id})" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:8px;">🗑️ Burahin ang Post</button>` : '';

    const postHTML = `
      <div class="user-post">
        <div class="user-post-author">📌 ${post.author} (${post.date})</div>
        <p>${post.text}</p>
        ${post.image ? `<img src="${post.image}" alt="Uploaded Image">` : ''}
        ${post.video ? `<iframe src="${post.video}"></iframe>` : ''}
        ${deleteBtnHTML}
      </div>
    `;

    if (post.category === 'Academics & Clubs' && containerAcademics) {
      containerAcademics.innerHTML += postHTML;
    } else if (post.category === 'Sports & Athletics' && containerSports) {
      containerSports.innerHTML += postHTML;
    } else if (post.category === 'Events & Activities' && containerEvents) {
      containerEvents.innerHTML += postHTML;
    }
  });
}

// ==========================================
// 9. FILTER POSTS FOR FEED.HTML
// ==========================================
function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('cat');

  if (categoryParam) {
    if (categoryParam === 'Academics') filterPosts('Academics & Clubs');
    else if (categoryParam === 'Sports') filterPosts('Sports & Athletics');
    else if (categoryParam === 'Events') filterPosts('Events & Activities');
  } else {
    filterPosts('All');
  }
}

async function filterPosts(selectedCategory) {
  const feedContainer = document.getElementById('all-posts-feed');
  if (!feedContainer) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  let isAdmin = false;
  if (user) {
    const userHash = await hashEmail(user.email);
    isAdmin = (userHash === ADMIN_EMAIL_HASH);
  }

  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    if (btn.innerText.includes(selectedCategory) || (selectedCategory === 'All' && btn.innerText === 'Lahat')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const posts = JSON.parse(localStorage.getItem('campus_posts')) || [];
  feedContainer.innerHTML = '';

  const filtered = selectedCategory === 'All' 
    ? posts 
    : posts.filter(p => p.category === selectedCategory);

  if (filtered.length === 0) {
    feedContainer.innerHTML = `<p class="empty-state">Wala pang naitatalang post sa kategoryang ito.</p>`;
    return;
  }

  filtered.forEach(post => {
    const deleteBtnHTML = isAdmin ? `<button onclick="deletePost(${post.id})" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:8px;">🗑️ Burahin ang Post</button>` : '';

    const postHTML = `
      <div class="feed-card">
        <div class="feed-card-header">
          <span class="feed-author">📌 ${post.author} (${post.date})</span>
          <span class="feed-category-tag">${post.category}</span>
        </div>
        <p>${post.text}</p>
        ${post.image ? `<img src="${post.image}" alt="Uploaded Image">` : ''}
        ${post.video ? `<iframe src="${post.video}" frameborder="0" allowfullscreen></iframe>` : ''}
        ${deleteBtnHTML}
      </div>
    `;
    feedContainer.innerHTML += postHTML;
  });
}

// ==========================================
// 10. DYNAMIC SCHOOL YEAR & HERO CAROUSEL
// ==========================================
function updateDynamicSchoolYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let startYear = currentYear;
  let endYear = currentYear + 1;

  if (currentMonth < 5) { 
    startYear = currentYear - 1;
    endYear = currentYear;
  }

  const syElement = document.getElementById('sy-badge');
  if (syElement) {
    syElement.innerText = `School Year ${startYear} – ${endYear}`;
  }
}

const mySchoolPictures = [
  "pnhs1.jpg",
  "pnhs2.jpg",
  "pnhs3.jpg"
];

let currentBgIndex = 0;

function startSchoolCarousel() {
  const heroSection = document.getElementById('hero');
  if (!heroSection) return;

  heroSection.style.backgroundImage = `url('${mySchoolPictures[0]}')`;

  setInterval(() => {
    currentBgIndex = (currentBgIndex + 1) % mySchoolPictures.length;
    heroSection.style.backgroundImage = `url('${mySchoolPictures[currentBgIndex]}')`;
  }, 5000);
}