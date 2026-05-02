/**
 * Election Guide Assistant — Frontend Script
 * ===========================================
 * Handles all UI interactions, API calls, and dynamic rendering.
 * Uses vanilla JavaScript with the Fetch API.
 */

// ── DOM References ───────────────────────────────────────────────────────────
const ageInput         = document.getElementById("age-input");
const checkBtn         = document.getElementById("check-btn");
const eligibilityResult = document.getElementById("eligibility-result");
const stepsContainer   = document.getElementById("steps-container");
const electionsContainer = document.getElementById("elections-container");
const chatMessages     = document.getElementById("chat-messages");
const chatInput        = document.getElementById("chat-input");
const sendBtn          = document.getElementById("send-btn");

// Journey Dashboard References
const journeyContainer = document.getElementById("journey-tracker-container");
const journeyMotivation= document.getElementById("journey-motivation");
const journeyNextBtn   = document.getElementById("journey-next-btn");

// Location Info References
const stateInput       = document.getElementById("state-input");
const districtInput    = document.getElementById("district-input");
const locationBtn      = document.getElementById("location-btn");
const locationResult   = document.getElementById("location-result-container");


// ── 1. ELIGIBILITY CHECKER ───────────────────────────────────────────────────

/**
 * Called when the user clicks "Check Eligibility".
 * POSTs the age to /check-eligibility and renders the result.
 */
async function checkEligibility() {
  const age = parseInt(ageInput.value, 10);

  // Basic front-end validation
  if (!ageInput.value || isNaN(age)) {
    showResultBox("⚠️ Please enter a valid age.", false, null);
    return;
  }

  // Show loading state
  checkBtn.textContent = "Checking…";
  checkBtn.disabled = true;
  eligibilityResult.style.display = "block";
  eligibilityResult.innerHTML = `<div class="loading-text">⏳ Checking eligibility…</div>`;

  try {
    const response = await fetch("/check-eligibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age })
    });

    const data = await response.json();

    if (data.error) {
      showResultBox("❌ " + data.error, false, null);
    } else {
      renderEligibilityResult(data);
      // Fetch the journey to update tracker after age check
      fetchJourney();
    }

  } catch (err) {
    showResultBox("🔌 Could not connect to server. Is Flask running?", false, null);
    console.error("Eligibility fetch error:", err);
  } finally {
    checkBtn.textContent = "Check Eligibility";
    checkBtn.disabled = false;
  }
}

/**
 * Renders the eligibility result card in the UI.
 * @param {Object} data - API response object
 */
function renderEligibilityResult(data) {
  const cls = data.eligible ? "eligible" : "not-eligible";
  const btnCls = data.eligible ? "green" : "navy";

  const html = `
    <div class="result-box ${cls}">
      <p class="result-message">${data.message}</p>
      <p class="next-step-label">Next Step →</p>
      <p class="next-step-title">${data.next_step.title}</p>
      <p class="next-step-desc">${data.next_step.description}</p>
      <a href="${data.next_step.action_url}" target="_blank" class="btn-action ${btnCls}">
        ${data.next_step.action_label} ↗
      </a>
    </div>
  `;

  eligibilityResult.innerHTML = html;
  eligibilityResult.style.display = "block";
}

/**
 * Generic helper to show a plain message in the result box.
 */
function showResultBox(message, eligible, nextStep) {
  const html = `<div class="result-box ${eligible ? 'eligible' : 'not-eligible'}">
    <p class="result-message">${message}</p>
  </div>`;
  eligibilityResult.innerHTML = html;
  eligibilityResult.style.display = "block";
}

// Allow pressing Enter in the age input
ageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkEligibility();
});

checkBtn.addEventListener("click", checkEligibility);


// ── 2. STEPS / PROGRESS JOURNEY ─────────────────────────────────────────────

/**
 * Fetches the step-by-step journey and upcoming elections from /get-steps.
 * Called automatically on page load.
 */
