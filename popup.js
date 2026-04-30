const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send"
].join(" ");

let allSenders = [];
let filteredSenders = [];
let accessToken = null;

// ─── INIT ───────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const redirectUri = chrome.identity.getRedirectURL();
  document.getElementById("redirectUriDisplay").textContent = redirectUri;

  // ── Wire all button events here (no inline onclick allowed in MV3) ──
  document.getElementById("copyBtn").addEventListener("click", copyRedirect);
  document.getElementById("connectBtn").addEventListener("click", saveClientId);
  document.getElementById("fetchBtn").addEventListener("click", fetchSenders);
  document.getElementById("selectAllBtn").addEventListener("click", selectAll);
  document.getElementById("deselectAllBtn").addEventListener("click", deselectAll);
  document.getElementById("sendBtn").addEventListener("click", sendBCC);
  document.getElementById("disconnectBtn").addEventListener("click", disconnect);
  document.getElementById("searchInput").addEventListener("input", filterSenders);

  const data = await chrome.storage.local.get(["clientId", "accessToken", "userEmail"]);

  if (data.clientId && data.accessToken) {
    accessToken = data.accessToken;
    showMainPage(data.userEmail || "");
  } else if (data.clientId) {
    document.getElementById("clientIdInput").value = data.clientId;
  }
});

function copyRedirect() {
  const uri = chrome.identity.getRedirectURL();

  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(uri)
      .then(() => flashCopyBtn())
      .catch(() => fallbackCopy(uri));
  } else {
    fallbackCopy(uri);
  }
}

function fallbackCopy(text) {
  // Textarea trick — reliable in all extension contexts
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand("copy");
    if (ok) {
      flashCopyBtn();
    } else {
      // Last resort: make the URI selectable and tell user to copy manually
      selectRedirectUri();
    }
  } catch (e) {
    selectRedirectUri();
  }
  document.body.removeChild(ta);
}

function flashCopyBtn() {
  const btn = document.querySelector(".copy-btn");
  btn.textContent = "Copied ✓";
  btn.style.color = "var(--green)";
  setTimeout(() => { btn.textContent = "Copy"; btn.style.color = ""; }, 2500);
}

function selectRedirectUri() {
  const el = document.getElementById("redirectUriDisplay");
  el.style.userSelect = "all";
  const range = document.createRange();
  range.selectNodeContents(el);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  showSetupStatus("Text selected above — press Ctrl+C (Windows) or Cmd+C (Mac) to copy it.", "info");
}

// ─── SETUP ──────────────────────────────────────────────

async function saveClientId() {
  const clientId = document.getElementById("clientIdInput").value.trim();
  if (!clientId) {
    showSetupStatus("Please paste your Client ID first.", "error");
    return;
  }
  if (!clientId.includes(".apps.googleusercontent.com")) {
    showSetupStatus("That doesn't look like a valid Client ID.", "error");
    return;
  }

  await chrome.storage.local.set({ clientId });
  authenticate(clientId);
}

