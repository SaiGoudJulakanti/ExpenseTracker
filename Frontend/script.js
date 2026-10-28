const TX_KEY = "finora-transactions-v1";
const PREF_KEY = "finora-preferences-v1";
const GOAL_KEY = "finora-goals-v1";
// Java HttpServer backend connected to MySQL
const API_URL = "http://localhost:8080/api";
let transactionsCache = [];

async function loadTransactionsFromAPI() {
  const response = await fetch(`${API_URL}/transactions`);

  if (!response.ok) {
    throw new Error("Could not load transactions from the Java backend.");
  }

  const data = await response.json();

  transactionsCache = data.map(t => ({
    id: String(t.id),
    description: t.title ?? t.description ?? "",
    amount: Number(t.amount),
    type: String(t.type).toLowerCase(),
    category: t.category || "Other",
    date: t.transactionDate ?? t.transaction_date ?? t.date ?? "",
    notes: t.notes || "",
    recurring: false,
    paymentMethod:
      t.paymentMethod ?? t.payment_method ?? "Other"
  }));

  return transactionsCache;
}

function apiTransactionData(record) {
  return {
    title: record.description,
    amount: Number(record.amount),
    type: record.type.toUpperCase(),
    category: record.category,
    transactionDate: record.date,
    paymentMethod: record.paymentMethod,
    notes: record.notes || ""
  };
}

const CATEGORIES = {
  income: ["Salary", "Freelance", "Investment", "Other"],
  expense: [
    "Food", "Transport", "Shopping", "Bills",
    "Education", "Health", "Entertainment", "Other"
  ]
};

const COLORS = [
  "#7564ee", "#20b486", "#f2aa4c", "#e35c78",
  "#4299e1", "#a276d8", "#e88b57", "#56b5c5"
];

const $ = id => document.getElementById(id);

const money = n => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(Number(n) || 0);

function today() {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function readList(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getTransactions() {
  return transactionsCache;
}

function preferences() {
  try {
    return {
      budget: 15000,
      ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}")
    };
  } catch {
    return { budget: 15000 };
  }
}

function savePreferences(p) {
  localStorage.setItem(PREF_KEY, JSON.stringify(p));
}

function sum(items, type) {
  return items
    .filter(t => t.type === type)
    .reduce((n, t) => n + Number(t.amount), 0);
}

function monthKey(date) {
  return date.slice(0, 7);
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);

  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit"
  });
}

function monthData(items) {
  const result = {};

  items.forEach(t => {
    const key = monthKey(t.date);

    if (!result[key]) {
      result[key] = { income: 0, expense: 0 };
    }

    result[key][t.type] += Number(t.amount);
  });

  return result;
}

function lastMonths(items, count = 6) {
  const map = monthData(items);
  const keys = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);

    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return {
    labels: keys.map(monthLabel),
    income: keys.map(k => map[k]?.income || 0),
    expense: keys.map(k => map[k]?.expense || 0)
  };
}

function categoryData(items) {
  const result = {};

  items
    .filter(t => t.type === "expense")
    .forEach(t => {
      const category = t.category || "Other";
      result[category] = (result[category] || 0) + Number(t.amount);
    });

  return Object.entries(result).sort((a, b) => b[1] - a[1]);
}

const charts = {};

function barChart(id, items) {
  const canvas = $(id);

  if (!canvas || typeof Chart === "undefined") return;

  charts[id]?.destroy();

  const data = lastMonths(items);

  charts[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Income",
          data: data.income,
          backgroundColor: "#20b486",
          borderRadius: 5
        },
        {
          label: "Expenses",
          data: data.expense,
          backgroundColor: "#7564ee",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, boxWidth: 7 }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(130,130,160,.12)" },
          ticks: {
            callback: v => "₹" + Number(v).toLocaleString("en-IN")
          }
        }
      }
    }
  });
}

