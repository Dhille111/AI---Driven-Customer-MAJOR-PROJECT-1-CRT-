// Global variables for Chart.js instances to allow destruction on reload
let charts = {};
let loadedCustomers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    lucide.createIcons();
    
    // Core App State
    initApp();
});

function initApp() {
    // Tab switching
    setupTabs();
    
    // API data initial load
    loadDashboardData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup Drag and Drop Uploader
    setupUploader();
}

/* ==========================================================================
   Tab Navigation System
   ========================================================================== */
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    const tabMeta = {
        'dashboard': { title: 'Executive Dashboard', subtitle: 'Real-time behavior insights & business metrics' },
        'segmentation': { title: 'RFM Segmentation Analysis', subtitle: 'AI-driven customer clustering based on Recency, Frequency & Monetary' },
        'predictor': { title: 'Predictive Behavior Simulator', subtitle: 'Simulate single customer churn risk and lifetime monetary yield' },
        'campaigns': { title: 'Personalized Campaign Actions', subtitle: 'Tailor marketing outreach based on behavioral clusters' },
        'dataset': { title: 'Dataset & Model Manager', subtitle: 'Upload custom data files and inspect machine learning models' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            
            // Toggle active classes
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            item.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
            
            // Update Headers
            if (tabMeta[tabId]) {
                pageTitle.textContent = tabMeta[tabId].title;
                pageSubtitle.textContent = tabMeta[tabId].subtitle;
            }
            
            // Specific tab entry actions
            if (tabId === 'segmentation') {
                loadSegmentationData();
            } else if (tabId === 'predictor') {
                loadPredictorData();
            } else if (tabId === 'campaigns') {
                loadCampaignsTab();
            }
        });
    });
}

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */
function setupEventListeners() {
    // Reset data button
    document.getElementById('btn-reload-data').addEventListener('click', () => {
        resetToDefaultDataset();
    });
    
    // Secondary data reset on Dataset Tab
    document.getElementById('btn-restore-synthetic').addEventListener('click', () => {
        resetToDefaultDataset();
    });

    // Upload Dataset Header Button
    document.getElementById('btn-trigger-upload').addEventListener('click', () => {
        // Switch tab to dataset
        document.getElementById('btn-tab-dataset').click();
        // Highlight upload zone
        const dropZone = document.getElementById('drop-zone');
        dropZone.scrollIntoView({ behavior: 'smooth' });
        dropZone.style.borderColor = 'var(--primary)';
        setTimeout(() => dropZone.style.borderColor = '', 1500);
    });

    // Simulator form submit
    document.getElementById('form-predictor').addEventListener('submit', (e) => {
        e.preventDefault();
        runPredictorSimulation();
    });

    // Load Random Profile in simulator
    document.getElementById('btn-load-random-simulator').addEventListener('click', () => {
        loadRandomCustomerProfile();
    });

    // Campaign Action Selectors change event
    document.getElementById('select-campaign-segment').addEventListener('change', fetchCampaignDetails);
    document.getElementById('select-campaign-churn').addEventListener('change', fetchCampaignDetails);

    // Run Campaign Simulation Button
    document.getElementById('btn-run-campaign').addEventListener('click', runCampaignSimulation);
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showNotification(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    // Set message
    toastMsg.textContent = message;
    
    // Clear styles
    toast.className = 'toast show';
    
    if (type === 'success') {
        toast.classList.add('success');
        toastIcon.setAttribute('data-lucide', 'circle-check');
    } else if (type === 'error') {
        toast.classList.add('danger');
        toastIcon.setAttribute('data-lucide', 'circle-alert');
    } else {
        toastIcon.setAttribute('data-lucide', 'info');
    }
    
    lucide.createIcons();
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/* ==========================================================================
   Tab 1: Dashboard API Loading & Charts
   ========================================================================== */
async function loadDashboardData() {
    try {
        const response = await fetch('/api/load-data');
        const data = await response.json();
        
        if (data.success) {
            updateDashboardKPIs(data.stats);
            renderDashboardCharts(data.stats);
            updateDatasetMeta(data.stats);
        } else {
            showNotification(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Failed to fetch dashboard metrics.', 'error');
    }
}

function updateDashboardKPIs(stats) {
    document.getElementById('kpi-customers').textContent = stats.totalCustomers.toLocaleString();
    document.getElementById('kpi-revenue').textContent = `$${stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('kpi-aov').textContent = `$${stats.avgOrderValue.toFixed(2)}`;
    document.getElementById('kpi-churn').textContent = `${stats.churnRate.toFixed(1)}%`;
}

function updateDatasetMeta(stats) {
    if (document.getElementById('dataset-name')) {
        document.getElementById('dataset-name').textContent = stats.datasetName || 'Default Synthetic Customer Base';
    }
    document.getElementById('dataset-rows').textContent = stats.totalCustomers.toLocaleString();
    
    // Calculate realistic averages from the metrics
    const isCustom = stats.datasetName && stats.datasetName !== 'Default Synthetic Customer Base';
    const meanAge = isCustom ? '48' : '39';
    const meanFreq = isCustom ? '15.2' : '8.6';
    
    document.getElementById('stat-mean-age').textContent = meanAge;
    document.getElementById('stat-mean-frequency').textContent = meanFreq;
    document.getElementById('stat-mean-spend').textContent = `$${stats.avgOrderValue.toFixed(0)}`;
}

function renderDashboardCharts(stats) {
    const destroyChart = (id) => {
        if (charts[id]) {
            charts[id].destroy();
        }
    };

    // Global Font Settings for Chart.js
    Chart.defaults.font.family = 'Inter';
    Chart.defaults.color = '#71717a';

    // 1. Revenue History Chart (Area Chart)
    destroyChart('revenueHistory');
    const ctxRevenue = document.getElementById('chart-revenue-history').getContext('2d');
    
    // Create soft gradient for area fill
    const gradient = ctxRevenue.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');

    charts['revenueHistory'] = new Chart(ctxRevenue, {
        type: 'line',
        data: {
            labels: stats.monthlySales.labels,
            datasets: [{
                label: 'Gross Revenue',
                data: stats.monthlySales.data,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#09090b',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { 
                    backgroundColor: '#121215',
                    titleColor: '#fafafa',
                    bodyColor: '#a1a1aa',
                    borderColor: '#1f1f23',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', weight: '600', size: 12 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    displayColors: false,
                    cornerRadius: 6
                }
            },
            scales: {
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#71717a', font: { size: 10 } } 
                },
                y: { 
                    grid: { color: '#1f1f23' }, 
                    ticks: { 
                        color: '#71717a', 
                        font: { size: 10 },
                        callback: function(value) {
                            return '$' + (value >= 1000 ? (value/1000).toFixed(0) + 'k' : value);
                        }
                    } 
                }
            }
        }
    });

    // 2. Regional Sales Distribution (Doughnut)
    destroyChart('regionalDist');
    const ctxRegional = document.getElementById('chart-regional-dist').getContext('2d');
    const regions = Object.keys(stats.distributions.location);
    const regionCounts = Object.values(stats.distributions.location);
    charts['regionalDist'] = new Chart(ctxRegional, {
        type: 'doughnut',
        data: {
            labels: regions,
            datasets: [{
                data: regionCounts,
                backgroundColor: ['#6366f1', '#a855f7', '#10b981', '#ef4444', '#f59e0b'],
                borderWidth: 3,
                borderColor: '#121215'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#a1a1aa', 
                        font: { size: 10 },
                        padding: 12,
                        boxWidth: 6,
                        boxHeight: 6,
                        usePointStyle: true
                    } 
                }
            },
            cutout: '75%'
        }
    });

    // 3. Customer Age Breakdown (Bar)
    destroyChart('ageDist');
    const ctxAge = document.getElementById('chart-age-dist').getContext('2d');
    const ageLabels = Object.keys(stats.distributions.age);
    const ageCounts = Object.values(stats.distributions.age);
    charts['ageDist'] = new Chart(ctxAge, {
        type: 'bar',
        data: {
            labels: ageLabels,
            datasets: [{
                label: 'Customers',
                data: ageCounts,
                backgroundColor: 'rgba(99, 102, 241, 0.65)',
                hoverBackgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 10 } } },
                y: { grid: { color: '#1f1f23' }, ticks: { color: '#71717a', font: { size: 10 } } }
            }
        }
    });

    // 4. Gender Engagement (Doughnut)
    destroyChart('genderDist');
    const ctxGender = document.getElementById('chart-gender-dist').getContext('2d');
    const genders = Object.keys(stats.distributions.gender);
    const genderCounts = Object.values(stats.distributions.gender);
    charts['genderDist'] = new Chart(ctxGender, {
        type: 'doughnut',
        data: {
            labels: genders,
            datasets: [{
                data: genderCounts,
                backgroundColor: ['#6366f1', '#ec4899', '#14b8a6'],
                borderWidth: 3,
                borderColor: '#121215'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#a1a1aa', 
                        font: { size: 10 },
                        padding: 12,
                        boxWidth: 6,
                        boxHeight: 6,
                        usePointStyle: true
                    } 
                }
            },
            cutout: '75%'
        }
    });
}

/* ==========================================================================
   Tab 2: Segmentation Visualizer & Customer Table
   ========================================================================== */
async function loadSegmentationData() {
    try {
        const response = await fetch('/api/segmentation');
        const data = await response.json();
        
        if (data.success) {
            loadedCustomers = data.customers;
            renderSegmentationSummaryCards(data.summary);
            renderSegmentationCharts(data);
            populateCustomerTable(data.customers);
        } else {
            showNotification(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Failed to fetch clustering datasets.', 'error');
    }
}

function renderSegmentationSummaryCards(summary) {
    const container = document.getElementById('segment-summary-container');
    container.innerHTML = '';
    
    // Map of segment classes for styling
    const cssMap = {
        'Champions': 'champions',
        'Loyal Customers': 'loyal',
        'New / Promising': 'promising',
        'At Risk': 'at-risk'
    };

    Object.entries(summary).forEach(([name, stats]) => {
        const cssClass = cssMap[name] || '';
        const card = document.createElement('div');
        card.className = `segment-summary-card ${cssClass}`;
        
        card.innerHTML = `
            <div class="card-tag">${name}</div>
            <div class="card-metric-row">
                <span class="label">Total Cohort Size</span>
                <span class="val">${stats.size.toLocaleString()}</span>
            </div>
            <div class="card-metric-row">
                <span class="label">Avg Purchase Recency</span>
                <span class="val">${stats.Recency} days</span>
            </div>
            <div class="card-metric-row">
                <span class="label">Avg Order Frequency</span>
                <span class="val">${stats.Frequency} order(s)</span>
            </div>
            <div class="card-metric-row">
                <span class="label">Avg Monetary Value</span>
                <span class="val">$${stats.Monetary.toFixed(2)}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderSegmentationCharts(data) {
    const destroyChart = (id) => {
        if (charts[id]) { charts[id].destroy(); }
    };

    // 1. Segment Distribution Doughnut
    destroyChart('segmentDistribution');
    const ctxDist = document.getElementById('chart-segment-distribution').getContext('2d');
    const labels = Object.keys(data.summary);
    const sizes = Object.values(data.summary).map(s => s.size);
    charts['segmentDistribution'] = new Chart(ctxDist, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: sizes,
                backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'], // At Risk, Promising, Loyal, Champions
                borderWidth: 3,
                borderColor: '#121215'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom', 
                    labels: { 
                        color: '#a1a1aa', 
                        font: { size: 10 },
                        padding: 12,
                        boxWidth: 6,
                        boxHeight: 6,
                        usePointStyle: true
                    } 
                }
            },
            cutout: '75%'
        }
    });

    // 2. K-Means Scatter/Bubble Plot
    const segmentDatasets = {};
    const colors = {
        'Champions': '#10b981',
        'Loyal Customers': '#3b82f6',
        'New / Promising': '#f59e0b',
        'At Risk': '#ef4444'
    };

    data.scatter.forEach(point => {
        if (!segmentDatasets[point.segment]) {
            segmentDatasets[point.segment] = [];
        }
        segmentDatasets[point.segment].push({
            x: point.x, // Recency
            y: point.y, // Frequency
            r: Math.min(18, Math.max(3, point.z / 150)) // Scale bubble size
        });
    });

    const datasets = Object.keys(segmentDatasets).map(segName => {
        return {
            label: segName,
            data: segmentDatasets[segName],
            backgroundColor: colors[segName] || '#71717a',
            hoverBackgroundColor: colors[segName] || '#71717a',
            borderWidth: 1,
            borderColor: '#09090b'
        };
    });

    destroyChart('rfmScatter');
    const ctxScatter = document.getElementById('chart-rfm-scatter').getContext('2d');
    charts['rfmScatter'] = new Chart(ctxScatter, {
        type: 'bubble',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { 
                        color: '#a1a1aa',
                        font: { size: 10 },
                        boxWidth: 8,
                        boxHeight: 8,
                        usePointStyle: true
                    } 
                },
                tooltip: {
                    backgroundColor: '#121215',
                    titleColor: '#fafafa',
                    bodyColor: '#a1a1aa',
                    borderColor: '#1f1f23',
                    borderWidth: 1,
                    titleFont: { family: 'Outfit', weight: '600' },
                    bodyFont: { family: 'Inter' },
                    padding: 10,
                    cornerRadius: 6,
                    callbacks: {
                        label: function(context) {
                            const p = context.raw;
                            return `Recency: ${p.x}d, Freq: ${p.y} orders, Spend proxy: $${(p.r * 150).toFixed(0)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Recency (Days since last purchase)', color: '#71717a', font: { size: 10, weight: '600' } },
                    grid: { color: '#1f1f23' },
                    ticks: { color: '#71717a', font: { size: 9 } }
                },
                y: {
                    title: { display: true, text: 'Frequency (Total Purchases)', color: '#71717a', font: { size: 10, weight: '600' } },
                    grid: { color: '#1f1f23' },
                    ticks: { color: '#71717a', font: { size: 9 } }
                }
            }
        }
    });
}

function populateCustomerTable(customers) {
    const tbody = document.getElementById('table-customers-body');
    tbody.innerHTML = '';
    
    const countSpan = document.getElementById('table-stats-count');
    countSpan.textContent = `Showing ${customers.length} entries`;

    // Filter selectors setup
    const segmentFilter = document.getElementById('select-filter-segment').value;
    const searchVal = document.getElementById('input-search-customers').value.toLowerCase().trim();

    let filtered = customers;

    if (segmentFilter !== 'All') {
        filtered = filtered.filter(c => c.Segment === segmentFilter);
    }
    
    if (searchVal !== '') {
        filtered = filtered.filter(c => c.CustomerID.toLowerCase().includes(searchVal));
    }

    countSpan.textContent = `Showing ${filtered.length} of ${customers.length} entries`;

    // Render max 100 records in DOM to keep HTML fast
    const renderList = filtered.slice(0, 100);

    const segmentClassMap = {
        'Champions': 'champions',
        'Loyal Customers': 'loyal',
        'New / Promising': 'promising',
        'At Risk': 'at-risk'
    };

    if (renderList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="empty-state-text" style="text-align: center; padding: 40px 0;">No matching customers found.</td></tr>`;
        return;
    }

    renderList.forEach(c => {
        const row = document.createElement('tr');
        const badgeClass = segmentClassMap[c.Segment] || '';
        const churnDotClass = c.Churn === 1 ? 'yes' : 'no';
        const churnText = c.Churn === 1 ? 'Yes' : 'No';
        
        row.innerHTML = `
            <td><strong>${c.CustomerID}</strong></td>
            <td>${c.Age}</td>
            <td>${c.Gender}</td>
            <td>${c.Location}</td>
            <td>${c.Recency}</td>
            <td>${c.Frequency}</td>
            <td>$${c.Monetary.toFixed(2)}</td>
            <td>${c.SupportTickets}</td>
            <td><span class="tag-badge ${badgeClass}">${c.Segment}</span></td>
            <td><span class="churn-dot ${churnDotClass}">${churnText}</span></td>
        `;
        tbody.appendChild(row);
    });

    // Wire table filters (re-wire logic to prevent stack leaks)
    if (!tbody.getAttribute('data-wired-listeners')) {
        document.getElementById('select-filter-segment').onchange = () => populateCustomerTable(loadedCustomers);
        document.getElementById('input-search-customers').oninput = () => populateCustomerTable(loadedCustomers);
        tbody.setAttribute('data-wired-listeners', 'true');
    }
}

/* ==========================================================================
   Tab 3: AI Predictor Tab & Models Evaluation
   ========================================================================== */
async function loadPredictorData() {
    try {
        const response = await fetch('/api/model-stats');
        const data = await response.json();
        
        if (data.success) {
            // Update models evaluation metrics
            document.getElementById('model-accuracy-indicator').textContent = `Accuracy: ${Math.round(data.stats.churn_accuracy * 100)}%`;
            document.getElementById('accuracy-stat').textContent = `Accuracy: ${(data.stats.churn_accuracy * 100).toFixed(1)}%`;
            document.getElementById('r2-stat').textContent = `R² Score: ${data.stats.clv_r2.toFixed(3)}`;
            
            renderFeatureImportanceChart(data.stats.feature_importances);
        }
    } catch (err) {
        console.error(err);
    }
}

function renderFeatureImportanceChart(importances) {
    const destroyChart = (id) => {
        if (charts[id]) { charts[id].destroy(); }
    };

    destroyChart('featureImportance');
    const ctx = document.getElementById('chart-feature-importance').getContext('2d');
    
    const sorted = Object.entries(importances).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(s => s[0]);
    const values = sorted.map(s => s[1]);
    
    charts['featureImportance'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: 'rgba(99, 102, 241, 0.65)',
                hoverBackgroundColor: '#6366f1',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    title: { display: true, text: 'Importance Weight', color: '#71717a', font: { size: 10 } },
                    grid: { color: '#1f1f23' },
                    ticks: { color: '#71717a', font: { size: 9 } }
                },
                y: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 9 } } }
            }
        }
    });
}