async function loadSteps() {
  stepsContainer.innerHTML = `<div class="loading-text">⏳ Loading steps…</div>`;

  try {
    const response = await fetch("/get-steps");
    const data = await response.json();

    renderSteps(data.steps);
    renderElections(data.upcoming_elections);

  } catch (err) {
    stepsContainer.innerHTML = `<div class="loading-text">🔌 Could not load steps. Is Flask running?</div>`;
    console.error("Steps fetch error:", err);
  }
}

/**
 * Renders the voter journey steps.
 * @param {Array} steps - Array of step objects from the API
 */
function renderSteps(steps) {
  stepsContainer.innerHTML = steps.map((step, i) => `
    <div class="step-item">
      <div class="step-num">${step.icon}</div>
      <div class="step-content">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
        <p class="step-action">→ ${step.action}</p>
      </div>
    </div>
  `).join("");
}

/**
 * Renders upcoming elections below the steps.
 * @param {Array} elections - Array of election objects
 */
function renderElections(elections) {
  if (!elections || elections.length === 0) return;

  const html = elections.map(e => {
    const dateObj = new Date(e.date);
    const formatted = dateObj.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
    return `
      <div class="election-card">
        <div>
          <div class="election-name">${e.name}</div>
          <div class="election-meta">${e.state} · ${e.type} Election</div>
        </div>
        <span class="election-date-badge">${formatted}</span>
      </div>
    `;
  }).join("");

  electionsContainer.innerHTML = `
    <p style="font-size:0.8rem;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--slate);margin-bottom:10px;margin-top:8px;">
      Upcoming Elections
    </p>
    ${html}
  `;
}


// ── 3. VOTING JOURNEY TRACKER ────────────────────────────────────────────────

/**
 * Fetches the current journey state from /api/journey
 */
async function fetchJourney() {
  if (!journeyContainer) return; // safeguard if node doesn't exist
  
  try {
    const response = await fetch("/api/journey");
    const data = await response.json();
    renderJourney(data);
  } catch (err) {
    console.error("Journey fetch error:", err);
  }
}

/**
 * Renders the horizontal tracker nodes
 */
function renderJourney(data) {
  const tooltips = [
    "Not yet eligible or haven't checked",
    "Age verified as 18+",
    "Successfully registered for Voter ID",
    "Ready to cast your vote on election day!"
  ];
  
  const nodesHtml = data.stages.map((stage, i) => {
    let iconContent = "🔵";
    if (stage.status === "done") iconContent = "✔";
    if (stage.status === "locked") iconContent = "🔒";
    
    // Add custom tooltips using title attribute for native hover support
    const tooltipText = tooltips[i] || stage.name;
    
    return `
      <div class="journey-step-node ${stage.status}" title="${tooltipText}">
        <div class="journey-icon">${iconContent}</div>
        <div class="journey-label">${stage.name}</div>
      </div>
    `;
  }).join("");
  
  journeyContainer.innerHTML = nodesHtml;
  
  // Check if we hit the final stage to show confetti
  if (data.current_stage === "Ready to Vote") {
    triggerConfetti();
  }
  
  // Update motivation message
  if (journeyMotivation) {
    journeyMotivation.textContent = data.message || "Loading...";
  }
  
  // Show/Hide Next Step Button
  if (journeyNextBtn) {
    if (data.can_advance) {
      journeyNextBtn.style.display = "inline-block";
    } else {
      journeyNextBtn.style.display = "none";
    }
  }
}

/**
 * Triggers a confetti animation
 */
function triggerConfetti() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0d2137', '#f4a21e', '#138a36'] // Theme colors
    });
  }
}

/**
 * Advances the journey manually when the "Next Step" button is clicked
 */