function donutChart(id, legendId, items) {
  const canvas = $(id);

  if (!canvas || typeof Chart === "undefined") return;

  charts[id]?.destroy();

  const entries = categoryData(items);

  charts[id] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: entries.length ? entries.map(e => e[0]) : ["No expenses"],
      datasets: [{
        data: entries.length ? entries.map(e => e[1]) : [1],
        backgroundColor: entries.length
          ? entries.map((_, i) => COLORS[i % COLORS.length])
          : ["#e9e9f2"],
        borderWidth: 0,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: { legend: { display: false } }
    }
  });

  const legend = $(legendId);

  if (legend) {
    legend.innerHTML = entries.length
      ? entries.map(([name, amount], i) =>
          `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${safeText(name)} · ${money(amount)}</span>`
        ).join("")
      : "<span>No expense data yet</span>";
  }
}

function renderRows(items, targetId, detailed = false) {
  const target = $(targetId);

  if (!target) return;

  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) {
    target.innerHTML = `
      <tr>
        <td class="empty" colspan="${detailed ? 6 : 3}">
          No transactions yet. Add your first transaction to get started.
        </td>
      </tr>`;
    return;
  }

  target.innerHTML = sorted.map(t => {
    const amount = `${t.type === "income" ? "+" : "−"}${money(t.amount)}`;

    if (!detailed) {
      return `
        <tr>
          <td>
            ${safeText(t.description)}
            ${t.recurring ? ' <span title="Recurring reminder">↻</span>' : ""}
          </td>
          <td>${safeText(t.date)}</td>
          <td class="${t.type === "income" ? "amount-income" : "amount-expense"}">
            ${amount}
          </td>
        </tr>`;
    }

    return `
      <tr>
        <td>
          ${safeText(t.description)}
          ${t.recurring ? '<div class="muted">↻ Recurring reminder</div>' : ""}
        </td>
        <td>${safeText(t.category)}</td>
        <td>${safeText(t.date)}</td>
        <td>
          <span class="type-pill ${t.type}">
            ${t.type === "income" ? "Income" : "Expense"}
          </span>
        </td>
        <td class="${t.type === "income" ? "amount-income" : "amount-expense"}">
          ${amount}
        </td>
        <td>
          <button class="text-link button-link" data-edit="${safeText(t.id)}">Edit</button>
          <button class="text-link button-link" data-delete="${safeText(t.id)}">Delete</button>
        </td>
      </tr>`;
  }).join("");
}

function toast(message) {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function setupShared() {
  if (localStorage.getItem("finora-theme") === "dark") {
    document.body.classList.add("dark");
  }

  $("themeToggle")?.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    localStorage.setItem(
      "finora-theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );

    toast(document.body.classList.contains("dark")
      ? "Dark mode enabled"
      : "Light mode enabled");
  });

  document.querySelectorAll("[data-close]").forEach(btn =>
    btn.addEventListener("click", () => $(btn.dataset.close)?.close())
  );
}

function monthExpenses(items) {
  return sum(items.filter(t => monthKey(t.date) === today().slice(0, 7)), "expense");
}

function renderBudget(items) {
  const spent = monthExpenses(items);
  const limit = Math.max(1, Number(preferences().budget) || 15000);
  const percent = spent / limit * 100;

  if ($("budgetSpent")) $("budgetSpent").textContent = money(spent);
  if ($("budgetLimit")) $("budgetLimit").textContent = money(limit);

  if ($("budgetProgress")) {
    $("budgetProgress").style.width = Math.min(100, percent) + "%";
    $("budgetProgress").style.background =
      percent >= 100 ? "#dd5570" : percent >= 80 ? "#f2aa4c" : "";
  }

  if ($("budgetPercent")) $("budgetPercent").textContent = Math.round(percent) + "%";

  if ($("budgetMessage")) {
    $("budgetMessage").textContent =
      percent >= 100 ? `Budget exceeded by ${money(spent - limit)}.` :
      percent >= 80 ? `${money(limit - spent)} remaining — you're getting close.` :
      `${money(limit - spent)} left to spend this month.`;
  }
}

function getGoals() {
  return readList(GOAL_KEY).filter(
    g => g && typeof g.id === "string" && g.name && Number(g.target) > 0
  );
}

