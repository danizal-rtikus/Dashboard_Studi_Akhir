// script.js

// URL API Google Apps Script Anda.
// PASTIKAN URL INI BENAR DAN SUDAH DI-DEPLOY DENGAN AKSES PUBLIK.
const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbwLjQRxoemkHfjtcJNa9U4HsxP_egj_jAyefVnV1wIm_r1yewrV25pAUM3FM2JNuwV5/exec';

let originalData = []; // Variabel global untuk menyimpan data asli dari API
let uniqueDosenNames = []; // Menyimpan daftar nama dosen unik
let dosenStats = {}; // Menyimpan statistik detail untuk setiap dosen
let currentPage = 1;
const rowsPerPage = 10;
const fullTableRowsPerPage = 15;

let currentDosenFilter = null; // Menyimpan nama dosen yang sedang difilter untuk halaman mahasiswa bimbingan

/**
 * Menampilkan pesan global di bagian atas halaman.
 * @param {string} message - Pesan yang akan ditampilkan.
 * @param {boolean} isError - True jika pesan error, false jika pesan loading/info.
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
 * Menghapus pesan global dari tampilan.
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
 * Menampilkan halaman yang dipilih dan menyembunyikan halaman lainnya.
 * Juga mengelola status aktif pada sidebar.
 * @param {string} pageId - ID dari elemen halaman yang akan ditampilkan.
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.page-section');
    pages.forEach(page => page.style.display = 'none');

    const contentPage = document.getElementById(pageId);
    if (contentPage) {
        contentPage.style.display = 'block';
    } else {
        console.error(`Error: Element halaman dengan ID '${pageId}' tidak ditemukan.`);
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active', 'open'));

    // Pastikan casing ID menu sesuai dengan HTML
    const basePageName = pageId.replace('Page', '');
    const capitalizedMenuSuffix = basePageName.charAt(0).toUpperCase() + basePageName.slice(1);
    const menuElementId = 'menu' + capitalizedMenuSuffix;

    // Khusus untuk halaman detail mahasiswa bimbingan, menu Dosen Pembimbing yang aktif
    if (pageId === 'mahasiswaBimbinganDetailPage') {
        document.getElementById('menuDosenPembimbing').classList.add('active');
    } else {
        const menuElement = document.getElementById(menuElementId);
        if (menuElement) {
            menuElement.classList.add('active');
        } else {
            console.error(`Error: Elemen menu sidebar dengan ID '${menuElementId}' tidak ditemukan.`);
        }
    }

    // Reset filter dan data terkait saat pindah halaman
    // Kecuali jika pageId adalah mahasiswaBimbinganDetailPage (karena currentDosenFilter akan digunakan)
    if (pageId !== 'mahasiswaBimbinganDetailPage') {
        currentDosenFilter = null; // Reset filter dosen
        const searchBoxBimbingan = document.getElementById('searchBoxBimbingan');
        const statusFilterBimbingan = document.getElementById('statusFilterBimbingan');
        if (searchBoxBimbingan) searchBoxBimbingan.value = '';
        if (statusFilterBimbingan) statusFilterBimbingan.value = 'all';

        const backButtonFromBimbingan = document.getElementById('backToDosenListFromBimbinganBtn');
        if(backButtonFromBimbingan) backButtonFromBimbingan.style.display = 'none';
    }

    // Reset pencarian dosen di halaman daftar dosen saat pindah dari halaman itu
    if (pageId !== 'dosenPembimbingPage') {
        const searchBoxDosen = document.getElementById('searchBoxDosen');
        if (searchBoxDosen) {
            searchBoxDosen.value = '';
        }
    }

    currentPage = 1; // Reset halaman pagination setiap kali ganti halaman
}

// Event Klik Sidebar
document.getElementById('menuDashboard').addEventListener('click', function() {
    showPage('dashboardPage');
});
document.getElementById('menuDataMahasiswa').addEventListener('click', function() {
    showPage('dataMahasiswaPage');
});
// Event listener untuk menu Dosen Pembimbing (langsung menampilkan daftar dosen)
document.getElementById('menuDosenPembimbing').addEventListener('click', function() {
    showPage('dosenPembimbingPage');
    updateDashboard(); // Memuat daftar dosen saat halaman dibuka
});
document.getElementById('menuAnalytics').addEventListener('click', function() {
    showPage('analyticsPage');
    updateDashboard(); // Pastikan grafik di-render ulang
});
document.getElementById('menuReport').addEventListener('click', function() {
    showPage('reportPage');
});
document.getElementById('showAllMahasiswa').addEventListener('click', function(e) {
    e.preventDefault();
    showPage('dataMahasiswaPage');
});

// Event listener untuk tombol kembali dari halaman detail mahasiswa bimbingan
document.getElementById('backToDosenListFromBimbinganBtn').addEventListener('click', function() {
    showPage('dosenPembimbingPage'); // Kembali ke halaman daftar dosen
    updateDashboard(); // Perbarui halaman daftar dosen
});


// Menampilkan tanggal saat ini di header
function displayCurrentDate() {
    const now = new Date();
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    document.getElementById('currentDate').innerText = now.toLocaleDateString('en-GB', options).replace(/\//g, '/');
}

/**
 * Mengambil data dari Google Apps Script Web App URL.
 * Menangani potensi error dari operasi fetch atau respons Apps Script.
 */
