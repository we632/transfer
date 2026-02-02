// static/app.js
const t = window.__T__;
const lang = window.__LANG__;
const tbody = document.querySelector("#tbl tbody");
const errBox = document.querySelector("#errBox");
const blockedRangesEl = document.querySelector("#blockedRanges");
const blockedRangesParam = window.__BLOCKED_RANGES__ || "";

function showErr(msg){
  errBox.style.display = "block";
  errBox.textContent = msg;
}
function clearErr(){
  errBox.style.display = "none";
  errBox.textContent = "";
}

function routeOptions() {
  // A01 - A25
  const opts = [];
  for (let i=1;i<=25;i++){
    const v = "A" + String(i).padStart(2,"0");
    opts.push(`<option value="${v}">${v}</option>`);
  }
  return opts.join("");
}

function addRow(defaults = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="date" class="from_date" value="${defaults.from_date||""}"></td>
    <td>
      <select class="route">${routeOptions()}</select>
    </td>
    <td><input type="text" class="from_driver" value="${defaults.from_driver||""}"></td>
    <td><input type="text" class="from_range" placeholder="100-120" value="${defaults.from_range||""}"></td>
    <td><input type="date" class="to_date" value="${defaults.to_date||""}"></td>
    <td><input type="text" class="to_driver" value="${defaults.to_driver||""}"></td>
    <td><input type="text" class="to_range" placeholder="100-120" value="${defaults.to_range||""}"></td>

    <!-- ✅ 不可转：方案A（行级锁定） -->
    <td style="text-align:center;">
      <input type="checkbox" class="locked" ${defaults.locked ? "checked": ""}>
    </td>

    <td><button type="button" class="btnDel">${t["delete"]}</button></td>
  `;
  tr.querySelector(".route").value = defaults.route || "A01";

  tr.querySelector(".btnDel").addEventListener("click", () => {
    tr.remove();
  });

  tbody.appendChild(tr);
}

function collectRows() {
  const rows = [];
  for (const tr of tbody.querySelectorAll("tr")) {
    rows.push({
      from_date: tr.querySelector(".from_date").value,
      route: tr.querySelector(".route").value,
      from_driver: tr.querySelector(".from_driver").value.trim(),
      from_range: tr.querySelector(".from_range").value.trim(),
      to_date: tr.querySelector(".to_date").value,
      to_driver: tr.querySelector(".to_driver").value.trim(),
      to_range: tr.querySelector(".to_range").value.trim(),
      locked: tr.querySelector(".locked").checked
    });
  }
  return rows;
}


document.querySelector("#btnAddRow").addEventListener("click", () => {
  clearErr();
  addRow();
});

// 初始一行
addRow();

// 修改生成链接的逻辑 (static/app.js)

const genLinkBtn = document.getElementById("genLinkBtn");
if (genLinkBtn) {
  genLinkBtn.addEventListener("click", () => {
    const val = blockedRangesEl.value.trim(); // 格式应为 A01:100-120, A02:200-250
    if (!val) {
      alert("请输入不可转范围，格式：线路:范围 (如 A01:100-120)");
      return;
    }

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("lang", lang);
    
    // 使用 Base64 简单处理，让链接看起来像是一串加密字符
    const secretToken = btoa(unescape(encodeURIComponent(val)));
    url.searchParams.set("token", secretToken); 

    document.getElementById("genLinkOut").value = url.toString();
    clearErr();
  });
}

// 页面加载时解析 token
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
if (token) {
  try {
    const decoded = decodeURIComponent(escape(atob(token)));
    window.__BLOCKED_RANGES__ = decoded;
    blockedRangesEl.value = decoded;
    blockedRangesEl.readOnly = true;
    blockedRangesEl.style.background = "#f5f5f5";
    // 如果有 token，隐藏管理员配置控件，只给填写者看表格
    if(genLinkBtn) genLinkBtn.parentElement.style.display = 'none';
  } catch (e) {
    console.error("Invalid Token");
  }
}
// 如有 blocked_ranges 参数，textarea 只读
if (blockedRangesParam) {
  blockedRangesEl.value = blockedRangesParam;
  blockedRangesEl.readOnly = true;
  blockedRangesEl.style.background = "#f5f5f5";
}

document.querySelector("#btnDownload").addEventListener("click", async () => {
  clearErr();
  const payload = {
    lang,
    blocked_ranges: blockedRangesParam || blockedRangesEl.value.trim(), // 优先参数
    rows: collectRows()
  };

  const resp = await fetch("/pdf", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const data = await resp.json().catch(()=>({msg:"Error"}));
    showErr(data.msg || "Error");
    return;
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "transfer_log.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