function renderGoals() {
  const target = $("goalList");
  if (!target) return;

  const goals = getGoals();

  if (!goals.length) {
    target.innerHTML = '<p style="font-size:11px;color:var(--muted)">No savings goals yet. Add one to track your progress.</p>';
    return;
  }

  target.innerHTML = goals.map(g => {
    const percent = Math.min(100, Number(g.saved) / Number(g.target) * 100);

    return `
      <div class="goal-item">
        <div class="goal-meta">
          <strong>${safeText(g.name)}</strong>
          <span>${Math.round(percent)}%</span>
        </div>
        <div class="progress"><div style="width:${percent}%"></div></div>
        <div class="goal-labels">
          <span>${money(g.saved)} saved · Target ${money(g.target)}</span>
          <button class="text-link button-link" data-remove-goal="${safeText(g.id)}">Remove</button>
        </div>
      </div>`;
  }).join("");
}

function initDashboard(items) {
  const income = sum(items, "income");
  const expense = sum(items, "expense");

  if ($("todayLabel")) {
    $("todayLabel").textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "short", day: "numeric", month: "short", year: "numeric"
    });
  }

  if ($("balance")) $("balance").textContent = money(income - expense);
  if ($("income")) $("income").textContent = money(income);
  if ($("expenses")) $("expenses").textContent = money(expense);
  if ($("monthExpense")) $("monthExpense").textContent = money(monthExpenses(items));
  if ($("heroBalance")) $("heroBalance").textContent = money(income - expense);

  barChart("cashflowChart", items);
  donutChart("spendingChart", "spendingLegend", items);

  renderRows(
    items.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    "recentRows"
  );

  renderBudget(items);
  renderGoals();

  $("editBudgetBtn")?.addEventListener("click", () => {
    $("budgetForm").elements.budget.value = preferences().budget;
    $("budgetDialog").showModal();
  });

  $("budgetForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const budget = Number(new FormData(e.currentTarget).get("budget"));

    if (!Number.isFinite(budget) || budget <= 0) return toast("Enter a valid budget.");

    savePreferences({ ...preferences(), budget });
    $("budgetDialog").close();
    renderBudget(getTransactions());
    toast("Monthly budget updated.");
  });

  $("newGoalBtn")?.addEventListener("click", () => {
    $("goalForm").reset();
    $("goalDialog").showModal();
  });

  $("goalForm")?.addEventListener("submit", e => {
    e.preventDefault();

    const form = new FormData(e.currentTarget);
    const target = Number(form.get("target"));
    const saved = Number(form.get("saved"));

    if (target <= 0 || saved < 0) return toast("Enter valid goal amounts.");

    const goals = getGoals();
    goals.push({
      id: makeId(),
      name: String(form.get("name")).trim(),
      target,
      saved
    });

    localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
    $("goalDialog").close();
    renderGoals();
    toast("Savings goal added.");
  });

  $("goalList")?.addEventListener("click", e => {
    const btn = e.target.closest("[data-remove-goal]");
    if (!btn || !confirm("Remove this savings goal?")) return;

    localStorage.setItem(
      GOAL_KEY,
      JSON.stringify(getGoals().filter(g => g.id !== btn.dataset.removeGoal))
    );

    renderGoals();
    toast("Savings goal removed.");
  });
}

