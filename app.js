// SUPABASE SAFE SETUP
if (!window.mySupabase) {
    window.mySupabase = window.supabase.createClient("https://ukuzqhevfpzsufomsalp.supabase.co", "sb_publishable_MJzNY_Jf5md4UxyRRxyo7g_3L0ULc8i");
}
const db = window.mySupabase;

// Check if user is logged in via Supabase session on page load
db.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
        console.log("No active session found, redirecting to login...");
        // Agar aapka login page koi alag file hai toh yahan uncomment kar dein:
        // window.location.href = 'login.html'; 
    } else {
        console.log("User session active:", session.user.email);
    }
});

// Listen for auth changes (Login, Logout, Refresh)
db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
        console.log("User signed out or session expired.");
        // window.location.href = 'login.html';
    }
});

// --- PART 1: Initialization, State & Navigation ---

let assets = [];
let employees = []; 

let assignmentHistory = JSON.parse(localStorage.getItem('argos_history')) || [];
let serviceLogs = JSON.parse(localStorage.getItem('argos_service_logs')) || [];
let assetRequests = JSON.parse(localStorage.getItem('argos_requests')) || [];

if (!localStorage.getItem('argos_admin_pass')) localStorage.setItem('argos_admin_pass', 'admin123');
if (!localStorage.getItem('argos_access_emails')) localStorage.setItem('argos_access_emails', JSON.stringify(['admin@argoswatch.com', 'manager@argoswatch.com']));

let adminPassword = localStorage.getItem('argos_admin_pass') || 'admin123';
let accessEmails = JSON.parse(localStorage.getItem('argos_access_emails')) || ['admin@argoswatch.com', 'manager@argoswatch.com'];

// Supabase se Live Assets Fetch karne ka async function
async function fetchAssetsFromSupabase() {
    try {
        const { data, error } = await db.from('assets').select('*');
        if (error) {
            console.error("Supabase error fetching assets:", error);
            return;
        }
        
        assets = (data || []).map(item => {
            let rawStatus = item.status ? item.status.toString().trim().toLowerCase() : 'in stock';
            let formattedStatus = 'In Stock';

            if (rawStatus === 'assigned') {
                formattedStatus = 'Assigned';
            } else if (rawStatus === 'repair' || rawStatus === 'under repair') {
                formattedStatus = 'Under Repair';
            } else if (rawStatus === 'damaged' || rawStatus === 'damaged (office)') {
                formattedStatus = 'Damaged (Office)';
            } else if (rawStatus === 'scrapped') {
                formattedStatus = 'Scrapped';
            } else if (rawStatus === 'stock' || rawStatus === 'in stock') {
                formattedStatus = 'In Stock';
            }

            return {
                serial: item.serial_tag || item.serial || '',
                category: item.category || '',
                model: item.model_number || item.model || '',
                processor: item.processor || '',
                generation: item.generation || '',
                status: formattedStatus,
                assignedTo: item.assigned_to || item.assignedTo || '',
                vendor: item.vendor || '',
                cost: item.cost || 0,
                date: item.date || '',
                warrantyDate: item.warranty_date || item.warrantyDate || '',
                invoiceNo: item.invoice_no || item.invoiceNo || '',
                ram: item.ram || '',
                graphics: item.graphics || '',
                maintenanceLogs: item.maintenance_logs || []
            };
        });

        console.log("Assets with formatted status loaded:", assets);

    } catch (err) {
        console.error("Execution error:", err);
    }
}

// Employees fetch function
async function fetchEmployeesFromSupabase() {
    try {
        const { data, error } = await db.from('employees').select('*');
        if (error) {
            console.error("Supabase error fetching employees:", error);
            return;
        }
        employees = (data || []).map(emp => ({
            id: emp.id || emp.emp_id || '',
            name: emp.name || '',
            email: emp.email || '',
            dept: emp.dept || emp.department || '',
            assigned: emp.assigned || []
        }));
        console.log("Supabase employees loaded:", employees);
    } catch (err) {
        console.error("Employees fetch error:", err);
    }
}

// Supabase se Requests fetch karne ka function
async function fetchRequestsFromSupabase() {
    try {
        const { data, error } = await db.from('asset_requests').select('*');
        if (error) {
            console.error("Supabase error fetching requests:", error);
            return;
        }
        assetRequests = data || [];
        console.log("Supabase asset requests loaded:", assetRequests);
    } catch (err) {
        console.error("Requests fetch error:", err);
    }
}

let auditLogs = [];

// Supabase se Audit Logs fetch karne ka function
async function fetchAuditLogsFromSupabase() {
    try {
        const { data, error } = await db.from('audit_logs').select('*');
        if (error) {
            console.error("Supabase error fetching audit logs:", error);
            return;
        }
        auditLogs = data || [];
        console.log("Supabase audit logs loaded:", auditLogs);
    } catch (err) {
        console.error("Audit logs fetch error:", err);
    }
}

async function submitAssetRequest(e) {
    if (e) e.preventDefault();
    console.log("Submit request initiated...");

    try {
        const idEl = document.getElementById('req-emp-id');
        const nameEl = document.getElementById('req-emp-name');
        const detailsEl = document.getElementById('req-details');

        if (!idEl || !nameEl || !detailsEl) {
            alert("Error: Input fields HTML me nahi mile! IDs check karein.");
            return;
        }

        const id = idEl.value.trim();
        const name = nameEl.value.trim();
        const details = detailsEl.value.trim();

        const newReq = { 
            date: new Date().toLocaleDateString(), 
            emp_id: id, 
            emp_name: name, 
            details: details, 
            status: 'Pending' 
        };

        console.log("Sending to Supabase:", newReq);

        // 1. Database insert
        const { data, error } = await db.from('asset_requests').insert([newReq]);
        
        if (error) {
            console.error("Supabase Error:", error);
            alert("Database Error: " + error.message);
            return;
        }

        console.log("Inserted successfully, closing modal...");

        // 2. Modal close
        if (typeof closeRequestModal === 'function') {
            closeRequestModal();
        }

        // 3. Fresh data fetch & render
        if (typeof fetchAssetRequests === 'function') {
            await fetchAssetRequests();
        }

        if (typeof renderRequestsTable === 'function') {
            renderRequestsTable();
        } else if (typeof refreshAllData === 'function') {
            refreshAllData();
        }

        alert("Request submitted successfully!");

    } catch (err) {
        console.error("Unexpected Error:", err);
        alert("Script Error: " + err.message);
    }
}

function handleCombinedLogin(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('login-email-input');
    const passInput = document.getElementById('login-pass-input');
    
    const enteredEmail = emailInput ? emailInput.value.trim() : 'admin@argoswatch.com';
    const enteredPass = passInput ? passInput.value.trim() : '';
    const currentAdminPass = adminPassword || localStorage.getItem('argos_admin_pass') || 'admin123';
    
    if (enteredPass === currentAdminPass) {
        sessionStorage.setItem('argos_logged_user', enteredEmail || 'Admin');
        showDashboardApp();
    } else {
        alert('Invalid Password! Please enter the correct password.');
        if (passInput) passInput.value = '';
    }
}

function showLoginScreen() {
    const overlay = document.getElementById('login-overlay');
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.getElementById('app-main-content');
    if (overlay) overlay.style.display = 'flex';
    if (sidebar) sidebar.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    const passInput = document.getElementById('login-pass-input');
    if (passInput) passInput.value = '';
}

function showDashboardApp() {
    const overlay = document.getElementById('login-overlay');
    const sidebar = document.getElementById('app-sidebar');
    const mainContent = document.getElementById('app-main-content');
    if (overlay) overlay.style.display = 'none';
    if (sidebar) sidebar.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'flex';
    
    const loggedUser = sessionStorage.getItem('argos_logged_user') || 'Manager';
    const userDisplay = document.getElementById('logged-user-display');
    if (userDisplay) userDisplay.innerText = 'User: ' + loggedUser;
    
    switchTab('dashboard');
    refreshAllData();
}

function logoutSystem() {
    if (typeof stopQrScanner === 'function') stopQrScanner();
    sessionStorage.removeItem('argos_logged_user');
    showLoginScreen();
}

function switchTab(tabId) {
    if (tabId === 'settings') { renderAccessEmailsList(); }
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar ul li').forEach(el => el.classList.remove('active'));
    
    const targetTab = document.getElementById('tab-' + tabId);
    if (targetTab) targetTab.classList.add('active');
    refreshAllData();
}

// --- PART 2: Dashboard, Charts, Breakdowns & Audit Logs ---

function showDashboardStatModal(type) {
    if (type === 'total') { switchTab('assets'); filterAssetsTable(); }
    else if (type === 'assigned') { switchTab('assets'); document.getElementById('asset-filter-status').value = 'Assigned'; filterAssetsTable(); }
    else if (type === 'stock') { switchTab('assets'); document.getElementById('asset-filter-status').value = 'In Stock'; filterAssetsTable(); }
    else if (type === 'repair') { switchTab('assets'); document.getElementById('asset-filter-status').value = 'Under Repair'; filterAssetsTable(); }
    else if (type === 'damaged-office') { switchTab('assets'); document.getElementById('asset-filter-status').value = 'Damaged (In Office)'; filterAssetsTable(); }
    else if (type === 'scrapped') { switchTab('assets'); document.getElementById('asset-filter-status').value = 'Scrapped'; filterAssetsTable(); }
    else if (type === 'employees') { switchTab('employees'); renderEmployeesTable(''); }
}

let categoryChartInstance = null;
let statusChartInstance = null;

