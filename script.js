// --- State Management & LocalStorage ---
let transactions = JSON.parse(localStorage.getItem('budget_box_txs')) || [
    { id: '1', title: 'Monthly Salary', amount: 45000, category: 'Salary', type: 'income', date: '2026-10-01' },
    { id: '2', title: 'Groceries Supermarket', amount: 3200, category: 'Food', type: 'expense', date: '2026-10-03' },
    { id: '3', title: 'Uber Ride to Office', amount: 450, category: 'Travel', type: 'expense', date: '2026-10-04' },
    { id: '4', title: 'Electricity Bill', amount: 1850, category: 'Bills', type: 'expense', date: '2026-10-05' },
    { id: '5', title: 'New Sneakers', amount: 2999, category: 'Shopping', type: 'expense', date: '2026-10-06' }
];

// Category definitions with Neo-Brutalist pastel colors
const categoryColors = {
    'Food': '#FF94B8',
    'Travel': '#8AD1FF',
    'Bills': '#FFEE55',
    'Shopping': '#D29FFF',
    'Salary': '#7EE8B5',
    'Others': '#FFB366'
};

const expenseCategories = ['Food', 'Travel', 'Bills', 'Shopping', 'Others'];
const incomeCategories = ['Salary', 'Others'];

// --- Supabase Config Variables ---
let supabaseClient = null;
let supabaseConfig = JSON.parse(localStorage.getItem('budget_box_supabase')) || { url: '', key: '' };

// --- Startup Loading Screen Animation Sequence ---
window.addEventListener('DOMContentLoaded', function() {
    const progressBar = document.getElementById('progress-bar');
    const loadingStatus = document.getElementById('loading-status');
    const loadingScreen = document.getElementById('loading-screen');

    let progress = 0;
    const interval = setInterval(function() {
        progress += Math.floor(Math.random() * 25) + 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            loadingStatus.textContent = "READY TO LAUNCH!";
            setTimeout(function() {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.visibility = 'hidden';
            }, 400);
        }
        progressBar.style.width = progress + '%';
        if (progress > 50) {
            loadingStatus.textContent = "BUILDING ANALYTICS & PIE CHARTS...";
        }
    }, 120);

    // Initialize App
    document.getElementById('tx-date').valueAsDate = new Date();
    updateCategoryOptions();
    initSupabaseFromStorage();
    renderAll();
});

// --- Custom Notification Modal ---
function showNotification(title, message, icon) {
    icon = icon || '✨';
    document.getElementById('notification-title').textContent = title;
    document.getElementById('notification-message').textContent = message;
    document.getElementById('notification-icon').textContent = icon;
    document.getElementById('notification-modal').classList.remove('hidden');
}

function closeNotification() {
    document.getElementById('notification-modal').classList.add('hidden');
}

// --- Category Selection Handler ---
function updateCategoryOptions() {
    const type = document.getElementById('tx-type').value;
    const categorySelect = document.getElementById('tx-category');
    const categories = type === 'expense' ? expenseCategories : incomeCategories;

    categorySelect.innerHTML = '';
    categories.forEach(function(cat) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
}

// --- CRUD Operations ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('tx-title').value.trim();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const type = document.getElementById('tx-type').value;
    const date = document.getElementById('tx-date').value;

    if (!title || isNaN(amount) || amount <= 0) {
        showNotification('Invalid Input', 'Please enter a valid title and positive amount.', '⚠️');
        return;
    }

    const newTx = {
        id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4),
        title: title,
        amount: amount,
        category: category,
        type: type,
        date: date
    };

    transactions.unshift(newTx);
    saveAndRefresh();

    // Reset form
    document.getElementById('transaction-form').reset();
    document.getElementById('tx-date').valueAsDate = new Date();
    updateCategoryOptions();

    // If Supabase is connected, sync first
    await syncInsertToSupabase(newTx);
}

function deleteTransaction(id) {
    transactions = transactions.filter(function(t) { return t.id !== id; });
    saveAndRefresh();
    showNotification('Deleted', 'Transaction removed from ledger.', '🗑️');
}

function saveAndRefresh() {
    localStorage.setItem('budget_box_txs', JSON.stringify(transactions));
    renderAll();
}

