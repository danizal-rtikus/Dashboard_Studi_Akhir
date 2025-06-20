// script.js

// Google Apps Script Web App URL.
// ENSURE THIS URL IS CORRECT AND DEPLOYED WITH PUBLIC ACCESS.
const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwLjQRxoemkHfjtcJNa9U4HsxP_egj_jAyefVnV1wIm_r1yewrV25pAUM3FM2JNuwV5/exec';

let originalData = []; // Global variable to store raw data from the API
let uniqueDosenNames = []; // Stores a list of unique faculty names
let dosenStats = {}; // Stores detailed statistics for each faculty member
let prodiStatsData = {}; // NEW: Stores detailed statistics per program study
let currentPage = 1;
const rowsPerPage = 10;
const fullTableRowsPerPage = 15;

let currentDosenFilter = null; // Stores the currently filtered faculty name for the supervised student page

/**
 * Displays a global message at the top of the page.
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false if it's a loading/info message.
 */
function showGlobalMessage(message, isError = false) {
    const container = document.getElementById('globalMessageContainer');
    if (!container) {
        console.error("Global message container not found!");
        return;
    }
    container.innerHTML = `<span class="message-text">${message}</span><button class="close-button">&times;</button>`;
    container.className = 'global-message-container'; // Reset classes
    if (isError) {
        container.classList.add('error');
    } else {
        container.classList.add('loading');
    }
    container.style.display = 'block';

    // Add event listener to close button
    const closeButton = container.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = clearGlobalMessage;
    }
}

/**
 * Removes the global message from display.
 */
function clearGlobalMessage() {
    const container = document.getElementById('globalMessageContainer');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
        container.classList.remove('loading', 'error');
    }
}


/**
 * Displays the selected page and hides other pages.
 * Also manages active status in the sidebar.
 * @param {string} pageId - ID of the page element to display.
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => page.style.display = 'none');

    const contentPage = document.getElementById(pageId);
    if (contentPage) {
        contentPage.style.display = 'block';
    } else {
        console.error(`Error: Page element with ID '${pageId}' not found.`);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active', 'open'));

    // Ensure menu ID casing matches HTML
    const basePageName = pageId.replace('Page', '');
    const capitalizedMenuSuffix = basePageName.charAt(0).toUpperCase() + basePageName.slice(1);
    const menuElementId = 'menu' + capitalizedMenuSuffix;

    // Special handling for supervised student detail page, activate Faculty Advisor menu
    if (pageId === 'mahasiswaBimbinganDetailPage') {
        document.getElementById('menuDosenPembimbing').classList.add('active');
    } else if (pageId === 'prodiStatsPage') { // If on Program Study Statistics page, activate Program Study Statistics menu
        document.getElementById('menuProdiStats').classList.add('active');
    }
    else {
        const menuElement = document.getElementById(menuElementId);
        if (menuElement) {
            menuElement.classList.add('active');
        } else {
            console.error(`Error: Sidebar menu element with ID '${menuElementId}' not found.`);
        }
    }

    // Reset filters and related data when changing pages
    // Except if the pageId is mahasiswaBimbinganDetailPage (because currentDosenFilter will be used)
    if (pageId !== 'mahasiswaBimbinganDetailPage') {
        currentDosenFilter = null; // Reset faculty filter
        const searchBoxBimbingan = document.getElementById('searchBoxBimbingan');
        const statusFilterBimbingan = document.getElementById('statusFilterBimbingan');
        if (searchBoxBimbingan) searchBoxBimbingan.value = '';
        if (statusFilterBimbingan) statusFilterBimbingan.value = 'all';

        const backButtonFromBimbingan = document.getElementById('backToDosenListFromBimbinganBtn');
        if(backButtonFromBimbingan) backButtonFromBimbingan.style.display = 'none';
    }

    // Reset faculty search on faculty list page when moving from that page
    if (pageId !== 'dosenPembimbingPage') {
        const searchBoxDosen = document.getElementById('searchBoxDosen');
        if (searchBoxDosen) {
            searchBoxDosen.value = '';
        }
    }

    // NEW: Reset program study dropdown on program study statistics page when moving from that page
    if (pageId !== 'prodiStatsPage') {
        const prodiSelector = document.getElementById('prodiSelectorForStats');
        if (prodiSelector) {
            prodiSelector.value = 'all'; // Reset to "Select Program Study"
            // Clear cards and display initial message
            const cardsContainer = document.getElementById('prodiSpecificStatsCards');
            if (cardsContainer) {
                cardsContainer.innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color:#777;">Silakan pilih program studi dari dropdown di atas untuk melihat statistiknya.</p>';
                document.getElementById('currentProdiStatsName').innerText = 'Pilih Prodi'; // Reset title
            }
        }
    }


    currentPage = 1; // Reset pagination page every time page changes
}

// Sidebar Click Events
document.getElementById('menuDashboard').addEventListener('click', function() {
    showPage('dashboardPage');
});
document.getElementById('menuDataMahasiswa').addEventListener('click', function() {
    showPage('dataMahasiswaPage');
});
// Event listener for Faculty Advisor menu (directly displays faculty list)
document.getElementById('menuDosenPembimbing').addEventListener('click', function() {
    showPage('dosenPembimbingPage');
    updateDashboard(); // Load faculty list when page opens
});
// START: Event listener for new Program Study Statistics menu
document.getElementById('menuProdiStats').addEventListener('click', function() {
    showPage('prodiStatsPage');
    // Do not directly call updateDashboard, let the dropdown trigger card rendering
    // Just ensure program study dropdown is populated and initial message is displayed
    populateProdiSelectorForStats();
});
// END: Event listener for new Program Study Statistics menu
document.getElementById('menuAnalytics').addEventListener('click', function() {
    showPage('analyticsPage');
    updateDashboard(); // Ensure charts are re-rendered
});
document.getElementById('menuReport').addEventListener('click', function() {
    showPage('reportPage');
});
document.getElementById('showAllMahasiswa').addEventListener('click', function(e) {
    e.preventDefault();
    showPage('dataMahasiswaPage');
});

// Event listener for back button from supervised student details page
document.getElementById('backToDosenListFromBimbinganBtn').addEventListener('click', function() {
    showPage('dosenPembimbingPage'); // Go back to faculty list page
    updateDashboard(); // Update faculty list page
});


// Displays current date in the header
function displayCurrentDate() {
    const now = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('currentDate').innerText = now.toLocaleDateString('en-GB', options).replace(/\//g, '/');
}

/**
 * Fetches data from Google Apps Script Web App URL.
 * Handles potential errors from fetch operation or Apps Script response.
 */