function downloadCSV(items, filename) {
  const rows = [
    ["Description", "Amount", "Type", "Category", "Date", "Payment Method", "Notes", "Recurring"],
    ...items.map(t => [
      t.description,
      t.amount,
      t.type,
      t.category,
      t.date,
      t.paymentMethod || "Other",
      t.notes || "",
      t.recurring ? "Yes" : "No"
    ])
  ];

  const csv = rows.map(row => row.map(value => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initTransactions(items) {
  $("txCount").textContent = items.length;
  $("txIncome").textContent = money(sum(items, "income"));
  $("txExpenses").textContent = money(sum(items, "expense"));
  $("txBalance").textContent = money(sum(items, "income") - sum(items, "expense"));

  const dialog = $("transactionDialog");
  const form = $("transactionForm");
  const type = $("formType");
  const category = $("formCategory");
  const date = $("formDate");
  const paymentField = $("paymentMethod");

  date.max = today();
  date.value = today();

  function updateCategories(selected) {
    const options = CATEGORIES[type.value];

    category.innerHTML = options.map(c => `<option>${safeText(c)}</option>`).join("");

    if (options.includes(selected)) category.value = selected;
  }

  type.addEventListener("change", () => updateCategories());
  updateCategories();

  function filtered() {
    const q = $("searchInput").value.trim().toLowerCase();
    const ty = $("typeFilter").value;
    const cat = $("categoryFilter").value;
    const from = $("fromDate").value;
    const to = $("toDate").value;

    return getTransactions().filter(t =>
      `${t.description} ${t.category} ${t.notes || ""} ${t.paymentMethod || ""}`.toLowerCase().includes(q) &&
      (ty === "all" || t.type === ty) &&
      (cat === "all" || t.category === cat) &&
      (!from || t.date >= from) &&
      (!to || t.date <= to)
    );
  }

  function refresh() {
    const found = filtered();
    renderRows(found, "transactionRows", true);
    $("resultCount").textContent = `Showing ${found.length} of ${getTransactions().length} transactions`;
  }

  ["searchInput", "typeFilter", "categoryFilter", "fromDate", "toDate"]
    .forEach(id => $(id)?.addEventListener("input", refresh));

  $("clearFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("typeFilter").value = "all";
    $("categoryFilter").value = "all";
    $("fromDate").value = "";
    $("toDate").value = "";
    refresh();
  });

  $("addTransactionBtn").addEventListener("click", () => {
    form.reset();
    form.elements.id.value = "";
    $("transactionModalTitle").textContent = "Add transaction";
    date.value = today();
    if (paymentField) paymentField.value = "";
    updateCategories();
    dialog.showModal();
  });

  $("transactionRows").addEventListener("click", async e => {
    const del = e.target.closest("[data-delete]");
    const edit = e.target.closest("[data-edit]");

    if (del) {
      if (!confirm("Delete this transaction? This cannot be undone.")) return;

      try {
        const response = await fetch(
          `${API_URL}/transactions/${encodeURIComponent(del.dataset.delete)}`,
          { method: "DELETE" }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Delete failed");

        toast("Transaction deleted.");
        setTimeout(() => location.reload(), 250);
      } catch (error) {
        console.error(error);
        toast(error.message || "Could not delete transaction.");
      }

      return;
    }

    if (edit) {
      const t = getTransactions().find(x => x.id === edit.dataset.edit);
      if (!t) return;

      form.reset();
      form.elements.id.value = t.id;
      form.elements.description.value = t.description;
      form.elements.amount.value = t.amount;
      form.elements.type.value = t.type;

      updateCategories(t.category);

      form.elements.date.value = t.date;
      form.elements.notes.value = t.notes || "";

      if (paymentField) {
        paymentField.value = t.paymentMethod || "Other";
      }

      if (form.elements.recurring) {
        form.elements.recurring.checked = !!t.recurring;
      }

      $("transactionModalTitle").textContent = "Edit transaction";
      dialog.showModal();
    }
  });

  // Save the exact selected payment method to the Java backend.
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const d = new FormData(form);
    const amount = Number(d.get("amount"));
    const dateValue = String(d.get("date") || "");
    const id = String(d.get("id") || "");
    const selectedPaymentMethod = String(
      d.get("payment_method") || paymentField?.value || ""
    ).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return toast("Amount must be greater than zero.");
    }

    if (!dateValue || dateValue > today()) {
      return toast("Choose a valid date, not a future date.");
    }

    if (!selectedPaymentMethod) {
      return toast("Please select a payment method.");
    }

    const record = {
      description: String(d.get("description") || "").trim(),
      amount,
      type: String(d.get("type") || "expense").toLowerCase(),
      category: String(d.get("category") || "Other"),
      date: dateValue,
      notes: String(d.get("notes") || "").trim(),
      paymentMethod: selectedPaymentMethod
    };

    if (!record.description) return toast("Enter a description.");
    if (!record.category) return toast("Choose a category.");

    try {
      const url = id
        ? `${API_URL}/transactions/${encodeURIComponent(id)}`
        : `${API_URL}/transactions`;

      const response = await fetch(url, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiTransactionData(record))
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Could not save transaction.");
      }

      dialog.close();
      toast(id ? "Transaction updated." : "Transaction added.");
      setTimeout(() => location.reload(), 350);

    } catch (error) {
      console.error("Transaction save error:", error);
      toast(error.message || "Could not connect to the backend.");
    }
  });

  $("exportCsv").addEventListener("click", () => {
    downloadCSV(filtered(), "Expense-Transactions.csv");
  });

  refresh();
}

function dateFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function reportItems(items) {
  const period = $("reportPeriod").value;
  const now = new Date();

  let from = "";
  let to = today();

  if (period === "month") {
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  if (period === "lastMonth") {
    from = dateFor(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    to = dateFor(new Date(now.getFullYear(), now.getMonth(), 0));
  }

  if (period === "3months") {
    from = dateFor(new Date(now.getFullYear(), now.getMonth() - 2, 1));
  }

  if (period === "6months") {
    from = dateFor(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  }

  if (period === "year") {
    from = `${now.getFullYear()}-01-01`;
  }

  if (period === "custom") {
    from = $("reportFrom").value;
    to = $("reportTo").value || today();
  }

  return items.filter(t => (!from || t.date >= from) && (!to || t.date <= to));
}

function initReports() {
  const period = $("reportPeriod");

  function render() {
    const items = reportItems(getTransactions());
    const income = sum(items, "income");
    const expense = sum(items, "expense");
    const net = income - expense;

    $("reportIncome").textContent = money(income);
    $("reportExpenses").textContent = money(expense);
    $("reportNet").textContent = money(net);
    $("savingsRate").textContent = (income ? Math.round(net / income * 100) : 0) + "%";

    barChart("reportCashflow", items);
    donutChart("reportDonut", "reportLegend", items);

    const rows = Object.entries(monthData(items)).sort((a, b) => b[0].localeCompare(a[0]));

    $("monthlyRows").innerHTML = rows.length
      ? rows.map(([key, v]) => {
          const savings = v.income - v.expense;

          return `
            <tr>
              <td>${safeText(monthLabel(key))}</td>
              <td class="amount-income">${money(v.income)}</td>
              <td class="amount-expense">${money(v.expense)}</td>
              <td class="${savings >= 0 ? "amount-income" : "amount-expense"}">${money(savings)}</td>
              <td>${v.income ? Math.round(savings / v.income * 100) : 0}%</td>
            </tr>`;
        }).join("")
      : '<tr><td colspan="5" class="empty">No transactions for this period.</td></tr>';

    $("reportCsv").onclick = () => downloadCSV(items, "Expense-Report.csv");
  }

  period.addEventListener("change", () => {
    const custom = period.value === "custom";
    $("reportFrom").hidden = !custom;
    $("reportTo").hidden = !custom;
  });

  $("applyReport").addEventListener("click", () => {
    if (
      period.value === "custom" &&
      $("reportFrom").value &&
      $("reportTo").value &&
      $("reportFrom").value > $("reportTo").value
    ) {
      return toast("Start date must be before end date.");
    }

    render();
  });

  $("printReport").addEventListener("click", () => window.print());

  render();
}

// Load transactions from MySQL before initializing each page.
document.addEventListener("DOMContentLoaded", async () => {
  setupShared();

  try {
    await loadTransactionsFromAPI();

    const page = document.body.dataset.page;
    const items = getTransactions();

    if (page === "dashboard") initDashboard(items);
    if (page === "transactions") initTransactions(items);
    if (page === "reports") initReports();

  } catch (error) {
    console.error("Expense Tracker API error:", error);

    alert(
      "Could not connect to the Expense Tracker backend.\n\n" +
      "Make sure the Java server is running at http://localhost:8080 " +
      "and MySQL is available."
    );
  }
});