function renderAll() {
    renderMetrics();
    renderTransactions();
    renderPieChart();
}

// --- Metrics Render ---
function renderMetrics() {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(function(t) {
        if (t.type === 'income') {
            totalIncome += t.amount;
        } else {
            totalExpense += t.amount;
        }
    });

    const balance = totalIncome - totalExpense;

    document.getElementById('total-balance').textContent = '₹' + balance.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('total-income').textContent = '+₹' + totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    document.getElementById('total-expense').textContent = '-₹' + totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// --- Transaction List & Filtering Render ---
function renderTransactions() {
    const listEl = document.getElementById('transaction-list');
    const searchVal = document.getElementById('search-input').value.toLowerCase();
    const filterCat = document.getElementById('filter-category').value;

    const filtered = transactions.filter(function(t) {
        const matchesSearch = t.title.toLowerCase().includes(searchVal) || t.category.toLowerCase().includes(searchVal);
        const matchesCat = filterCat === 'all' || t.category === filterCat;
        return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="text-center py-8 border-2 border-dashed border-black/30 p-4"><p class="font-mono text-xs uppercase text-gray-500 font-bold">No transactions found</p></div>';
        return;
    }

    listEl.innerHTML = '';
    filtered.forEach(function(t) {
        const isInc = t.type === 'income';
        const colorHex = categoryColors[t.category] || '#FFF';

        const item = document.createElement('div');
        item.className = 'neo-box-sm bg-white p-3 sm:p-4 flex items-center justify-between gap-3 hover:translate-x-1 transition-transform';
        item.innerHTML = '<div class="flex items-center gap-3"><div class="w-10 h-10 border-2 border-black flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#000]" style="background-color: ' + colorHex + '">' + t.category.charAt(0) + '</div><div><h4 class="font-black text-sm sm:text-base">' + escapeHtml(t.title) + '</h4><div class="flex items-center gap-2 mt-0.5"><span class="font-mono text-[10px] bg-black text-white px-1.5 py-0.5 uppercase">' + t.category + '</span><span class="font-mono text-[10px] text-gray-500">' + t.date + '</span></div></div></div><div class="flex items-center gap-4"><span class="font-mono font-black text-sm sm:text-base ' + (isInc ? 'text-green-700' : 'text-red-700') + '">' + (isInc ? '+' : '-') + '₹' + t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) + '</span><button onclick="deleteTransaction(\'' + t.id + '\')" class="text-gray-400 hover:text-red-600 font-mono font-bold px-2 py-1 border border-transparent hover:border-black hover:bg-red-100 transition-colors">✕</button></div>';
        listEl.appendChild(item);
    });
}

// --- SVG Pie Chart Analytics ---
function renderPieChart() {
    const svg = document.getElementById('pie-chart');
    const legendEl = document.getElementById('category-legend');
    const centerAmountEl = document.getElementById('chart-center-amount');

    svg.innerHTML = '';
    legendEl.innerHTML = '';

    const expenseTxs = transactions.filter(function(t) { return t.type === 'expense'; });
    const categoryTotals = {};
    let totalExpenseSum = 0;

    expenseTxs.forEach(function(t) {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        totalExpenseSum += t.amount;
    });

    centerAmountEl.textContent = '₹' + totalExpenseSum.toLocaleString('en-IN', { maximumFractionDigits: 0 });

    if (totalExpenseSum === 0) {
        svg.innerHTML = '<circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="20" />';
        legendEl.innerHTML = '<p class="text-center font-mono text-xs text-gray-400">No expense records to analyze.</p>';
        return;
    }

    let cumulativePercent = 0;
    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    Object.keys(categoryTotals).forEach(function(cat) {
        const amount = categoryTotals[cat];
        const percentage = amount / totalExpenseSum;
        const strokeDasharray = (percentage * circumference) + ' ' + circumference;
        const strokeDashoffset = -cumulativePercent * circumference;
        const color = categoryColors[cat] || '#ccc';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '22');
        circle.setAttribute('stroke-dasharray', strokeDasharray);
        circle.setAttribute('stroke-dashoffset', strokeDashoffset);
        circle.style.transition = 'stroke-dasharray 0.5s ease';

        svg.appendChild(circle);
        cumulativePercent += percentage;

        const percentDisplay = Math.round(percentage * 100);
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center justify-between text-xs font-mono';
        legendItem.innerHTML = '<div class="flex items-center gap-2"><span class="w-3 h-3 border border-black shadow-[1px_1px_0px_#000]" style="background-color: ' + color + '"></span><span class="font-bold">' + cat + '</span></div><div class="flex items-center gap-3"><span class="text-gray-500">' + percentDisplay + '%</span><span class="font-black">₹' + amount.toLocaleString('en-IN') + '</span></div>';
        legendEl.appendChild(legendItem);
    });
}