async function authenticate(clientId) {
  if (!clientId) {
    const data = await chrome.storage.local.get("clientId");
    clientId = data.clientId;
  }
  if (!clientId) {
    showPage("page-setup");
    return;
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl =
    `https://accounts.google.com/o/oauth2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&prompt=consent`;

  showSetupStatus("⏳ Opening Google login window... (allow popups if blocked)", "info");

  // Disable button while auth is in progress
  const connectBtn = document.querySelector("#page-setup .btn-primary");
  if (connectBtn) connectBtn.disabled = true;

  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (responseUrl) => {
    if (connectBtn) connectBtn.disabled = false;

    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message || "";
      if (msg.includes("redirect_uri_mismatch") || msg.includes("redirect")) {
        showSetupStatus("❌ Redirect URI mismatch — make sure you copied the yellow URL above into Google Cloud Console → Authorised Redirect URIs exactly.", "error");
      } else if (msg.includes("cancelled") || msg.includes("closed")) {
        showSetupStatus("❌ Login window was closed. Try again.", "error");
      } else if (msg.includes("access_denied")) {
        showSetupStatus("❌ Access denied — make sure your Gmail is added as a Test User in Google Cloud Console → OAuth consent screen.", "error");
      } else {
        showSetupStatus("❌ Error: " + msg, "error");
      }
      return;
    }

    if (!responseUrl) {
      showSetupStatus("❌ No response from Google. Try again.", "error");
      return;
    }

    try {
      const hash = new URL(responseUrl).hash.slice(1);
      const params = new URLSearchParams(hash);
      const token = params.get("access_token");

      if (!token) {
        showSetupStatus("❌ No access token received. Double-check your Client ID is correct.", "error");
        return;
      }

      accessToken = token;
      await chrome.storage.local.set({ accessToken: token });

      // Get user profile
      const profile = await gmailRequest("https://www.googleapis.com/gmail/v1/users/me/profile");
      const email = profile.emailAddress || "";
      await chrome.storage.local.set({ userEmail: email });

      showMainPage(email);
    } catch (e) {
      showSetupStatus("Error: " + e.message, "error");
    }
  });
}

// ─── NAVIGATION ─────────────────────────────────────────

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");
}

function showMainPage(email) {
  showPage("page-main");
  document.getElementById("headerRight").innerHTML = `<div class="user-chip"><div class="dot"></div>${email}</div>`;
  document.getElementById("disconnectBtn").style.display = "";
  document.getElementById("footerInfo").textContent = "Connected · v1.0";
}

function showSetupStatus(msg, type) {
  const el = document.getElementById("setupStatus");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}

async function disconnect() {
  await chrome.storage.local.clear();
  accessToken = null;
  allSenders = [];
  filteredSenders = [];
  document.getElementById("disconnectBtn").style.display = "none";
  document.getElementById("headerRight").innerHTML = "";
  document.getElementById("footerInfo").textContent = "v1.0";
  showPage("page-setup");
}

// ─── GMAIL API ───────────────────────────────────────────

async function gmailRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (res.status === 401) {
    // Token expired — re-auth
    await chrome.storage.local.remove("accessToken");
    accessToken = null;
    showPage("page-setup");
    showSetupStatus("Session expired. Please reconnect.", "error");
    throw new Error("Token expired");
  }

  return res.json();
}

// ─── FETCH SENDERS ───────────────────────────────────────