function renderDashboardChartsAndValuation() {
    let totalVal = assets.reduce((sum, a) => sum + (Number(a.cost) || 0), 0);
    const valEl = document.getElementById('stat-valuation');
    if (valEl) valEl.innerText = '₹' + totalVal.toLocaleString('en-IN');

    let cats = {};
    assets.forEach(a => { let c = a.category || 'Other'; cats[c] = (cats[c] || 0) + 1; });

    let assignedCount = assets.filter(a => a.status === 'Assigned').length;
    let stockCount = assets.filter(a => a.status === 'In Stock').length;
    let repairCount = assets.filter(a => a.status === 'Under Repair').length;
    let damagedOfficeCount = assets.filter(a => a.status === 'Damaged (In Office)' || a.status === 'Damaged').length;
    let scrappedCount = assets.filter(a => a.status === 'Scrapped').length;

    const repairEl = document.getElementById('stat-repair');
    if (repairEl) repairEl.innerText = repairCount;
    const damagedEl = document.getElementById('stat-damaged-office');
    if (damagedEl) damagedEl.innerText = damagedOfficeCount;
    const scrappedEl = document.getElementById('stat-scrapped');
    if (scrappedEl) scrappedEl.innerText = scrappedCount;

    const palette = ['#2563EB', '#0F172A', '#1D4ED8', '#64748B', '#334155', '#0D9488', '#D97706'];

    const ctxCat = document.getElementById('categoryChart');
    if (ctxCat && typeof Chart !== 'undefined') {
        if (categoryChartInstance) categoryChartInstance.destroy();
        categoryChartInstance = new Chart(ctxCat, {
            type: 'doughnut',
            data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: palette, borderWidth: 2, borderColor: '#FFFFFF' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    const ctxStatus = document.getElementById('statusChart');
    if (ctxStatus && typeof Chart !== 'undefined') {
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(ctxStatus, {
            type: 'bar',
            data: { labels: ['Assigned', 'In Stock', 'Repair', 'Damaged', 'Scrapped'], datasets: [{ label: 'Count', data: [assignedCount, stockCount, repairCount, damagedOfficeCount, scrappedCount], backgroundColor: ['#2563EB', '#0F172A', '#D97706', '#991B1B', '#334155'], borderRadius: 6 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
    renderRequestsBadge();
    renderBreakdownTable();
}

function renderRequestsBadge() {
    const badge = document.getElementById('req-badge');
    if (!badge) return;
    const pending = assetRequests.filter(r => r.status === 'Pending').length;
    if (pending > 0) { badge.style.display = 'inline-block'; badge.innerText = pending; } else { badge.style.display = 'none'; }
}

function renderBreakdownTable() {
    const tbody = document.getElementById('dashboard-breakdown-tbody');
    if (!tbody) return;
    
    let uniqueCategories = [...new Set(assets.map(a => a.category || 'Other'))];
    let html = '';
    
    uniqueCategories.forEach(cat => {
        const catAssets = assets.filter(a => (a.category || 'Other') === cat);
        const catTotal = catAssets.length;
        const catAssigned = catAssets.filter(a => a.status === 'Assigned').length;
        const catStock = catAssets.filter(a => a.status === 'In Stock').length;
        const catRepair = catAssets.filter(a => a.status === 'Under Repair' || a.status === 'Scrapped' || a.status.includes('Damaged')).length;
        
        html += '<tr style="cursor:pointer;" onclick="openDashboardPopup(\'Category: ' + cat + '\', \'' + cat + '\', \'category\')">' +
                    '<td><strong>' + cat + '</strong></td>' +
                    '<td><span class="badge badge-assigned" style="cursor:pointer;">' + catTotal + ' Total</span></td>' +
                    '<td>' + catAssigned + ' Assigned</td>' +
                    '<td>' + catStock + ' In Stock</td>' +
                    '<td>' + catRepair + ' Repair/Scrapped</td>' +
                '</tr>';
    });
    tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No breakdown available.</td></tr>';
}

function renderDashboardBreakdowns() {
    const deptList = document.getElementById('department-breakdown-list');
    if (deptList) {
        deptList.innerHTML = '';
        let deptMap = {};
        assets.forEach(a => {
            if (a.status === 'Assigned' && a.assignedTo) {
                let emp = employees.find(e => e.id === a.assignedTo);
                let dept = emp ? emp.dept : 'Unassigned';
                if (!deptMap[dept]) deptMap[dept] = [];
                deptMap[dept].push(a);
            }
        });
        
        if (Object.keys(deptMap).length === 0) { 
            deptList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No assets assigned.</p>'; 
        } else {
            for (let dept in deptMap) { 
                let count = deptMap[dept].length;
                let div = document.createElement('div');
                div.style.cssText = "display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:8px 0; border-bottom:1px solid var(--border-color); cursor:pointer;";
                div.innerHTML = '<span style="font-weight:500;">' + dept + '</span><span class="badge badge-assigned">' + count + ' Asset(s) (Click to view)</span>';
                div.onclick = function() { openDashboardPopup('Department: ' + dept, dept, 'department'); };
                deptList.appendChild(div);
            }
        }
    }

    const recentLogsBody = document.getElementById('dashboard-recent-logs');
    if (recentLogsBody) {
        recentLogsBody.innerHTML = '';
        if (assignmentHistory.length === 0) { 
            recentLogsBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No activity recorded.</td></tr>'; 
        } else {
            assignmentHistory.slice().reverse().slice(0, 5).forEach(h => {
                let tr = document.createElement('tr');
                tr.innerHTML = '<td><small>' + h.date + '</small></td><td><strong>' + h.type + '</strong></td><td>' + h.details + '</td>';
                recentLogsBody.appendChild(tr);
            });
        }
    }
}

function openDashboardPopup(title, filterKey, type) {
    const titleEl = document.getElementById('dashboard-popup-title');
    const contentEl = document.getElementById('dashboard-popup-content');
    if (!titleEl || !contentEl) return;
    
    titleEl.innerText = title;
    let matchedAssets = [];
    
    if (type === 'category') {
        matchedAssets = assets.filter(a => (a.category || 'Other') === filterKey);
    } else if (type === 'department') {
        matchedAssets = assets.filter(a => {
            if (a.status !== 'Assigned' || !a.assignedTo) return false;
            let emp = employees.find(e => e.id === a.assignedTo);
            let dept = emp ? emp.dept : 'Unassigned';
            return dept === filterKey;
        });
    }
    
    if (matchedAssets.length === 0) {
        contentEl.innerHTML = '<p style="color:var(--text-muted);">No assets found for this selection.</p>';
    } else {
        let html = '<table class="table" style="margin-top:0;"><thead><tr><th>Serial</th><th>Category</th><th>Model</th><th>Status</th><th>Holder / Info</th></tr></thead><tbody>';
        matchedAssets.forEach(a => {
            let emp = a.assignedTo ? employees.find(e => e.id === a.assignedTo) : null;
            let holderText = emp ? emp.name + ' (' + emp.id + ')' : (a.status || 'In Stock');
            html += '<tr><td><span onclick="openAssetHistory(\'' + a.serial + '\')" style="color: #2563EB; font-weight: 600; cursor: pointer; text-decoration: underline;">' + a.serial + '</span></td><td>' + a.category + '</td><td>' + (a.model || 'N/A') + '</td><td>' + a.status + '</td><td>' + holderText + '</td></tr>';
        });
        html += '</tbody></table>';
        contentEl.innerHTML = html;
    }
    document.getElementById('dashboardPopupModal').style.display = 'flex';
}
function closeDashboardPopupModal() { document.getElementById('dashboardPopupModal').style.display = 'none'; }

function renderAuditLogs() {
    const tbody = document.getElementById('audit-logs-body');
    const query = document.getElementById('audit-search-input') ? document.getElementById('audit-search-input').value.toLowerCase() : '';
    const selectedCategory = document.getElementById('audit-category-filter') ? document.getElementById('audit-category-filter').value : '';
    
    if (!tbody) return;
    tbody.innerHTML = '';

    let filteredLogs = auditLogs.filter(log => {
        let textMatch = (log.timestamp && log.timestamp.toLowerCase().includes(query)) || 
                        (log.date && log.date.toLowerCase().includes(query)) || 
                        (log.action && log.action.toLowerCase().includes(query)) || 
                        (log.details && log.details.toLowerCase().includes(query));
        
        let categoryMatch = true;
        if (selectedCategory) {
            let assetFound = assets.find(a => log.details && log.details.includes(a.serial));
            categoryMatch = assetFound && assetFound.category === selectedCategory;
        }
        
        return textMatch && categoryMatch;
    });

    if (filteredLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No audit logs found.</td></tr>';
        return;
    }

    filteredLogs.slice().reverse().forEach(log => {
        let logDate = log.timestamp || log.date || '';
        let logAction = log.action || log.type || '';
        let logDetails = log.details || '';

        let tr = document.createElement('tr');
        tr.innerHTML = '<td><small>' + logDate + '</small></td><td><strong>' + logAction + '</strong></td><td>' + logDetails + '</td>';
        tbody.appendChild(tr);
    });
}

// --- PART 3: Inventory, Employees, Challan Modal & QR Scanner ---

function filterAssetsTable() {
    const query = document.getElementById('asset-search-input') ? document.getElementById('asset-search-input').value.toLowerCase() : '';
    const catFilter = document.getElementById('asset-filter-category') ? document.getElementById('asset-filter-category').value : '';
    const statFilter = document.getElementById('asset-filter-status') ? document.getElementById('asset-filter-status').value : '';

    const filtered = assets.filter(a => {
        const matchesQuery = (a.serial && a.serial.toLowerCase().includes(query)) || (a.category && a.category.toLowerCase().includes(query)) || (a.vendor && a.vendor.toLowerCase().includes(query)) || (a.model && a.model.toLowerCase().includes(query));
        const matchesCat = !catFilter || a.category === catFilter;
        const matchesStat = !statFilter || a.status === statFilter;
        return matchesQuery && matchesCat && matchesStat;
    });

    const tbody = document.getElementById('assets-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (filtered.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No matching assets found.</td></tr>'; 
        return; 
    }

    filtered.forEach(a => {
        let badgeClass = 'badge-stock';
        if (a.status === 'Assigned') badgeClass = 'badge-assigned';
        else if (a.status.includes('Damaged')) badgeClass = 'badge-alert';
        else if (a.status === 'Scrapped') badgeClass = 'badge-scrapped';
        
        let tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = '<td><span onclick="openAssetHistory(\'' + a.serial + '\')" style="color: #2563EB; font-weight: 600; cursor: pointer; text-decoration: underline;">' + a.serial + '</span><br><small style="color:var(--text-muted);">' + (a.model || '') + '</small></td>' +
                       '<td>' + a.category + '</td>' +
                       '<td>Purchased: ' + a.date + '</td>' +
                       '<td>' + (a.vendor || 'N/A') + ' (' + '₹' + (a.cost || 0) + ')</td>' +
                       '<td><span class="badge ' + badgeClass + '">' + a.status + '</span></td>' +
                       '<td><button class="btn" style="background:#0284C7; color:#FFF; padding:4px 8px; font-size:11px; margin-right:4px;" onclick="openMaintenanceModal(\'' + a.serial + '\')">Repair Log</button>' +
                       '<button class="btn" style="background:#EF4444; color:#FFF; padding:4px 8px; font-size:11px;" onclick="deleteAsset(\'' + a.serial + '\')">Delete</button></td>';
        tr.onclick = function() { openAssetDetailModal(a.serial); };
        tbody.appendChild(tr);
    });
}

function openAssetDetailModal(serial) {
    const a = assets.find(item => item.serial === serial);
    if (!a) return;
    const titleEl = document.getElementById('asset-detail-title');
    const contentEl = document.getElementById('asset-detail-content');
    if (!titleEl || !contentEl) return;
    
    titleEl.innerText = "Asset Details: " + a.serial;
    let emp = a.assignedTo ? employees.find(e => e.id === a.assignedTo) : null;
    let assignedInfo = emp ? emp.name + ' (ID: ' + emp.id + ', Dept: ' + emp.dept + ')' : 'Not Assigned / In Stock';
    
    contentEl.innerHTML = 
        '<p><strong>Serial Number:</strong> ' + a.serial + '</p>' +
        '<p><strong>Category:</strong> ' + a.category + '</p>' +
        '<p><strong>Model:</strong> ' + (a.model || 'N/A') + '</p>' +
        '<p><strong>RAM:</strong> ' + (a.ram || 'N/A') + '</p>' +
        '<p><strong>Processor:</strong> ' + (a.processor || 'N/A') + '</p>' +
        '<p><strong>Graphics Card:</strong> ' + (a.graphics || 'N/A') + '</p>' +
        '<p><strong>Status:</strong> ' + a.status + '</p>' +
        '<p><strong>Current Holder:</strong> ' + assignedInfo + '</p>' +
        '<p><strong>Purchase Date:</strong> ' + a.date + '</p>' +
        '<p><strong>Vendor:</strong> ' + (a.vendor || 'N/A') + '</p>' +
        '<p><strong>Cost:</strong> ₹' + (a.cost || 0) + '</p>' +
        '<p><strong>Invoice Number:</strong> ' + (a.invoiceNo || 'N/A') + '</p>';
        
    document.getElementById('assetDetailModal').style.display = 'flex';
}
function closeAssetDetailModal() { document.getElementById('assetDetailModal').style.display = 'none'; }

let html5QrCode = null;
function startQrScanner() {
    const readerEl = document.getElementById('reader');
    if (!readerEl) return;
    readerEl.innerHTML = '';
    
    if (typeof Html5Qrcode !== 'undefined') {
        html5QrCode = new Html5Qrcode("reader");
        html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 250 } }, 
            (decodedText) => { 
                handleScannedCode(decodedText); 
                stopQrScanner(); 
            }, 
            (errorMessage) => {}
        ).catch(err => { 
            console.error(err); 
            alert("Camera access error or permission denied!"); 
        });
    } else {
        alert("QR Scanner library not loaded properly!");
    }
}
function stopQrScanner() { 
    if (html5QrCode) { 
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(() => { html5QrCode = null; }); 
    } 
}

function handleScannedCode(serial) {
    const resultBox = document.getElementById('scan-result-box');
    const infoP = document.getElementById('scanned-asset-info');
    if (resultBox) resultBox.style.display = 'block';
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    if (asset && infoP) {
        let assignedEmp = employees.find(e => e.id === asset.assignedTo);
        infoP.innerHTML = '<strong>Serial:</strong> ' + asset.serial + '<br><strong>Category:</strong> ' + asset.category + '<br><strong>Status:</strong> ' + asset.status + '<br><strong>Assigned To:</strong> ' + (assignedEmp ? assignedEmp.name + ' (' + assignedEmp.dept + ')' : 'None');
    } else if (infoP) {
        infoP.innerHTML = '<span style="color:red;">Asset with serial "' + serial + '" not found!</span>';
    }
}

// --- PART 4: Employees, QR, Challan & Workflows ---

function renderEmployeesTable(searchQuery = '') {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const filtered = employees.filter(e => (e.id && e.id.toLowerCase().includes(searchQuery.toLowerCase())) || (e.name && e.name.toLowerCase().includes(searchQuery.toLowerCase())));
    if (filtered.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No employees found.</td></tr>'; return; }

    filtered.forEach(e => {
        let assignedDetails = e.assigned && e.assigned.length > 0 ? e.assigned.join(', ') : 'None';
        let tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = '<td><strong>' + e.id + '</strong></td>' +
                       '<td>' + e.name + '<br><small style="color:var(--text-muted);">' + (e.email || '') + '</small></td>' +
                       '<td>' + (e.dept || 'N/A') + '</td>' +
                       '<td>' + assignedDetails + '</td>' +
                       '<td><button type="button" class="btn" style="padding:4px 8px; font-size:11px; margin-right:4px;" onclick="event.stopPropagation(); openEmployeeQR(\'' + e.id + '\')">QR Code</button><button type="button" class="btn" style="background:#0D9488; color:#FFF; padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openEmployeeChallanModal(\'' + e.id + '\')">Challan</button></td>' +
                       '<td><button type="button" class="btn" style="background:#EF4444; color:#FFF; padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); deleteEmployee(\'' + e.id + '\')">Delete</button></td>';
        tr.onclick = function() { openEmployeeDetailModal(e.id); };
        tbody.appendChild(tr);
    });
}

function openEmployeeDetailModal(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const titleEl = document.getElementById('emp-detail-title');
    const contentEl = document.getElementById('emp-detail-content');
    if (!titleEl || !contentEl) return;
    
    titleEl.innerText = "Employee Profile: " + emp.name + " (" + emp.id + ")";
    
    let assignedListHtml = '<ul style="margin-left: 20px; margin-top: 5px;">';
    if (emp.assigned && emp.assigned.length > 0) {
        emp.assigned.forEach(serial => {
            let ast = assets.find(a => a.serial === serial);
            let cat = ast ? ast.category : 'Hardware';
            let model = ast && ast.model ? ast.model : 'N/A';
            assignedListHtml += '<li><strong>' + serial + '</strong> - ' + cat + ' (' + model + ') [Assigned]</li>';
        });
    } else {
        assignedListHtml = '<span>None currently assigned</span>';
    }
    assignedListHtml += '</ul>';

    let empHistory = assignmentHistory.filter(h => h.details && h.details.includes(emp.name));
    let historyHtml = '<ul style="margin-left: 20px; margin-top: 5px; font-size: 12px; color: var(--text-muted);">';
    if (empHistory.length > 0) {
        empHistory.slice().reverse().forEach(h => {
            historyHtml += '<li>[' + h.date + '] ' + h.type + ': ' + h.details + '</li>';
        });
    } else {
        historyHtml += '<li>No past activity logs recorded for this employee.</li>';
    }
    historyHtml += '</ul>';

    contentEl.innerHTML = 
        '<p><strong>Name:</strong> ' + emp.name + '</p>' +
        '<p><strong>Employee ID:</strong> ' + emp.id + '</p>' +
        '<p><strong>Department:</strong> ' + (emp.dept || 'N/A') + '</p>' +
        '<p><strong>Email:</strong> ' + (emp.email || 'N/A') + '</p>' +
        '<hr style="margin: 12px 0; border:0; border-top:1px solid var(--border-color);">' +
        '<p style="font-weight:650;">Currently Assigned Assets:</p>' +
        assignedListHtml +
        '<hr style="margin: 12px 0; border:0; border-top:1px solid var(--border-color);">' +
        '<p style="font-weight:650;">Assignment & Transfer History:</p>' +
        historyHtml;

    document.getElementById('employeeDetailModal').style.display = 'flex';
}
function closeEmployeeDetailModal() { document.getElementById('employeeDetailModal').style.display = 'none'; }

function openEmployeeQR(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    document.getElementById('employee-qr-title').innerText = "QR Code: " + emp.name + " (" + emp.id + ")";
    let qrText = "Employee ID: " + emp.id + "\nName: " + emp.name + "\nDepartment: " + (emp.dept || 'N/A');
    let qrApiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent(qrText);
    document.getElementById('employee-qr-display-area').innerHTML = '<div style="text-align: center; padding: 10px;"><img src="' + qrApiUrl + '" alt="QR Code" style="display: block; margin: 0 auto;"/></div>';
    document.getElementById('employeeQRModal').style.display = 'flex';
}
function closeEmployeeQRModal() { document.getElementById('employeeQRModal').style.display = 'none'; }

function openEmployeeChallanModal(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    const modal = document.getElementById('employeeChallanModal') || document.getElementById('printModal');
    const titleEl = document.getElementById('employee-challan-title');
    const bodyEl = document.getElementById('employee-challan-body') || document.getElementById('print-modal-body');
    
    if (titleEl) titleEl.innerText = "IT Asset Handover Challan - " + emp.name + " (" + emp.id + ")";
    
    let assignedAssetsList = '<p style="color:var(--text-muted);">No assets currently assigned.</p>';
    if (emp.assigned && emp.assigned.length > 0) {
        assignedAssetsList = '<ul style="margin-left: 20px; margin-top: 5px;">';
        emp.assigned.forEach(serial => {
            let ast = assets.find(a => a.serial === serial);
            let cat = ast ? ast.category : 'Hardware';
            let vendor = ast && ast.vendor ? ast.vendor : 'N/A';
            let cost = ast && ast.cost ? '₹' + ast.cost : 'N/A';
            assignedAssetsList += '<li><strong>' + serial + '</strong> - ' + cat + ' (Vendor: ' + vendor + ', Cost: ' + cost + ')</li>';
        });
        assignedAssetsList += '</ul>';
    }

    if (bodyEl) {
        bodyEl.innerHTML = 
            '<div style="border: 2px solid var(--border-color); padding: 20px; border-radius: 8px; background: #FFF;">' +
                '<h4 style="text-align: center; color: var(--primary); margin-bottom: 15px; font-size: 16px;">ARGOS WATCH - IT HANDOVER CHALLAN</h4>' +
                '<p><strong>Date:</strong> ' + new Date().toLocaleDateString() + '</p>' +
                '<p><strong>Employee Name:</strong> ' + emp.name + '</p>' +
                '<p><strong>Employee ID:</strong> ' + emp.id + '</p>' +
                '<p><strong>Department:</strong> ' + (emp.dept || 'N/A') + '</p>' +
                '<p><strong>Email:</strong> ' + (emp.email || 'N/A') + '</p>' +
                '<hr style="margin: 15px 0; border: 0; border-top: 1px solid var(--border-color);">' +
                '<p style="font-weight: 600; margin-bottom: 8px;">Assigned IT Assets:</p>' +
                assignedAssetsList +
                '<div style="margin-top: 20px;">' +
                    '<p style="font-weight: 600; margin-bottom: 5px; font-size: 12px;">Receiver Signature:</p>' +
                    '<canvas id="sigCanvas" width="300" height="100" style="border: 1px dashed #94A3B8; background: #F8FAFC; border-radius: 4px; cursor: crosshair;"></canvas>' +
                    '<br><button type="button" class="btn" style="background:#64748B; font-size:10px; padding:2px 6px; margin-top:4px;" onclick="clearSignature()">Clear Sign</button>' +
                '</div>' +
                '<div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">' +
                    '<button class="btn" style="background:#0D9488; font-size:11px;" onclick="sendChallanEmail(\'' + emp.id + '\')">Send via Email</button>' +
                    '<button class="btn" style="background:#2563EB; font-size:11px;" onclick="window.print()">Print Challan</button>' +
                    '<button class="btn" style="background:#64748B; font-size:11px;" onclick="closeEmployeeChallanModal()">Close</button>' +
                '</div>' +
            '</div>';
    }
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(initSignaturePad, 100);
    }
}

function sendChallanEmail(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp || !emp.email) { alert("Employee email not found!"); return; }
    const subject = encodeURIComponent("IT Asset Handover Challan - Argos Watch");
    const body = encodeURIComponent("Dear " + emp.name + ",\n\nHere are your assigned IT asset details from Argos Watch IT Department.\n\nRegards,\nIT Team");
    window.location.href = "mailto:" + emp.email + "?subject=" + subject + "&body=" + body;
}

let sigCanvas, sigCtx, isDrawing = false;
function initSignaturePad() {
    sigCanvas = document.getElementById('sigCanvas');
    if (!sigCanvas) return;
    sigCtx = sigCanvas.getContext('2d');
    sigCtx.strokeStyle = '#000';
    sigCtx.lineWidth = 2;

    sigCanvas.onmousedown = startDrawing;
    sigCanvas.onmousemove = draw;
    sigCanvas.onmouseup = stopDrawing;
    sigCanvas.onmouseleave = stopDrawing;

    sigCanvas.ontouchstart = (e) => { startDrawing(e.touches[0]); e.preventDefault(); };
    sigCanvas.ontouchmove = (e) => { draw(e.touches[0]); e.preventDefault(); };
    sigCanvas.ontouchend = stopDrawing;
}
function startDrawing(e) {
    isDrawing = true;
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.beginPath();
    sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}
function draw(e) {
    if (!isDrawing) return;
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    sigCtx.stroke();
}
function stopDrawing() { isDrawing = false; }
function clearSignature() {
    if (sigCtx && sigCanvas) {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
    }
}

// --- PART 5: Workflows, Modals, Dynamic Categories & Helpers ---

async function assignAsset(e) {
    if (e) e.preventDefault();
    const rawVal = document.getElementById('modal-assign-search').value.trim();
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal;
    const empRaw = document.getElementById('modal-assign-emp-search').value.trim();
    let empId = empRaw.includes('(ID: ') ? empRaw.split('(ID: ')[1].split(')')[0].trim() : empRaw;

    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = employees.find(em => em.id.toLowerCase() === empId.toLowerCase());
    if (!asset || asset.status !== 'In Stock') { alert("Invalid or unavailable asset!"); return; }
    if (!emp) { alert("Invalid employee ID!"); return; }

    asset.status = 'Assigned'; 
    asset.assignedTo = emp.id;
    if (!emp.assigned.includes(asset.serial)) emp.assigned.push(asset.serial);

    // Supabase update for asset
    await db.from('assets').update({ status: 'Assigned', assigned_to: emp.id }).eq('serial_tag', asset.serial);
    // Supabase update for employee
    await db.from('employees').update({ assigned: emp.assigned }).eq('id', emp.id);

    const logDetails = 'Asset ' + asset.serial + ' assigned to ' + emp.name;
    const newLog = { timestamp: new Date().toLocaleString(), action: 'Asset Assigned', details: logDetails, user: sessionStorage.getItem('argos_logged_user') || 'Admin' };
    auditLogs.push(newLog);
    await db.from('audit_logs').insert([newLog]);

    saveData(); 
    refreshAllData(); 
    alert("Asset successfully assigned!");
}

function updateTransferOldEmployee() {
    const rawVal = document.getElementById('transfer-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = asset && asset.assignedTo ? employees.find(e => e.id === asset.assignedTo) : null;
    document.getElementById('transfer-old-emp').value = emp ? emp.name + ' (ID: ' + emp.id + ')' : 'Not Assigned / Stock';
}

async function transferAsset(e) {
    if (e) e.preventDefault();
    const assetDropdown = document.getElementById('select-assigned-asset-dropdown');
    const selectedSerial = assetDropdown ? assetDropdown.value : '';
    const newEmpInput = document.getElementById('transfer-new-emp-select');
    const newEmpRaw = newEmpInput ? newEmpInput.value : '';
    
    let newEmpId = '';
    if (newEmpRaw.includes('(') && newEmpRaw.includes(')')) {
        const match = newEmpRaw.match(/\(([^)]+)\)/);
        newEmpId = match ? match[1].replace('ID: ', '').trim() : newEmpRaw.trim();
    } else {
        newEmpId = newEmpRaw.trim();
    }
    
   const asset = assets.find(a => {
        const aid = (a.serial || a.assetId || a.asset_id || a.id || '').toString().toLowerCase();
        return aid === selectedSerial.toLowerCase() || selectedSerial.toLowerCase().includes(aid);
    });

    const newEmp = employees.find(em => {
        const eid = (em.id || em.empId || '').toString().toLowerCase();
        const ename = (em.name || em.employeeName || '').toString().toLowerCase();
        return eid === newEmpId.toLowerCase() || newEmpRaw.toLowerCase().includes(eid) || newEmpRaw.toLowerCase().includes(ename);
    });

   console.log("DEBUG TRANSFER:", { selectedSerial, assetFound: asset, newEmpRaw, newEmpId, empFound: newEmp });

    if (!asset || !newEmp) {
        alert("Invalid selection!");
        return;
    } 
   
     

    
    const oldEmp = employees.find(em => em.id === asset.assignedTo);
    const oldEmpName = oldEmp ? oldEmp.name + ' (' + oldEmp.id + ')' : 'Unassigned / Stock';

    if (oldEmp) {
        oldEmp.assigned = oldEmp.assigned.filter(s => s !== asset.serial);
        await db.from('employees').update({ assigned: oldEmp.assigned }).eq('id', oldEmp.id);
    }
    if (!newEmp.assigned.includes(asset.serial)) {
        newEmp.assigned.push(asset.serial);
        await db.from('employees').update({ assigned: newEmp.assigned }).eq('id', newEmp.id);
    }

    asset.assignedTo = newEmp.id;
    await db.from('assets').update({ assigned_to: newEmp.id }).eq('serial_tag', asset.serial);

    
    const logDetails = 'Asset ' + asset.serial + ' transferred from ' + oldEmpName + ' to ' + newEmp.name + ' (' + newEmp.id + ')';
    
    const newLog = { timestamp: new Date().toLocaleString(), action: 'Asset Transferred', details: logDetails, user: sessionStorage.getItem('argos_logged_user') || 'Admin' };
    auditLogs.push(newLog);
    await db.from('audit_logs').insert([newLog]);

    saveData(); 
    refreshAllData(); 
    alert("Asset successfully transferred!");
}

function updateReturnHolder() {
    const rawVal = document.getElementById('return-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = asset && asset.assignedTo ? employees.find(e => e.id === asset.assignedTo) : null;
    document.getElementById('return-holder-emp').value = emp ? emp.name + ' (ID: ' + emp.id + ')' : 'Not Assigned / Stock';
}

async function returnAsset(e) {
    if (e) e.preventDefault();
    const rawVal = document.getElementById('return-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    if (!asset) { alert("Invalid asset!"); return; }
    
    const emp = employees.find(em => em.id === asset.assignedTo);
    if (emp) {
        emp.assigned = emp.assigned.filter(s => s !== asset.serial);
        await db.from('employees').update({ assigned: emp.assigned }).eq('id', emp.id);
    }

    asset.status = 'In Stock'; 
    asset.assignedTo = '';
    await db.from('assets').update({ status: 'In Stock', assigned_to: null }).eq('serial_tag', asset.serial);

    const logDetails = 'Asset ' + serial + ' returned to stock';
    const newLog = { timestamp: new Date().toLocaleString(), action: 'Asset Returned', details: logDetails, user: sessionStorage.getItem('argos_logged_user') || 'Admin' };
    auditLogs.push(newLog);
    await db.from('audit_logs').insert([newLog]);

    saveData(); 
    refreshAllData(); 
    alert("Asset returned to stock!");
}

function populateStockDatalist() {
    const list = document.getElementById('stock-assets-datalist');
    if (!list) return;
    list.innerHTML = '';
    assets.filter(a => a.status === 'In Stock').forEach(a => {
        let opt = document.createElement('option');
        opt.value = a.serial + ' - ' + a.category + ' (' + (a.vendor || 'N/A') + ')';
        list.appendChild(opt);
    });
}

function populateEmployeeDatalist() {
    const list = document.getElementById('assign-employees-datalist');
    if (!list) return;
    list.innerHTML = '';
    employees.forEach(emp => {
        let opt = document.createElement('option');
        opt.value = emp.name + ' (ID: ' + emp.id + ') - ' + emp.dept;
        list.appendChild(opt);
    });
}

function populateTransferEmployeeDatalist() {
    const list = document.getElementById('transfer-employees-datalist');
    if (!list) return;
    list.innerHTML = '';
    employees.forEach(emp => {
        let opt = document.createElement('option');
        opt.value = emp.name + ' (ID: ' + emp.id + ') - ' + emp.dept;
        list.appendChild(opt);
    });
}

// 1. Asset select karne ka popup (Stock assets ke liye)
function openSelectAssetPopup() {
    const listDiv = document.getElementById('popup-asset-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    assets.filter(a => a.status === 'In Stock').forEach(a => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; margin-bottom: 5px;";
        const serialNum = a.serial_tag || a.serial || '';
        item.innerHTML = '<strong>' + serialNum + '</strong> (' + (a.category || '') + ')';
        
        item.onclick = function() {
            const targetInput = document.getElementById('modal-assign-search') || document.querySelector('input[placeholder*="asset"]');
            if (targetInput) {
                targetInput.value = serialNum;
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            closeSelectAssetPopup();
        };
        listDiv.appendChild(item);
    });
    document.getElementById('selectAssetModal').style.display = 'flex';
}

function closeSelectAssetPopup() {
    document.getElementById('selectAssetModal').style.display = 'none';
}

// 2. Employee select karne ka popup (Assign aur Transfer dono ke liye)
function openSelectEmployeePopup() {
    const listDiv = document.getElementById('popup-employee-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    if (typeof employees !== 'undefined' && employees.length > 0) {
        employees.forEach(emp => {
            let item = document.createElement('div');
            item.style.cssText = "padding: 10px 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; cursor: pointer; margin-bottom: 6px; font-size: 14px;";
            item.innerHTML = '<strong>' + emp.name + '</strong> (ID: ' + emp.id + ')';
            
            item.onclick = function() {
                const transferInput = document.getElementById('transfer-emp-select');
                const assignInput = document.getElementById('modal-assign-emp-search');
                const selectedText = emp.name + ' (ID: ' + emp.id + ')';
                
                if (transferInput && document.getElementById('tab-transfer') && document.getElementById('tab-transfer').style.display !== 'none') {
                    transferInput.value = selectedText;
                } else if (assignInput) {
                    assignInput.value = selectedText;
                } else {
                    if (transferInput) transferInput.value = selectedText;
                }
                
                closeSelectEmployeePopup();
            };
            listDiv.appendChild(item);
        });
    } else {
        listDiv.innerHTML = '<div style="padding: 10px; color: #64748B;">No employees found.</div>';
    }
    
    const modal = document.getElementById('selectEmployeeModal');
    if (modal) modal.style.display = 'flex';
}

function closeSelectEmployeePopup() {
    const modal = document.getElementById('selectEmployeeModal');
    if (modal) modal.style.display = 'none';
}

// 3. Assigned asset select karne ka popup (Transfer aur Return ke liye)
function openSelectAssignedAssetPopup(type) {
    const listDiv = document.getElementById('popup-assigned-asset-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    assets.filter(a => a.status === 'Assigned').forEach(a => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; margin-bottom: 5px;";
        const emp = employees.find(e => e.id === a.assignedTo);
        const empName = emp ? emp.name : 'Unknown';
        item.innerHTML = '<strong>' + a.serial + '</strong> (' + a.category + ') - Assigned to: <span style="color: var(--text-muted);">' + empName + '</span>';
        
        item.onclick = function() {
            if (type === 'transfer') {
                document.getElementById('transfer-asset-search').value = a.serial + ' - ' + a.category;
                if (typeof updateTransferOldEmployee === 'function') {
                    // Old employee auto-detect trigger karne ke liye
                    document.getElementById('transfer-asset-search').dataset.assignedTo = a.assignedTo;
                    updateTransferOldEmployee();
                }
            } else {
                document.getElementById('return-asset-search').value = a.serial + ' - ' + a.category;
            }
            closeSelectAssignedAssetPopup();
        };
        listDiv.appendChild(item);
    });
    document.getElementById('selectAssignedAssetModal').style.display = 'flex';
}

function closeSelectAssignedAssetPopup() {
    document.getElementById('selectAssignedAssetModal').style.display = 'none';
}

// Supabase se requests fetch karke array me dalne ke liye
async function fetchRequestsFromSupabase() {
    try {
        const { data, error } = await db.from('asset_requests').select('*');
        if (!error && data) {
            assetRequests = data.map(r => ({
                id: r.id,
                date: r.date || new Date(r.created_at).toLocaleDateString(),
                empId: r.emp_id || r.empId,
                empName: r.emp_name || r.empName,
                details: r.details,
                status: r.status || 'Pending'
            }));
            renderRequestsTable();
        }
    } catch (err) {
        console.error("Error fetching asset requests:", err);
    }
}

async function submitAssetRequest(e) {
    if (e) e.preventDefault();
    
    const id = document.getElementById('req-emp-id').value.trim();
    const name = document.getElementById('req-emp-name').value.trim();
    const details = document.getElementById('req-details').value.trim();

    if (!id || !name || !details) {
        alert("Please fill in all required fields.");
        return;
    }

    const newReq = { 
        date: new Date().toLocaleDateString(), 
        emp_id: id, 
        emp_name: name, 
        details: details, 
        status: 'Pending' 
    };

    // 1. Supabase mein data insert karein
    const { error } = await db.from('asset_requests').insert([newReq]);
    
    if (error) {
        alert("Error submitting request: " + error.message);
        return;
    }

    // 2. Modal close karein
    closeRequestModal(); 

    // 3. Supabase se fresh data fetch karein
    if (typeof fetchAssetRequests === 'function') {
        await fetchAssetRequests(); 
    }

    // 4. UI badge aur breakdown/requests table ko turant update/render karein
    if (typeof renderRequestsBadge === 'function') {
        renderRequestsBadge();
    }
    if (typeof renderBreakdownTable === 'function') {
        renderBreakdownTable();
    }
    if (typeof refreshAllData === 'function') {
        refreshAllData();
    }

    alert("Request submitted successfully!");
}

function renderRequestsTable() {
    const tbody = document.getElementById('requests-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!assetRequests || assetRequests.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No requests pending.</td></tr>'; 
        return; 
    }
    
    assetRequests.slice().reverse().forEach((r, idx) => {
        let statusBadge = r.status === 'Pending' ? '<span class="badge badge-alert">Pending</span>' : '<span class="badge badge-stock">Fulfilled</span>';
        let actionBtn = r.status === 'Pending' ? '<button class="btn" style="background:#0D9488; padding:4px 10px; font-size:11px;" onclick="fulfillRequest(' + idx + ')">Approve</button>' : 'Done';
        
        tbody.innerHTML += '<tr><td><small>' + (r.date || '') + '</small></td><td><strong>' + (r.empName || r.emp_name || '') + '</strong></td><td>' + (r.details || '') + '</td><td>' + statusBadge + '</td><td>' + actionBtn + '</td></tr>';
    });
}

async function fulfillRequest(index) {
    // Reverse array ka index handle karne ke liye
    const actualIdx = assetRequests.length - 1 - index;
    assetRequests.actualIdx.status = 'Fulfilled';
    
    // Supabase me status update karein agar id hai toh
    // (Agar id available hai toh database me bhi update ho jayega)
    
    saveData(); 
    refreshAllData(); 
    switchTab('assign'); 
    alert("Request fulfilled.");
}

// --- PART 6: Services, Reports, Settings & Backup ---

function renderServiceTable() {
    const tbody = document.getElementById('service-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (serviceLogs.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No service logs recorded.</td></tr>'; return; }
    serviceLogs.slice().reverse().forEach(s => {
        tbody.innerHTML += '<tr><td><strong>' + s.serial + '</strong></td><td>' + s.date + '</td><td>' + s.tech + '</td><td>' + s.tasks + '</td><td><span class="badge badge-stock">Up to Date</span></td></tr>';
    });
}

function downloadServiceReportPDF() {
    if (typeof window.jspdf === 'undefined') { alert("jsPDF library not loaded!"); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Argos Watch - PC Maintenance Service Report", 14, 20);
    let y = 30;
    serviceLogs.forEach(s => { doc.text(s.serial + " - " + s.date + " - " + s.tech, 14, y); y += 8; });
    doc.save("Argos_Service_Report.pdf");
}

function changeAdminPassword(e) {
    if (e) e.preventDefault();
    const curr = document.getElementById('set-curr-pass').value;
    const nuevo = document.getElementById('set-new-pass').value;
    if (curr !== adminPassword) { alert("Current password incorrect!"); return; }
    adminPassword = nuevo; localStorage.setItem('argos_admin_pass', adminPassword);
    alert("Password updated!");
}

function addAccessEmail(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('new-access-email');
    const email = emailInput.value.trim().toLowerCase();
    if (accessEmails.includes(email)) { alert("Email already exists!"); return; }
    accessEmails.push(email); localStorage.setItem('argos_access_emails', JSON.stringify(accessEmails));
    emailInput.value = ''; renderAccessEmailsList(); alert("Email added!");
}

function renderAccessEmailsList() {
    const container = document.getElementById('access-emails-list');
    if (!container) return;
    container.innerHTML = '';
    
    accessEmails.forEach(em => { 
        container.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 4px 8px; background: #f8f9fa; border-radius: 4px;">
                <span>${em}</span>
                <button onclick="removeAccessEmail('${em}')" style="background: #dc3545; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete</button>
            </div>
        `;
    });
}

function removeAccessEmail(emailToRemove) {
    if (!confirm('Are you sure you want to remove ${emailToRemove} from the list?')) {
        return;
    }

    // Global accessEmails array se filter karke hatana
    accessEmails = accessEmails.filter(e => e !== emailToRemove);
    
    // LocalStorage ko update karna
    localStorage.setItem('argos_access_emails', JSON.stringify(accessEmails));
    
    // List ko dobara render karna taaki screen se hat jaye
    renderAccessEmailsList();
    
    alert('${emailToRemove} successfully removed!');
}

function downloadCompleteBackup() {
    const backupData = {
        assets: assets,
        employees: employees,
        requests: assetRequests,
        auditLogs: auditLogs,
        exportedAt: new Date().toLocaleString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", 'Argos_IT_Asset_Backup_' + new Date().toISOString().slice(0,10) + '.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function saveData() {
    localStorage.setItem('argos_assets', JSON.stringify(assets));
    localStorage.setItem('argos_employees', JSON.stringify(employees));
    localStorage.setItem('argos_history', JSON.stringify(assignmentHistory));
    localStorage.setItem('argos_service_logs', JSON.stringify(serviceLogs));
    localStorage.setItem('argos_requests', JSON.stringify(assetRequests));
    localStorage.setItem('argos_access_emails', JSON.stringify(accessEmails));
}

// --- PART 7: Asset Modal, Auto Serial & Supabase Insert ---

function openAssetModal() { 
    document.getElementById('assetModal').style.display = 'flex'; 
    generateAutoSerial(); 
    toggleAssetSpecFields();
}
function closeAssetModal() { document.getElementById('assetModal').style.display = 'none'; }

function checkNewCategory(selectEl) {
    if (selectEl.value === 'OTHER_NEW') {
        let newCat = prompt("Enter new asset category name:");
        if (newCat && newCat.trim() !== '') {
            let formattedCat = newCat.trim();
            let opt = document.createElement('option');
            opt.value = formattedCat;
            opt.innerText = formattedCat;
            selectEl.insertBefore(opt, selectEl.lastElementChild);
            selectEl.value = formattedCat;
        } else {
            selectEl.value = 'Laptop';
        }
    }
    generateAutoSerial();
    toggleAssetSpecFields();
}

function generateAutoSerial() {
    const categorySelect = document.getElementById('modal-asset-category');
    if (!categorySelect) return;
    const category = categorySelect.value;
    
    let prefix = 'ARG-';
    let catUpper = category.toUpperCase();
    if (catUpper.includes('LAPTOP')) prefix = 'ARG-LAP-';
    else if (catUpper.includes('MONITOR')) prefix = 'ARG-MON-';
    else if (catUpper.includes('KEYBOARD')) prefix = 'ARG-KEY-';
    else if (catUpper.includes('MOUSE')) prefix = 'ARG-MSE-';
    else if (catUpper.includes('PC') || catUpper.includes('DESKTOP')) prefix = 'ARG-PC-';
    else if (catUpper.includes('PRINTER')) prefix = 'ARG-PRN-';
    else {
        prefix = 'ARG-' + catUpper.substring(0, 3) + '-';
    }

    let maxNum = 0;
    assets.forEach(a => { if (a.serial && a.serial.startsWith(prefix)) { let numPart = parseInt(a.serial.replace(prefix, '')); if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart; } });
    document.getElementById('modal-asset-serial').value = prefix + String(maxNum + 1).padStart(3, '0');
}

async function addAssetFromModal(e) {
    if (e) e.preventDefault();
    const category = document.getElementById('modal-asset-category').value;
    const serial = document.getElementById('modal-asset-serial').value.trim();
    const status = document.getElementById('modal-asset-status').value;
    const date = document.getElementById('modal-asset-date').value;
    const warrantyDate = document.getElementById('modal-asset-warranty') ? document.getElementById('modal-asset-warranty').value : ''; 
    const vendor = document.getElementById('modal-asset-vendor').value.trim();
    const model = document.getElementById('modal-asset-model').value.trim();
    const ram = document.getElementById('modal-asset-ram') ? document.getElementById('modal-asset-ram').value.trim() : '';
    const processor = document.getElementById('modal-asset-processor') ? document.getElementById('modal-asset-processor').value.trim() : '';
    const graphics = document.getElementById('modal-asset-graphics') ? document.getElementById('modal-asset-graphics').value.trim() : '';
    const cost = document.getElementById('modal-asset-cost').value;
    const invoiceNo = document.getElementById('modal-asset-invoice-no').value.trim();
    
    const pdfInput = document.getElementById('modal-asset-invoice-pdf');
    let invoicePdfName = '';
    if (pdfInput && pdfInput.files && pdfInput.files[0]) {
        invoicePdfName = pdfInput.files[0].name;
    }

    if (assets.some(a => a.serial === serial)) { alert("Serial already exists!"); return; }
    
    const newAsset = { 
        serial, category, status, assignedTo: '', date, warrantyDate, vendor, model, 
        ram, processor, graphics, cost: Number(cost), invoiceNo, invoicePdf: invoicePdfName, maintenanceLogs: [] 
    };

    const dbAssetPayload = {
        serial_tag: serial,
        category: category,
        status: status,
        assigned_to: null,
        date: date || null,
        warranty_date: warrantyDate || null,
        vendor: vendor,
        model_number: model,
        ram: ram,
        processor: processor,
        graphics: graphics,
        cost: Number(cost) || 0,
        invoice_no: invoiceNo,
        maintenance_logs: []
    };

    const { error: assetError } = await db.from('assets').insert([dbAssetPayload]);
    if (assetError) {
        console.error("Supabase Asset Insert Error:", assetError);
        alert("Database Error (Asset): " + assetError.message);
        return;
    }

    assets.push(newAsset);

    const logDetails = 'Hardware asset ' + serial + ' (' + category + ') added to inventory';
    const newLog = {
        timestamp: new Date().toLocaleString(),
        action: 'Asset Added',
        details: logDetails,
        user: sessionStorage.getItem('argos_logged_user') || 'Admin'
    };

    const { error: logError } = await db.from('audit_logs').insert([newLog]);
    if (!logError) {
        auditLogs.push(newLog);
    }

    closeAssetModal(); 
    if (typeof refreshAllData === 'function') refreshAllData();
    alert("Asset added successfully!");
}

// --- PART 8: Employee Modal, Supabase Insert & Service Modal ---

function openEmployeeModal() { document.getElementById('employeeModal').style.display = 'flex'; }
function closeEmployeeModal() { document.getElementById('employeeModal').style.display = 'none'; }

async function addEmployeeFromModal(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('modal-emp-id').value.trim();
    const name = document.getElementById('modal-emp-name').value.trim();
    const email = document.getElementById('modal-emp-email').value.trim();
    const dept = document.getElementById('modal-emp-dept').value.trim();
    
    if (employees.some(em => em.id === id)) { alert("ID exists!"); return; }

    const newEmp = { id, name, email, dept, assigned: [] };

    const dbEmpPayload = {
        id: id,
        name: name,
        email: email,
        dept: dept,
        assigned: []
    };

    const { error: empError } = await db.from('employees').insert([dbEmpPayload]);
    if (empError) {
        console.error("Supabase Employee Insert Error:", empError);
        alert("Database Error (Employee): " + empError.message);
        return;
    }

    employees.push(newEmp);

    const logDetails = 'Employee ' + name + ' (ID: ' + id + ') registered';
    const newLog = {
        timestamp: new Date().toLocaleString(),
        action: 'Employee Added',
        details: logDetails,
        user: sessionStorage.getItem('argos_logged_user') || 'Admin'
    };

    const { error: logError } = await db.from('audit_logs').insert([newLog]);
    if (!logError) {
        auditLogs.push(newLog);
    }

    closeEmployeeModal(); 
    if (typeof refreshAllData === 'function') refreshAllData();
    alert("Employee added successfully!");
}

function openServiceModal() { document.getElementById('serviceModal').style.display = 'flex'; }
function closeServiceModal() { document.getElementById('serviceModal').style.display = 'none'; }

function handleSaveService(e) {
    if (e) e.preventDefault();
    const serial = document.getElementById('service-asset-select').value;
    const tech = document.getElementById('service-tech').value;
    const tasks = document.getElementById('service-tasks').value;
    serviceLogs.unshift({ serial, date: new Date().toISOString().split('T')[0], tech, tasks, status: 'Completed' });
    assignmentHistory.push({ type: 'PC Service', details: 'Maintenance performed on ' + serial + ' by ' + tech, date: new Date().toLocaleString() });
    saveData(); refreshAllData(); closeServiceModal(); 
    document.getElementById('serviceModal').querySelector('form').reset();
}

function openRequestModal() { document.getElementById('requestModal').style.display = 'flex'; }
function closeRequestModal() { document.getElementById('requestModal').style.display = 'none'; }
function closePrintModal() { document.getElementById('printModal').style.display = 'none'; }

// --- PART 9: Deletion Logic, Global Refresh, Warranty Alerts & Bulk CSV Import ---

async function deleteAsset(serial) { 
    if (confirm("Delete " + serial + "?")) { 
        assets = assets.filter(a => a.serial !== serial); 
        await db.from('assets').delete().eq('serial_tag', serial);
        
        const newLog = { type: 'Asset Deleted', details: 'Asset ' + serial + ' removed from inventory', date: new Date().toLocaleString() };
        assignmentHistory.push(newLog);
        saveData(); 
        refreshAllData(); 
    } 
}

async function deleteEmployee(empId) { 
    if (confirm("Delete employee " + empId + "?")) { 
        employees = employees.filter(e => e.id !== empId); 
        await db.from('employees').delete().eq('id', empId);
        saveData(); 
        refreshAllData(); 
    } 
}

function toggleAssetSpecFields() {
    const categorySelect = document.getElementById('modal-asset-category');
    if (!categorySelect) return;
    const cat = categorySelect.value.toUpperCase();
    const specFields = document.getElementById('pc-spec-fields');
    if (!specFields) return;
    
    if (cat.includes('LAPTOP') || cat.includes('PC') || cat.includes('DESKTOP')) { 
        specFields.style.display = 'block'; 
    } else { 
        specFields.style.display = 'none'; 
    }
}

async function refreshAllData() {
    try {
        await fetchAssetsFromSupabase();
        await fetchEmployeesFromSupabase();
        await fetchRequestsFromSupabase();
        await fetchAuditLogsFromSupabase();
    } catch (err) {
        console.error("Error fetching data from Supabase during refresh:", err);
    }

    const totalEl = document.getElementById('stat-total');
    const assignedEl = document.getElementById('stat-assigned');
    const stockEl = document.getElementById('stat-stock');
    const empCountEl = document.getElementById('stat-employees');
    
    if (totalEl) totalEl.innerText = assets.length;
    if (assignedEl) assignedEl.innerText = assets.filter(a => a.status === 'Assigned').length;
    if (stockEl) stockEl.innerText = assets.filter(a => a.status === 'In Stock').length;
    if (empCountEl) empCountEl.innerText = employees.length;

    if (typeof filterAssetsTable === 'function') filterAssetsTable();
    if (typeof renderEmployeesTable === 'function') renderEmployeesTable();
    if (typeof renderDashboardChartsAndValuation === 'function') renderDashboardChartsAndValuation();
    if (typeof renderDashboardBreakdowns === 'function') renderDashboardBreakdowns();
    if (typeof renderRequestsTable === 'function') renderRequestsTable();
    if (typeof renderServiceTable === 'function') renderServiceTable();
    if (typeof renderAuditLogs === 'function') renderAuditLogs();
    if (typeof checkWarrantyAlerts === 'function') checkWarrantyAlerts();
}

function closeEmployeeChallanModal() {
    const modal1 = document.getElementById('employeeChallanModal');
    const modal2 = document.getElementById('printModal');
    if (modal1) modal1.style.display = 'none';
    if (modal2) modal2.style.display = 'none';
}

function checkWarrantyAlerts() {
    const banner = document.getElementById('warranty-alert-banner');
    const textEl = document.getElementById('warranty-alert-text');
    if (!banner || !textEl) return;

    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);

    let expiringSoon = [];

    assets.forEach(a => {
        if (a.warrantyDate) {
            let wDate = new Date(a.warrantyDate);
            if (wDate <= thirtyDaysLater && wDate >= today) {
                expiringSoon.push('<strong>' + a.serial + '</strong> (' + a.category + ') - Expires on: ' + a.warrantyDate);
            }
        }
    });

    if (expiringSoon.length > 0) {
        banner.style.display = 'block';
        textEl.innerHTML = 'The following assets have warranties expiring within 30 days:<br>' + expiringSoon.join('<br>');
    } else {
        banner.style.display = 'none';
    }
}

// --- BULK CSV IMPORT FUNCTIONS ---
function openBulkImportModal() {
    const modal = document.getElementById('bulkImportModal');
    if (modal) modal.style.display = 'flex';
}

function closeBulkImportModal() {
    const modal = document.getElementById('bulkImportModal');
    if (modal) modal.style.display = 'none';
    const input = document.getElementById('csvFileInput');
    if (input) input.value = '';
}

function processCSVImport() {
    const fileInput = document.getElementById('csvFileInput');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        alert("Please select a CSV file first!");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split(/\r\n|\n/).map(row => row.trim()).filter(row => row.length > 0);
            
            if (lines.length < 2) {
                alert("CSV file is empty or missing headers!");
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            let importedCount = 0;
            let skippedCount = 0;

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;

                let rowData = {};
                headers.forEach((header, index) => {
                    rowData[header] = values[index] ? values[index].replace(/^["']|["']$/g, '') : '';
                });

                if (!rowData.serial || assets.some(a => a.serial === rowData.serial)) {
                    skippedCount++;
                    continue;
                }

                assets.push({
                    serial: rowData.serial,
                    category: rowData.category || 'Other',
                    status: rowData.status || 'In Stock',
                    assignedTo: '',
                    date: rowData.date || new Date().toISOString().split('T')[0],
                    warrantyDate: rowData.warrantydate || rowData.warrantyDate || '',
                    vendor: rowData.vendor || '',
                    model: rowData.model || '',
                    ram: rowData.ram || '',
                    processor: rowData.processor || '',
                    graphics: rowData.graphics || '',
                    cost: Number(rowData.cost) || 0,
                    invoiceNo: rowData.invoiceno || '',
                    invoicePdf: '',
                    maintenanceLogs: []
                });
                importedCount++;
            }

            saveData();
            refreshAllData();
            closeBulkImportModal();

            alert("Bulk Import Complete!\n✅ Successfully Imported: " + importedCount + "\n⚠️ Skipped (Duplicates/Invalid): " + skippedCount);
        } catch (err) {
            console.error("CSV Import Error:", err);
            alert("Error parsing CSV file. Please check file format.");
        }
    };

    reader.readAsText(file);
}

// --- PART 10: Maintenance, Consumables & Asset History ---

let currentMaintSerial = null;

function openMaintenanceModal(serial) {
    currentMaintSerial = serial;
    const modal = document.getElementById('maintenanceModal');
    const infoEl = document.getElementById('maintAssetInfo');
    if (modal) modal.style.display = 'flex';
    
    let asset = assets.find(a => a.serial === serial);
    if (asset) {
        if (!asset.maintenanceLogs) asset.maintenanceLogs = [];
        if (infoEl) {
            infoEl.innerHTML = "Managing repairs for Asset: <strong>" + asset.serial + "</strong> (" + (asset.category || 'Asset') + " - " + (asset.model || 'N/E') + ")";
        }
        renderMaintenanceTimeline();
    }
}

function closeMaintenanceModal() {
    const modal = document.getElementById('maintenanceModal');
    if (modal) modal.style.display = 'none';
    currentMaintSerial = null;
}

function saveMaintenanceLog() {
    if (!currentMaintSerial) return;
    const dateEl = document.getElementById('maintDate');
    const costEl = document.getElementById('maintCost');
    const issueEl = document.getElementById('maintIssue');

    if (!dateEl || !issueEl) return;

    const date = dateEl.value;
    const cost = costEl.value;
    const issue = issueEl.value;

    if (!date || !issue) {
        alert("Please enter both date and issue description!");
        return;
    }

    let asset = assets.find(a => a.serial === currentMaintSerial);
    if (asset) {
        if (!asset.maintenanceLogs) asset.maintenanceLogs = [];
        asset.maintenanceLogs.push({ date: date, cost: Number(cost) || 0, issue: issue });

        saveData();
        refreshAllData();

        dateEl.value = '';
        costEl.value = '';
        issueEl.value = '';

        renderMaintenanceTimeline();
        alert("Repair log added successfully!");
    }
}

function renderMaintenanceTimeline() {
    const listEl = document.getElementById('maintTimelineList');
    if (!listEl) return;

    let asset = assets.find(a => a.serial === currentMaintSerial);
    if (!asset || !asset.maintenanceLogs || asset.maintenanceLogs.length === 0) {
        listEl.innerHTML = '<p style="font-size: 12px; color: #94A3B8; text-align: center; padding: 10px;">No repair history recorded yet.</p>';
        return;
    }

    let html = '';
    let sortedLogs = [...asset.maintenanceLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedLogs.forEach(log => {
        html += '<div style="border-left: 2px solid #0284C7; padding-left: 10px; margin-bottom: 10px;">' +
                    '<div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; color: #1E293B;">' +
                        '<span>📅 ' + (log.date || '') + '</span>' +
                        '<span style="color: #0D9488;">Cost: ₹' + (log.cost || 0) + '</span>' +
                    '</div>' +
                    '<p style="font-size: 12px; color: #475569; margin-top: 3px;">' + (log.issue || '') + '</p>' +
                '</div>';
    });
    listEl.innerHTML = html;
}



// --- CONSUMABLES & ACCESSORIES STOCK MANAGEMENT ---
let consumablesStock = JSON.parse(localStorage.getItem('argos_consumables')) || [];

function openConsumablesModal() {
    const modal = document.getElementById('consumablesModal');
    if (modal) modal.style.display = 'flex';
    renderConsumablesTable();
}

function closeConsumablesModal() {
    const modal = document.getElementById('consumablesModal');
    if (modal) modal.style.display = 'none';
}

function addConsumableItem() {
    const nameEl = document.getElementById('consName');
    const qtyEl = document.getElementById('consQty');
    const minQtyEl = document.getElementById('consMinQty');

    if (!nameEl || !qtyEl || !minQtyEl) return;

    const name = nameEl.value.trim();
    const qty = Number(qtyEl.value);
    const minQty = Number(minQtyEl.value) || 2;

    if (!name || isNaN(qty)) {
        alert("Please enter a valid item name and quantity!");
        return;
    }

    consumablesStock.push({ id: 'CONS-' + Date.now(), name: name, qty: qty, minQty: minQty });

    saveConsumablesData();
    renderConsumablesTable();

    nameEl.value = '';
    qtyEl.value = '';
    minQtyEl.value = '';
    alert("Consumable item added successfully!");
}

function updateConsumableQty(id, change) {
    let item = consumablesStock.find(c => c.id === id);
    if (item) {
        item.qty += change;
        if (item.qty < 0) item.qty = 0;
        saveConsumablesData();
        renderConsumablesTable();
    }
}

function deleteConsumableItem(id) {
    if (confirm("Are you sure you want to delete this item?")) {
        consumablesStock = consumablesStock.filter(c => c.id !== id);
        saveConsumablesData();
        renderConsumablesTable();
    }
}

function saveConsumablesData() {
    localStorage.setItem('argos_consumables', JSON.stringify(consumablesStock));
}

function renderConsumablesTable() {
    const tbody = document.getElementById('consumablesTableBody');
    if (!tbody) return;

    if (consumablesStock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94A3B8; padding: 12px;">No consumables stock recorded yet.</td></tr>';
        return;
    }

    let html = '';
    consumablesStock.forEach(item => {
        let isLowStock = item.qty <= item.minQty;
        html += `
            <tr style="border-bottom: 1px solid #E2E8F0;">
                <td style="padding: 8px; font-weight: 500;">${item.name}</td>
                <td style="padding: 8px; color: ${isLowStock ? '#EF4444' : '#1E293B'}; font-weight: ${isLowStock ? 'bold' : 'normal'};">
                    ${item.qty} ${isLowStock ? '⚠️ (Low)' : ''}
                </td>
                <td style="padding: 8px;">${item.minQty}</td>
                <td style="padding: 8px; text-align: center;">
                    <button class="btn" style="background: #10B981; padding: 2px 6px; font-size: 10px; margin-right: 4px;" onclick="updateConsumableQty('${item.id}', 1)">+ Qty</button>
                    <button class="btn" style="background: #F59E0B; padding: 2px 6px; font-size: 10px; margin-right: 4px;" onclick="updateConsumableQty('${item.id}', -1)">- Qty</button>
                    <button class="btn" style="background: #EF4444; padding: 2px 6px; font-size: 10px;" onclick="deleteConsumableItem('${item.id}')">Del</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Asset History Modal open karne ka function
function openAssetHistory(serial) {
    const modal = document.getElementById('assetHistoryModal');
    const title = document.getElementById('history-modal-title');
    const content = document.getElementById('history-modal-content');
    
    if (!modal) return;
    
    let asset = assets.find(a => a.serial === serial);
    if (title) {
        let catStr = asset ? " (" + asset.category + ")" : "";
        title.innerText = "Asset History: " + serial + catStr;
    }
    
    let logs = auditLogs.filter(function(h) {
        return h.details && h.details.includes(serial);
    });
    
    if (!content) return;

    if (logs.length === 0) {
        content.innerHTML = '<p style="color: #64748B; text-align: center; padding: 20px;">Abhi tak is asset ki koi history log nahi hai.</p>';
    } else {
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        html += '<tr style="background: #F1F5F9; text-align: left;"><th style="padding: 8px;">Date</th><th style="padding: 8px;">Action</th><th style="padding: 8px;">Details</th></tr>';
        
        logs.forEach(function(h) {
            let d = h.timestamp || h.date || 'N/A';
            let act = h.action || h.type || 'Log';
            let det = h.details || 'N/A';
            html += '<tr style="border-bottom: 1px solid #E2E8F0;"><td style="padding: 8px;">' + d + '</td><td style="padding: 8px; font-weight: 600; color: #2563EB;">' + act + '</td><td style="padding: 8px;">' + det + '</td></tr>';
        });
        html += '</table>';
        content.innerHTML = html;
    }
    
    modal.style.display = 'flex';
}

function closeAssetHistoryModal() {
    const modal = document.getElementById('assetHistoryModal');
    if (modal) modal.style.display = 'none';
}

window.onload = async function () {
    // Supabase se actual active session check karein
    const { data: { session } } = await db.auth.getSession();
    
    if (session) {
        // Agar Supabase mein active session hai
        const userEmail = session.user.email;
        sessionStorage.setItem('argos_logged_user', userEmail);
        
        // 1. Dashboard UI show karein
        showDashboardApp();
        
        // 2. Supabase se saara fresh data fetch karein
        if (typeof fetchAssetRequests === 'function') {
            await fetchAssetRequests();
        }
        
        // 3. Asset requests table ko UI par draw karein
        if (typeof renderRequestsTable === 'function') {
            renderRequestsTable();
        } else if (typeof refreshAllData === 'function') {
            refreshAllData();
        }
    } else {
        // Agar session nahi hai toh login screen dikhayein
        sessionStorage.removeItem('argos_logged_user');
        if (typeof showLoginScreen === 'function') {
            showLoginScreen();
        }
    }
};

// 1. Supabase Client Init 
// const { createClient } = supabase;
// const db = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

// 2. Login Function
async function loginUser(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert("Login Failed: " + error.message);
        return false;
    }

    alert("Login Successful!");
    sessionStorage.setItem('argos_logged_user', data.user.email);
    return true;
}

// 3. Logout Function
async function logoutUser() {
    const { error } = await db.auth.signOut();
    if (error) {
        alert("Error logging out: " + error.message);
        return;
    }
    sessionStorage.removeItem('argos_logged_user');
    window.location.reload();
}

// 4. Session Verification on Page Load
async function checkAuthSession() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        // Logged out state logic
        console.log("No active user session");
    } else {
        console.log("Logged in user:", session.user.email);
    }
}

// Settings se email delete karne ka function
function removeAccessEmail(emailToRemove) {
    if (!confirm('Are you sure you want to remove ${emailToRemove} from the list?')) {
        return;
    }

    // Global accessEmails array se filter karke hatana
    accessEmails = accessEmails.filter(e => e !== emailToRemove);
    
    // LocalStorage ko update karna
    localStorage.setItem('argos_access_emails', JSON.stringify(accessEmails));
    
    // List ko dobara render karna taaki screen se hat jaye
    renderAccessEmailsList();
    
    alert('${emailToRemove} successfully removed!');

}

function filterAssetsByEmployee(query) {
    const q = query.toLowerCase().trim();
    if (!q) return;

    // Filter assets matching assigned employee
    const matchedAssets = assets.assetData ? assets.assetData.filter(ast => 
        ast.assignedTo && (
            ast.assignedTo.toLowerCase().includes(q) || 
            (ast.empId && ast.empId.toLowerCase().includes(q))
        )
    ) : assets.filter(ast => 
        ast.assignedTo && (
            ast.assignedTo.toLowerCase().includes(q) || 
            (ast.empId && ast.empId.toLowerCase().includes(q))
        )
    );

    const assetSelect = document.getElementById('select-assigned-asset-dropdown');

if (matchedAssets.length > 0 && assetSelect) {
    assetSelect.innerHTML = '<option value="">Select asset to transfer...</option>';
    matchedAssets.forEach((ast, index) => {
        const option = document.createElement('option');
        
        // Exact keys jo inventory table mein use ho rahi hain
        const aid = ast.assetId || ast.asset_id || ast.id || ast.serial_no || ast.serialNo || ast.tag || `ARG-00${index + 1}`;
        const category = ast.category || ast.asset_category || ast.type || 'Asset';
        const aname = ast.assetName || ast.name || ast.asset_name || ast.title || ast.model || '';
        
        option.value = aid;
        
        // Exact format: ARG-MON-001 - Monitor (Zebronics)
        if (aname && aname !== category) {
            option.textContent = `${aid} - ${category} (${aname})`;
        } else {
            option.textContent = `${aid} - ${category}`;
        }
        
        assetSelect.appendChild(option);
    });
}
}


function populateOldEmployeeDropdown(query = '') {
    const datalist = document.getElementById('old-employees-datalist');
    if (!datalist) return;
    
    const empList = employees || []; 
    const q = query.toLowerCase().trim();
    
    // Agar query hai toh filter karo, warna saare dikhao
    const filtered = q === '' ? empList : empList.filter(emp => {
        const name = (emp.name || emp.employeeName || emp.fullName || '').toLowerCase();
        const id = (emp.empId || emp.id || '').toLowerCase();
        return name.includes(q) || id.includes(q);
    });
    
    datalist.innerHTML = '';
    filtered.forEach(emp => {
        const option = document.createElement('option');
        const empName = emp.name || emp.employeeName || emp.fullName;
        const empId = emp.empId || emp.id || '';
        
        option.value = `${empName} (${empId})`;
        datalist.appendChild(option);
    });
}

function fillOldEmployeeFromAsset(selectedAssetId) {
    const oldEmpInput = document.getElementById('transfer-old-emp');
    if (!oldEmpInput) return;
    
    if (!selectedAssetId) {
        oldEmpInput.value = '';
        return;
    }
    
    // matchedAssets ya global assets array se asset find karo
    const allAssets = (typeof assets !== 'undefined' ? assets.assetData || assets : []);
    const foundAsset = allAssets.find(ast => {
        const aid = ast.assetId || ast.asset_id || ast.id || ast.serial_no || ast.serialNo || ast.tag;
        return aid === selectedAssetId;
    });
    
    if (foundAsset) {
        // Employee ki field check karein jo asset ko assigned hai
        const holder = foundAsset.assignedTo || foundAsset.employeeName || foundAsset.holder || 'N/A';
        oldEmpInput.value = holder;
    } else {
        // Agar upar wale se na mile toh jo old employee search mein dala tha wahi utha lo
        const searchEmp = document.getElementById('search-old-employee');
        oldEmpInput.value = searchEmp ? searchEmp.value : '';
    }
}

// Datalist mein employees populate karne ke liye function
function populateEmployeeDatalists() {
    const empList = (typeof employees !== 'undefined' ? employees : []);
    
    // 1. Old Employee Datalist
    const oldDatalist = document.getElementById('old-employees-datalist');
    if (oldDatalist) {
        oldDatalist.innerHTML = '';
        empList.forEach(emp => {
            const option = document.createElement('option');
            const empName = emp.name || emp.employeeName || emp.fullName || '';
            const empId = emp.empId || emp.id || '';
            option.value = `${empName} (${empId})`;
            oldDatalist.appendChild(option);
        });
    }
    
    // 2. New Employee Datalist
    const newDatalist = document.getElementById('new-employees-datalist');
    if (newDatalist) {
        newDatalist.innerHTML = '';
        empList.forEach(emp => {
            const option = document.createElement('option');
            const empName = emp.name || emp.employeeName || emp.fullName || '';
            const empId = emp.empId || emp.id || '';
            const empDept = emp.department || emp.dept || '';
            option.value = `${empName} (${empId})${empDept ? ' - ' + empDept : ''}`;
            newDatalist.appendChild(option);
        });
    }
}

// Page load hone par datalist ko populate karne ke liye
document.addEventListener('DOMContentLoaded', () => {
    populateEmployeeDatalists();
});

// 1. Employees ko dropdowns mein populate karne ke liye
function populateEmployeeDropdowns() {
    const empList = (typeof employees !== 'undefined' ? employees : []);
    
    const oldEmpSelect = document.getElementById('search-old-employee');
    const newEmpSelect = document.getElementById('transfer-new-emp-select');
    
    if (oldEmpSelect) {
        oldEmpSelect.innerHTML = '<option value="">Select old employee...</option>';
        empList.forEach(emp => {
            const opt = document.createElement('option');
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            opt.value = id; // ID store hogi backend ke liye
            opt.textContent = `${name} (${id})`;
            oldEmpSelect.appendChild(opt);
        });
    }
    
    if (newEmpSelect) {
        newEmpSelect.innerHTML = '<option value="">Select new employee...</option>';
        empList.forEach(emp => {
            const opt = document.createElement('option');
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            const dept = emp.department || emp.dept || '';
            opt.value = id;
            opt.textContent = `${name} (${id})${dept ? ' - ' + dept : ''}`;
            newEmpSelect.appendChild(opt);
        });
    }
}

// 2. Old Employee select hote hi uske assigned assets load karna
function filterAssetsForOldEmployee(empId) {
    const assetDropdown = document.getElementById('select-assigned-asset-dropdown');
    const oldEmpInput = document.getElementById('transfer-old-emp');
    
    if (!assetDropdown) return;
    assetDropdown.innerHTML = '<option value="">Select asset to transfer...</option>';
    
    if (!empId) {
        if (oldEmpInput) oldEmpInput.value = '';
        return;
    }
    
    // Employee ka naam dhoondo
    const emp = employees.find(e => (e.id || e.empId) === empId);
    if (oldEmpInput && emp) {
        oldEmpInput.value = `${emp.name || emp.employeeName} (${emp.id || emp.empId})`;
    }
    
    // Us employee ko assigned assets filter karo
    // emp.assigned array ho sakta hai ya assets list mein assignedTo match hoga
    const empAssignedSerials = emp && emp.assigned ? emp.assigned : [];
    
    const assignedAssets = assets.filter(a => {
        const aid = a.assignedTo || a.employeeId || a.empId;
        const serial = a.serial || a.assetId || a.asset_id || a.id;
        return aid === empId || empAssignedSerials.includes(serial);
    });
    
    assignedAssets.forEach(ast => {
        const opt = document.createElement('option');
        const serial = ast.serial || ast.assetId || ast.asset_id || ast.id;
        const category = ast.category || ast.type || 'Asset';
        const model = ast.model || ast.name || '';
        
        opt.value = serial;
        opt.textContent = `${serial} - ${category} (${model})`;
        assetDropdown.appendChild(opt);
    });
}

// Page load par call karein
document.addEventListener('DOMContentLoaded', () => {
    populateEmployeeDropdowns();
});

// Datalist populate karne ke liye
function populateEmployeeDatalists() {
    const empList = (typeof employees !== 'undefined' ? employees : []);
    
    const oldDatalist = document.getElementById('old-employees-datalist');
    const newDatalist = document.getElementById('new-employees-datalist');
    
    if (oldDatalist) {
        oldDatalist.innerHTML = '';
        empList.forEach(emp => {
            const opt = document.createElement('option');
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            opt.value = `${name} (${id})`;
            oldDatalist.appendChild(opt);
        });
    }
    
    if (newDatalist) {
        newDatalist.innerHTML = '';
        empList.forEach(emp => {
            const opt = document.createElement('option');
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            const dept = emp.department || emp.dept || '';
            opt.value = `${name} (${id})${dept ? ' - ' + dept : ''}`;
            newDatalist.appendChild(opt);
        });
    }
}

// Old Employee type/select hone par assets filter karna
function checkOldEmployeeSelection() {
    const val = document.getElementById('search-old-employee').value;
    const assetDropdown = document.getElementById('select-assigned-asset-dropdown');
    const oldEmpInput = document.getElementById('transfer-old-emp');
    
    if (!assetDropdown) return;
    assetDropdown.innerHTML = '<option value="">Select asset to transfer...</option>';
    
    // ID ya Name extract karo
    let empId = '';
    if (val.includes('(') && val.includes(')')) {
        const match = val.match(/\(([^)]+)\)/);
        empId = match ? match[1].replace('ID: ', '').trim() : '';
    }
    
    const emp = employees.find(e => (e.id || e.empId) === empId || `${e.name} (${e.id || e.empId})` === val);
    
    if (!emp) {
        if (oldEmpInput) oldEmpInput.value = '';
        return;
    }
    
    if (oldEmpInput) {
        oldEmpInput.value = `${emp.name || emp.employeeName} (${emp.id || emp.empId})`;
    }
    
    // Us employee ke assigned assets nikalo
    const empAssignedSerials = emp.assigned || [];
    const assignedAssets = assets.filter(a => {
        const aid = a.assignedTo || a.employeeId || a.empId;
        const serial = a.serial || a.assetId || a.asset_id || a.id;
        return aid === emp.id || aid === emp.empId || empAssignedSerials.includes(serial);
    });
    
    assignedAssets.forEach(ast => {
        const opt = document.createElement('option');
        const serial = ast.serial || ast.assetId || ast.asset_id || ast.id;
        const category = ast.category || ast.type || 'Asset';
        const model = ast.model || ast.name || '';
        opt.value = serial;
        opt.textContent = `${serial} - ${category} (${model})`;
        assetDropdown.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    populateEmployeeDatalists();
});

// --- CENTRALIZED & CENTERED NOTIFICATION/ALERT HELPER ---
function showCenterAlert(message) {
    // Purana alert hatao agar ho
    const existing = document.getElementById('custom-center-alert');
    if (existing) existing.remove();

    const alertBox = document.createElement('div');
    alertBox.id = 'custom-center-alert';
    alertBox.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #ffffff; padding: 24px 32px; border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 99999;
        text-align: center; border: 1px solid #e2e8f0; min-width: 300px;
    `;
    alertBox.innerHTML = `
        <p style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 16px;">${message}</p>
        <button onclick="document.getElementById('custom-center-alert').remove()" style="background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">OK</button>
    `;
    document.body.appendChild(alertBox);
}

// --- CUSTOM SEARCHABLE DROPDOWN LOGIC ---
function openEmpDropdown(type) {
    const otherList = document.getElementById(type === 'old' ? 'new-emp-custom-list' : 'old-emp-custom-list');
    if (otherList) otherList.style.display = 'none';
    filterEmpDropdown(type);
}

function filterEmpDropdown(type) {
    const input = document.getElementById(type === 'old' ? 'search-old-employee' : 'transfer-new-emp-select');
    const listDiv = document.getElementById(type === 'old' ? 'old-emp-custom-list' : 'new-emp-custom-list');
    if (!input || !listDiv) return;

    const query = input.value.toLowerCase().trim();
    const empList = (typeof employees !== 'undefined' ? employees : []);

    // Jo naam query se match kare ya shuru ho, use upar rakho
    const filtered = empList.filter(emp => {
        const name = (emp.name || emp.employeeName || '').toLowerCase();
        const id = (emp.id || emp.empId || '').toLowerCase();
        return name.includes(query) || id.includes(query);
    }).sort((a, b) => {
        const nameA = (a.name || a.employeeName || '').toLowerCase();
        const nameB = (b.name || b.employeeName || '').toLowerCase();
        const aStarts = nameA.startsWith(query);
        const bStarts = nameB.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return nameA.localeCompare(nameB);
    });

    listDiv.innerHTML = '';
    if (filtered.length === 0) {
        listDiv.innerHTML = '<div style="padding: 10px 14px; color: #64748b; font-size: 13px;">No employee found</div>';
    } else {
        filtered.forEach(emp => {
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            const dept = emp.department || emp.dept || '';
            
            const item = document.createElement('div');
            item.style.cssText = 'padding: 10px 14px; cursor: pointer; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;';
            item.innerHTML = `<strong>${name}</strong> <span style="color: #64748b; font-size: 12px;">(${id}${dept ? ' - ' + dept : ''})</span>`;
            
            item.onmouseover = () => item.style.background = '#f1f5f9';
            item.onmouseout = () => item.style.background = '#ffffff';
            item.onclick = () => selectEmpFromDropdown(type, id, name);
            
            listDiv.appendChild(item);
        });
    }
    listDiv.style.display = 'block';
}

function selectEmpFromDropdown(type, empId, empName) {
    const input = document.getElementById(type === 'old' ? 'search-old-employee' : 'transfer-new-emp-select');
    const hiddenId = document.getElementById(type === 'old' ? 'selected-old-emp-id' : 'selected-new-emp-id');
    const listDiv = document.getElementById(type === 'old' ? 'old-emp-custom-list' : 'new-emp-custom-list');

    if (input) input.value = `${empName} (${empId})`;
    if (hiddenId) hiddenId.value = empId;
    if (listDiv) listDiv.style.display = 'none';

    if (type === 'old') {
        const oldEmpDisplay = document.getElementById('transfer-old-emp');
        if (oldEmpDisplay) oldEmpDisplay.value = `${empName} (${empId})`;
        loadAssetsForSelectedOldEmployee(empId);
    }
}

function loadAssetsForSelectedOldEmployee(empId) {
    const assetDropdown = document.getElementById('select-assigned-asset-dropdown');
    if (!assetDropdown) return;

    const emp = employees.find(e => (e.id || e.empId) === empId);
    const empAssignedSerials = (emp && Array.isArray(emp.assigned)) ? emp.assigned : [];

    const assignedAssets = assets.filter(a => {
        const assignedTo = a.assignedTo || a.employeeId || a.empId;
        const serial = a.serial || a.assetId || a.asset_id || a.id;
        return assignedTo === empId || empAssignedSerials.includes(serial);
    });

    assetDropdown.innerHTML = '';
    if (assignedAssets.length === 0) {
        assetDropdown.innerHTML = '<option value="">No assets assigned to this employee</option>';
        return;
    }

    assetDropdown.innerHTML = '<option value="">-- Select asset to transfer --</option>';
    assignedAssets.forEach(ast => {
        const serial = ast.serial || ast.assetId || ast.asset_id || ast.id;
        const category = ast.category || ast.type || 'Asset';
        const model = ast.model || ast.name || '';
        
        const opt = document.createElement('option');
        opt.value = serial;
        opt.textContent = `${serial} - ${category} (${model})`;
        assetDropdown.appendChild(opt);
    });
}

// Bahar click karne par dropdown band ho jaye
document.addEventListener('click', function(e) {
    if (!e.target.closest('#search-old-employee') && !e.target.closest('#old-emp-custom-list')) {
        const oldList = document.getElementById('old-emp-custom-list');
        if (oldList) oldList.style.display = 'none';
    }
    if (!e.target.closest('#transfer-new-emp-select') && !e.target.closest('#new-emp-custom-list')) {
        const newList = document.getElementById('new-emp-custom-list');
        if (newList) newList.style.display = 'none';
    }
});

// --- TRANSFER ASSET CORE FUNCTION ---
async function transferAsset(e) {
    if (e) e.preventDefault();

    const selectedSerial = document.getElementById('select-assigned-asset-dropdown')?.value || '';
    const newEmpId = document.getElementById('selected-new-emp-id')?.value || '';
    const reason = document.getElementById('transfer-reason')?.value.trim() || 'No reason provided';

    if (!selectedSerial) {
        showCenterAlert("Please select an asset to transfer!");
        return;
    }
    if (!newEmpId) {
        showCenterAlert("Please select a valid New Employee from the dropdown list!");
        return;
    }

    const asset = assets.find(a => (a.serial || a.assetId || a.asset_id || a.id) === selectedSerial);
    const newEmp = employees.find(em => (em.id || em.empId) === newEmpId);

    if (!asset || !newEmp) {
        showCenterAlert("Invalid selection! Please select employee and asset properly.");
        return;
    }

    const oldEmp = employees.find(em => (em.id || em.empId) === asset.assignedTo);
    if (oldEmp && (oldEmp.id || oldEmp.empId) === (newEmp.id || newEmp.empId)) {
        showCenterAlert("Asset is already assigned to this employee!");
        return;
    }

    const oldEmpName = oldEmp ? `${oldEmp.name} (${oldEmp.id})` : 'Unassigned / Stock';

    // 1. Old Employee se asset hatao
    if (oldEmp) {
        oldEmp.assigned = (oldEmp.assigned || []).filter(s => s !== asset.serial);
        if (typeof db !== 'undefined') {
            await db.from('employees').update({ assigned: oldEmp.assigned }).eq('id', oldEmp.id);
        }
    }

    // 2. New Employee mein asset add karo
    if (!newEmp.assigned) newEmp.assigned = [];
    if (!newEmp.assigned.includes(asset.serial)) {
        newEmp.assigned.push(asset.serial);
        if (typeof db !== 'undefined') {
            await db.from('employees').update({ assigned: newEmp.assigned }).eq('id', newEmp.id);
        }
    }

    // 3. Asset holder update karo
    asset.assignedTo = newEmp.id;
    if (typeof db !== 'undefined') {
        await db.from('assets').update({ assigned_to: newEmp.id }).eq('serial_tag', asset.serial);
    }

    // 4. Audit Log entry
    const logDetails = `Asset ${asset.serial} transferred from ${oldEmpName} to ${newEmp.name} (${newEmp.id}) | Reason: ${reason}`;
    const newLog = { 
        timestamp: new Date().toLocaleString(), 
        action: 'Asset Transferred', 
        details: logDetails, 
        user: typeof currentUser !== 'undefined' ? currentUser : 'Admin' 
    };
    if (typeof auditLogs !== 'undefined') auditLogs.push(newLog);
    if (typeof db !== 'undefined') {
        await db.from('audit_logs').insert([newLog]);
    }

    if (typeof saveData === 'function') saveData();
    if (typeof refreshAllData === 'function') refreshAllData();

    // Form clear karo
    document.getElementById('search-old-employee').value = '';
    document.getElementById('selected-old-emp-id').value = '';
    document.getElementById('transfer-old-emp').value = '';
    document.getElementById('select-assigned-asset-dropdown').innerHTML = '<option value="">First select an old employee...</option>';
    document.getElementById('transfer-new-emp-select').value = '';
    document.getElementById('selected-new-emp-id').value = '';
    document.getElementById('transfer-reason').value = '';

    showCenterAlert("Asset successfully transferred!");
}

// Global alert override taaki saare alerts center mein aayein
window.alert = function(message) {
    const existing = document.getElementById('custom-center-alert');
    if (existing) existing.remove();

    const alertBox = document.createElement('div');
    alertBox.id = 'custom-center-alert';
    alertBox.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #ffffff; padding: 24px 32px; border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25); z-index: 99999;
        text-align: center; border: 1px solid #e2e8f0; min-width: 300px;
    `;
    alertBox.innerHTML = `
        <p style="font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 16px;">${message}</p>
        <button onclick="document.getElementById('custom-center-alert').remove()" style="background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">OK</button>
    `;
    document.body.appendChild(alertBox);
};

// --- RETURN ASSET SEARCHABLE DROPDOWN & BULK RETURN LOGIC ---

function openReturnEmpDropdown() {
    filterReturnEmpDropdown();
}

function filterReturnEmpDropdown() {
    const input = document.getElementById('return-employee-search');
    const listDiv = document.getElementById('return-emp-custom-list');
    if (!input || !listDiv) return;

    const query = input.value.toLowerCase().trim();
    const empList = (typeof employees !== 'undefined' ? employees : []);

    const filtered = empList.filter(emp => {
        const name = (emp.name || emp.employeeName || '').toLowerCase();
        const id = (emp.id || emp.empId || '').toLowerCase();
        return name.includes(query) || id.includes(query);
    }).sort((a, b) => {
        const nameA = (a.name || a.employeeName || '').toLowerCase();
        const nameB = (b.name || b.employeeName || '').toLowerCase();
        const aStarts = nameA.startsWith(query);
        const bStarts = nameB.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return nameA.localeCompare(nameB);
    });

    listDiv.innerHTML = '';
    if (filtered.length === 0) {
        listDiv.innerHTML = '<div style="padding: 10px 14px; color: #64748b; font-size: 13px;">No employee found</div>';
    } else {
        filtered.forEach(emp => {
            const name = emp.name || emp.employeeName || '';
            const id = emp.id || emp.empId || '';
            const dept = emp.department || emp.dept || '';
            
            const item = document.createElement('div');
            item.style.cssText = 'padding: 10px 14px; cursor: pointer; font-size: 13.5px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;';
            item.innerHTML = `<strong>${name}</strong> <span style="color: #64748b; font-size: 12px;">(${id}${dept ? ' - ' + dept : ''})</span>`;
            
            item.onmouseover = () => item.style.background = '#f1f5f9';
            item.onmouseout = () => item.style.background = '#ffffff';
            item.onclick = () => selectReturnEmployee(id, name);
            
            listDiv.appendChild(item);
        });
    }
    listDiv.style.display = 'block';
}

function selectReturnEmployee(empId, empName) {
    const input = document.getElementById('return-employee-search');
    const hiddenId = document.getElementById('selected-return-emp-id');
    const listDiv = document.getElementById('return-emp-custom-list');
    const holderInput = document.getElementById('return-current-holder');

    if (input) input.value = `${empName} (${empId})`;
    if (hiddenId) hiddenId.value = empId;
    if (listDiv) listDiv.style.display = 'none';
    if (holderInput) holderInput.value = `${empName} (${empId})`;

    loadAssetsForReturnEmployee(empId);
}

function loadAssetsForReturnEmployee(empId) {
    const assetDropdown = document.getElementById('return-asset-dropdown');
    if (!assetDropdown) return;

    const emp = employees.find(e => (e.id || e.empId) === empId);
    const empAssignedSerials = (emp && Array.isArray(emp.assigned)) ? emp.assigned : [];

    const assignedAssets = assets.filter(a => {
        const assignedTo = a.assignedTo || a.employeeId || a.empId;
        const serial = a.serial || a.assetId || a.asset_id || a.id;
        return assignedTo === empId || empAssignedSerials.includes(serial);
    });

    assetDropdown.innerHTML = '';
    if (assignedAssets.length === 0) {
        assetDropdown.innerHTML = '<option value="">No assets assigned to this employee</option>';
        return;
    }

    assetDropdown.innerHTML = '<option value="">-- Select asset to return --</option>';
    
    // * RETURN ALL ASSETS OPTION *
    const allOpt = document.createElement('option');
    allOpt.value = 'RETURN_ALL';
    allOpt.textContent = `🚀 Return All Assets (${assignedAssets.length} Assets)`;
    allOpt.style.fontWeight = 'bold';
    allOpt.style.color = '#0d9488';
    assetDropdown.appendChild(allOpt);

    assignedAssets.forEach(ast => {
        const serial = ast.serial || ast.assetId || ast.asset_id || ast.id;
        const category = ast.category || ast.type || 'Asset';
        const model = ast.model || ast.name || '';
        
        const opt = document.createElement('option');
        opt.value = serial;
        opt.textContent = `${serial} - ${category} (${model})`;
        assetDropdown.appendChild(opt);
    });
}

// Bahar click karne par dropdown band ho jaye
document.addEventListener('click', function(e) {
    if (!e.target.closest('#return-employee-search') && !e.target.closest('#return-emp-custom-list')) {
        const list = document.getElementById('return-emp-custom-list');
        if (list) list.style.display = 'none';
    }
});

// --- SUBMIT RETURN ASSET ---
async function returnAssetToStock(e) {
    if (e) e.preventDefault();

    const empId = document.getElementById('selected-return-emp-id')?.value || '';
    const selectedVal = document.getElementById('return-asset-dropdown')?.value || '';
    const reason = document.getElementById('return-reason')?.value.trim() || 'Returned to stock';

    if (!empId) {
        showCenterAlert("Please select an employee!");
        return;
    }
    if (!selectedVal) {
        showCenterAlert("Please select an asset or 'Return All Assets'!");
        return;
    }

    const emp = employees.find(em => (em.id || em.empId) === empId);
    if (!emp) {
        showCenterAlert("Invalid employee selection!");
        return;
    }

    const empAssignedSerials = (emp && Array.isArray(emp.assigned)) ? emp.assigned : [];
    const empAssets = assets.filter(a => {
        const assignedTo = a.assignedTo || a.employeeId || a.empId;
        const serial = a.serial || a.assetId || a.asset_id || a.id;
        return assignedTo === empId || empAssignedSerials.includes(serial);
    });

    if (selectedVal === 'RETURN_ALL') {
        // --- BULK RETURN ALL ASSETS ---
        for (const ast of empAssets) {
            ast.assignedTo = null;
            if (typeof db !== 'undefined') {
                await db.from('assets').update({ assigned_to: null }).eq('serial_tag', ast.serial);
            }
        }
        
        const count = empAssets.length;
        emp.assigned = [];
        if (typeof db !== 'undefined') {
            await db.from('employees').update({ assigned: [] }).eq('id', emp.id);
        }

        const logDetails = `All ${count} assets returned to stock from ${emp.name} (${emp.id}) | Reason: ${reason}`;
        const newLog = { 
            timestamp: new Date().toLocaleString(), 
            action: 'Assets Returned (Bulk)', 
            details: logDetails, 
            user: typeof currentUser !== 'undefined' ? currentUser : 'Admin' 
        };
        if (typeof auditLogs !== 'undefined') auditLogs.push(newLog);
        if (typeof db !== 'undefined') {
            await db.from('audit_logs').insert([newLog]);
        }

        showCenterAlert(`Successfully returned all ${count} assets to stock!`);
    } else {
        // --- SINGLE ASSET RETURN ---
        const asset = assets.find(a => (a.serial || a.assetId || a.asset_id || a.id) === selectedVal);
        if (!asset) {
            showCenterAlert("Selected asset not found!");
            return;
        }

        emp.assigned = (emp.assigned || []).filter(s => s !== asset.serial);
        if (typeof db !== 'undefined') {
            await db.from('employees').update({ assigned: emp.assigned }).eq('id', emp.id);
        }

        asset.assignedTo = null;
        if (typeof db !== 'undefined') {
            await db.from('assets').update({ assigned_to: null }).eq('serial_tag', asset.serial);
        }

        const logDetails = `Asset ${asset.serial} returned to stock from ${emp.name} (${emp.id}) | Reason: ${reason}`;
        const newLog = { 
            timestamp: new Date().toLocaleString(), 
            action: 'Asset Returned', 
            details: logDetails, 
            user: typeof currentUser !== 'undefined' ? currentUser : 'Admin' 
        };
        if (typeof auditLogs !== 'undefined') auditLogs.push(newLog);
        if (typeof db !== 'undefined') {
            await db.from('audit_logs').insert([newLog]);
        }

        showCenterAlert("Asset successfully returned to stock!");
    }

    if (typeof saveData === 'function') saveData();
    if (typeof refreshAllData === 'function') refreshAllData();

    // Form clear karo
    document.getElementById('return-employee-search').value = '';
    document.getElementById('selected-return-emp-id').value = '';
    document.getElementById('return-current-holder').value = '';
    document.getElementById('return-asset-dropdown').innerHTML = '<option value="">First select an employee...</option>';
    document.getElementById('return-reason').value = '';
}