// --- CSV Export Function ---
function exportDataCSV() {
    if (transactions.length === 0) {
        showNotification('Empty Ledger', 'No transactions available to export.', '⚠️');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,ID,Title,Category,Type,Amount,Date\n";
    transactions.forEach(function(t) {
        csvContent += '"' + t.id + '","' + t.title.replace(/"/g, '""') + '","' + t.category + '","' + t.type + '",' + t.amount + ',"' + t.date + '"\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", 'budget_box_expenses_' + new Date().toISOString().slice(0,10) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported!', 'Transactions downloaded as CSV file.', '📥');
}

// --- Supabase Integration Handlers ---
function openSupabaseModal() {
    document.getElementById('supabase-url').value = supabaseConfig.url;
    document.getElementById('supabase-key').value = supabaseConfig.key;
    document.getElementById('supabase-modal').classList.remove('hidden');
}

function closeSupabaseModal() {
    document.getElementById('supabase-modal').classList.add('hidden');
}

function initSupabaseFromStorage() {
    if (supabaseConfig.url && supabaseConfig.key) {
        try {
            supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.key);
            document.getElementById('sync-status-badge').textContent = 'Supabase Connected';
            fetchSupabaseTransactions();
        } catch (e) {
            console.error("Supabase initialization error:", e);
        }
    }
}

function saveSupabaseConfig() {
    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();

    if (!url || !key) {
        showNotification('Missing Fields', 'Please enter both Supabase URL and Anon Key.', '⚠️');
        return;
    }

    supabaseConfig = { url: url, key: key };
    localStorage.setItem('budget_box_supabase', JSON.stringify(supabaseConfig));
    initSupabaseFromStorage();
    closeSupabaseModal();
    showNotification('Connected!', 'Supabase credentials saved successfully.', '☁️');
}

async function testSupabaseSync() {
    const url = document.getElementById('supabase-url').value.trim();
    const key = document.getElementById('supabase-key').value.trim();
    if (!url || !key) {
        showNotification('Missing Credentials', 'Fill in URL and Key first.', '⚠️');
        return;
    }

    try {
        const tempClient = window.supabase.createClient(url, key);
        const response = await tempClient.from('expenses').select('*').limit(1);
        if (response.error) throw response.error;
        showNotification('Connection Verified!', 'Successfully connected to Supabase "expenses" table.', '✅');
    } catch (err) {
        showNotification('Connection Failed', err.message || 'Check table schema and credentials.', '❌');
    }
}

async function fetchSupabaseTransactions() {
    if (!supabaseClient) return;
    try {
        const response = await supabaseClient.from('expenses').select('*');
        if (!response.error && response.data && response.data.length > 0) {
            transactions = response.data;
            saveAndRefresh();
        }
    } catch (err) {
        console.log("Supabase fetch notice:", err);
    }
}

async function syncInsertToSupabase(tx) {
    if (!supabaseClient) {
        showNotification('Saved Locally', 'Supabase is not connected.', '⚠️');
        return;
    }
    try {
        const response = await supabaseClient
            .from('expenses')
            .insert([tx]);

        if (response.error) {
            showNotification('Supabase Error', response.error.message, '❌');
            console.error("Supabase insert error:", response.error);
            return;
        }

        showNotification('Success!', 'Transaction stored in Supabase.', '🚀');

    } catch (err) {
        showNotification('Supabase Error', err.message, '❌');
        console.error("Supabase sync warning:", err);
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}