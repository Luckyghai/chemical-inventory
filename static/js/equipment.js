/**
 * EQUIPMENT.JS
 * Logic for Equipment Management Module
 */

const EQUIP_API = {
    getAll: async () => {
        const response = await fetch('/api/equipments');
        return await response.json();
    },
    getById: async (id) => {
        const response = await fetch(`/api/equipments/${id}`);
        return await response.json();
    },
    getLocations: async () => {
        const response = await fetch('/api/locations');
        return await response.json();
    },
    save: async (data) => {
        const response = await fetch('/api/equipments', {
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
    delete: async (id) => {
        await fetch(`/api/equipments/${id}`, { method: 'DELETE' });
    }
};

const EquipmentApp = {
    locationsCache: [],

    initDashboard: async () => {
        const tableBody = document.getElementById('equipmentTableBody');
        const searchInput = document.getElementById('searchInput');
        const locFilter = document.getElementById('locationFilter');

        const [items, locations] = await Promise.all([
            EQUIP_API.getAll(),
            EQUIP_API.getLocations()
        ]);

        EquipmentApp.locationsCache = locations;
        const locMap = {};
        locations.forEach(l => locMap[l.id] = l.name);

        // Stats
        const inMaint = items.filter(i => i.status === 'Maintenance').length;
        const broken = items.filter(i => i.status === 'Broken' || i.status === 'Retired').length;

        document.getElementById('statTotal').innerText = items.length;
        document.getElementById('statMaint').innerText = inMaint;
        document.getElementById('statBroken').innerText = broken;

        // Locations Filter
        locFilter.innerHTML = '<option value="">All Locations</option>';
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            locFilter.appendChild(opt);
        });

        const renderTable = (data) => {
            tableBody.innerHTML = '';
            if (data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No equipment found.</td></tr>';
                return;
            }

            data.forEach(item => {
                const locName = item.location_name || locMap[item.location_id] || 'Unknown';
                const nextMaint = item.next_maintenance_date ? item.next_maintenance_date.toString().split('T')[0] : 'N/A';

                let statusClass = 'bg-success';
                if (item.status === 'Maintenance') statusClass = 'bg-warning text-dark';
                else if (item.status === 'Broken') statusClass = 'bg-danger';
                else if (item.status === 'Retired') statusClass = 'bg-secondary';

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="ps-4 fw-bold text-dark"><a href="#" class="text-decoration-none text-dark" onclick="EquipmentApp.showDetails(${item.id}); return false;">${item.name}</a></td>
                    <td class="text-muted"><small>${item.model_number || 'N/A'} / ${item.serial_number || 'N/A'}</small></td>
                    <td><span class="badge ${statusClass} rounded-pill">${item.status}</span></td>
                    <td><small class="text-secondary fw-semibold">${locName}</small></td>
                    <td>${nextMaint}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light text-info me-1" onclick="EquipmentApp.editItem(${item.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-light text-danger" onclick="EquipmentApp.deleteItem(${item.id})"><i class="fa-regular fa-trash-can"></i></button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        };

        const filterData = () => {
            const term = searchInput.value.toLowerCase();
            const locId = locFilter.value;
            const filtered = items.filter(i => {
                const matchesSearch = i.name.toLowerCase().includes(term) ||
                    (i.model_number && i.model_number.toLowerCase().includes(term)) ||
                    (i.manufacturer && i.manufacturer.toLowerCase().includes(term));
                const matchesLoc = locId ? i.location_id == locId : true;
                return matchesSearch && matchesLoc;
            });
            renderTable(filtered);
        };

        searchInput.addEventListener('keyup', filterData);
        locFilter.addEventListener('change', filterData);
        renderTable(items);
    },

    showDetails: async (id) => {
        try {
            const item = await EQUIP_API.getById(id);
            if (!item || item.error) throw new Error("Equipment not found");

            document.getElementById('modalName').textContent = item.name;
            document.getElementById('modalModel').textContent = item.model_number || 'N/A';
            document.getElementById('modalManufacturer').textContent = item.manufacturer || 'Unknown';
            document.getElementById('modalDesc').textContent = item.description || 'No description provided.';

            let locName = 'Unknown';
            const foundLoc = EquipmentApp.locationsCache.find(l => l.id == item.location_id);
            if (foundLoc) locName = foundLoc.name;
            document.getElementById('modalLoc').textContent = locName;

            document.getElementById('modalLastMaint').textContent = item.last_maintenance_date ? item.last_maintenance_date.split('T')[0] : 'N/A';
            document.getElementById('modalNextMaint').textContent = item.next_maintenance_date ? item.next_maintenance_date.split('T')[0] : 'N/A';

            document.getElementById('modalEditBtn').onclick = () => EquipmentApp.editItem(item.id);
            document.getElementById('modalDeleteBtn').onclick = () => EquipmentApp.deleteItem(item.id);

            const modal = new bootstrap.Modal(document.getElementById('quickViewModal'));
            modal.show();
        } catch (e) {
            console.error(e);
            alert("Failed to load details");
        }
    },

    editItem: (id) => {
        window.location.href = `/equipment/form?id=${id}`;
    },

    deleteItem: async (id) => {
        if (confirm('Delete this equipment permanently?')) {
            await EQUIP_API.delete(id);
            window.location.reload();
        }
    },

    initForm: async () => {
        const locSelect = document.getElementById('location_id');
        const locations = await EQUIP_API.getLocations();

        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            locSelect.appendChild(opt);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('id');

        if (editId) {
            document.getElementById('pageTitle').textContent = "Edit Equipment";
            const item = await EQUIP_API.getById(editId);
            if (item && !item.error) {
                document.getElementById('itemId').value = item.id;
                document.getElementById('name').value = item.name;
                document.getElementById('manufacturer').value = item.manufacturer || '';
                document.getElementById('model_number').value = item.model_number || '';
                document.getElementById('serial_number').value = item.serial_number || '';
                document.getElementById('quantity').value = item.quantity;
                document.getElementById('status').value = item.status;
                document.getElementById('location_id').value = item.location_id || '';
                document.getElementById('description').value = item.description || '';

                if (item.purchase_date) document.getElementById('purchase_date').value = item.purchase_date.split('T')[0];
                if (item.last_maintenance_date) document.getElementById('last_maintenance_date').value = item.last_maintenance_date.split('T')[0];
                if (item.next_maintenance_date) document.getElementById('next_maintenance_date').value = item.next_maintenance_date.split('T')[0];
            }
        }

        document.getElementById('equipmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                id: document.getElementById('itemId').value || null,
                name: document.getElementById('name').value,
                manufacturer: document.getElementById('manufacturer').value,
                model_number: document.getElementById('model_number').value,
                serial_number: document.getElementById('serial_number').value,
                quantity: parseInt(document.getElementById('quantity').value),
                status: document.getElementById('status').value,
                location_id: document.getElementById('location_id').value || null,
                purchase_date: document.getElementById('purchase_date').value || null,
                last_maintenance_date: document.getElementById('last_maintenance_date').value || null,
                next_maintenance_date: document.getElementById('next_maintenance_date').value || null,
                description: document.getElementById('description').value
            };
            try {
                await EQUIP_API.save(formData);
                alert('Saved successfully!');
                window.location.href = '/equipment';
            } catch (err) { alert(err.message); }
        });
    }
};
