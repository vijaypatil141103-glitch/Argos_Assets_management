// --- PART 1: Initialization & Navigation ---
let assets = JSON.parse(localStorage.getItem('argos_assets')) || [
    { serial: 'ARG-LAP-001', category: 'Laptop', status: 'Assigned', assignedTo: '10048', date: '2025-09-14', vendor: 'Dell Store', cost: 45000, model: 'ThinkPad E14', ram: '16GB', processor: 'Core i5', graphics: 'Intel Iris', invoiceNo: 'INV-101', invoicePdf: '', warrantyDate: '2026-12-31' },
    { serial: 'ARG-MSE-001', category: 'Mouse', status: 'Assigned', assignedTo: '10008', date: '2025-09-14', vendor: 'Logitech', cost: 500, model: 'B170', invoiceNo: 'INV-102', invoicePdf: '', warrantyDate: '2026-11-15' },
    { serial: 'ARG-MON-001', category: 'Monitor', status: 'In Stock', assignedTo: '', date: '2025-09-15', vendor: 'Samsung', cost: 12000, model: 'S24R350', invoiceNo: 'INV-103', invoicePdf: '', warrantyDate: '2027-01-10' },
    { serial: 'ARG-KEY-001', category: 'Keyboard', status: 'Damaged (In Office)', assignedTo: '', date: '2025-09-15', vendor: 'Dell', cost: 800, model: 'KB216', invoiceNo: 'INV-104', invoicePdf: '', warrantyDate: '2026-10-20' }
];

let employees = JSON.parse(localStorage.getItem('argos_employees')) || [
    { id: '10048', name: 'Kaif', email: 'kaif@argoswatch.com', dept: 'IT Department', assigned: ['ARG-LAP-001'] },
    { id: '10008', name: 'Muffy', email: 'muffy@argoswatch.com', dept: 'Inventory', assigned: ['ARG-MSE-001'] }
];

let assignmentHistory = JSON.parse(localStorage.getItem('argos_history')) || [];
let serviceLogs = JSON.parse(localStorage.getItem('argos_service_logs')) || [];
let assetRequests = JSON.parse(localStorage.getItem('argos_requests')) || [];

if (!localStorage.getItem('argos_admin_pass')) localStorage.setItem('argos_admin_pass', 'admin123');
if (!localStorage.getItem('argos_access_emails')) localStorage.setItem('argos_access_emails', JSON.stringify(['admin@argoswatch.com', 'manager@argoswatch.com']));

let adminPassword = localStorage.getItem('argos_admin_pass') || 'admin123';
let accessEmails = JSON.parse(localStorage.getItem('argos_access_emails')) || ['admin@argoswatch.com', 'manager@argoswatch.com'];

window.onload = function() {
    const logged = sessionStorage.getItem('argos_logged_user');
    if (logged) { 
        showDashboardApp(); 
    } else { 
        sessionStorage.removeItem('argos_logged_user');
        showLoginScreen(); 
    }
    const dateEl = document.getElementById('current-date');
    if (dateEl) dateEl.innerText = new Date().toLocaleString();
};

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

