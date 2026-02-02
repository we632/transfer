// static/app.js
const t = window.__T__;
const lang = window.__LANG__;
const tbody = document.querySelector("#tbl tbody");
const errBox = document.querySelector("#errBox");
const blockedRangesEl = document.querySelector("#blockedRanges");

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

document.querySelector("#btnDownload").addEventListener("click", async () => {
  clearErr();
  const payload = {
    lang,
    blocked_ranges: blockedRangesEl.value.trim(), // ✅ 方案B：不可转范围
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
