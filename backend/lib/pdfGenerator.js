const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function generateOrderPDF(db, orderId) {
    const order = db.prepare("SELECT o.*, (c.first_name || ' ' || c.last_name) as client_name, v.brand, v.model, v.plate FROM orders o JOIN clients c ON o.client_id = c.id JOIN vehicles v ON o.vehicle_id = v.id WHERE o.id = ?").get(orderId);
    if (!order) return null;

    const budget = db.prepare('SELECT * FROM budgets WHERE order_id = ?').get(orderId);
    let items = [];
    let isBudget = false;

    if (budget) {
        items = JSON.parse(budget.items || '[]');
        isBudget = true;
    } else {
        items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    }

    const workshop = db.prepare('SELECT * FROM config LIMIT 1').get() || { workshop_name: 'Taller', client_portal_language: 'es' };
    const lang = workshop.client_portal_language || 'es';

    const translations = {
        es: {
            budget: 'PRESUPUESTO DE SERVICIO',
            order: 'ORDEN DE TRABAJO',
            client: 'Cliente',
            vehicle: 'Vehículo',
            date: 'Fecha',
            detail: 'Detalle',
            qty: 'Cant',
            price: 'Precio',
            subtotal: 'Subtotal',
            labor: 'Mano de Obra',
            parts: 'Repuestos',
            total: 'TOTAL'
        },
        en: {
            budget: 'SERVICE ESTIMATE',
            order: 'WORK ORDER',
            client: 'Customer',
            vehicle: 'Vehicle',
            date: 'Date',
            detail: 'Detail',
            qty: 'Qty',
            price: 'Price',
            subtotal: 'Subtotal',
            labor: 'Labor',
            parts: 'Parts',
            total: 'TOTAL'
        }
    };

    const t = (key) => translations[lang][key] || key;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const wName = (workshop.workshop_name || 'TALLER').toUpperCase();

    // Draw Logo if exists
    let logoOffset = 0;
    if (workshop.logo_path) {
        try {
            const parts = workshop.logo_path.split('/');
            if (parts.length >= 4 && parts[1] === 'uploads') {
                const slug = parts[2];
                const file = parts.slice(3).join('/');
                const localPath = path.join(__dirname, '..', 'tenants', slug, 'uploads', file);

                if (fs.existsSync(localPath)) {
                    const logoBytes = fs.readFileSync(localPath);
                    let logoImage;
                    const ext = localPath.toLowerCase().split('.').pop();
                    if (ext === 'png') {
                        logoImage = await pdfDoc.embedPng(logoBytes);
                    } else if (['jpg', 'jpeg'].includes(ext)) {
                        logoImage = await pdfDoc.embedJpg(logoBytes);
                    }

                    if (logoImage) {
                        const dims = logoImage.scaleToFit(50, 50);
                        page.drawImage(logoImage, {
                            x: 50,
                            y: 735,
                            width: dims.width,
                            height: dims.height,
                        });
                        logoOffset = dims.width + 10;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to embed logo in PDF:', e);
        }
    }

    page.drawText(wName, { x: 50 + logoOffset, y: 750, size: 24, font: bold });
    page.drawText(isBudget ? t('budget') : t('order'), { x: 300, y: 750, size: 14, font: bold, color: rgb(0.2, 0.4, 0.8) });

    page.drawText(`${t('client')}: ${order.client_name || '---'}`, { x: 50, y: 700, size: 12, font });
    page.drawText(`${t('vehicle')}: ${order.brand || ''} ${order.model || ''} (${order.plate || ''})`, { x: 50, y: 680, size: 12, font });
    page.drawText(`${t('date')}: ${order.created_at ? new Date(order.created_at).toLocaleDateString(lang === 'es' ? 'es-AR' : 'en-US') : '---'}`, { x: 350, y: 700, size: 12, font });

    page.drawText(t('detail'), { x: 50, y: 620, size: 12, font: bold });
    if (isBudget) {
        page.drawText(t('qty'), { x: 350, y: 620, size: 12, font: bold });
        page.drawText(t('price'), { x: 420, y: 620, size: 12, font: bold });
        page.drawText(t('subtotal'), { x: 500, y: 620, size: 12, font: bold });
    } else {
        page.drawText(t('labor'), { x: 350, y: 620, size: 12, font: bold });
        page.drawText(t('parts'), { x: 450, y: 620, size: 12, font: bold });
    }

    let y = 600;
    let total = 0;
    items.forEach(item => {
        const desc = (item.description || item.desc || '').substring(0, 45);
        page.drawText(desc, { x: 50, y, size: 10, font });
        if (isBudget) {
            page.drawText(String(item.qty || 1), { x: 350, y, size: 10, font });
            page.drawText(`$${item.price || 0}`, { x: 420, y, size: 10, font });
            page.drawText(`$${item.subtotal || 0}`, { x: 500, y, size: 10, font });
            total += (item.subtotal || 0);
        } else {
            page.drawText(`$${item.labor_price || 0}`, { x: 350, y, size: 10, font });
            page.drawText(`$${item.parts_price || 0}`, { x: 450, y, size: 10, font });
            total += (item.labor_price || 0) + (item.parts_price || 0);
        }
        y -= 20;
    });

    page.drawLine({ start: { x: 50, y: y - 10 }, end: { x: 550, y: y - 10 }, thickness: 1 });

    if (isBudget && budget.tax) {
        page.drawText(`SUBTOTAL: $${budget.subtotal}`, { x: 350, y: y - 30, size: 10, font });
        const taxLabel = lang === 'es' ? 'IVA (21%)' : 'TAX (21%)';
        page.drawText(`${taxLabel}: $${budget.tax}`, { x: 350, y: y - 45, size: 10, font });
        page.drawText(`${t('total')}: $${budget.total}`, { x: 350, y: y - 70, size: 16, font: bold });
    } else {
        page.drawText(`${t('total')}: $${total}`, { x: 350, y: y - 40, size: 14, font: bold });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

async function generateVehicleHistoryPDF(db, vehicleId) {
    const sanitize = (str) => {
        if (str === null || str === undefined) return '';
        // Replace chars that are not in Latin-1 and replace newlines/tabs with spaces
        return String(str).replace(/[^\x00-\xFF]/g, '').replace(/[\n\r\t]+/g, ' ').trim();
    };

    const vehicle = db.prepare(`
        SELECT v.*, c.first_name, c.last_name 
        FROM vehicles v 
        JOIN clients c ON v.client_id = c.id 
        WHERE v.id = ?
    `).get(vehicleId);

    if (!vehicle) return null;

    const orders = db.prepare(`
        SELECT * FROM orders 
        WHERE vehicle_id = ?
        ORDER BY updated_at DESC
    `).all(vehicleId);

    const workshop = db.prepare('SELECT * FROM config LIMIT 1').get() || { workshop_name: 'Taller', client_portal_language: 'es' };
    const lang = workshop.client_portal_language || 'es';

    const translations = {
        es: {
            title: 'HISTORIAL DE MANTENIMIENTO',
            client: 'Cliente',
            vehicle: 'Vehículo',
            plate: 'Patente',
            km: 'Kilometraje',
            date: 'Fecha',
            maintenance: 'Mantenimiento',
            status: 'Estado',
            service: 'Servicio',
            detail_title: 'Detalle de Tareas y Repuestos:',
            labor: 'M.O',
            parts: 'Rep',
            totals: 'TOTALES FACTURADOS',
            notes: 'Notas',
            no_records: 'No hay registros de ordenes para este vehiculo.'
        },
        en: {
            title: 'MAINTENANCE HISTORY',
            client: 'Customer',
            vehicle: 'Vehicle',
            plate: 'Plate',
            km: 'Mileage',
            date: 'Date',
            maintenance: 'Maintenance',
            status: 'Status',
            service: 'Service',
            detail_title: 'Tasks and Parts Detail:',
            labor: 'Labor',
            parts: 'Parts',
            totals: 'BILLED TOTALS',
            notes: 'Notes',
            no_records: 'No order records found for this vehicle.'
        }
    };

    const t = (key) => translations[lang][key] || key;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 620;

    const checkPage = () => {
        if (y < 80) {
            page = pdfDoc.addPage([600, 800]);
            y = 750;
        }
    };

    const wName = sanitize((workshop.workshop_name || 'TALLER').toUpperCase());

    // Draw Logo if exists
    let logoOffset = 0;
    if (workshop.logo_path) {
        try {
            const parts = workshop.logo_path.split('/');
            if (parts.length >= 4 && parts[1] === 'uploads') {
                const slug = parts[2];
                const file = parts.slice(3).join('/');
                const localPath = path.join(__dirname, '..', 'tenants', slug, 'uploads', file);

                if (fs.existsSync(localPath)) {
                    const logoBytes = fs.readFileSync(localPath);
                    let logoImage;
                    const ext = localPath.toLowerCase().split('.').pop();
                    if (ext === 'png') {
                        logoImage = await pdfDoc.embedPng(logoBytes);
                    } else if (['jpg', 'jpeg'].includes(ext)) {
                        logoImage = await pdfDoc.embedJpg(logoBytes);
                    }

                    if (logoImage) {
                        const dims = logoImage.scaleToFit(50, 50);
                        page.drawImage(logoImage, {
                            x: 50,
                            y: 735,
                            width: dims.width,
                            height: dims.height,
                        });
                        logoOffset = dims.width + 10;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to embed logo in PDF:', e);
        }
    }

    page.drawText(wName, { x: 50 + logoOffset, y: 750, size: 24, font: bold });
    page.drawText(t('title'), { x: 300, y: 750, size: 14, font: bold, color: rgb(0.2, 0.4, 0.8) });

    page.drawText(`${t('client')}: ${sanitize(vehicle.first_name)} ${sanitize(vehicle.last_name)}`, { x: 50, y: 700, size: 12, font });
    page.drawText(`${t('vehicle')}: ${sanitize(vehicle.brand)} ${sanitize(vehicle.model)}`, { x: 50, y: 680, size: 12, font });
    page.drawText(`${t('plate')}: ${sanitize(vehicle.plate)} | ${t('km')}: ${sanitize(vehicle.km)}`, { x: 50, y: 660, size: 12, font });

    if (orders.length === 0) {
        page.drawText(t('no_records'), { x: 50, y, size: 10, font });
    } else {
        orders.forEach(order => {
            checkPage();

            // Infer KM at the time of order
            const orderKmQuery = db.prepare(`SELECT km FROM vehicle_km_history WHERE vehicle_id = ? AND recorded_at <= ? ORDER BY recorded_at DESC LIMIT 1`).get(vehicleId, order.updated_at || order.created_at);
            const orderKm = orderKmQuery ? orderKmQuery.km : null;

            const dateStr = order.updated_at ? new Date(order.updated_at).toLocaleDateString(lang === 'es' ? 'es-AR' : 'en-US') : 'N/A';

            page.drawText(`${t('date')}: ${dateStr}`, { x: 50, y, size: 10, font: bold });
            const kmText = orderKm ? ` - ${orderKm} km aprox` : '';
            page.drawText(`${t('maintenance')}${kmText} | ${t('status')}: ${order.status}`, { x: 200, y, size: 10, font: bold });
            y -= 20;
            checkPage();

            const svcDesc = order.description || order.desc || '---';
            page.drawText(`${t('service')}: ${sanitize(svcDesc).substring(0, 100)}`, { x: 50, y, size: 10, font });
            y -= 20;
            checkPage();

            // Fetch pricing and items if status is Entregado
            if (order.status === 'Entregado' || order.status === 'Delivered') {
                const items = db.prepare('SELECT description, labor_price, parts_price FROM order_items WHERE order_id = ?').all(order.id);
                if (items && items.length > 0) {
                    page.drawText(t('detail_title'), { x: 50, y, size: 9, font: bold });
                    y -= 15;
                    checkPage();

                    let totalLabor = 0;
                    let totalParts = 0;
                    items.forEach(i => {
                        const itemDesc = sanitize(i.description || 'Item').substring(0, 70);
                        const labor = i.labor_price || 0;
                        const parts = i.parts_price || 0;

                        page.drawText(`- ${itemDesc}`, { x: 60, y, size: 8, font });
                        page.drawText(`${t('labor')}: $${labor} | ${t('parts')}: $${parts}`, { x: 400, y, size: 8, font });
                        y -= 12;
                        checkPage();

                        totalLabor += labor;
                        totalParts += parts;
                    });

                    if (totalLabor > 0 || totalParts > 0) {
                        page.drawText(`${t('totals')} - ${t('labor')}: $${totalLabor} | ${t('parts')}: $${totalParts}`, { x: 50, y, size: 9, font: bold, color: rgb(0.1, 0.4, 0.1) });
                        y -= 20;
                        checkPage();
                    }
                }
            }

            // Fetch last note if exists
            const lastNote = db.prepare('SELECT notes FROM order_history WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').get(order.id);
            if (lastNote && lastNote.notes) {
                page.drawText(`${t('notes')}: ${sanitize(lastNote.notes).substring(0, 100)}`, { x: 50, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
                y -= 20;
                checkPage();
            }

            page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 550, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
            y -= 15;
        });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

module.exports = { generateOrderPDF, generateVehicleHistoryPDF };