// --- PART 2: Dashboard & Audit Logs ---
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

    let filteredLogs = assignmentHistory.filter(h => {
        let textMatch = (h.date && h.date.toLowerCase().includes(query)) || 
                        (h.type && h.type.toLowerCase().includes(query)) || 
                        (h.details && h.details.toLowerCase().includes(query));
        
        let categoryMatch = true;
        if (selectedCategory) {
            let assetFound = assets.find(a => h.details && h.details.includes(a.serial));
            categoryMatch = assetFound && assetFound.category === selectedCategory;
        }
        
        return textMatch && categoryMatch;
    });

    if (filteredLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No audit logs found.</td></tr>';
        return;
    }

    filteredLogs.slice().reverse().forEach(h => {
        let tr = document.createElement('tr');
        tr.innerHTML = '<td><small>' + h.date + '</small></td><td><strong>' + h.type + '</strong></td><td>' + h.details + '</td>';
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
                       '<td><button class="btn" style="background:#0284C7; color:#FFF; padding:4px 8px; font-size:11px; margin-right:4px;" onclick="openAssetRepairModal(\'' + a.serial + '\')">Repair Log</button>' +
                       '<button class="btn" style="background:#EF4444; color:#FFF; padding:4px 8px; font-size:11px;" onclick="openAssetDeleteModal(\'' + a.serial + '\')">Delete</button></td>';
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
function assignAsset(e) {
    if (e) e.preventDefault();
    const rawVal = document.getElementById('modal-assign-search').value.trim();
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal;
    const empRaw = document.getElementById('modal-assign-emp-search').value.trim();
    let empId = empRaw.includes('(ID: ') ? empRaw.split('(ID: ')[1].split(')')[0].trim() : empRaw;

    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = employees.find(em => em.id.toLowerCase() === empId.toLowerCase());
    if (!asset || asset.status !== 'In Stock') { alert("Invalid or unavailable asset!"); return; }
    if (!emp) { alert("Invalid employee ID!"); return; }

    asset.status = 'Assigned'; asset.assignedTo = emp.id;
    if (!emp.assigned.includes(asset.serial)) emp.assigned.push(asset.serial);
    assignmentHistory.push({ type: 'Asset Assigned', details: 'Asset ' + asset.serial + ' assigned to ' + emp.name, date: new Date().toLocaleString() });
    saveData(); refreshAllData(); alert("Asset successfully assigned!");
}

function updateTransferOldEmployee() {
    const rawVal = document.getElementById('transfer-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = asset && asset.assignedTo ? employees.find(e => e.id === asset.assignedTo) : null;
    document.getElementById('transfer-old-emp').value = emp ? emp.name + ' (ID: ' + emp.id + ')' : 'Not Assigned / Stock';
}

function transferAsset(e) {
    if (e) e.preventDefault();
    const rawVal = document.getElementById('transfer-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const newEmpRaw = document.getElementById('transfer-emp-select').value.trim();
    let newEmpId = newEmpRaw.includes('(ID: ') ? newEmpRaw.split('(ID: ')[1].split(')')[0].trim() : newEmpRaw;

    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const newEmp = employees.find(em => em.id.toLowerCase() === newEmpId.toLowerCase());
    if (!asset || !newEmp) { alert("Invalid selection!"); return; }

    const oldEmp = employees.find(em => em.id === asset.assignedTo);
    if (oldEmp) oldEmp.assigned = oldEmp.assigned.filter(s => s !== asset.serial);
    if (!newEmp.assigned.includes(asset.serial)) newEmp.assigned.push(asset.serial);

    asset.assignedTo = newEmp.id;
    assignmentHistory.push({ type: 'Asset Transferred', details: 'Asset ' + asset.serial + ' transferred to ' + newEmp.name, date: new Date().toLocaleString() });
    saveData(); refreshAllData(); alert("Asset successfully transferred!");
}

function updateReturnHolder() {
    const rawVal = document.getElementById('return-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    const emp = asset && asset.assignedTo ? employees.find(e => e.id === asset.assignedTo) : null;
    document.getElementById('return-holder-emp').value = emp ? emp.name + ' (ID: ' + emp.id + ')' : 'Not Assigned / Stock';
}

function returnAsset(e) {
    if (e) e.preventDefault();
    const rawVal = document.getElementById('return-asset-search').value;
    const serial = rawVal.includes(' - ') ? rawVal.split(' - ')[0].trim() : rawVal.trim();
    const asset = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
    if (!asset) { alert("Invalid asset!"); return; }
    
    const emp = employees.find(em => em.id === asset.assignedTo);
    if (emp) emp.assigned = emp.assigned.filter(s => s !== asset.serial);
    asset.status = 'In Stock'; asset.assignedTo = '';
    assignmentHistory.push({ type: 'Asset Returned', details: 'Asset ' + serial + ' returned to stock', date: new Date().toLocaleString() });
    saveData(); refreshAllData(); alert("Asset returned to stock!");
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

function openSelectAssetPopup() {
    const listDiv = document.getElementById('popup-asset-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    
    assets.filter(a => a.status === 'In Stock').forEach(a => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 6px; cursor: pointer;";
        
        // Yahan aap serial aur category ke sath unki condition ya status dikha sakte hain
        item.innerHTML = '<strong>' + a.serial + '</strong> (' + a.category + ') - <span style="color: #10B981; font-weight: 600;">In Stock</span>';
        
        item.onclick = function() {
            document.getElementById('assign-asset-search').value = a.serial + ' - ' + a.category;
            closeSelectAssetPopup();
        };
        listDiv.appendChild(item);
    });
    document.getElementById('selectAssetModal').style.display = 'flex';
}
function closeSelectAssetPopup() { document.getElementById('selectAssetModal').style.display = 'none'; }

function openSelectEmployeePopup() {
    const listDiv = document.getElementById('popup-employee-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    employees.forEach(emp => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;";
        item.innerHTML = '<strong>' + emp.name + '</strong> (ID: ' + emp.id + ')';
        item.onclick = function() { document.getElementById('modal-assign-emp-search').value = emp.name + ' (ID: ' + emp.id + ')'; closeSelectEmployeePopup(); };
        listDiv.appendChild(item);
    });
    document.getElementById('selectEmployeeModal').style.display = 'flex';
}
function closeSelectEmployeePopup() { document.getElementById('selectEmployeeModal').style.display = 'none'; }

function openSelectTransferEmployeePopup() {
    const listDiv = document.getElementById('popup-employee-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    employees.forEach(emp => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;";
        item.innerHTML = '<strong>' + emp.name + '</strong> (ID: ' + emp.id + ')';
        item.onclick = function() { document.getElementById('transfer-emp-select').value = emp.name + ' (ID: ' + emp.id + ')'; closeSelectEmployeePopup(); };
        listDiv.appendChild(item);
    });
    document.getElementById('selectEmployeeModal').style.display = 'flex';
}

function openSelectAssignedAssetPopup(type) {
    const listDiv = document.getElementById('popup-assigned-asset-list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    assets.filter(a => a.status === 'Assigned').forEach(a => {
        let item = document.createElement('div');
        item.style.cssText = "padding: 8px 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 6px; cursor: pointer;";
        
        // Employee ka naam dhoondhne ke liye logic
        const emp = employees.find(e => e.id === a.assignedTo);
        const empName = emp ? emp.name : 'Unknown';
        
        // Serial, Category ke sath Employee ka naam bhi yahan show hoga
        item.innerHTML = '<strong>' + a.serial + '</strong> (' + a.category + ') - Assigned to: <span style="color: #2563EB; font-weight: 600;">' + empName + '</span>';
        
        item.onclick = function() {
            if (type === 'transfer') { document.getElementById('transfer-asset-search').value = a.serial + ' - ' + a.category; }
            else { document.getElementById('return-asset-search').value = a.serial + ' - ' + a.category; updateReturnAssetDetails(a.serial); }
            closeSelectAssignedAssetPopup();
        };
        listDiv.appendChild(item);
    });
    document.getElementById('selectAssignedAssetModal').style.display = 'flex';
}
function closeSelectAssignedAssetPopup() { document.getElementById('selectAssignedAssetModal').style.display = 'none'; }

function submitAssetRequest(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('req-emp-id').value.trim();
    const name = document.getElementById('req-emp-name').value.trim();
    const details = document.getElementById('req-details').value.trim();
    assetRequests.push({ date: new Date().toLocaleDateString(), empId: id, empName: name, details: details, status: 'Pending' });
    saveData(); closeRequestModal(); refreshAllData(); alert("Request submitted!");
}

function renderRequestsTable() {
    const tbody = document.getElementById('requests-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (assetRequests.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No requests pending.</td></tr>'; return; }
    assetRequests.slice().reverse().forEach((r, idx) => {
        let statusBadge = r.status === 'Pending' ? '<span class="badge badge-alert">Pending</span>' : '<span class="badge badge-stock">Fulfilled</span>';
        let actionBtn = r.status === 'Pending' ? '<button class="btn" style="background:#0D9488; padding:4px 10px; font-size:11px;" onclick="fulfillRequest(' + idx + ')">Approve</button>' : 'Done';
        tbody.innerHTML += '<tr><td><small>' + r.date + '</small></td><td><strong>' + r.empName + '</strong></td><td>' + r.details + '</td><td>' + statusBadge + '</td><td>' + actionBtn + '</td></tr>';
    });
}

function fulfillRequest(index) {
    assetRequests[index].status = 'Fulfilled';
    saveData(); refreshAllData(); switchTab('assign'); alert("Request fulfilled.");
}

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
    accessEmails.forEach(em => { container.innerHTML += '<div style="display:flex; justify-content:space-between; padding:6px 10px; background:#F1F5F9; border-radius:6px; font-size:13px;"><span>' + em + '</span></div>'; });
}

function downloadSystemBackup() {
    const backupData = { assets, employees, history: assignmentHistory, serviceLogs, requests: assetRequests, accessEmails };
    let blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a'); a.href = url; a.download = 'argos_it_system_backup.json'; a.click();
}

function saveData() {
    localStorage.setItem('argos_assets', JSON.stringify(assets));
    localStorage.setItem('argos_employees', JSON.stringify(employees));
    localStorage.setItem('argos_history', JSON.stringify(assignmentHistory));
    localStorage.setItem('argos_service_logs', JSON.stringify(serviceLogs));
    localStorage.setItem('argos_requests', JSON.stringify(assetRequests));
    localStorage.setItem('argos_access_emails', JSON.stringify(accessEmails));
}

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

function addAssetFromModal(e) {
    if (e) e.preventDefault();
    const category = document.getElementById('modal-asset-category').value;
    const serial = document.getElementById('modal-asset-serial').value.trim();
    const status = document.getElementById('modal-asset-status').value;
    const date = document.getElementById('modal-asset-date').value;
    // ✅ Warranty Expiry Date capture ki yahan
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
    
    // ✅ assets.push ke andar warrantyDate add ho gayi hai
    assets.push({ 
        serial, category, status, assignedTo: '', date, warrantyDate, vendor, model, 
        ram, processor, graphics, cost: Number(cost), invoiceNo, invoicePdf: invoicePdfName 
    });
    
    assignmentHistory.push({ type: 'Asset Added', details: 'Hardware asset ' + serial + ' (' + category + ') added to inventory', date: new Date().toLocaleString() });
    saveData(); closeAssetModal(); refreshAllData(); alert("Asset added successfully!");
}
function openEmployeeModal() { document.getElementById('employeeModal').style.display = 'flex'; }
function closeEmployeeModal() { document.getElementById('employeeModal').style.display = 'none'; }

function addEmployeeFromModal(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('modal-emp-id').value.trim();
    const name = document.getElementById('modal-emp-name').value.trim();
    const email = document.getElementById('modal-emp-email').value.trim();
    const dept = document.getElementById('modal-emp-dept').value.trim();
    if (employees.some(em => em.id === id)) { alert("ID exists!"); return; }
    employees.push({ id, name, email, dept, assigned: [] });
    assignmentHistory.push({ type: 'Employee Added', details: 'Employee ' + name + ' (ID: ' + id + ') registered', date: new Date().toLocaleString() });
    saveData(); closeEmployeeModal(); refreshAllData(); alert("Employee added!");
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

function deleteAsset(serial) { 
    if (confirm("Delete " + serial + "?")) { 
        assets = assets.filter(a => a.serial !== serial); 
        assignmentHistory.push({ type: 'Asset Deleted', details: 'Asset ' + serial + ' removed from inventory', date: new Date().toLocaleString() });
        saveData(); refreshAllData(); 
    } 
}
function deleteEmployee(empId) { 
    if (confirm("Delete employee " + empId + "?")) { 
        employees = employees.filter(e => e.id !== empId); 
        saveData(); refreshAllData(); 
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

function refreshAllData() {
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

                if (!rowData.serial || (typeof assets !== 'undefined' && assets.some(a => a.serial === rowData.serial))) {
                    skippedCount++;
                    continue;
                }

                if (typeof assets !== 'undefined') {
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
            }

            if (typeof saveData === 'function') saveData();
            if (typeof refreshAllData === 'function') refreshAllData();
            closeBulkImportModal();

            alert("Bulk Import Complete!\n✅ Successfully Imported: " + importedCount + "\n⚠️ Skipped (Duplicates/Invalid): " + skippedCount);
        } catch (err) {
            console.error("CSV Import Error:", err);
            alert("Error parsing CSV file. Please check file format.");
        }
    };

    reader.readAsText(file);
}

// --- ASSET MAINTENANCE & REPAIR TIMELINE FUNCTIONS ---
let currentMaintSerial = null;

function openMaintenanceModal(serial) {
    currentMaintSerial = serial;
    const modal = document.getElementById('maintenanceModal');
    const infoEl = document.getElementById('maintAssetInfo');
    if (modal) modal.style.display = 'flex';
    
    if (typeof assets !== 'undefined') {
        let asset = assets.find(a => a.serial === serial);
        if (asset) {
            if (!asset.maintenanceLogs) asset.maintenanceLogs = [];
            if (infoEl) {
                infoEl.innerHTML = "Managing repairs for Asset: <strong>" + asset.serial + "</strong> (" + (asset.category || 'Asset') + " - " + (asset.model || 'N/E') + ")";
            }
            renderMaintenanceTimeline();
        }
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

    if (typeof assets !== 'undefined') {
        let asset = assets.find(a => a.serial === currentMaintSerial);
        if (asset) {
            if (!asset.maintenanceLogs) asset.maintenanceLogs = [];
            asset.maintenanceLogs.push({
                date: date,
                cost: Number(cost) || 0,
                issue: issue
            });

            if (typeof saveData === 'function') saveData();
            if (typeof refreshAllData === 'function') refreshAllData();

            dateEl.value = '';
            costEl.value = '';
            issueEl.value = '';

            renderMaintenanceTimeline();
            alert("Repair log added successfully!");
        }
    }
}

function renderMaintenanceTimeline() {
    const listEl = document.getElementById('maintTimelineList');
    if (!listEl) return;

    if (typeof assets === 'undefined') return;
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

    consumablesStock.push({
        id: 'CONS-' + Date.now(),
        name: name,
        qty: qty,
        minQty: minQty
    });

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

// Asset History Modal open karne ka error-free function
function openAssetHistory(serial) {
    const modal = document.getElementById('assetHistoryModal');
    const title = document.getElementById('history-modal-title');
    const content = document.getElementById('history-modal-content');
    
    if (!modal) return;
    
    const assetList = (typeof assets !== 'undefined' && Array.isArray(assets)) ? assets : [];
    const asset = assetList.find(a => a.serial === serial);
    
    if (title) {
        let catStr = asset ? " (" + asset.category + ")" : "";
        title.innerText = "Asset History: " + serial + catStr;
    }
    
    let logs = [];
    if (typeof assignmentHistory !== 'undefined' && Array.isArray(assignmentHistory)) {
        logs = assignmentHistory.filter(function(h) {
            return h.serial === serial || (h.details && h.details.includes(serial));
        });
    } else if (typeof auditLogs !== 'undefined' && Array.isArray(auditLogs)) {
        logs = auditLogs.filter(function(h) {
            return h.details && h.details.includes(serial);
        });
    }
    
    if (!content) return;

    if (logs.length === 0) {
        content.innerHTML = '<p style="color: #64748B; text-align: center; padding: 20px;">Abhi tak is asset ki koi history log nahi hai.</p>';
    } else {
        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        html += '<tr style="background: #F1F5F9; text-align: left;"><th style="padding: 8px;">Date</th><th style="padding: 8px;">Action</th><th style="padding: 8px;">Details</th></tr>';
        
        logs.forEach(function(h) {
            let d = h.date || h.timestamp || 'N/A';
            let act = h.action || 'Log';
            let det = h.employeeName || h.employee || h.details || 'N/A';
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