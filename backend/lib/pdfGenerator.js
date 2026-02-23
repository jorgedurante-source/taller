const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

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

    const workshop = db.prepare('SELECT * FROM config LIMIT 1').get() || { workshop_name: 'Taller' };

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const wName = (workshop.workshop_name || 'TALLER').toUpperCase();
    page.drawText(wName, { x: 50, y: 750, size: 24, font: bold });
    page.drawText(isBudget ? 'PRESUPUESTO DE SERVICIO' : 'ORDEN DE TRABAJO', { x: 300, y: 750, size: 14, font: bold, color: rgb(0.2, 0.4, 0.8) });

    page.drawText(`Cliente: ${order.client_name || 'Cliente'}`, { x: 50, y: 700, size: 12, font });
    page.drawText(`Vehículo: ${order.brand || ''} ${order.model || ''} (${order.plate || ''})`, { x: 50, y: 680, size: 12, font });
    page.drawText(`Fecha: ${order.created_at ? new Date(order.created_at).toLocaleDateString() : '---'}`, { x: 350, y: 700, size: 12, font });

    page.drawText('Detalle', { x: 50, y: 620, size: 12, font: bold });
    if (isBudget) {
        page.drawText('Cant', { x: 350, y: 620, size: 12, font: bold });
        page.drawText('Precio', { x: 420, y: 620, size: 12, font: bold });
        page.drawText('Subtotal', { x: 500, y: 620, size: 12, font: bold });
    } else {
        page.drawText('Mano de Obra', { x: 350, y: 620, size: 12, font: bold });
        page.drawText('Repuestos', { x: 450, y: 620, size: 12, font: bold });
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
        page.drawText(`IVA (21%): $${budget.tax}`, { x: 350, y: y - 45, size: 10, font });
        page.drawText(`TOTAL: $${budget.total}`, { x: 350, y: y - 70, size: 16, font: bold });
    } else {
        page.drawText(`TOTAL: $${total}`, { x: 350, y: y - 40, size: 14, font: bold });
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

module.exports = { generateOrderPDF };
