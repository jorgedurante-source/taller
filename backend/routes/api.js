const express = require('express');
const router = express.Router();
const { PDFDocument, rgb } = require('pdf-lib');
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth } = require('../middleware/auth');

// @route   GET api/orders/:id/pdf
router.get('/:id/pdf', auth, async (req, res) => {
    try {
        const budget = req.db.prepare('SELECT * FROM budgets WHERE order_id = ?').get(req.params.id);
        if (!budget) return res.status(404).json({ message: 'Budget not found' });

        const order = req.db.prepare(`
      SELECT o.*, c.name as client_name, v.plate, v.model
      FROM orders o
      JOIN clients c ON o.client_id = c.id
      JOIN vehicles v ON o.vehicle_id = v.id
      WHERE o.id = ?
    `).get(req.params.id);

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);
        const { width, height } = page.getSize();
        const fontSize = 12;

        page.drawText('PRESUPUESTO - MechHub', { x: 50, y: height - 50, size: 20 });
        page.drawText(`Orden #${order.id}`, { x: 50, y: height - 80, size: 15 });
        page.drawText(`Cliente: ${order.client_name}`, { x: 50, y: height - 110, size: fontSize });
        page.drawText(`Vehículo: ${order.model} (${order.plate})`, { x: 50, y: height - 130, size: fontSize });

        let y = height - 170;
        const items = JSON.parse(budget.items);
        page.drawText('Descripción', { x: 50, y, size: fontSize });
        page.drawText('Cant', { x: 400, y, size: fontSize });
        page.drawText('Precio', { x: 450, y, size: fontSize });
        page.drawText('Subtotal', { x: 520, y, size: fontSize });

        y -= 20;
        items.forEach(item => {
            page.drawText(item.desc, { x: 50, y, size: 10 });
            page.drawText(String(item.qty), { x: 400, y, size: 10 });
            page.drawText(`$${item.price}`, { x: 450, y, size: 10 });
            page.drawText(`$${item.subtotal}`, { x: 520, y, size: 10 });
            y -= 15;
        });

        y -= 20;
        page.drawText(`Subtotal: $${budget.subtotal}`, { x: 450, y, size: fontSize });
        y -= 15;
        page.drawText(`IVA (21%): $${budget.tax}`, { x: 450, y, size: fontSize });
        y -= 20;
        page.drawText(`TOTAL: $${budget.total}`, { x: 450, y, size: 18, color: rgb(0, 0, 0) });

        const pdfBytes = await pdfDoc.save();
        res.contentType('application/pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

// @route   POST api/webhook
// Simple webhook for future mobile app
router.post('/webhook', (req, res) => {
    const { event, data } = req.body;
    console.log('WEBHOOK RECEIVED:', event, data);
    res.json({ status: 'received' });
});

module.exports = router;