async function fetchSenders() {
  const btn = document.getElementById("fetchBtn");
  const btnText = document.getElementById("fetchBtnText");
  const progressBar = document.getElementById("fetchProgress");
  const fill = document.getElementById("progressFill");

  btn.disabled = true;
  btnText.innerHTML = '<span class="spinner"></span> Scanning inbox...';
  progressBar.style.display = "block";

  let progress = 0;
  const interval = setInterval(() => {
    progress = Math.min(progress + 3, 88);
    fill.style.width = progress + "%";
  }, 400);

  const senderMap = {};

  try {
    let pageToken = null;

    do {
      let url = `https://www.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=100`;
      if (pageToken) url += `&pageToken=${pageToken}`;

      const listResult = await gmailRequest(url);
      const messages = listResult.messages || [];
      pageToken = listResult.nextPageToken || null;

      // Fetch metadata for all messages in batch
      const fetches = messages.map(m =>
        gmailRequest(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`
        )
      );
      const details = await Promise.all(fetches);

      for (const msg of details) {
        const headers = {};
        for (const h of (msg.payload?.headers || [])) {
          headers[h.name] = h.value;
        }
        const from = headers["From"] || "";
        if (!from) continue;

        let name = "", email = "";
        const match = from.match(/^(.*?)\s*<(.+?)>$/);
        if (match) {
          name = match[1].trim().replace(/^"|"$/g, "");
          email = match[2].trim();
        } else {
          email = from.trim();
        }

        if (email && email.includes("@") && !senderMap[email]) {
          senderMap[email] = { email, name };
        }
      }

      // Stop after 500 messages to keep it snappy
      if (Object.keys(senderMap).length >= 500) break;

    } while (pageToken);

    clearInterval(interval);
    fill.style.width = "100%";

    allSenders = Object.values(senderMap).sort((a, b) => a.email.localeCompare(b.email));
    filteredSenders = [...allSenders];

    document.getElementById("totalBadge").textContent = `${allSenders.length} senders`;
    document.getElementById("totalBadge").style.display = "";
    document.getElementById("senderSection").style.display = "block";

    renderSenders();

    setTimeout(() => { progressBar.style.display = "none"; fill.style.width = "0%"; }, 500);

  } catch (e) {
    clearInterval(interval);
    if (e.message !== "Token expired") {
      showSendStatus("Error: " + e.message, "error");
    }
  } finally {
    btn.disabled = false;
    btnText.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg> Refresh Senders`;
  }
}

function renderSenders() {
  const list = document.getElementById("senderList");
  list.innerHTML = "";

  if (!filteredSenders.length) {
    list.innerHTML = '<div class="empty-state">No senders found.</div>';
    updateSelectedCount();
    return;
  }

  filteredSenders.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "sender-item";
    item.innerHTML = `
      <input type="checkbox" id="s_${i}" data-email="${s.email}" checked onchange="updateSelectedCount()">
      <label for="s_${i}" style="display:flex;flex:1;gap:8px;align-items:center;cursor:pointer;overflow:hidden;">
        <span class="sender-email">${s.email}</span>
        ${s.name ? `<span class="sender-name">${s.name}</span>` : ""}
      </label>`;
    list.appendChild(item);
  });

  updateSelectedCount();
}

function filterSenders() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  filteredSenders = q
    ? allSenders.filter(s => s.email.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    : [...allSenders];
  renderSenders();
}

function selectAll() {
  document.querySelectorAll("#senderList input[type=checkbox]").forEach(c => c.checked = true);
  updateSelectedCount();
}
function deselectAll() {
  document.querySelectorAll("#senderList input[type=checkbox]").forEach(c => c.checked = false);
  updateSelectedCount();
}
function updateSelectedCount() {
  const n = document.querySelectorAll("#senderList input:checked").length;
  document.getElementById("selectedCount").textContent = `${n} selected`;
}

// ─── SEND EMAIL ──────────────────────────────────────────

async function sendBCC() {
  const subject = document.getElementById("subject").value.trim();
  const body = document.getElementById("body").value.trim();

  if (!subject || !body) {
    showSendStatus("Please fill in subject and message.", "error");
    return;
  }

  const checked = document.querySelectorAll("#senderList input:checked");
  if (!checked.length) {
    showSendStatus("No recipients selected.", "error");
    return;
  }

  const recipients = Array.from(checked).map(c => c.dataset.email);

  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending...';

  try {
    // Gmail BCC limit ~50 per message — chunk it
    const chunkSize = 50;
    let totalSent = 0;

    const meData = await gmailRequest("https://www.googleapis.com/gmail/v1/users/me/profile");
    const fromEmail = meData.emailAddress;

    for (let i = 0; i < recipients.length; i += chunkSize) {
      const chunk = recipients.slice(i, i + chunkSize);
      const raw = buildEmail(fromEmail, chunk, subject, body);

      await gmailRequest("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        body: JSON.stringify({ raw })
      });

      totalSent += chunk.length;
    }

    showSendStatus(`✉️ Sent to ${totalSent} people via BCC!`, "success");
    document.getElementById("subject").value = "";
    document.getElementById("body").value = "";

  } catch (e) {
    if (e.message !== "Token expired") {
      showSendStatus("Send failed: " + e.message, "error");
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Send BCC to Selected`;
  }
}

function buildEmail(from, bccList, subject, body) {
  const bcc = bccList.join(", ");
  const email = [
    `From: ${from}`,
    `To: ${from}`,
    `Bcc: ${bcc}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function showSendStatus(msg, type) {
  const el = document.getElementById("sendStatus");
  el.textContent = msg;
  el.className = `status-msg ${type}`;
  setTimeout(() => el.className = "status-msg", 5000);
}