async function loadDataFromAppsScript() {
    clearGlobalMessage(); // Clear previous messages (error/loading)
    showGlobalMessage('Memuat data, mohon tunggu...', false); // Display loading message

    try {
        const response = await fetch(appsScriptUrl);
        const result = await response.json();

        if (result.error) {
            console.error('Error from Apps Script:', result.error);
            showGlobalMessage(`Gagal memuat data: ${result.error}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
            // Clear error messages from individual tables as a global message is now present
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
            return;
        }

        if (result.data) {
            originalData = result.data;
            // Extract unique faculty names and calculate faculty statistics
            const dosenSet = new Set();
            const tempDosenStats = {};
            const tempProdiStatsData = {}; // NEW: Object to store statistics per program study

            const allPossibleStatuses = [ // Complete list of statuses for initial calculation
                "Belum Proposal", "Sudah Proposal", "Seminar Hasil", "Pendadaran",
                "Belum Ujian Komprehensif", "Sudah Ujian Komprehensif", "Sudah Yudisium"
            ];

            originalData.forEach(d => {
                const p1 = d["Usulan Komisi SI (P1)"];
                const p2 = d["Usulan Komisi (P2)"];
                const status = d.Status || "Other"; // Default status
                const prodi = d["Program Studi"] || "Other"; // Get student's program study

                // Calculate Faculty Statistics
                const relevantDosen = [];
                if (p1) relevantDosen.push(p1);
                if (p2 && p2 !== p1) relevantDosen.push(p2);

                relevantDosen.forEach(dosenName => {
                    if (!tempDosenStats[dosenName]) {
                        tempDosenStats[dosenName] = { total: 0 };
                        allPossibleStatuses.forEach(s => tempDosenStats[dosenName][s] = 0);
                        tempDosenStats[dosenName]["Other"] = 0;
                    }
                    tempDosenStats[dosenName].total++;
                    if (tempDosenStats[dosenName].hasOwnProperty(status)) {
                        tempDosenStats[dosenName][status]++;
                    } else {
                        tempDosenStats[dosenName]["Other"]++;
                    }
                });
                // Also add faculty names to the global set for unique list
                if (p1) dosenSet.add(p1);
                if (p2) dosenSet.add(p2);

                // NEW: Calculate Program Study Statistics
                if (!tempProdiStatsData[prodi]) {
                    tempProdiStatsData[prodi] = { total: 0 };
                    allPossibleStatuses.forEach(s => tempProdiStatsData[prodi][s] = 0);
                    tempProdiStatsData[prodi]["Other"] = 0;
                }
                tempProdiStatsData[prodi].total++;
                if (tempProdiStatsData[prodi].hasOwnProperty(status)) {
                    tempProdiStatsData[prodi][status]++;
                } else {
                    tempProdiStatsData[prodi]["Other"]++;
                }
            });

            uniqueDosenNames = Array.from(dosenSet).sort();
            dosenStats = tempDosenStats; // Store complete faculty statistics
            prodiStatsData = tempProdiStatsData; // NEW: Store complete program study statistics

            populateProdiFilter(originalData);
            populateStatusFilter(originalData);
            populateStatusFilterBimbingan(originalData);
            populateProdiSelectorForStats(); // NEW: Populate dropdown on Program Study Statistics page
            updateDashboard(); // Update the entire dashboard with the newly loaded data
            clearGlobalMessage(); // Data loaded successfully, clear loading message
        } else {
            console.warn('No data received from Apps Script.');
            showGlobalMessage('Tidak ada data yang ditemukan.', false); // Info message, not error
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada dosen ditemukan.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data bimbingan ditemukan.</p>`;
        }

    } catch (error) {
        console.error('Error fetching data from Apps Script:', error);
        showGlobalMessage(`Gagal memuat data: ${error.message}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
        document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
        document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
    }
}

/**
 * Populates the Program Study filter dropdown.
 * @param {Array<Object>} data - Student data.
 */
function populateProdiFilter(data) {
    const prodiSet = new Set(data.map(d => d["Program Studi"]).filter(Boolean));
    const dropdown = document.getElementById("prodiFilter");
    dropdown.innerHTML = '<option value="all">Semua Program Studi</option>';
    Array.from(prodiSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * NEW: Populates the program study dropdown for the Program Study Statistics page.
 */
function populateProdiSelectorForStats() {
    const prodiSelector = document.getElementById('prodiSelectorForStats');
    if (!prodiSelector) return;

    // Clear old options except "Select Program Study"
    prodiSelector.innerHTML = '<option value="all">Pilih Program Studi</option>';
    
    // Get unique program study list from calculated data (prodiStatsData)
    const uniqueProdi = Object.keys(prodiStatsData).sort();

    uniqueProdi.forEach(prodiName => {
        const option = document.createElement('option');
        option.value = prodiName;
        option.textContent = prodiName;
        prodiSelector.appendChild(option);
    });

    // Add event listener when selection changes
    prodiSelector.onchange = function() {
        const selectedProdi = this.value;
        if (selectedProdi === 'all') {
            document.getElementById('prodiSpecificStatsCards').innerHTML = '<p style="text-align:center; grid-column: 1 / -1; color:#777;">Silakan pilih program studi dari dropdown di atas untuk melihat statistiknya.</p>';
            document.getElementById('currentProdiStatsName').innerText = 'Pilih Prodi';
        } else {
            document.getElementById('currentProdiStatsName').innerText = selectedProdi;
            renderProdiSpecificStatsCards(selectedProdi);
        }
    };
}

/**
 * Populates the Status filter dropdown.
 * @param {Array<Object>} data - Student data.
 */
function populateStatusFilter(data) {
    const statusSet = new Set(data.map(d => d.Status).filter(Boolean));
    const dropdown = document.getElementById("statusFilter");
    dropdown.innerHTML = '<option value="all">Semua Status</option>';
    Array.from(statusSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * Populates the Status filter dropdown for the supervised student details page.
 * @param {Array<Object>} data - Student data.
 */
function populateStatusFilterBimbingan(data) {
    const statusSet = new Set(data.map(d => d.Status).filter(Boolean));
    const dropdown = document.getElementById("statusFilterBimbingan");
    dropdown.innerHTML = '<option value="all">Semua Status</option>';
    Array.from(statusSet).sort().forEach(val => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = val;
        dropdown.appendChild(option);
    });
}

/**
 * Updates the faculty list table (on dosenPembimbingPage).
 * This will display a clickable table of faculty members.
 */
function updateDosenListTable() {
    const tableContainer = document.getElementById('dosenListTable');
    if (!tableContainer) return;

    const keyword = document.getElementById('searchBoxDosen').value.toLowerCase();
    const filteredDosen = uniqueDosenNames.filter(dosen => dosen.toLowerCase().includes(keyword));

    if (filteredDosen.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada dosen ditemukan dengan kriteria ini.</p>";
        return;
    }

    let tableHTML = `<table><thead>
        <tr>
            <th>No</th>
            <th>Nama Dosen</th>
            <th>Jumlah Mahasiswa Bimbingan</th>
        </tr>
    </thead><tbody>`;

    filteredDosen.forEach((dosenName, i) => {
        const count = dosenStats[dosenName] ? dosenStats[dosenName].total : 0;
        tableHTML += `<tr data-dosen-name="${dosenName}">
            <td>${i + 1}</td>
            <td class="nama-dosen">${dosenName}</td>
            <td>${count}</td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;
    tableContainer.innerHTML = tableHTML;

    // Add event listener to each faculty row
    const dosenRows = tableContainer.querySelectorAll('tbody tr');
    dosenRows.forEach(row => {
        row.addEventListener('click', function() {
            const dosenName = this.dataset.dosenName;
            currentDosenFilter = dosenName; // Set global faculty filter
            document.getElementById('currentDosenName').innerText = dosenName; // Update heading on detail page
            showPage('mahasiswaBimbinganDetailPage'); // Display supervised student details page
            updateDashboard(); // Update dashboard to display supervised students for this faculty member
            document.getElementById('backToDosenListFromBimbinganBtn').style.display = 'block'; // Display back button
        });
    });
}


/**
 * Renders faculty statistics cards on the mahasiswaBimbinganDetailPage.
 * @param {string} dosenName - Name of the faculty member whose supervision statistics will be displayed.
 */
function renderDosenStatsCards(dosenName) {
    const cardsContainer = document.getElementById('dosenStatsCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = ''; // Clear old cards

    const stats = dosenStats[dosenName] || {};
    const totalBimbingan = stats.total || 0;

    const statOrder = [
        { label: "Total Dibimbing", key: "total", icon: "fas fa-users" },
        { label: "Belum Proposal", key: "Belum Proposal", icon: "fas fa-times-circle" },
        { label: "Belum Ujian Komprehensif", key: "Belum Ujian Komprehensif", icon: "fas fa-times-circle" },
        { label: "Sudah Proposal", key: "Sudah Proposal", icon: "fas fa-check-circle" },
        { label: "Seminar Hasil", key: "Seminar Hasil", icon: "fas fa-check-circle" },
        { label: "Pendadaran", key: "Pendadaran", icon: "fas fa-check-circle" },
        { label: "Sudah Ujian Komprehensif", key: "Sudah Ujian Komprehensif", icon: "fas fa-check-circle" },
        { label: "Sudah Yudisium", key: "Sudah Yudisium", icon: "fas fa-graduation-cap" }
    ];
        
    statOrder.forEach(stat => {
        const value = stats[stat.key] || 0;
        const percentage = totalBimbingan > 0 ? ((value / totalBimbingan) * 100).toFixed(1) : 0;
        const cardClass = stat.key.replace(/\s/g, ''); // Remove spaces for CSS class

        const cardHtml = `
            <div class="dosen-summary-card ${cardClass}">
                <div class="label"><i class="${stat.icon}"></i> ${stat.label}</div>
                <div class="value">${value}</div>
                <div class="percentage">${percentage}%</div>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });
}


/**
 * NEW: Renders specific statistics cards for the selected program study.
 * @param {string} prodiName - Name of the program study whose statistics will be displayed.
 */
function renderProdiSpecificStatsCards(prodiName) {
    const cardsContainer = document.getElementById('prodiSpecificStatsCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = ''; // Clear old cards

    const stats = prodiStatsData[prodiName] || {}; // Get statistics data from prodiStatsData

    const totalMahasiswaProdi = stats.total || 0;

    // Define order and labels of cards according to program study
    let statOrder = [];
    // Common icon for these cards
    const commonIcon = "fas fa-users";
    // Define common card background colors
    const commonCardColors = {
        "total": "#eaf6ff", // Light blue
        "Belum Proposal": "#f8d7da", // Light red
        "Sudah Proposal": "#d1ecf1", // Info (light cyan)
        "Seminar Hasil": "#d1ecf1",
        "Pendadaran": "#d1ecf1",
        "Belum Ujian Komprehensif": "#f8d7da",
        "Sudah Ujian Komprehensif": "#d1ecf1",
        "Sudah Yudisium": "#d4edda" // Success (light green)
    };

    if (['Sistem Informasi', 'Teknik Informatika', 'Teknik Multimedia dan Jaringan'].includes(prodiName)) {
        statOrder = [
            { label: `Jumlah Mahasiswa Skripsi`, key: "total", icon: commonIcon },
            { label: "Belum Proposal", key: "Belum Proposal", icon: "fas fa-times-circle" },
            { label: "Proposal", key: "Sudah Proposal", icon: "fas fa-check-circle" },
            { label: "Seminar Hasil", key: "Seminar Hasil", icon: "fas fa-check-circle" },
            { label: "Pendadaran", key: "Pendadaran", icon: "fas fa-check-circle" },
            { label: "Yudisium", key: "Sudah Yudisium", icon: "fas fa-graduation-cap" }
        ];
    } else if (prodiName === 'Komputerisasi Akuntansi') {
        statOrder = [
            { label: `Jumlah Mahasiswa Tugas Akhir`, key: "total", icon: commonIcon },
            { label: "Belum Komprehensif", key: "Belum Ujian Komprehensif", icon: "fas fa-times-circle" },
            { label: "Komprehensif", key: "Sudah Ujian Komprehensif", icon: "fas fa-check-circle" },
            { label: "Yudisium", key: "Sudah Yudisium", icon: "fas fa-graduation-cap" }
        ];
    } else {
        cardsContainer.innerHTML = `<p style="text-align:center; grid-column: 1 / -1; color:#777;">Statistik untuk program studi ini belum tersedia.</p>`;
        return;
    }

    statOrder.forEach(stat => {
        const value = stats[stat.key] || 0;
        const percentage = totalMahasiswaProdi > 0 ? ((value / totalMahasiswaProdi) * 100).toFixed(1) : 0;
        const cardClass = stat.key.replace(/\s/g, ''); // Remove spaces for CSS class

        // Use custom color from commonCardColors if available, default to #f8f9fa
        const backgroundColor = commonCardColors[stat.key] || '#f8f9fa';

        const cardHtml = `
            <div class="dosen-summary-card ${cardClass}" style="background-color: ${backgroundColor};">
                <div class="label"><i class="${stat.icon}"></i> ${stat.label}</div>
                <div class="value">${value}</div>
                <div class="percentage">${percentage}%</div>
            </div>
        `;
        cardsContainer.innerHTML += cardHtml;
    });
}


/**
 * Updates overview statistics on the dashboard and circular progress bars.
 * @param {Array<Object>} data - Filtered student data.
 */
function updateStats(data) {
    const totalMahasiswaSkripsiTA = data.length;

    const prodiSISet = data.filter(d => d["Program Studi"] === "Sistem Informasi").length;
    const prodiTISet = data.filter(d => d["Program Studi"] === "Teknik Informatika").length;
    const prodiTMJSet = data.filter(d => d["Program Studi"] === "Teknik Multimedia dan Jaringan").length;
    const prodiKASet = data.filter(d => d["Program Studi"] === "Komputerisasi Akuntansi").length;

    const totalMahasiswaSkripsiTAPercent = 100;
    const prodiSIPercent = totalMahasiswaSkripsiTA > 0 ? (prodiSISet / totalMahasiswaSkripsiTA * 100).toFixed(1) : 0;
    const prodiTIPercent = totalMahasiswaSkripsiTA > 0 ? (prodiTISet / totalMahasiswaSkripsiTA * 100).toFixed(1) : 0;
    const prodiTMJPercent = totalMahasiswaSkripsiTA > 0 ? (prodiTMJSet / totalMahasiswaSkripsiTA * 100).toFixed(1) : 0;
    const prodiKAPercent = totalMahasiswaSkripsiTA > 0 ? (prodiKASet / totalMahasiswaSkripsiTA * 100).toFixed(1) : 0;

    document.getElementById("totalMahasiswaSkripsiTA").innerText = totalMahasiswaSkripsiTA;
    document.getElementById("jumlahProdiSI").innerText = prodiSISet;
    document.getElementById("jumlahProdiTI").innerText = prodiTISet;
    document.getElementById("jumlahProdiTMJ").innerText = prodiTMJSet;
    document.getElementById("jumlahProdiKA").innerText = prodiKASet;

    updateCircularProgress('totalMahasiswaSkripsiTAProgress', totalMahasiswaSkripsiTAPercent);
    updateCircularProgress('jumlahProdiSIProgress', prodiSIPercent);
    updateCircularProgress('jumlahProdiTIProgress', prodiTIPercent);
    updateCircularProgress('jumlahProdiTMJProgress', prodiTMJPercent);
    updateCircularProgress('jumlahProdiKAProgress', prodiKAPercent);

    document.getElementById("totalMahasiswaSkripsiTAChange").innerText = `${totalMahasiswaSkripsiTAPercent}%`;
    document.getElementById("jumlahProdiSIChange").innerText = `${prodiSIPercent}%`;
    document.getElementById("jumlahProdiTIChange").innerText = `${prodiTIPercent}%`;
    document.getElementById("jumlahProdiTMJChange").innerText = `${prodiTMJPercent}%`;
    document.getElementById("jumlahProdiKAChange").innerText = `${prodiKAPercent}%`;
    
    // NEW: Update stats for the duplicated section in prodiStatsPage as well
    const prodiStatsPage = document.getElementById('prodiStatsPage');
    // Only update standard overview cards on prodiStatsPage if no specific program study is selected in the dropdown
    const prodiSelector = document.getElementById('prodiSelectorForStats');
    if (prodiStatsPage && prodiStatsPage.style.display === 'block' && prodiSelector && prodiSelector.value === 'all') {
        document.getElementById("totalMahasiswaSkripsiTA_prodiStats").innerText = totalMahasiswaSkripsiTA;
        document.getElementById("jumlahProdiSI_prodiStats").innerText = prodiSISet;
        document.getElementById("jumlahProdiTI_prodiStats").innerText = prodiTISet;
        document.getElementById("jumlahProdiTMJ_prodiStats").innerText = prodiTMJSet;
        document.getElementById("jumlahProdiKA_prodiStats").innerText = prodiKASet;

        updateCircularProgress('totalMahasiswaSkripsiTAProgress_prodiStats', totalMahasiswaSkripsiTAPercent);
        updateCircularProgress('jumlahProdiSIProgress_prodiStats', prodiSIPercent);
        updateCircularProgress('jumlahProdiTIProgress_prodiStats', prodiTIPercent);
        updateCircularProgress('jumlahProdiTMJProgress_prodiStats', prodiTMJPercent);
        updateCircularProgress('jumlahProdiKAProgress_prodiStats', prodiKAPercent);

        document.getElementById("totalMahasiswaSkripsiTAChange_prodiStats").innerText = `${totalMahasiswaSkripsiTAPercent}%`;
        document.getElementById("jumlahProdiSIChange_prodiStats").innerText = `${prodiSIPercent}%`;
        document.getElementById("jumlahProdiTIChange_prodiStats").innerText = `${prodiTIPercent}%`;
        document.getElementById("jumlahProdiTMJChange_prodiStats").innerText = `${prodiTMJPercent}%`;
        document.getElementById("jumlahProdiKAChange_prodiStats").innerText = `${prodiKAPercent}%`;
    }
}


/**
 * Updates the circular progress bar based on CSS.
 * @param {string} elementId - ID of the inner text element.
 * @param {number} percentage - Percentage value (0-100).
 */
function updateCircularProgress(elementId, percentage) {
    const innerTextElement = document.getElementById(elementId);
    const progressBarContainer = innerTextElement.closest('.circular-progress');
    if (!progressBarContainer) return;

    const gradientElement = progressBarContainer.querySelector('.circular-progress-gradient');
    if (gradientElement) {
        gradientElement.style.setProperty('--progress', `${percentage}%`);
    }
    innerTextElement.innerText = `${percentage}%`;
}


/**
 * Updates the detailed student table.
 * @param {Array<Object>} data - Filtered student data.
 * @param {string} targetElementId - ID of the div element to place the table in.
 * @param {number} limit - Number of rows to display (for latest orders).
 * @param {boolean} showPagination - Whether to display pagination buttons.
 */
function updateTable(data, targetElementId, limit = null, showPagination = true) {
    const tableContainer = document.getElementById(targetElementId);
    if (!tableContainer) return;

    if (data.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada data ditemukan.</p>";
        return;
    }

    let dataToRender = data;
    let currentRowsPerPage = rowsPerPage;
    // Apply fullTableRowsPerPage only for student detail table and supervised student table
    if (targetElementId === 'detailTable' || targetElementId === 'mahasiswaBimbinganTable') {
        currentRowsPerPage = fullTableRowsPerPage;
    }

    const totalPages = Math.ceil(data.length / currentRowsPerPage);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    if (currentPage < 1 && totalPages > 0) currentPage = 1;
    if (totalPages === 0) currentPage = 0;


    const start = (currentPage - 1) * currentRowsPerPage;
    if (limit) {
        dataToRender = data.slice(start, start + limit);
    } else {
        dataToRender = data.slice(start, start + currentRowsPerPage);
    }


    let tableHTML = `<table><thead>
        <tr>
            <th>No</th>
            <th>NIM</th>
            <th>NAMA</th>
            <th>Program Studi</th>
            <th>Judul Skripsi/TA</th>
            <th>Pembimbing 1</th>
            <th>Pembimbing 2</th>
            <th>Penelaah</th>
            <th>Status</th>
        </tr>
    </thead><tbody>`;

    dataToRender.forEach((d, i) => {
        const statusVal = d.Status;

        let statusClass = "";
        if (statusVal === "Belum Proposal") {
            statusClass = "BelumProposal";
        } else if (statusVal === "Sudah Proposal") {
            statusClass = "SudahProposal";
        } else if (statusVal === "Seminar Hasil") {
            statusClass = "SeminarHasil";
        } else if (statusVal === "Pendadaran") {
            statusClass = "Pendadaran";
        } else if (statusVal === "Belum Ujian Komprehensif") {
            statusClass = "BelumUjianKomprehensif";
        } else if (statusVal === "Sudah Ujian Komprehensif") {
            statusClass = "SudahUjianKomprehensif";
        } else if (statusVal === "Sudah Yudisium") {
            statusClass = "SudahYudisium";
        }
        else {
            statusClass = "Other";
        }


        tableHTML += `<tr>
            <td>${start + i + 1}</td>
            <td>${d.NIM || '-'}</td>
            <td class="nama">${d.NAMA || '-'}</td>
            <td class="program-studi">${d["Program Studi"] || '-'}</td>
            <td>${d["Sinposis Skripsi/TA"] || '-'}</td>
            <td>${d["Usulan Komisi SI (P1)"] || '-'}</td>
            <td>${d["Usulan Komisi (P2)"] || '-'}</td>
            <td>${d.Penelaah || '-'}</td>
            <td><span class="status-badge ${statusClass}">${statusVal || '-'}</span></td>
        </tr>`;
    });

    tableHTML += `</tbody></table>`;

    if (showPagination) {
        tableHTML += `<div style="text-align:center; margin-top:15px;">
            <button onclick="prevPage()" class="pagination-button" ${currentPage === 1 || totalPages === 0 ? 'disabled' : ''}>❮</button>
            <span style="margin: 0 10px;">Page ${currentPage} of ${totalPages}</span>
            <button onclick="nextPage()" class="pagination-button" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}>❯</button>
        </div>`;
    }

    tableContainer.innerHTML = tableHTML;
}

// Global pagination functions - adjusted to always call updateDashboard
function nextPage() {
    currentPage++;
    updateDashboard();
}

function prevPage() {
    currentPage--;
    updateDashboard();
}


/**
 * Generates a statistics table based on Program Study.
 * The table contains Total Student Body, and Thesis/TA progress status, sorted by most students.
 * @param {Array<Object>} data - Student data.
 * @param {string} targetElementId - ID of the div element to place the table in.
 */
function generateProdiStatsTable(data, targetElementId) {
    const tableContainer = document.getElementById(targetElementId);
    if (!tableContainer) return;

    if (data.length === 0) {
        tableContainer.innerHTML = "<p style='text-align:center;'>Tidak ada data statistik program studi ditemukan.</p>";
        return;
    }

    const prodiStats = {};
    data.forEach(d => {
        const prodi = d["Program Studi"] || "Tidak Diketahui";
        const statusVal = d.Status || "Tidak Diketahui";

        if (!prodiStats[prodi]) {
            prodiStats[prodi] = {
                total: 0,
                "Belum Proposal": 0,
                "Sudah Proposal": 0,
                "Seminar Hasil": 0,
                "Pendadaran": 0,
                "Belum Ujian Komprehensif": 0,
                "Sudah Ujian Komprehensif": 0,
                "Sudah Yudisium": 0
            };
        }
        prodiStats[prodi].total++;

        if (prodiStats[prodi].hasOwnProperty(statusVal)) {
            prodiStats[prodi][statusVal]++;
        }
    });

    let prodiStatsArray = Object.entries(prodiStats).map(([prodiName, stats]) => ({
        prodi: prodiName,
        ...stats
    }));

    prodiStatsArray.sort((a, b) => b.total - a.total);

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>No</th>
                    <th>Program Studi</th>
                    <th>Jumlah</th>
                    <th>Belum Proposal</th>
                    <th>Sudah Proposal</th>
                    <th>Seminar Hasil</th>
                    <th>Pendadaran</th>
                    <th>Belum Ujian Komprehensif</th>
                    <th>Sudah Ujian Komprehensif</th>
                    <th>Yudisium</th>
                </tr>
            </thead>
            <tbody>
    `;

    prodiStatsArray.forEach((stats, i) => {
        tableHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>${stats.prodi}</td>
                <td>${stats.total}</td>
                <td>${stats["Belum Proposal"]}</td>
                <td>${stats["Sudah Proposal"]}</td>
                <td>${stats["Seminar Hasil"]}</td>
                <td>${stats["Pendadaran"]}</td>
                <td>${stats["Belum Ujian Komprehensif"]}</td>
                <td>${stats["Sudah Ujian Komprehensif"]}</td>
                <td>${stats["Sudah Yudisium"]}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    tableContainer.innerHTML = tableHTML;
}


/**
 * Updates all charts in the Analytics section.
 * @param {Array<Object>} data - Filtered student data.
 */
function updateCharts(data) {
    // Custom color definitions for Program Study Population
    const prodiColorsMapping = {
        "Sistem Informasi": '#3498db', // Blue
        "Teknik Informatika": '#f39c12', // Orange
        "Komputerisasi Akuntansi": '#2ecc71', // Green
        "Teknik Multimedia dan Jaringan": '#9b59b6' // Purple
    };
    generatePieChart(countOccurrences(data, 'Program Studi'), 'programStudiChart', 'Grafik Mahasiswa Studi Akhir', prodiColorsMapping);
    
    // Progress charts per Program Study (Pie Chart)
    const dataSI = data.filter(d => d["Program Studi"] === "Sistem Informasi");
    generateProdiProgressPieChart(dataSI, "Sistem Informasi", 'progressStatusChartSI', 'Program Studi - Sistem Informasi', [
        "Belum Proposal", "Sudah Proposal", "Seminar Hasil", "Pendadaran", "Sudah Yudisium"
    ]);

    const dataTI = data.filter(d => d["Program Studi"] === "Teknik Informatika");
    generateProdiProgressPieChart(dataTI, "Teknik Informatika", 'progressStatusChartTI', 'Program Studi - Teknik Informatika', [
        "Belum Proposal", "Sudah Proposal", "Seminar Hasil", "Pendadaran", "Sudah Yudisium"
    ]);

    const dataTMJ = data.filter(d => d["Program Studi"] === "Teknik Multimedia dan Jaringan");
    generateProdiProgressPieChart(dataTMJ, "Teknik Multimedia dan Jaringan", 'progressStatusChartTMJ', 'Program Studi - Teknik Multimedia dan Jaringan', [
        "Belum Proposal", "Sudah Proposal", "Seminar Hasil", "Pendadaran", "Sudah Yudisium"
    ]);

    const dataKA = data.filter(d => d["Program Studi"] === "Komputerisasi Akuntansi");
    generateProdiProgressPieChart(dataKA, "Komputerisasi Akuntansi", 'progressStatusChartKA', 'Program Studi - Komputerisasi Akuntansi', [
        "Belum Ujian Komprehensif", "Sudah Ujian Komprehensif", "Sudah Yudisium"
    ]);
}

/**
 * Counts occurrences of values in a given column.
 * @param {Array<Object>} data - Student data.
 * @param {string} key - The column key to count.
 * @returns {Object} - Object containing occurrence counts.
 */
function countOccurrences(data, key) {
    return data.reduce((acc, row) => {
        const value = row[key] || 'Tidak diketahui';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

/**
 * Gets filtered student data based on the active page.
 * @returns {Array<Object>} - Filtered student data.
 */
function getFilteredData() {
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');
    const prodiStatsPage = document.getElementById('prodiStatsPage');

    if (dataMahasiswaPage.style.display === 'block') {
        const keyword = document.getElementById('searchBox').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const prodiFilter = document.getElementById('prodiFilter').value;

        return originalData.filter(d => {
            const matchKeyword = (!keyword || (d.NAMA && d.NAMA.toLowerCase().includes(keyword)) || (d.NIM && String(d.NIM).toLowerCase().includes(keyword)));
            const matchStatus = (statusFilter === 'all' || d.Status === statusFilter);
            const matchProdi = (prodiFilter === 'all' || d["Program Studi"] === prodiFilter);
            return matchKeyword && matchStatus && matchProdi;
        });
    } else if (mahasiswaBimbinganDetailPage.style.display === 'block' && currentDosenFilter) {
        const keywordBimbingan = document.getElementById('searchBoxBimbingan').value.toLowerCase();
        const statusFilterBimbingan = document.getElementById('statusFilterBimbingan').value;

        return originalData.filter(d => {
            const isPembimbing1 = d["Usulan Komisi SI (P1)"] === currentDosenFilter;
            const isPembimbing2 = d["Usulan Komisi (P2)"] === currentDosenFilter;
            const matchDosen = isPembimbing1 || isPembimbing2;

            const matchKeyword = (!keywordBimbingan || (d.NAMA && d.NAMA.toLowerCase().includes(keywordBimbingan)) || (d.NIM && String(d.NIM).toLowerCase().includes(keywordBimbingan)));
            const matchStatus = (statusFilterBimbingan === 'all' || d.Status === statusFilterBimbingan);

            return matchDosen && matchKeyword && matchStatus;
        });
    } else if (analyticsPage.style.display === 'block') {
        return originalData;
    } else if (dosenPembimbingPage.style.display === 'block') {
        return originalData;
    } else if (prodiStatsPage.style.display === 'block') {
        return originalData;
    }
    return originalData;
}

/**
 * Updates all parts of the dashboard (statistics, tables, and charts)
 * based on the active page.
 */
function updateDashboard() {
    const dashboardPage = document.getElementById('dashboardPage');
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');
    const prodiStatsPage = document.getElementById('prodiStatsPage');

    const filteredDataForContext = getFilteredData();

    if (dashboardPage.style.display === 'block') {
        updateStats(filteredDataForContext);
        generateProdiStatsTable(filteredDataForContext, 'recentMahasiswaTable');
    } else if (dataMahasiswaPage.style.display === 'block') {
        updateTable(filteredDataForContext, 'detailTable', null, true);
    } else if (dosenPembimbingPage.style.display === 'block') {
        updateDosenListTable();
    } else if (mahasiswaBimbinganDetailPage.style.display === 'block') {
        updateTable(filteredDataForContext, 'mahasiswaBimbinganTable', null, true);
        if (currentDosenFilter) {
            renderDosenStatsCards(currentDosenFilter);
        }
    } else if (analyticsPage.style.display === 'block') {
        updateCharts(filteredDataForContext);
    } else if (prodiStatsPage.style.display === 'block') {
        // updateStats(filteredDataForContext); // Cards on this page are filled by renderProdiSpecificStatsCards
        generateProdiStatsTable(filteredDataForContext, 'recentMahasiswaTable_prodiStats'); // Update table in the duplicated section
        const prodiSelector = document.getElementById('prodiSelectorForStats');
        if (prodiSelector && prodiSelector.value !== 'all') {
            renderProdiSpecificStatsCards(prodiSelector.value);
        }
    }
}

// Initialization when the page loads
window.onload = function() {
    displayCurrentDate();
    loadDataFromAppsScript();

    const searchBox = document.getElementById('searchBox');
    const statusFilter = document.getElementById('statusFilter');
    const prodiFilter = document.getElementById('prodiFilter');
    if (searchBox) searchBox.addEventListener('input', function() { currentPage = 1; updateDashboard(); });
    if (statusFilter) statusFilter.addEventListener('change', function() { currentPage = 1; updateDashboard(); });
    if (prodiFilter) prodiFilter.addEventListener('change', function() { currentPage = 1; updateDashboard(); });

    const searchBoxDosen = document.getElementById('searchBoxDosen');
    if (searchBoxDosen) searchBoxDosen.addEventListener('input', function() { currentPage = 1; updateDashboard(); });

    const searchBoxBimbingan = document.getElementById('searchBoxBimbingan');
    const statusFilterBimbingan = document.getElementById('statusFilterBimbingan');
    if (searchBoxBimbingan) searchBoxBimbingan.addEventListener('input', function() { currentPage = 1; updateDashboard(); });
    if (statusFilterBimbingan) statusFilterBimbingan.addEventListener('change', function() { currentPage = 1; updateDashboard(); });

    document.getElementById('refreshDataBtn').addEventListener('click', function() {
        console.log('Refreshing data...');
        loadDataFromAppsScript();
    });

    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.body.classList.toggle('sidebar-collapsed');
    });

    // Event listener for showAllMahasiswa_prodiStats
    const showAllMahasiswaProdiStats = document.getElementById('showAllMahasiswa_prodiStats');
    if (showAllMahasiswaProdiStats) {
        showAllMahasiswaProdiStats.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('dataMahasiswaPage'); // Redirect to main Student Data page
            // Optional: set program study filter if you want to display all students from a specific program study when clicked from program study statistics
            // const selectedProdiFromStats = document.getElementById('prodiSelectorForStats').value;
            // if (selectedProdiFromStats !== 'all') {
            //     document.getElementById('prodiFilter').value = selectedProdiFromStats;
            // }
            // currentPage = 1; updateDashboard();
        });
    }

    showPage('dashboardPage');
};

// --- Plotly Chart Functions ---

/**
 * Generates a pie chart using Plotly.
 * This function is used for the Program Study Population chart.
 * @param {Object} dataCounts - Object containing category counts (label: count).
 * @param {string} targetElementId - ID of the div element to place the chart in.
 * @param {string} title - Chart title.
 * @param {Object} [colorMapping] - Optional: Object mapping label names to color codes.
 */
function generatePieChart(dataCounts, targetElementId, title, colorMapping = {}) {
    const labels = Object.keys(dataCounts);
    const values = Object.values(dataCounts);

    // Determine colors based on mapping or default Plotly colors
    const colors = labels.map(label => {
        if (colorMapping[label]) {
            return colorMapping[label];
        }
        // Default colors if not in mapping
        switch (label) {
            case "Sistem Informasi": return '#3498db'; // Blue (fallback)
            case "Teknik Informatika": return '#f39c12'; // Orange (fallback)
            case "Komputerisasi Akuntansi": return '#2ecc71'; // Green (fallback)
            case "Teknik Multimedia dan Jaringan": return '#9b59b6'; // Purple (fallback)
            default: return '#7f8c8d'; // Default gray
        }
    });

    const data = [{
        labels: labels,
        values: values,
        type: 'pie',
        hoverinfo: 'label+percent',
        textinfo: 'percent',
        insidetextorientation: 'radial',
        marker: {
            colors: colors // Use the determined color array
        },
        automargin: true
    }];

    const layout = {
        title: title,
        height: 400,
        margin: { t: 40, b: 20, l: 20, r: 20 },
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#333'
        },
        legend: {
            orientation: "h",
            x: 0,
            y: -0.15,
            traceorder: 'normal',
            font: {
                size: 10
            }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(targetElementId, data, layout, {responsive: true, displayModeBar: false});
}


/**
 * Generates a pie chart for student progress per stage, specifically for each program study.
 * This function replaces generateProdiProgressChart (bar chart).
 * @param {Array<Object>} data - Student data filtered for a specific program study.
 * @param {string} prodiName - Program study name.
 * @param {string} targetElementId - ID of the div element to place the chart in.
 * @param {string} title - Chart title.
 * @param {Array<string>} specificStatuses - Array of specific statuses for this program study (original status names from data).
 */
function generateProdiProgressPieChart(data, prodiName, targetElementId, title, specificStatuses) {
    const statusCounts = {};
    specificStatuses.forEach(status => statusCounts[status] = 0);

    data.forEach(d => {
        const status = d.Status;
        if (specificStatuses.includes(status)) { // Only count statuses relevant to this program study
            statusCounts[status]++;
        }
    });

    // Mapping for display labels and custom colors
    const customStatusMapping = {
        "Belum Proposal": { label: "Belum Proposal", color: '#e74c3c' }, // Red
        "Sudah Proposal": { label: "Sudah Proposal", color: '#2ecc71' },   // Green
        "Seminar Hasil": { label: "Sudah Semhas", color: '#3498db' },     // Blue
        "Pendadaran": { label: "Pendadaran", color: '#f39c12' },         // Orange
        "Sudah Yudisium": { label: "Yudisium", color: '#9b59b6' },        // Purple
        // Status for Accounting Computerization
        "Belum Ujian Komprehensif": { label: "Belum Kompre", color: '#e74c3c' }, // Red
        "Sudah Ujian Komprehensif": { label: "Sudah Kompre", color: '#2ecc71' } // Green
    };

    // Order of labels to display in the pie chart and corresponding colors
    const labels = specificStatuses.map(status => customStatusMapping[status] ? customStatusMapping[status].label : status);
    const values = specificStatuses.map(status => statusCounts[status]);
    const colors = specificStatuses.map(status => customStatusMapping[status] ? customStatusMapping[status].color : '#7f8c8d'); // Default gray


    const dataPlotly = [{
        labels: labels, // Labels for pie slices
        values: values, // Values for pie slices
        type: 'pie',
        hoverinfo: 'label+percent+value', // Display label, percentage, and value on hover
        textinfo: 'percent', // Display percentage inside slices
        insidetextorientation: 'radial', // Orientation of percentage text
        marker: {
            colors: colors // Use the determined color array
        },
        automargin: true // Prevents labels and legend from being cut off
    }];

    const layout = {
        title: title,
        height: 400, // Sufficient height for pie chart
        margin: { t: 40, b: 20, l: 20, r: 20 }, // Adjust margins
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#333'
        },
        legend: {
            orientation: "h", // Horizontal legend
            x: 0,
            y: -0.15, // Position legend below the chart
            traceorder: 'normal',
            font: {
                size: 10
            }
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };

    Plotly.newPlot(targetElementId, dataPlotly, layout, {responsive: true, displayModeBar: false});
}
