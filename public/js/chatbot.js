(() => {
  "use strict";
  const KB = [
    { keys: ["jatinga","bird"], a: "Jatinga is famous for the mysterious bird phenomenon — on dark monsoon nights (June–September), disoriented birds descend toward village lights. Scientists still debate the exact cause. It sits at about 650m elevation, near Haflong." },
    { keys: ["tumjang","sunrise","peak","cloud"], a: "Tumjang Peak is where you camp overnight and wake before dawn to watch the sunrise break over a sea of clouds — one of the most uncrowded sunrise viewpoints in Northeast India." },
    { keys: ["borail","trek","wildlife","sanctuary","forest"], a: "Borail Wildlife Sanctuary offers multi-day treks through dense sub-tropical forest, home to hoolock gibbons and rare orchids. Moderate fitness is recommended." },
    { keys: ["haflong","lake"], a: "Haflong Lake is the natural lake at the heart of Haflong, Assam's only hill station and the district headquarters. Great for a relaxed evening — paddle boats, sunset views, lakeside cafes." },
    { keys: ["panimur","waterfall","falls"], a: "Panimur Waterfall is Assam's biggest waterfall, most dramatic in monsoon season (July–September) when it's at full flow." },
    { keys: ["maibang","ruin","history","dimasa","kingdom","heritage"], a: "Maibang was once the capital of the Dimasa Kingdom. Its stone ruins and royal tombs sit along the Mahur River — a great half-day trip for history lovers." },
    { keys: ["distance","far","km","reach","how to get","travel time"], a: "Dima Hasao is best reached via Haflong, which connects by rail and road to Guwahati (roughly 6-7 hours by road). Exact distances vary by starting point — tell us where you're coming from on the Contact page and we'll help plan your route." },
    { keys: ["best time","season","when to visit","weather"], a: "Winter (October–February) has the clearest skies and easiest trekking. Visit in monsoon (June–September) specifically for Jatinga's bird phenomenon and Panimur at full flow." },
    { keys: ["price","cost","package","book","booking"], a: "Packages range from ₹4,500 for a weekend trip up to ₹13,500 for the full 5-day Explorer package. Check the Packages page for details, or head to Booking to reserve." },
    { keys: ["permit","foreigner","visa"], a: "Indian nationals don't need special permits for most of the district. Foreign nationals may need a Protected Area Permit for certain zones — we handle this paperwork if you book with us." },
    { keys: ["contact","phone","email","reach you"], a: "You can reach us at +91 8099774793 or novinjoishi789@gmail.com — or use the Contact page form." },
  ];

  function findAnswer(text) {
    const q = text.toLowerCase();
    let best = null, bestScore = 0;
    KB.forEach(entry => {
      const score = entry.keys.filter(k => q.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    return best ? best.a : "I don't have a specific answer for that yet — try asking about a destination (Jatinga, Borail, Tumjang, Haflong, Panimur, Maibang), distances, best season, permits, or pricing. For anything else, reach us directly at +91 8099774793.";
  }

  const toggle = document.getElementById("chatToggle");
  const panel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("chatClose");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");
  const messages = document.getElementById("chatMessages");

  function addMessage(text, role) {
    const el = document.createElement("div");
    el.className = "chat-msg " + role;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  toggle.addEventListener("click", () => panel.classList.toggle("open"));
  closeBtn.addEventListener("click", () => panel.classList.remove("open"));

  addMessage("Namaste! Ask me about a destination, distances, best season, permits, or pricing.", "bot");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, "user");
    input.value = "";
    setTimeout(() => addMessage(findAnswer(text), "bot"), 350);
  });
})();