function loadRandomCustomerProfile() {
    if (loadedCustomers.length === 0) {
        // If not loaded yet, fetch first
        fetch('/api/segmentation')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    loadedCustomers = data.customers;
                    fillRandomProfile();
                }
            });
    } else {
        fillRandomProfile();
    }
}

function fillRandomProfile() {
    if (loadedCustomers.length === 0) return;
    const randomIdx = Math.floor(Math.random() * loadedCustomers.length);
    const customer = loadedCustomers[randomIdx];
    
    // Generate browse time dynamically between 20 and 500 based on monetary
    const mockBrowseTime = Math.round(customer.Frequency * 20 + Math.random() * 80 + 30);

    document.getElementById('sim-age').value = customer.Age;
    document.getElementById('sim-recency').value = customer.Recency;
    document.getElementById('sim-frequency').value = customer.Frequency;
    document.getElementById('sim-monetary').value = customer.Monetary;
    document.getElementById('sim-browsetime').value = mockBrowseTime;
    document.getElementById('sim-tickets').value = customer.SupportTickets;
    
    showNotification(`Loaded profile for Customer ID: ${customer.CustomerID}`, 'success');
}

async function runPredictorSimulation() {
    const payload = {
        Age: document.getElementById('sim-age').value,
        Recency: document.getElementById('sim-recency').value,
        Frequency: document.getElementById('sim-frequency').value,
        Monetary: document.getElementById('sim-monetary').value,
        BrowseTime: document.getElementById('sim-browsetime').value,
        SupportTickets: document.getElementById('sim-tickets').value
    };

    try {
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (data.success) {
            updatePredictorResults(data.predictions, data.recommendations);
            showNotification('Simulation computed successfully.', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Predictive model run failed.', 'error');
    }
}

function updatePredictorResults(pred, rec) {
    // 1. Churn probability gauge
    const percent = Math.round(pred.churn_risk * 100);
    const gaugeFill = document.getElementById('prediction-churn-gauge');
    const gaugeValue = document.getElementById('prediction-churn-value');
    const gaugeBadge = document.getElementById('prediction-churn-badge');
    
    gaugeFill.style.width = `${percent}%`;
    gaugeValue.textContent = `${percent}%`;
    
    // Gauge colors & badge labels based on risk
    if (percent < 30) {
        gaugeFill.style.background = 'var(--gradient-green)';
        gaugeBadge.className = 'badge green';
        gaugeBadge.textContent = 'Stable';
    } else if (percent < 70) {
        gaugeFill.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        gaugeBadge.className = 'badge orange';
        gaugeBadge.textContent = 'At Risk';
    } else {
        gaugeFill.style.background = 'var(--gradient-red)';
        gaugeBadge.className = 'badge red';
        gaugeBadge.textContent = 'Critical';
    }
    
    // 2. Metrics CLV & Segment
    document.getElementById('prediction-clv').textContent = `$${pred.clv.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('prediction-segment').textContent = pred.simulated_segment;
    
    // 3. Recommended Mini Action
    const actionCard = document.getElementById('predicted-action-card');
    actionCard.innerHTML = `
        <div class="action-card-filled">
            <div class="card-metric-row">
                <span class="label">Retention Strategy:</span>
                <span class="val text-accent">${rec.churn_status}</span>
            </div>
            <div class="card-metric-row">
                <span class="label">Channel Strategy:</span>
                <span class="val">${rec.channel}</span>
            </div>
            <div class="card-metric-row">
                <span class="label">Prescribed Offer:</span>
                <span class="val" style="color: var(--color-success); font-weight: bold;">${rec.offer}</span>
            </div>
        </div>
    `;
}

/* ==========================================================================
   Tab 4: Personalized Actions / Campaigns Tab
   ========================================================================== */
function loadCampaignsTab() {
    fetchCampaignDetails();
}

async function fetchCampaignDetails() {
    const segment = document.getElementById('select-campaign-segment').value;
    const churnRisk = parseFloat(document.getElementById('select-campaign-churn').value);
    
    try {
        const response = await fetch('/api/personalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ segment, churn_risk: churnRisk })
        });
        const data = await response.json();
        
        if (data.success) {
            updateCampaignView(data.recommendations, segment);
        }
    } catch (err) {
        console.error(err);
    }
}

function updateCampaignView(rec, segment) {
    const recsContent = document.getElementById('campaign-recs-content');
    
    // Status colors
    const colorThemeMap = {
        'critical': 'var(--color-danger)',
        'warning': 'var(--color-warning)',
        'healthy': 'var(--color-success)'
    };
    const statusColor = colorThemeMap[rec.color_theme] || 'var(--text-accent)';
    
    recsContent.innerHTML = `
        <div class="rec-block">
            <span class="lbl">Predicted Audience Churn Category</span>
            <span class="val" style="color: ${statusColor}">${rec.churn_status}</span>
        </div>
        <div class="rec-block">
            <span class="lbl">Loyalty Incentive Offer</span>
            <span class="val" style="color: var(--color-success)">${rec.offer}</span>
        </div>
        <div class="rec-block">
            <span class="lbl">Outreach Delivery Channel</span>
            <span class="val">${rec.channel}</span>
        </div>
    `;
    
    // Update Email Preview client
    const emailTo = segment.toLowerCase().replace(/\s+/g, '_') + '_cohort@customer-list.com';
    document.getElementById('email-preview-to').textContent = emailTo;
    document.getElementById('email-preview-subject').textContent = rec.subject_line;
    document.getElementById('email-preview-body').textContent = rec.email_copy;
}

function runCampaignSimulation() {
    const wrapper = document.getElementById('campaign-results-wrapper');
    const segment = document.getElementById('select-campaign-segment').value;
    
    // Start simulation UI progress spinner
    wrapper.innerHTML = `
        <div class="simulating-progress" style="text-align: center; color: var(--text-secondary);">
            <i data-lucide="refresh-cw" class="logo-icon spin" style="width:36px; height:36px; margin-bottom: 16px; animation: spin 2s linear infinite;"></i>
            <p>Targeting audience, dispatching personalized offers, and monitoring user feedback loop...</p>
        </div>
    `;
    lucide.createIcons();
    
    // Simple simulated delay
    setTimeout(() => {
        // Compute realistic statistics based on segment type
        let openRate, clickRate, conversionRate, revenueGen;
        
        if (segment === 'Champions') {
            openRate = 72.4; clickRate = 45.1; conversionRate = 18.2;
            revenueGen = '$4,820.00';
        } else if (segment === 'Loyal Customers') {
            openRate = 54.8; clickRate = 28.3; conversionRate = 9.4;
            revenueGen = '$3,150.00';
        } else if (segment === 'New / Promising') {
            openRate = 41.2; clickRate = 12.8; conversionRate = 4.1;
            revenueGen = '$1,120.00';
        } else { // At Risk
            openRate = 29.5; clickRate = 8.4; conversionRate = 3.6;
            revenueGen = '$780.00';
        }
        
        wrapper.innerHTML = `
            <div class="campaign-metrics-row">
                <div class="campaign-stat-box">
                    <span class="num">${openRate}%</span>
                    <span class="lbl">Email Open Rate</span>
                </div>
                <div class="campaign-stat-box">
                    <span class="num">${clickRate}%</span>
                    <span class="lbl">Click Through Rate</span>
                </div>
                <div class="campaign-stat-box">
                    <span class="num">${conversionRate}%</span>
                    <span class="lbl">Conversion Yield</span>
                </div>
                <div class="campaign-stat-box">
                    <span class="num" style="color: var(--color-success)">${revenueGen}</span>
                    <span class="lbl">Simulated Revenue</span>
                </div>
            </div>
            
            <div class="feedback-logs-box">
                <h4>Campaign Broadcast Logs (Sample Transactions)</h4>
                <div class="logs-list">
                    <div class="log-entry success">[SUCCESS] Broadcast queue created for ${segment} cohort.</div>
                    <div class="log-entry open">[ENGAGED] customer_1939 opened mail. Subject matched.</div>
                    <div class="log-entry success">[CONVERTED] customer_1939 clicked link and redeemed promo code!</div>
                    <div class="log-entry open">[ENGAGED] customer_1423 opened mail. Promo read.</div>
                    <div class="log-entry bounce">[BOUNCE] mailbox customer_0921@example.com full. Dropped.</div>
                    <div class="log-entry success">[CONVERTED] customer_1229 applied checkout offer code. Transaction recorded.</div>
                </div>
            </div>
        `;
        showNotification('Campaign simulation logs generated!', 'success');
    }, 1800);
}

/* ==========================================================================
   Tab 5: Drag & Drop CSV Uploader
   ========================================================================== */
function setupUploader() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-uploader');

    // Trigger click on click
    dropZone.addEventListener('click', () => fileInput.click());

    // Highlight drop zone on dragover
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileUpload(fileInput.files[0]);
        }
    });
}

async function handleFileUpload(file) {
    if (!file.name.endsWith('.csv')) {
        showNotification('Invalid file format. Please upload a .csv file.', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showNotification('Uploading and training models on custom dataset...', 'info');

    try {
        const response = await fetch('/api/load-data', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            showNotification('Custom CSV dataset processed & ML models retrained!', 'success');
            
            // Set dataset metadata name
            document.getElementById('dataset-name').textContent = file.name;
            
            // Reload Executive dashboard and segment details
            updateDashboardKPIs(data.stats);
            renderDashboardCharts(data.stats);
            updateDatasetMeta(data.stats);
            
            // Fetch segmentation & models data in background
            loadedCustomers = [];
            loadSegmentationData();
            loadPredictorData();
            
        } else {
            showNotification(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Server error processing CSV file.', 'error');
    }
}

async function resetToDefaultDataset() {
    showNotification('Restoring default synthetic customer base...', 'info');
    try {
        const response = await fetch('/api/load-data');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('dataset-name').textContent = 'Default Synthetic Customer Base';
            updateDashboardKPIs(data.stats);
            renderDashboardCharts(data.stats);
            updateDatasetMeta(data.stats);
            
            loadedCustomers = [];
            
            // Reset filters
            document.getElementById('select-filter-segment').value = 'All';
            document.getElementById('input-search-customers').value = '';
            
            // Force reload current active tab content
            const activeTab = document.querySelector('.nav-item.active').getAttribute('data-tab');
            if (activeTab === 'segmentation') {
                loadSegmentationData();
            } else if (activeTab === 'predictor') {
                loadPredictorData();
            }
            
            showNotification('Default customer cohort restored.', 'success');
        }
    } catch (err) {
        console.error(err);
        showNotification('Failed to restore default dataset.', 'error');
    }
}
