/**
 * APP.JS - FANCY VERSION
 * Connected to Flask Backend + Handles Stats & Badges
 */

const API = {
    // 1. Get All Chemicals
    getAllChemicals: async () => {
        const response = await fetch('/api/chemicals');
        return await response.json();
    },

    // 2. Get Single Chemical
    getChemicalById: async (id) => {
        const response = await fetch(`/api/chemicals/${id}`);
        return await response.json();
    },

    // 3. Get Locations
    getLocations: async () => {
        const response = await fetch('/api/locations');
        return await response.json();
    },

    // 4. Save (Add or Update)
    saveChemical: async (data) => {
        const response = await fetch('/api/chemicals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save');
        }
        return await response.json();
    },

    // 5. Delete Base
    deleteChemical: async (id) => {
        await fetch(`/api/chemicals/${id}`, { method: 'DELETE' });
    },

    // --- ORDERS API ---
    getOrders: async () => {
        const response = await fetch('/api/orders');
        return await response.json();
    },
    saveOrder: async (data) => {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save order');
        }
        return await response.json();
    },
    updateOrder: async (id, data) => {
        const response = await fetch(`/api/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update order');
        }
        return await response.json();
    },
    deleteOrder: async (id) => {
        await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    }
};

/**
 * UI CONTROLLER
 */
const InventoryApp = {
    locationsCache: [], // Cache for modal

    // --- DASHBOARD LOGIC ---
    initDashboard: async () => {
        const tableBody = document.getElementById('inventoryTableBody');
        const searchInput = document.getElementById('searchInput');
        const locFilter = document.getElementById('locationFilter');

        // 1. Fetch Real Data (Parallel for speed)
        const [chemicals, locations] = await Promise.all([
            API.getAllChemicals(),
            API.getLocations()
        ]);

        // Save to cache & build fast lookup map
        InventoryApp.locationsCache = locations;
        const locMap = {};
        locations.forEach(l => locMap[l.id] = l.name);

        // 2. Update Stats Cards & Notifications
        const lowStock = chemicals.filter(c => c.quantity < 50);
        const today = new Date();
        const expiring = chemicals.filter(c => {
            if (!c.expiry_date) return false;
            const expDate = new Date(c.expiry_date);
            const diffTime = expDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 30;
        });

        // Update Stats
        if (document.getElementById('statTotal')) {
            document.getElementById('statTotal').innerText = chemicals.length;
            document.getElementById('statLow').innerText = lowStock.length;
            document.getElementById('statLocs').innerText = locations.length;
        }

        // Update Notifications
        const notifBadge = document.getElementById('notificationCount');
        const notifList = document.getElementById('notificationList');
        const totalAlerts = lowStock.length + expiring.length;

        if (totalAlerts > 0 && notifBadge && notifList) {
            notifBadge.innerText = totalAlerts;
            notifBadge.style.display = 'block';

            let html = '';

            // Low Stock Alerts
            lowStock.forEach(c => {
                html += `
                    <div class="p-3 border-bottom d-flex align-items-start bg-warning bg-opacity-10">
                        <i class="fa-solid fa-triangle-exclamation text-warning mt-1 me-3"></i>
                        <div>
                            <p class="mb-0 fw-bold text-dark">Low Stock: ${c.name}</p>
                            <small class="text-muted">Only ${c.quantity} ${c.unit} remaining.</small>
                        </div>
                    </div>
                `;
            });

            // Expiry Alerts
            expiring.forEach(c => {
                const isExpired = new Date(c.expiry_date) < today;
                const txt = isExpired ? 'Expired' : 'Expiring Soon';
                const color = isExpired ? 'danger' : 'info';
                html += `
                    <div class="p-3 border-bottom d-flex align-items-start bg-${color} bg-opacity-10">
                        <i class="fa-solid fa-clock text-${color} mt-1 me-3"></i>
                        <div>
                            <p class="mb-0 fw-bold text-dark">${txt}: ${c.name}</p>
                            <small class="text-muted">Date: ${c.expiry_date.split('T')[0]}</small>
                        </div>
                    </div>
                `;
            });
            notifList.innerHTML = html;
        } else if (notifList) {
            notifList.innerHTML = `
                <div class="p-4 text-center text-muted small">
                    <i class="fa-solid fa-check-circle mb-2 text-success fa-2x"></i>
                    <p class="mb-0">All good! No alerts.</p>
                </div>
            `;
            if (notifBadge) notifBadge.style.display = 'none';
        }

        // 3. Populate Filter Dropdown
        locFilter.innerHTML = '<option value="">All Locations</option>';
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            locFilter.appendChild(opt);
        });

        // 4. Render "Fancy" Table
        const renderTable = (data) => {
            tableBody.innerHTML = '';
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No chemicals found in database.</td></tr>';
                return;
            }

            data.forEach(chem => {
                // Fast O(1) Lookup using locMap
                const locName = chem.location_name || locMap[chem.location_id] || 'Unknown';
                const expiry = chem.expiry_date ? chem.expiry_date.toString().split('T')[0] : 'N/A';

                // Status Badge Logic
                let statusBadge = '<span class="badge bg-success bg-opacity-10 text-success">In Stock</span>';
                if (chem.quantity < 50) {
                    statusBadge = '<span class="badge bg-warning bg-opacity-10 text-warning">Low Stock</span>';
                }

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ps-4 fw-bold text-dark"><a href="#" class="text-decoration-none text-dark" onclick="InventoryApp.showDetails(${chem.id}); return false;">${chem.name}</a></td>
                    <td class="text-muted">${chem.cas_number}</td>
                    <td>${statusBadge}</td>
                    <td><small class="text-secondary fw-semibold">${locName}</small></td>
                    <td>${expiry}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light text-info me-1" onclick="InventoryApp.editChem(${chem.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-light text-danger" onclick="InventoryApp.deleteChem(${chem.id})"><i class="fa-regular fa-trash-can"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        };

        // Filter Logic
        const filterData = () => {
            const term = searchInput.value.toLowerCase();
            const locId = locFilter.value;
            const filtered = chemicals.filter(c => {
                const matchesName = c.name.toLowerCase().includes(term) || c.cas_number.includes(term);
                const matchesLoc = locId ? c.location_id == locId : true;
                return matchesName && matchesLoc;
            });
            renderTable(filtered);
        };

        searchInput.addEventListener('keyup', (e) => {
            if (InventoryApp.aiMode) {
                if (e.key === 'Enter') handleAiSearch();
            } else {
                filterData();
            }
        });
        locFilter.addEventListener('change', filterData);
        renderTable(chemicals);

        // --- NEW: AI Search Logic ---
        InventoryApp.aiMode = false;
        const aiToggle = document.getElementById('aiSearchToggle');

        const handleAiSearch = async () => {
            const query = searchInput.value;
            if (!query) return;

            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted"><i class="fa-solid fa-spinner fa-spin me-2"></i>Gemini is thinking...</td></tr>';

            try {
                const response = await fetch('/api/ai-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                const data = await response.json();

                if (data.error) throw new Error(data.error);

                // Filter chemicals by returned IDs
                const matches = chemicals.filter(c => data.match_ids.includes(c.id));
                renderTable(matches);

                // Show explanation toast/alert
                if (data.explanation) {
                    // Simple inline feedback
                    const alertRow = document.createElement('tr');
                    alertRow.innerHTML = `<td colspan="6" class="bg-info bg-opacity-10 text-center text-info small fw-bold py-2">StartAI: "${data.explanation}"</td>`;
                    tableBody.prepend(alertRow);
                }

            } catch (err) {
                console.error(err);
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">AI Error: ${err.message}</td></tr>`;
            }
        };

        if (aiToggle) {
            aiToggle.addEventListener('click', () => {
                InventoryApp.aiMode = !InventoryApp.aiMode;
                if (InventoryApp.aiMode) {
                    aiToggle.classList.replace('btn-outline-primary', 'btn-primary');
                    searchInput.placeholder = "✨ Ask Gemini (e.g. 'Show me flammable liquids')... Press Enter";
                    locFilter.disabled = true;
                } else {
                    aiToggle.classList.replace('btn-primary', 'btn-outline-primary');
                    searchInput.placeholder = "Search by name, CAS, or formula...";
                    locFilter.disabled = false;
                    renderTable(chemicals); // Reset
                }
            });
        }

        // --- NEW: AI Hazard Scan Logic ---
        const scanBtn = document.getElementById('scanHazardsBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', async () => {
                const modal = new bootstrap.Modal(document.getElementById('hazardModal'));
                const modalBody = document.getElementById('hazardModalBody');

                modal.show();
                modalBody.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fa-solid fa-spinner fa-spin fa-2x text-warning"></i>
                        <p class="mt-2 text-dark">Gemini AI is analyzing your inventory for dangerous combinations...</p>
                    </div>
                `;

                try {
                    const response = await fetch('/api/check-hazards');
                    const data = await response.json();

                    if (!response.ok) throw new Error(data.error || 'Scan failed');

                    if (data.safe) {
                        modalBody.innerHTML = `
                            <div class="text-center py-4 text-success">
                                <i class="fa-solid fa-check-circle fa-4x mb-3"></i>
                                <h4>Inventory Safe!</h4>
                                <p>${data.analysis || 'No incompatible combinations found in any shared storage location.'}</p>
                            </div>
                        `;
                    } else {
                        let html = '<div class="list-group">';
                        data.hazards.forEach(h => {
                            html += `
                                <div class="list-group-item list-group-item-danger">
                                    <div class="d-flex w-100 justify-content-between">
                                        <h5 class="mb-1"><i class="fa-solid fa-radiation me-2"></i>Incompatibility at <strong>${h.location}</strong></h5>
                                        <small class="badge bg-danger text-uppercase">${h.severity || 'High Risk'}</small>
                                    </div>
                                    <p class="mb-1 fw-bold">${h.chemicals.join(' + ')}</p>
                                    <small>${h.risk}</small>
                                </div>
                            `;
                        });
                        html += '</div>';
                        modalBody.innerHTML = html;
                    }

                } catch (err) {
                    console.error(err);
                    modalBody.innerHTML = `
                        <div class="text-center py-4 text-danger">
                            <i class="fa-solid fa-circle-exclamation fa-3x mb-3"></i>
                            <p>Error: ${err.message}</p>
                            ${err.message.includes('503') ? '<small>Please check your GEMINI_API_KEY environment variable.</small>' : ''}
                        </div>
                    `;
                }
            });
        }
    },

    // --- UI HELPERS ---
    showDetails: async (id) => {
        try {
            const chem = await API.getChemicalById(id);
            if (!chem || chem.error) throw new Error("Chemical not found");

            // Populate Modal Fields
            document.getElementById('modalName').textContent = chem.name;
            document.getElementById('modalCAS').textContent = chem.cas_number || 'N/A';
            document.getElementById('modalQty').textContent = `${chem.quantity} ${chem.unit}`;

            // Location Name (Backend includes location_name in get_chemical join? Let's check. 
            // Actually get_chemical endpoint just does SELECT * FROM chemicals. 
            // We might need to fetch locations or just show ID if name isn't there.
            // Wait, renderTable had access to location list. 
            // A better way: Let's fetch locations if needed or rely on what we have. 
            // The API.getChemicalById returns just the chemical row. 
            // Let's do a quick fetch of locations to map the name, or just show "Location ID: ...". 
            // Ideally backend should return it. 
            // Use Cache for Location Name
            let locName = 'Unknown Location';
            if (chem.location_name) {
                locName = chem.location_name;
            } else {
                // Check cache, if empty fetch again (fallback)
                if (InventoryApp.locationsCache.length === 0) {
                    InventoryApp.locationsCache = await API.getLocations();
                }
                const foundLoc = InventoryApp.locationsCache.find(l => l.id == chem.location_id);
                if (foundLoc) locName = foundLoc.name;
            }
            document.getElementById('modalLoc').textContent = locName;

            document.getElementById('modalExpiry').textContent = chem.expiry_date ? chem.expiry_date.split('T')[0] : 'No Expiry Date';
            document.getElementById('modalSafety').textContent = chem.safety_notes || 'No specific safety notes recorded.';

            // Badge
            const badgeDiv = document.getElementById('modalStatusBadge');
            if (chem.quantity < 50) {
                badgeDiv.innerHTML = '<span class="badge bg-warning text-dark px-3 py-2 rounded-pill"><i class="fa-solid fa-triangle-exclamation me-2"></i>Low Stock</span>';
            } else {
                badgeDiv.innerHTML = '<span class="badge bg-success text-white px-3 py-2 rounded-pill"><i class="fa-solid fa-check me-2"></i>In Stock</span>';
            }

            // Bind Actions in Manage Tab
            const editBtn = document.getElementById('modalEditBtn');
            const delBtn = document.getElementById('modalDeleteBtn');

            // Clone to remove previous listeners
            const newEditBtn = editBtn.cloneNode(true);
            const newDelBtn = delBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            delBtn.parentNode.replaceChild(newDelBtn, delBtn);

            newEditBtn.onclick = () => InventoryApp.editChem(chem.id);
            newDelBtn.onclick = () => InventoryApp.deleteChem(chem.id);

            // Show Modal
            const modalEl = document.getElementById('quickViewModal');
            const modal = new bootstrap.Modal(modalEl);
            modal.show();

        } catch (e) {
            console.error(e);
            alert("Failed to load details.");
        }
    },

    editChem: (id) => {
        window.location.href = `form.html?id=${id}`;
    },

    deleteChem: async (id) => {
        if (confirm('Are you sure you want to permanently delete this chemical?')) {
            await API.deleteChemical(id);
            window.location.reload();
        }
    },

    // --- FORM LOGIC (Unchanged) ---
    initForm: async () => {
        const locSelect = document.getElementById('location_id');
        const locations = await API.getLocations();

        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            locSelect.appendChild(opt);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');

        if (editId) {
            document.getElementById('pageTitle').textContent = "Edit Chemical";
            const chem = await API.getChemicalById(editId);
            if (chem && !chem.error) {
                document.getElementById('chemId').value = chem.id;
                document.getElementById('name').value = chem.name;
                document.getElementById('cas_number').value = chem.cas_number;
                document.getElementById('quantity').value = chem.quantity;
                document.getElementById('unit').value = chem.unit;
                document.getElementById('location_id').value = chem.location_id;
                if (chem.expiry_date) {
                    document.getElementById('expiry_date').value = chem.expiry_date.split('T')[0];
                }
                document.getElementById('safety_notes').value = chem.safety_notes || '';
            }
        }

        document.getElementById('chemicalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('chemId').value || null,
                name: document.getElementById('name').value,
                cas_number: document.getElementById('cas_number').value,
                quantity: parseFloat(document.getElementById('quantity').value),
                unit: document.getElementById('unit').value,
                location_id: document.getElementById('location_id').value || null,
                expiry_date: document.getElementById('expiry_date').value,
                safety_notes: document.getElementById('safety_notes').value
            };
            try {
                await API.saveChemical(formData);
                alert('Saved!');
                window.location.href = '/';
            } catch (err) { alert(err.message); }
        });
    },

    // --- ORDERS LOGIC ---
    initOrders: async () => {
        const tableBody = document.getElementById('ordersTableBody');
        if (!tableBody) return;

        let ordersData = []; // Store locally for edit

        // 1. Fetch Orders
        try {
            ordersData = await API.getOrders();
            const orders = ordersData;

            // 2. Stats Calculation
            const openOrders = orders.filter(o => o.status !== 'Received' && o.status !== 'Cancelled');
            const receivedValues = orders.filter(o => o.status === 'Received');
            const pending = orders.filter(o => o.status === 'Pending');
            const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.total_cost) || 0), 0);

            if (document.getElementById('statOpen')) document.getElementById('statOpen').innerText = openOrders.length;
            if (document.getElementById('statReceived')) document.getElementById('statReceived').innerText = receivedValues.length;
            if (document.getElementById('statPending')) document.getElementById('statPending').innerText = pending.length;
            if (document.getElementById('statSpent')) document.getElementById('statSpent').innerText = `₹${totalSpent.toFixed(2)}`;

            // 3. Render Table
            tableBody.innerHTML = '';
            if (orders.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No orders found.</td></tr>';
            } else {
                orders.forEach(order => {
                    let badgeClass = 'bg-secondary';
                    if (order.status === 'Received') badgeClass = 'bg-success';
                    else if (order.status === 'Shipped') badgeClass = 'bg-primary';
                    else if (order.status === 'Pending') badgeClass = 'bg-warning text-dark';
                    else if (order.status === 'Cancelled') badgeClass = 'bg-danger';

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="ps-4 fw-bold">${order.po_number}</td>
                        <td>${order.supplier}</td>
                        <td>${order.order_date || 'N/A'}</td>
                        <td>${order.items}</td>
                        <td>₹${parseFloat(order.total_cost || 0).toFixed(2)}</td>
                        <td><span class="badge ${badgeClass} bg-opacity-10 text-${badgeClass.replace('bg-', '')} status-badge">${order.status}</span></td>
                        <td class="text-end pe-4">
                            <button class="btn btn-sm btn-light text-primary me-1" onclick="InventoryApp.openEditOrder(${order.id})"><i class="fa-regular fa-pen-to-square"></i></button>
                            <button class="btn btn-sm btn-light text-danger" onclick="InventoryApp.deleteOrder(${order.id})"><i class="fa-regular fa-trash-can"></i></button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }

        } catch (e) {
            console.error(e);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading orders: ${e.message}</td></tr>`;
        }

        // 4. Handle Create/Edit Form
        const createForm = document.getElementById('createOrderForm');
        // Remove old listener to prevent duplicates (not perfect but simple)
        const newForm = createForm.cloneNode(true);
        if (createForm.parentNode) createForm.parentNode.replaceChild(newForm, createForm);

        if (newForm) {
            newForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('orderId').value;
                const formData = {
                    po_number: document.getElementById('po_number').value,
                    supplier: document.getElementById('supplier').value,
                    order_date: document.getElementById('order_date').value,
                    items: document.getElementById('items').value,
                    total_cost: parseFloat(document.getElementById('total_cost').value),
                    status: document.getElementById('status').value
                };

                try {
                    if (id) {
                        await API.updateOrder(id, formData);
                    } else {
                        await API.saveOrder(formData);
                    }
                    // Close modal and refresh
                    const modalEl = document.getElementById('newOrderModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();
                    InventoryApp.initOrders(); // Refresh
                } catch (err) {
                    alert(err.message);
                }
            });
        }

        // Helper to find order data for edit
        InventoryApp.openEditOrder = (id) => {
            const order = ordersData.find(o => o.id === id);
            if (!order) return;

            document.getElementById('orderId').value = order.id;
            document.getElementById('modalTitle').innerText = 'Edit Purchase Order';
            document.getElementById('submitBtn').innerText = 'Update Order';

            document.getElementById('po_number').value = order.po_number;
            document.getElementById('supplier').value = order.supplier;
            document.getElementById('order_date').value = order.order_date ? order.order_date.split('T')[0] : '';
            document.getElementById('items').value = order.items;
            document.getElementById('total_cost').value = order.total_cost;
            document.getElementById('status').value = order.status;

            new bootstrap.Modal(document.getElementById('newOrderModal')).show();
        };

        // Reset form on close
        const modalEl = document.getElementById('newOrderModal');
        modalEl.addEventListener('hidden.bs.modal', () => {
            document.getElementById('createOrderForm').reset();
            document.getElementById('orderId').value = '';
            document.getElementById('modalTitle').innerText = 'New Purchase Order';
            document.getElementById('submitBtn').innerText = 'Create Order';
        });
    },

    deleteOrder: async (id) => {
        if (confirm('Delete this order record?')) {
            try {
                await API.deleteOrder(id);
                InventoryApp.initOrders();
            } catch (e) { alert(e.message); }
        }
    }
};