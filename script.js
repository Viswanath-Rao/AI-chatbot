const typingForm = document.querySelector(".typing-form");
const chat = document.querySelector(".chat-list");
const suggestions = document.querySelectorAll(".suggestion");
const toggleTheme = document.querySelector("#theme-toogle-button");
const deleteChat = document.querySelector("#delete-chat-button");
const wipeModal = document.getElementById("wipe-modal");
const wipeCancel = document.getElementById("wipe-cancel");
const wipeConfirm = document.getElementById("wipe-confirm");

let userMessage = null;
let apiResponse = false;

const API_KEY = "AQ.Ab8RN6L_rY9PNEm3IpS4AUTkiHEMJwHmiHq6BOZsKzu196uekA";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${API_KEY}`;
const stampNow = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const loadData = () => {
  const savedChats = localStorage.getItem("savedchats");
  const isLightMode = localStorage.getItem("themeColor") === "light_mode";
  document.body.classList.toggle("light_mode", isLightMode);
  toggleTheme.innerText = isLightMode ? "dark_mode" : "light_mode";

  chat.innerHTML = savedChats || "";
  const hasMessages = Boolean(chat.querySelector(".message"));
  document.body.classList.toggle("hide-header", hasMessages);
  chat.scrollTo(0, chat.scrollHeight);
  window.thorUI?.syncHud();
};

toggleTheme.addEventListener("click", () => {
  const isLightMode = document.body.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightMode ? "light_mode" : "dark_mode");
  toggleTheme.innerText = isLightMode ? "dark_mode" : "light_mode";
});

toggleTheme.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") toggleTheme.click();
});

const createMessage = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const typingEffect = (text, textElement, messageDiv) => {
  const words = text.split(" ");
  let currentWordIndex = 0;

  const typingInterval = setInterval(() => {
    textElement.innerText +=
      (currentWordIndex === 0 ? "" : " ") + words[currentWordIndex++];
    messageDiv.querySelector(".icon").classList.add("hide");

    if (currentWordIndex === words.length) {
      clearInterval(typingInterval);
      apiResponse = false;
      messageDiv.querySelector(".icon").classList.remove("hide");
      localStorage.setItem("savedchats", chat.innerHTML);
      window.thorUI?.setSignal("Live");
    }
    chat.scrollTo(0, chat.scrollHeight);
  }, 28);
};

const generateResponse = async (messageDiv) => {
  const textElement = messageDiv.querySelector(".text");
  window.thorUI?.setSignal("Sync");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const apiData = data?.candidates[0].content.parts[0].text.replace(
      /\*\*(.*?)\*\*/g,
      "$1"
    );

    typingEffect(apiData, textElement, messageDiv);
  } catch (error) {
    apiResponse = false;
    textElement.innerText = error.message;
    textElement.parentElement.closest(".message").classList.add("error");
    window.thorUI?.setSignal("Fault");
  } finally {
    messageDiv.classList.remove("loading");
  }
};

const loadingAnimation = () => {
  const tag = `<div class="message-content">
                     <img class="avatar" src="images/logo.jpg" alt="Tony">
                     <p class="text"></p>
                     <div class="loading-indicator">
                     <div class="loading-bar"></div>
                     <div class="loading-bar"></div>
                     <div class="loading-bar"></div>
                     </div>
                     </div>
                     <div class="meta-row"><span class="stamp">${stampNow()}</span></div>
                     <span onClick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;

  const messageDiv = createMessage(tag, "incoming", "loading");
  chat.appendChild(messageDiv);
  chat.scrollTo(0, chat.scrollHeight);
  generateResponse(messageDiv);
};

const copyMessage = (copyButton) => {
  const messageText = copyButton.parentElement.querySelector(".text").innerText;
  navigator.clipboard.writeText(messageText);
  copyButton.innerText = "done";
  setTimeout(() => (copyButton.innerText = "content_copy"), 1000);
};
window.copyMessage = copyMessage;

const sendMessage = () => {
  userMessage =
    typingForm.querySelector(".typing-input").value.trim() || userMessage;
  if (!userMessage || apiResponse) return;
  apiResponse = true;
  const tag = `<div class="message-content">
                     <img class="avatar" src="images/th.jpg" alt="user profile photo">
                     <p class="text"></p>
                     </div>
                     <div class="meta-row"><span class="stamp">${stampNow()}</span></div>`;
  const sendMessageDiv = createMessage(tag, "outgoing");
  sendMessageDiv.querySelector(".text").innerText = userMessage;
  chat.appendChild(sendMessageDiv);

  typingForm.reset();
  document.body.classList.add("hide-header");
  chat.scrollTo(0, chat.scrollHeight);
  window.thorUI?.pulse();
  setTimeout(loadingAnimation, 380);
};

suggestions.forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    userMessage = suggestion.querySelector(".text").innerText;
    sendMessage();
  });
});

deleteChat.addEventListener("click", () => {
  wipeModal.hidden = false;
});

deleteChat.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") wipeModal.hidden = false;
});

wipeCancel.addEventListener("click", () => {
  wipeModal.hidden = true;
});

wipeConfirm.addEventListener("click", () => {
  localStorage.removeItem("savedchats");
  wipeModal.hidden = true;
  loadData();
});

wipeModal.addEventListener("click", (e) => {
  if (e.target === wipeModal) wipeModal.hidden = true;
});

typingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

loadData();