async function advanceJourney() {
  if (journeyNextBtn) {
    journeyNextBtn.disabled = true;
    journeyNextBtn.textContent = "Updating...";
  }
  
  try {
    const response = await fetch("/api/journey/advance", { method: "POST" });
    if (response.ok) {
        await fetchJourney(); // refetch after advancing
        
        // Smooth scroll into view
        const section = document.querySelector(".journey-dashboard");
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  } catch (err) {
    console.error("Journey advance error:", err);
  } finally {
    if (journeyNextBtn) {
      journeyNextBtn.disabled = false;
      journeyNextBtn.innerHTML = "Complete Registration Step &rarr;";
    }
  }
}

if (journeyNextBtn) {
  journeyNextBtn.addEventListener("click", advanceJourney);
}


// ── 4. LOCATION-BASED ELECTION INFO ──────────────────────────────────────────

/**
 * Triggered on click to fetch location info
 */
async function fetchLocationInfo() {
  const state = stateInput.value.trim();
  const district = districtInput.value.trim();

  if (!state || !district) {
    locationResult.innerHTML = `<div class="result-box not-eligible"><p class="result-message">⚠️ Please specify both State and District.</p></div>`;
    return;
  }

  // Save to localStorage
  localStorage.setItem("userState", state);
  localStorage.setItem("userDistrict", district);

  locationBtn.textContent = "Searching...";
  locationBtn.disabled = true;
  locationResult.innerHTML = `<div class="loading-text">⏳ Loading election info...</div>`;

  try {
    const response = await fetch("/api/election-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, district })
    });

    const data = await response.json();

    if (data.error) {
      locationResult.innerHTML = `<div class="result-box not-eligible"><p class="result-message">😕 ${data.error}</p></div>`;
    } else {
      renderLocationInfo(data);
    }
  } catch (err) {
    locationResult.innerHTML = `<div class="result-box not-eligible"><p class="result-message">🔌 Could not connect to the server.</p></div>`;
    console.error("Location fetch error:", err);
  } finally {
    locationBtn.textContent = "Find Election Info";
    locationBtn.disabled = false;
  }
}

/**
 * Renders the returned location data into a clean card
 */
function renderLocationInfo(data) {
  const daysString = calculateCountdown(data.election.date);
  
  const instructionsHtml = data.instructions.map(item => `<li>${item}</li>`).join("");

  const html = `
    <div class="location-result-wrapper">
      <div class="location-result-card">
        <div class="location-header-row">
          <h3>📍 ${data.location.district}, ${data.location.state}</h3>
          <span class="countdown-badge">${daysString}</span>
        </div>
        <div class="location-body">
          <p class="location-type-label">${data.election.type} Election</p>
          <p class="location-date-title">${new Date(data.election.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          
          <p class="location-polling-info">⏰ ${data.election.polling_info}</p>
          
          <h4 class="location-instructions-title">Important Instructions:</h4>
          <ul class="location-instructions-list">
            ${instructionsHtml}
          </ul>
        </div>
      </div>
    </div>
  `;
  
  locationResult.innerHTML = html;
}

/**
 * Helper to calculate countdown days from today
 */
function calculateCountdown(dateString) {
  const electionDate = new Date(dateString);
  const today = new Date();
  const diffTime = electionDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  if (diffDays > 0) return `${diffDays} Days Away`;
  if (diffDays === 0) return "Today!";
  return "Completed";
}

if (locationBtn) {
  locationBtn.addEventListener("click", fetchLocationInfo);
}

// Allow Enter key to trigger search
[stateInput, districtInput].forEach(el => {
  if(el) {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fetchLocationInfo();
    });
  }
});


// ── 4.5 DOCUMENT CHECKLIST ───────────────────────────────────────────────────

const checklistAge = document.getElementById("checklist-age");
const checklistState = document.getElementById("checklist-state");
const checklistFirstTime = document.getElementById("checklist-first-time");
const checklistBtn = document.getElementById("checklist-btn");
const checklistResultContainer = document.getElementById("checklist-result-container");