async function loadDataFromAppsScript() {
    clearGlobalMessage(); // Hapus pesan sebelumnya (error/loading)
    showGlobalMessage('Memuat data, mohon tunggu...', false); // Tampilkan pesan loading

    try {
        const response = await fetch(appsScriptUrl);
        const result = await response.json();

        if (result.error) {
            console.error('Error from Apps Script:', result.error);
            showGlobalMessage(`Gagal memuat data: ${result.error}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
            // Hapus pesan error dari tabel individu karena sudah ada pesan global
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
            return;
        }

        if (result.data) {
            originalData = result.data;
            // Ekstrak nama dosen unik dan hitung statistik dosen
            const dosenSet = new Set();
            const tempDosenStats = {};

            const allPossibleStatuses = [ // Status lengkap untuk perhitungan awal
                "Belum Proposal", "Sudah Proposal", "Seminar Hasil", "Pendadaran",
                "Belum Ujian Komprehensif", "Sudah Ujian Komprehensif", "Sudah Yudisium"
            ];

            originalData.forEach(d => {
                const p1 = d["Usulan Komisi SI (P1)"];
                const p2 = d["Usulan Komisi (P2)"];
                const status = d.Status || "Other"; // Default status

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
                // Juga tambahkan nama dosen ke set global untuk daftar unik
                if (p1) dosenSet.add(p1);
                if (p2) dosenSet.add(p2);
            });

            uniqueDosenNames = Array.from(dosenSet).sort();
            dosenStats = tempDosenStats; // Simpan statistik lengkap

            populateProdiFilter(originalData);
            populateStatusFilter(originalData);
            populateStatusFilterBimbingan(originalData);
            updateDashboard(); // Memperbarui seluruh dashboard dengan data yang baru dimuat
            clearGlobalMessage(); // Data berhasil dimuat, hapus pesan loading
        } else {
            console.warn('No data received from Apps Script.');
            showGlobalMessage('Tidak ada data yang ditemukan.', false); // Pesan info, bukan error
            document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data ditemukan.</p>`;
            document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada dosen ditemukan.</p>`;
            document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:gray;'>Tidak ada data bimbingan ditemukan.</p>`;
        }

    } catch (error) {
        console.error('Error fetching data from Apps Script:', error);
        showGlobalMessage(`Gagal memuat data: ${error.message}. Pastikan URL Apps Script benar dan dapat diakses.`, true);
        // Hapus pesan error dari tabel individu karena sudah ada pesan global
        document.getElementById("recentMahasiswaTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("detailTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data.</p>`;
        document.getElementById("dosenListTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat daftar dosen.</p>`;
        document.getElementById("mahasiswaBimbinganTable").innerHTML = `<p style='text-align:center; color:red;'>Gagal memuat data bimbingan.</p>`;
    }
}

/**
 * Mengisi dropdown filter Program Studi.
 * @param {Array<Object>} data - Data mahasiswa.
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
 * Mengisi dropdown filter Status.
 * @param {Array<Object>} data - Data mahasiswa.
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
 * Mengisi dropdown filter Status untuk halaman mahasiswaBimbinganDetailPage.
 * @param {Array<Object>} data - Data mahasiswa.
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
 * Memperbarui tabel daftar dosen (di dosenPembimbingPage).
 * Ini akan menampilkan tabel dosen yang bisa diklik.
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

    // Tambahkan event listener untuk setiap baris dosen
    const dosenRows = tableContainer.querySelectorAll('tbody tr');
    dosenRows.forEach(row => {
        row.addEventListener('click', function() {
            const dosenName = this.dataset.dosenName;
            currentDosenFilter = dosenName; // Set filter dosen global
            document.getElementById('currentDosenName').innerText = dosenName; // Update heading di halaman detail
            showPage('mahasiswaBimbinganDetailPage'); // Tampilkan halaman detail mahasiswa bimbingan
            updateDashboard(); // Perbarui dashboard untuk menampilkan mahasiswa bimbingan dosen tersebut
            document.getElementById('backToDosenListFromBimbinganBtn').style.display = 'block'; // Tampilkan tombol kembali
        });
    });
}


/**
 * Merender kartu statistik dosen di halaman mahasiswaBimbinganDetailPage.
 * @param {string} dosenName - Nama dosen yang statistik bimbingannya akan ditampilkan.
 */
function renderDosenStatsCards(dosenName) {
    const cardsContainer = document.getElementById('dosenStatsCards');
    if (!cardsContainer) return;

    cardsContainer.innerHTML = ''; // Bersihkan kartu lama

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
        const cardClass = stat.key.replace(/\s/g, ''); // Hapus spasi untuk kelas CSS

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
 * Memperbarui statistik overview di dashboard dan circular progress.
 * @param {Array<Object>} data - Data mahasiswa yang sudah difilter.
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
}

/**
 * Memperbarui bilah progress melingkar berbasis CSS.
 * @param {string} elementId - ID elemen teks bagian dalam.
 * @param {number} percentage - Nilai persentase (0-100).
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
 * Memperbarui tabel detail mahasiswa.
 * @param {Array<Object>} data - Data mahasiswa yang sudah difilter.
 * @param {string} targetElementId - ID elemen div untuk menempatkan tabel.
 * @param {number} limit - Jumlah baris yang akan ditampilkan (untuk order terbaru).
 * @param {boolean} showPagination - Apakah akan menampilkan tombol paginasi.
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
    // Terapkan fullTableRowsPerPage hanya untuk tabel detail mahasiswa dan mahasiswa bimbingan
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

// Global pagination functions - disesuaikan agar selalu memanggil updateDashboard
function nextPage() {
    currentPage++;
    updateDashboard();
}

function prevPage() {
    currentPage--;
    updateDashboard();
}


/**
 * Menghasilkan tabel statistik berdasarkan Program Studi.
 * Tabel berisi Jumlah Student Body, dan status progress skripsi/TA, diurutkan berdasarkan Student Body terbanyak.
 * @param {Array<Object>} data - Data mahasiswa.
 * @param {string} targetElementId - ID elemen div untuk menempatkan tabel.
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
 * Memperbarui semua chart di bagian Analytics.
 * @param {Array<Object>} data - Data mahasiswa yang sudah difilter.
 */
function updateCharts(data) {
    // Definisi warna khusus untuk Populasi Program Studi
    const prodiColorsMapping = {
        "Sistem Informasi": '#3498db', // Biru
        "Teknik Informatika": '#f39c12', // Oranye
        "Komputerisasi Akuntansi": '#2ecc71', // Hijau
        "Teknik Multimedia dan Jaringan": '#9b59b6' // Ungu
    };
    generatePieChart(countOccurrences(data, 'Program Studi'), 'programStudiChart', 'Grafik Mahasiswa Studi Akhir', prodiColorsMapping);
    
    // Grafik Progres per Program Studi (Pie Chart)
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
 * Menghitung frekuensi kemunculan nilai dalam kolom tertentu.
 * @param {Array<Object>} data - Data mahasiswa.
 * @param {string} key - Kunci kolom yang akan dihitung.
 * @returns {Object} - Objek berisi hitungan kemunculan.
 */
function countOccurrences(data, key) {
    return data.reduce((acc, row) => {
        const value = row[key] || 'Tidak diketahui';
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {});
}

/**
 * Mendapatkan data yang sudah difilter berdasarkan halaman yang aktif.
 * @returns {Array<Object>} - Data yang sudah difilter.
 */
function getFilteredData() {
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');

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
    }
    return originalData;
}

/**
 * Memperbarui seluruh bagian dashboard (statistik, tabel, dan chart)
 * berdasarkan halaman yang aktif.
 */
function updateDashboard() {
    const dashboardPage = document.getElementById('dashboardPage');
    const dataMahasiswaPage = document.getElementById('dataMahasiswaPage');
    const dosenPembimbingPage = document.getElementById('dosenPembimbingPage');
    const mahasiswaBimbinganDetailPage = document.getElementById('mahasiswaBimbinganDetailPage');
    const analyticsPage = document.getElementById('analyticsPage');

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
    }
}

// Inisialisasi saat halaman dimuat
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

    showPage('dashboardPage');
};

// --- Plotly Chart Functions ---

/**
 * Menghasilkan grafik pie menggunakan Plotly.
 * Fungsi ini digunakan untuk grafik Populasi Program Studi.
 * @param {Object} dataCounts - Objek berisi hitungan kategori (label: count).
 * @param {string} targetElementId - ID elemen div untuk menempatkan grafik.
 * @param {string} title - Judul grafik.
 * @param {Object} [colorMapping] - Opsional: Objek mapping nama label ke kode warna.
 */
function generatePieChart(dataCounts, targetElementId, title, colorMapping = {}) {
    const labels = Object.keys(dataCounts);
    const values = Object.values(dataCounts);

    // Tentukan warna berdasarkan mapping atau warna default Plotly
    const colors = labels.map(label => {
        if (colorMapping[label]) {
            return colorMapping[label];
        }
        // Warna default jika tidak ada di mapping
        switch (label) {
            case "Sistem Informasi": return '#3498db'; // Biru (fallback)
            case "Teknik Informatika": return '#f39c12'; // Oranye (fallback)
            case "Komputerisasi Akuntansi": return '#2ecc71'; // Hijau (fallback)
            case "Teknik Multimedia dan Jaringan": return '#9b59b6'; // Ungu (fallback)
            default: return '#7f8c8d'; // Abu-abu default
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
            colors: colors // Gunakan array warna yang sudah ditentukan
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
 * Menghasilkan grafik pie untuk progres mahasiswa per tahap, khusus untuk per prodi.
 * @param {Array<Object>} data - Data mahasiswa yang sudah difilter untuk prodi tertentu.
 * @param {string} prodiName - Nama program studi.
 * @param {string} targetElementId - ID elemen div untuk menempatkan grafik.
 * @param {string} title - Judul grafik.
 * @param {Array<string>} specificStatuses - Array status yang spesifik untuk prodi ini (status asli dari data).
 */
function generateProdiProgressPieChart(data, prodiName, targetElementId, title, specificStatuses) {
    const statusCounts = {};
    specificStatuses.forEach(status => statusCounts[status] = 0);

    data.forEach(d => {
        const status = d.Status;
        if (specificStatuses.includes(status)) { // Hanya hitung status yang relevan untuk prodi ini
            statusCounts[status]++;
        }
    });

    // Mapping untuk label tampilan dan warna kustom
    const customStatusMapping = {
        "Belum Proposal": { label: "Belum Proposal", color: '#e74c3c' }, // Merah
        "Sudah Proposal": { label: "Sudah Proposal", color: '#2ecc71' },   // Hijau
        "Seminar Hasil": { label: "Sudah Semhas", color: '#3498db' },     // Biru
        "Pendadaran": { label: "Pendadaran", color: '#f39c12' },         // Oranye
        "Sudah Yudisium": { label: "Yudisium", color: '#9b59b6' },        // Ungu
        // Status untuk Komputerisasi Akuntansi
        "Belum Ujian Komprehensif": { label: "Belum Kompre", color: '#e74c3c' }, // Merah
        "Sudah Ujian Komprehensif": { label: "Sudah Kompre", color: '#2ecc71' } // Hijau
    };

    // Urutan label yang akan ditampilkan di pie chart dan warna yang sesuai
    const labels = specificStatuses.map(status => customStatusMapping[status] ? customStatusMapping[status].label : status);
    const values = specificStatuses.map(status => statusCounts[status]);
    const colors = specificStatuses.map(status => customStatusMapping[status] ? customStatusMapping[status].color : '#7f8c8d'); // Default abu-abu


    const dataPlotly = [{
        labels: labels, // Label untuk irisan pie
        values: values, // Nilai untuk irisan pie
        type: 'pie',
        hoverinfo: 'label+percent+value', // Tampilkan label, persentase, dan nilai pada hover
        textinfo: 'percent', // Tampilkan persentase di dalam irisan
        insidetextorientation: 'radial', // Orientasi teks persentase
        marker: {
            colors: colors // Gunakan array warna yang sudah ditentukan
        },
        automargin: true // Agar label dan legend tidak terpotong
    }];

    const layout = {
        title: title,
        height: 400, // Tinggi yang cukup untuk pie chart
        margin: { t: 40, b: 20, l: 20, r: 20 }, // Sesuaikan margin
        font: {
            family: 'Inter, sans-serif',
            size: 12,
            color: '#333'
        },
        legend: {
            orientation: "h", // Legenda horizontal
            x: 0,
            y: -0.15, // Posisikan legenda di bawah grafik
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