async function generateChecklist() {
  const age = parseInt(checklistAge.value, 10);
  const state = checklistState.value.trim();
  const isFirstTime = checklistFirstTime.checked;

  if (isNaN(age)) {
    checklistResultContainer.style.display = "block";
    checklistResultContainer.innerHTML = `<div class="result-box not-eligible"><p class="result-message">⚠️ Please enter a valid age.</p></div>`;
    return;
  }

  checklistBtn.textContent = "Generating...";
  checklistBtn.disabled = true;
  checklistResultContainer.style.display = "block";
  checklistResultContainer.innerHTML = `<div class="loading-text">⏳ Gathering documents for you...</div>`;

  try {
    const response = await fetch("/api/document-checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ age, state, first_time_voter: isFirstTime })
    });

    const data = await response.json();

    if (data.error) {
      checklistResultContainer.innerHTML = `<div class="result-box not-eligible"><p class="result-message">❌ ${data.error}</p></div>`;
    } else {
      renderChecklist(data);
    }
  } catch (err) {
    checklistResultContainer.innerHTML = `<div class="result-box not-eligible"><p class="result-message">🔌 Could not connect to the server.</p></div>`;
    console.error("Checklist fetch error:", err);
  } finally {
    checklistBtn.textContent = "Generate Checklist";
    checklistBtn.disabled = false;
  }
}

function renderChecklist(data) {
  if (data.eligibility_status === "not_eligible") {
    const stepsHtml = data.future_steps ? data.future_steps.map(step => `<li>${step}</li>`).join("") : "";
    
    checklistResultContainer.innerHTML = `
      <div class="result-box not-eligible" style="margin-top: 20px;">
        <p class="result-message">⚠️ ${data.message}</p>
        <h4 class="location-instructions-title" style="margin-top: 15px;">Preparation Steps:</h4>
        <ul class="location-instructions-list">
          ${stepsHtml}
        </ul>
      </div>
    `;
    return;
  }

  const listItemsHtml = data.checklist.map((item, index) => {
    // Bold the main part of the document (before parenthesis)
    let parts = item.split(" (");
    if (parts.length > 1) {
      return `<li><strong>${parts[0]}</strong> (${parts[1]}</li>`;
    }
    return `<li><strong>${item}</strong></li>`;
  }).join("");
  
  const notesHtml = data.extra_notes ? data.extra_notes.map(note => `<li>${note}</li>`).join("") : "";

  checklistResultContainer.innerHTML = `
    <div class="location-result-wrapper">
      <div class="location-result-card">
        <div class="location-header-row" style="background: var(--green);">
          <h3>✅ Your Voter Registration Checklist</h3>
          ${checklistFirstTime.checked ? '<span class="countdown-badge" style="background: white; color: var(--green);">NEW VOTER</span>' : ''}
        </div>
        <div class="location-body">
          <p class="location-type-label" style="margin-bottom: 12px; color: var(--text);">REQUIRED DOCUMENTS:</p>
          <ul class="checklist-items" style="list-style-type: none; padding-left: 5px; margin-bottom: 20px;">
            ${data.checklist.map((item) => `
              <li style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <span style="color: var(--green); font-size: 1.1rem;">☑</span>
                <span>
                  <strong>${item.split(" (")[0]}</strong> 
                  ${item.includes("(") ? `<span style="color: var(--text-light); font-size: 0.9em;">(${item.split(" (")[1]}</span>` : ''}
                </span>
              </li>
            `).join("")}
          </ul>
          
          ${data.extra_notes && data.extra_notes.length > 0 ? `
            <div style="background: rgba(244,162,30,0.1); padding: 15px; border-radius: var(--radius-sm); border-left: 3px solid var(--saffron);">
              <h4 class="location-instructions-title" style="margin-bottom: 8px;">Important Notes:</h4>
              <ul class="location-instructions-list" style="gap: 5px;">
                ${notesHtml}
              </ul>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button onclick="window.print()" class="btn-primary" style="background: var(--slate-dark); padding: 8px; font-size: 0.85rem; width: auto; flex: 1;">🖨️ Print Checklist</button>
            <button onclick="alert('PDF generation would trigger here!')" class="btn-primary" style="background: var(--navy-light); padding: 8px; font-size: 0.85rem; width: auto; flex: 1;">📄 Download PDF</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

if (checklistBtn) {
  checklistBtn.addEventListener("click", generateChecklist);
}


// ── 5. CHAT ASSISTANT ────────────────────────────────────────────────────────

/**
 * Appends a message bubble to the chat window.
 * @param {string} text    - Message text (can contain \n)
 * @param {'bot'|'user'} sender
 */
function appendMessage(text, sender) {
  const avatar = sender === "bot" ? "🗳️" : "👤";
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msgEl = document.createElement("div");
  msgEl.className = `msg ${sender}`;
  msgEl.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">
      <div class="msg-text">${escapeHtml(text)}</div>
      <span class="msg-timestamp">${timeString}</span>
    </div>
  `;

  chatMessages.appendChild(msgEl);
  // Auto-scroll to latest message
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Shows a typing indicator bubble.
 */
function showTyping() {
  const el = document.createElement("div");
  el.className = "msg bot";
  el.id = "typing-indicator";
  el.innerHTML = `
    <div class="msg-avatar">🗳️</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

/**
 * Sends the user's message to /chat and displays the response.
 */
async function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  // Display user message
  appendMessage(message, "user");
  chatInput.value = "";
  sendBtn.disabled = true;

  // Show typing indicator
  showTyping();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });

    const data = await response.json();
    removeTyping();

    if (data.error) {
      appendMessage("⚠️ " + data.error, "bot");
    } else {
      appendMessage(data.reply, "bot");
    }

  } catch (err) {
    removeTyping();
    appendMessage("🔌 Could not reach the server. Please ensure Flask is running.", "bot");
    console.error("Chat fetch error:", err);
  } finally {
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

/**
 * Simple HTML escape to prevent XSS in chat messages.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Send on button click
sendBtn.addEventListener("click", sendChatMessage);

// Send on Enter key
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

/**
 * Allows clicking a suggestion chip to send a preset question.
 * @param {string} question - Preset question text
 */
function askSuggestion(question) {
  chatInput.value = question;
  sendChatMessage();
}


// ── 6. INITIALISE ─────────────────────────────────────────────────────────────

/**
 * Run on page load — fetch steps and greet the user in chat.
 */
(function init() {
  // Load steps automatically
  loadSteps();
  
  // Load journey tracker automatically
  fetchJourney();

  // Try to pre-fill location form from LocalStorage
  if (stateInput && districtInput) {
    const savedState = localStorage.getItem("userState");
    const savedDistrict = localStorage.getItem("userDistrict");
    if (savedState) stateInput.value = savedState;
    if (savedDistrict) districtInput.value = savedDistrict;
  }

  // Setup Theme Toggle
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  if (themeToggleBtn) {
    const savedTheme = localStorage.getItem("appTheme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
      themeToggleBtn.textContent = savedTheme === "dark" ? "☀️" : "🌙";
    }

    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("appTheme", newTheme);
      themeToggleBtn.textContent = newTheme === "dark" ? "☀️" : "🌙";
    });
  }

  // Setup Clear Chat
  const clearChatBtn = document.getElementById("clear-chat-btn");
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      chatMessages.innerHTML = "";
      appendMessage(
        "Namaste! 🙏 Welcome to the Election Guide Assistant.\n\nI can help you understand the voting process in India. Ask me anything or use the suggestion chips below!",
        "bot"
      );
    });
  }

  // Add a welcome message in the chat
  appendMessage(
    "Namaste! 🙏 Welcome to the Election Guide Assistant.\n\nI can help you understand the voting process in India. Ask me anything or use the suggestion chips below!",
    "bot"
  );
})();
