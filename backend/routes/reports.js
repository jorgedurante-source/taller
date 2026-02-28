const express = require('express');
const router = express.Router();
// db is injected per-request via req.db (tenant middleware)
// Each route reads db from req.db
function getDb(req) { return req.db; }
const { auth, isAdmin, hasPermission } = require('../middleware/auth');
const { generateOrderPDF } = require('../lib/pdfGenerator');

// @route   GET api/reports/budget-pdf/:id
router.get('/budget-pdf/:id', auth, async (req, res) => {
    try {
        const budget = req.db.prepare('SELECT order_id FROM budgets WHERE id = ?').get(req.params.id);
        if (!budget) return res.status(404).send('Budget not found');

        const pdfBuffer = await generateOrderPDF(req.db, budget.order_id);
        if (!pdfBuffer) return res.status(404).send('Error generating PDF');

        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

// @route   GET api/reports/order-pdf/:id
router.get('/order-pdf/:id', auth, async (req, res) => {
    try {
        const pdfBuffer = await generateOrderPDF(req.db, req.params.id);
        if (!pdfBuffer) return res.status(404).send('Order not found');

        res.contentType("application/pdf");
        res.send(pdfBuffer);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error generating PDF');
    }
});

// @route   GET api/reports/dashboard
router.get('/dashboard', auth, hasPermission('dashboard'), (req, res) => {
    try {
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        const includeParts = config.income_include_parts ?? 1;
        const partsPercentageValue = config.parts_profit_percentage ?? 100;
        const partsPercentage = partsPercentageValue / 100.0;

        // 1. Monthly Income Breakdown - based on items for paid/partial orders
        const incomeByMonth = req.db.prepare(`
          SELECT 
            strftime('%Y-%m', o.updated_at) as month,
            SUM(oi.labor_price) as labor_income,
            SUM(oi.parts_price) as parts_price,
            SUM(oi.parts_profit) as parts_profit
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('paid', 'partial')
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        // 1.1 Historical Totals
        const historicalStats = req.db.prepare(`
          SELECT 
            SUM(oi.labor_price) as labor_total,
            SUM(oi.parts_price) as parts_total,
            SUM(oi.parts_profit) as parts_profit_total
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('paid', 'partial')
        `).get();

        // 1.2 Monthly Totals (Current Month)
        const monthlyStats = req.db.prepare(`
          SELECT 
            SUM(oi.labor_price) as labor_total,
            SUM(oi.parts_price) as parts_total,
            SUM(oi.parts_profit) as parts_profit_total
          FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE o.payment_status IN ('paid', 'partial')
          AND strftime('%Y-%m', o.updated_at) = strftime('%Y-%m', 'now')
        `).get();

        // If no income data, provide at least the current month
        if (incomeByMonth.length === 0) {
            const now = new Date();
            const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            incomeByMonth.push({ month: localMonth, labor_income: 0, parts_price: 0 });
        }

        // 2. Orders by Status
        const ordersByStatus = req.db.prepare(`
          SELECT status, COUNT(*) as count
          FROM orders
          GROUP BY status
        `).all();

        const readyToDeliverTotal = req.db.prepare(`
            SELECT SUM(oi.labor_price + (CASE WHEN ? = 1 THEN oi.parts_profit ELSE 0 END)) as total
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status = 'ready'
        `).get(includeParts).total || 0;

        const commonServices = req.db.prepare(`
          SELECT description, COUNT(*) as count
          FROM orders
          GROUP BY description
          ORDER BY count DESC
          LIMIT 5
        `).all();

        const vehiclesByMonth = req.db.prepare(`
          SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count
          FROM vehicles
          GROUP BY month
          ORDER BY month DESC
          LIMIT 12
        `).all();

        const newClientsThisMonth = req.db.prepare(`
          SELECT COUNT(*) as count 
          FROM clients 
          WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `).get().count;

        const assignedAppointmentsCount = req.db.prepare(`
          SELECT COUNT(*) as count FROM orders WHERE status = 'appointment'
        `).get().count;

        const unreadMessagesCount = req.db.prepare(`
            SELECT COUNT(*) as count 
            FROM order_history 
            WHERE status = 'response_received' AND (is_read = 0 OR is_read IS NULL)
        `).get().count;

        res.json({
            incomeByMonth,
            historicalStats,
            monthlyStats,
            parts_profit_percentage: partsPercentageValue,
            ordersByStatus,
            commonServices,
            vehiclesByMonth,
            newClientsThisMonth,
            readyToDeliverTotal,
            assignedAppointmentsCount,
            unreadMessagesCount
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/reports/income-daily
router.get('/income-daily', auth, hasPermission('income'), (req, res) => {
    const { month } = req.query; // YYYY-MM

    // Use local date to avoid UTC timezone month shift
    const now = new Date();
    const localMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonth = month || localMonth;

    try {
        const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();
        const partsPercentage = (config.parts_profit_percentage ?? 100) / 100.0;

        // Separate income into labor and parts profit
        const dailyIncome = req.db.prepare(`
            SELECT 
                strftime('%d', o.updated_at) as day,
                SUM(oi.labor_price) as labor_income,
                SUM(oi.parts_profit) as parts_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.payment_status IN ('paid', 'partial')
            AND strftime('%Y-%m', o.updated_at) = ?
            GROUP BY day
            ORDER BY day ASC
        `).all(currentMonth);

        res.json(dailyIncome);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/reports/orders-status
router.get('/orders-status', auth, hasPermission('income'), (req, res) => {
    try {
        const ordersByStatus = req.db.prepare(`
            SELECT status, COUNT(*) as count
            FROM orders
            GROUP BY status
        `).all();
        res.json(ordersByStatus);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/reports/top-customers
router.get('/top-customers', auth, hasPermission('income'), (req, res) => {
    try {
        const topCustomers = req.db.prepare(`
            SELECT c.first_name || ' ' || c.last_name AS name, SUM(o.payment_amount) as total
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            GROUP BY c.id
            ORDER BY total DESC
            LIMIT 5
        `).all();
        res.json(topCustomers);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});


// @route   GET api/reports/reminders
router.get('/reminders', auth, hasPermission('reminders'), (req, res) => {
    const tab = req.query.tab || 'today';
    try {
        let whereClause = "WHERE o.reminder_at IS NOT NULL AND o.status = 'delivered'";
        const todayStr = "date('now', 'localtime')";
        const tomorrowStr = "date('now', '+1 day', 'localtime')";
        const lastWeekStr = "date('now', '-7 days', 'localtime')";

        const dayOfWeek = new Date().getDay(); // 0 = Sun

        switch (tab) {
            case 'today':
                // Today + Sunday if it's Monday
                if (dayOfWeek === 1) { // Monday
                    whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) <= ${todayStr}`;
                } else {
                    whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) = ${todayStr}`;
                }
                break;
            case 'upcoming':
                whereClause += ` AND o.reminder_status = 'pending' AND date(o.reminder_at) > ${todayStr}`;
                break;
            case 'skipped':
                whereClause += " AND o.reminder_status = 'skipped'";
                break;
            case 'sent':
                whereClause += ` AND o.reminder_status = 'sent' AND date(o.reminder_sent_at) >= ${lastWeekStr}`;
                break;
            case 'history': // Backward compatibility
                whereClause += ` AND (o.reminder_status = 'sent' OR o.reminder_at < ${todayStr})`;
                break;
        }

        const reminders = req.db.prepare(`
            SELECT o.id as order_id, o.reminder_at, o.status, o.reminder_status, o.reminder_sent_at,
                   c.first_name || ' ' || c.last_name as client_name, c.phone as client_phone,
                   v.plate, v.brand, v.model, v.km as vehicle_km,
                   (SELECT GROUP_CONCAT(description, ', ') FROM order_items WHERE order_id = o.id) as services_done
            FROM orders o
            JOIN clients c ON o.client_id = c.id
            JOIN vehicles v ON o.vehicle_id = v.id
            ${whereClause}
            ORDER BY o.reminder_at ASC
        `).all();
        res.json(reminders);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   PATCH api/reports/reminders/:orderId/date
router.patch('/reminders/:orderId/date', auth, hasPermission('reminders'), (req, res) => {
    const { date } = req.body;
    try {
        req.db.prepare('UPDATE orders SET reminder_at = ? WHERE id = ?').run(
            date,
            req.params.orderId
        );
        res.json({ message: 'Fecha de recordatorio actualizada' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating date');
    }
});

// @route   POST api/reports/reminders/send-bulk
router.post('/reminders/send-bulk', auth, hasPermission('reminders'), async (req, res) => {
    const { orderIds } = req.body;
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ message: 'No order IDs provided' });
    }

    const { sendOrderReminder } = require('../lib/reminderUtils');
    const config = req.db.prepare('SELECT * FROM config LIMIT 1').get();

    let sentCount = 0;
    let errors = [];

    for (const id of orderIds) {
        try {
            await sendOrderReminder(req.db, id, req.slug, config);
            sentCount++;
        } catch (err) {
            console.error(`Error sending bulk reminder for #${id}:`, err.message);
            errors.push({ id, message: err.message });
        }
    }

    res.json({
        message: `Se enviaron ${sentCount} recordatorios correctamente`,
        sentCount,
        errors
    });
});

// @route   GET api/reports/analytics
router.get('/analytics', auth, hasPermission('reports'), (req, res) => {
    try {
        const db = getDb(req);

        const errors = [];

        const leadTimes = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        strftime('%Y-%m', created_at) as month,
                        ROUND(AVG(JULIANDAY(delivered_at) - JULIANDAY(created_at)), 1) as avg_days
                    FROM orders
                    WHERE delivered_at IS NOT NULL
                    GROUP BY month
                    ORDER BY month ASC
                `).all();
            } catch (e) {
                console.error('Error in leadTimes:', e);
                errors.push('leadTimes');
                return [];
            }
        })();

        const partsLaborData = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        SUM(oi.labor_price) as total_labor,
                        SUM(oi.parts_price) as total_parts,
                        SUM(oi.parts_profit) as total_parts_profit
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.payment_status = 'paid'
                `).get();
            } catch (e) {
                console.error('Error in partsLaborData:', e);
                errors.push('profitBreakdown');
                return { total_labor: 0, total_parts: 0, total_parts_profit: 0 };
            }
        })();

        const retentionStats = (() => {
            try {
                const results = db.prepare(`SELECT client_id, COUNT(*) as order_count FROM orders GROUP BY client_id`).all();
                let nc = 0, rc = 0;
                results.forEach(r => {
                    if (r.order_count === 1) nc++;
                    else if (r.order_count > 1) rc++;
                });
                return { newCount: nc, recurringCount: rc };
            } catch (e) {
                console.error('Error in retentionStats:', e);
                errors.push('retention');
                return { newCount: 0, recurringCount: 0 };
            }
        })();

        const rankings = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        COALESCE(u.first_name || ' ' || u.last_name, u.username) as name,
                        COUNT(o.id) as completed_orders
                    FROM orders o
                    JOIN users u ON o.created_by_id = u.id
                    WHERE o.status = 'delivered'
                    GROUP BY u.id
                    ORDER BY completed_orders DESC
                    LIMIT 5
                `).all();
            } catch (e) {
                console.error('Error in rankings:', e);
                errors.push('rankings');
                return [];
            }
        })();

        const brands = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        v.brand as name,
                        COUNT(DISTINCT o.id) as volume,
                        SUM(oi.labor_price) as labor_income,
                        SUM(oi.parts_profit) as parts_profit,
                        SUM(oi.labor_price + oi.parts_profit) as income
                    FROM orders o
                    JOIN vehicles v ON o.vehicle_id = v.id
                    JOIN order_items oi ON o.id = oi.order_id
                    WHERE o.payment_status = 'paid'
                    GROUP BY v.brand
                    ORDER BY income DESC
                    LIMIT 10
                `).all();
            } catch (e) {
                console.error('Error in brands:', e);
                errors.push('brands');
                return [];
            }
        })();

        const loyalty = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        (c.first_name || ' ' || c.last_name) as name,
                        COUNT(o.id) as visits,
                        SUM(CASE WHEN o.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_visits
                    FROM clients c
                    JOIN orders o ON c.id = o.client_id
                    GROUP BY c.id
                    ORDER BY visits DESC
                    LIMIT 10
                `).all();
            } catch (e) {
                console.error('Error in loyalty:', e);
                errors.push('loyalty');
                return [];
            }
        })();

        const topServices = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        description as name, 
                        COUNT(*) as frequency,
                        SUM(labor_price) as labor_income
                    FROM order_items
                    GROUP BY description
                    ORDER BY labor_income DESC
                    LIMIT 10
                `).all();
            } catch (e) {
                console.error('Error in topServices:', e);
                errors.push('topServices');
                return [];
            }
        })();

        const config = db.prepare('SELECT * FROM config LIMIT 1').get();
        const partsPercentage = (config?.parts_profit_percentage ?? 100) / 100.0;

        const incomeByMonth = (() => {
            try {
                return db.prepare(`
                    SELECT 
                        strftime('%Y-%m', o.updated_at) as month,
                        SUM(oi.labor_price) as labor_income,
                        SUM(oi.parts_profit) as parts_profit
                    FROM orders o
                    JOIN order_items oi ON o.id = oi.order_id
                    WHERE o.payment_status IN ('paid', 'partial')
                    GROUP BY month
                    ORDER BY month ASC
                    LIMIT 12
                `).all();
            } catch (e) {
                console.error('Error in incomeByMonth:', e);
                errors.push('incomeByMonth');
                return [];
            }
        })();

        res.json({
            leadTimes,
            incomeByMonth,
            profitBreakdown: [
                { name: 'Mano de Obra', value: partsLaborData.total_labor || 0 },
                { name: 'Repuestos (Costo)', value: partsLaborData.total_parts || 0 },
                { name: 'Repuestos (Ganancia)', value: partsLaborData.total_parts_profit || 0 }
            ],
            retention: [
                { name: 'Nuevos (1 orden)', value: retentionStats.newCount },
                { name: 'Recurrentes (>1 orden)', value: retentionStats.recurringCount }
            ],
            rankings,
            brands,
            loyalty,
            topServices,
            errors
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error on reports data' });
    }
});

const ExcelJS = require('exceljs');

// @route   POST api/reports/export-excel
router.post('/export-excel', auth, hasPermission('reports'), async (req, res) => {
    try {
        const db = getDb(req);
        const { type, startDate, endDate } = req.body;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte');

        let query = '';
        let params = [];
        if (type === 'orders') {
            let filter = '';
            if (startDate && endDate) {
                filter = ` AND DATE(o.created_at) BETWEEN ? AND ? `;
                params.push(startDate, endDate);
            }
            query = `
                SELECT 
                    o.id as ID, 
                    (c.first_name || ' ' || c.last_name) as Cliente,
                    v.plate as Patente,
                    v.brand as Marca,
                    v.model as Modelo,
                    v.version as Version,
                    o.status as Estado,
                    o.payment_status as Pago,
                    o.created_at as Fecha
                FROM orders o
                JOIN clients c ON o.client_id = c.id
                JOIN vehicles v ON o.vehicle_id = v.id
                WHERE 1=1 ${filter}
                ORDER BY o.id DESC
            `;
            worksheet.columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Cliente', key: 'Cliente', width: 30 },
                { header: 'Patente', key: 'Patente', width: 15 },
                { header: 'Marca', key: 'Marca', width: 20 },
                { header: 'Modelo', key: 'Modelo', width: 20 },
                { header: 'Versión', key: 'Version', width: 20 },
                { header: 'Estado', key: 'Estado', width: 15 },
                { header: 'Pago', key: 'Pago', width: 15 },
                { header: 'Fecha', key: 'Fecha', width: 20 }
            ];
        } else if (type === 'clients') {
            let filter = '';
            if (startDate && endDate) {
                filter = ` WHERE DATE(created_at) BETWEEN ? AND ? `;
                params.push(startDate, endDate);
            }
            query = `SELECT id as ID, first_name as Nombre, last_name as Apellido, phone as Telefono, email as Email FROM clients ${filter} ORDER BY id DESC`;
            worksheet.columns = [
                { header: 'ID', key: 'ID', width: 10 },
                { header: 'Nombre', key: 'Nombre', width: 20 },
                { header: 'Apellido', key: 'Apellido', width: 20 },
                { header: 'Teléfono', key: 'Telefono', width: 20 },
                { header: 'Email', key: 'Email', width: 30 }
            ];
        } else {
            // Default: Income/Services
            let filter = '';
            if (startDate && endDate) {
                filter = ` AND DATE(o.created_at) BETWEEN ? AND ? `;
                params.push(startDate, endDate);
            }
            query = `
                SELECT 
                    o.id as OrderID,
                    oi.description as Servicio,
                    oi.labor_price as ManoDeObra,
                    oi.parts_price as Repuestos,
                    oi.subtotal as Total,
                    o.created_at as Fecha
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.payment_status = 'paid' ${filter}
                ORDER BY o.created_at DESC
            `;
            worksheet.columns = [
                { header: 'ID Orden', key: 'OrderID', width: 10 },
                { header: 'Servicio', key: 'Servicio', width: 40 },
                { header: 'Mano de Obra', key: 'ManoDeObra', width: 15 },
                { header: 'Repuestos', key: 'Repuestos', width: 15 },
                { header: 'Total', key: 'Total', width: 15 },
                { header: 'Fecha', key: 'Fecha', width: 20 }
            ];
        }

        const rows = db.prepare(query).all(params);
        worksheet.addRows(rows);

        // Styling
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=reporte_${type}_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error al exportar Excel' });
    }
});

// @route   GET api/reports/vehicle-filters
router.get('/vehicle-filters', auth, (req, res) => {
    try {
        const db = getDb(req);
        const brands = db.prepare('SELECT DISTINCT brand FROM vehicles WHERE brand IS NOT NULL ORDER BY brand ASC').all();
        const models = db.prepare('SELECT DISTINCT brand, model FROM vehicles WHERE model IS NOT NULL ORDER BY model ASC').all();
        const versions = db.prepare('SELECT DISTINCT brand, model, version FROM vehicles WHERE version IS NOT NULL ORDER BY version ASC').all();
        res.json({ brands, models, versions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching vehicle filters' });
    }
});

// @route   GET api/reports/vehicle-stats
router.get('/vehicle-stats', auth, (req, res) => {
    const { brand, model, version } = req.query;
    try {
        const db = getDb(req);

        // 1. Lo que más se rompió (Top Defects/Services)
        let defectsQuery = `
            SELECT 
                oi.description as name, 
                COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];
        if (brand) { defectsQuery += ` AND v.brand = ? `; params.push(brand); }
        if (model) { defectsQuery += ` AND v.model = ? `; params.push(model); }
        if (version) { defectsQuery += ` AND v.version = ? `; params.push(version); }
        defectsQuery += ` GROUP BY name ORDER BY count DESC LIMIT 10`;
        const topDefects = db.prepare(defectsQuery).all(params);

        // 2. Distribución por año
        let ageQuery = `
            SELECT 
                year as name, 
                COUNT(*) as value
            FROM vehicles 
            WHERE year IS NOT NULL
        `;
        const ageParams = [];
        if (brand) { ageQuery += ` AND brand = ? `; ageParams.push(brand); }
        if (model) { ageQuery += ` AND model = ? `; ageParams.push(model); }
        if (version) { ageQuery += ` AND version = ? `; ageParams.push(version); }
        ageQuery += ` GROUP BY year ORDER BY year DESC LIMIT 15`;
        const ageDistribution = db.prepare(ageQuery).all(ageParams);

        // 3. Frecuencia de visitas (KM promedio entre entradas al taller)
        let visitIntervalsQuery = `
            WITH deltas AS (
                SELECT 
                    vehicle_id,
                    vh.km - LAG(vh.km) OVER (PARTITION BY vehicle_id ORDER BY recorded_at ASC) as diff
                FROM vehicle_km_history vh
                JOIN vehicles v ON vh.vehicle_id = v.id
                WHERE 1=1
        `;
        const vParams = [];
        if (brand) { visitIntervalsQuery += ` AND v.brand = ? `; vParams.push(brand); }
        if (model) { visitIntervalsQuery += ` AND v.model = ? `; vParams.push(model); }
        if (version) { visitIntervalsQuery += ` AND v.version = ? `; vParams.push(version); }

        visitIntervalsQuery += `
            )
            SELECT 
                CAST(AVG(diff) AS INTEGER) as avg_interval,
                COUNT(*) as sample_size
            FROM deltas WHERE diff > 0
        `;
        const visitStats = db.prepare(visitIntervalsQuery).get(vParams);

        // 3a. Intensidad de visitas por Kilometraje Absoluto
        let intensityQuery = `
            SELECT 
                CAST(vh.km / 10000 AS INTEGER) * 10 as bin,
                COUNT(*) as value
            FROM vehicle_km_history vh
            JOIN vehicles v ON vh.vehicle_id = v.id
            WHERE 1=1
        `;
        const distParams = [];
        if (brand) { intensityQuery += ` AND v.brand = ? `; distParams.push(brand); }
        if (model) { intensityQuery += ` AND v.model = ? `; distParams.push(model); }
        if (version) { intensityQuery += ` AND v.version = ? `; distParams.push(version); }

        intensityQuery += `
            GROUP BY bin
            ORDER BY bin ASC
        `;
        const visitDistribution = db.prepare(intensityQuery).all(distParams).map(row => ({
            name: `${row.bin}k`,
            value: row.value
        }));

        // 3b. Comparativa por marcas (KM promedio entre visitas)
        const brandIntervals = db.prepare(`
            WITH deltas AS (
                SELECT 
                    v.brand,
                    vh.km - LAG(vh.km) OVER (PARTITION BY vh.vehicle_id ORDER BY vh.recorded_at ASC) as diff
                FROM vehicle_km_history vh
                JOIN vehicles v ON vh.vehicle_id = v.id
            )
            SELECT brand as name, CAST(AVG(diff) AS INTEGER) as value
            FROM deltas 
            WHERE diff > 0
            GROUP BY name
            ORDER BY value ASC
            LIMIT 10
        `).all();

        // 4. Qué se rompe según kilometraje
        let kmDefectsQuery = `
            SELECT 
                CASE 
                    WHEN v.km <= 30000 THEN '0-30k'
                    WHEN v.km <= 60000 THEN '30-60k'
                    WHEN v.km <= 100000 THEN '60-100k'
                    WHEN v.km <= 150000 THEN '100-150k'
                    ELSE '150k+' 
                END AS km_range,
                oi.description as defect,
                COUNT(*) as count
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN vehicles v ON o.vehicle_id = v.id
            WHERE 1=1
        `;
        const kmDefectsParams = [];
        if (brand) { kmDefectsQuery += ` AND v.brand = ? `; kmDefectsParams.push(brand); }
        if (model) { kmDefectsQuery += ` AND v.model = ? `; kmDefectsParams.push(model); }
        if (version) { kmDefectsQuery += ` AND v.version = ? `; kmDefectsParams.push(version); }
        kmDefectsQuery += ` 
            GROUP BY km_range, defect 
            HAVING count > 0
            ORDER BY count DESC 
            LIMIT 50
        `;
        const kmDefectsRaw = db.prepare(kmDefectsQuery).all(kmDefectsParams);

        // Pivot/Group defects by range for better UI consumption
        const kmDefects = {};
        kmDefectsRaw.forEach(r => {
            if (!kmDefects[r.km_range]) kmDefects[r.km_range] = [];
            if (kmDefects[r.km_range].length < 3) {
                kmDefects[r.km_range].push({ defect: r.defect, count: r.count });
            }
        });

        res.json({ topDefects, ageDistribution, visitStats, visitDistribution, brandIntervals, kmDefects });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching vehicle analytics' });
    }
});

// @route   GET api/reports/debt
router.get('/debt', auth, hasPermission('reports'), (req, res) => {
    try {
        const db = getDb(req);

        const clientsWithDebt = db.prepare(`
            SELECT 
                c.id,
                (c.first_name || ' ' || c.last_name) as name,
                COUNT(o.id) as orders_count,
                SUM(ot.total) as total_amount,
                SUM(o.payment_amount) as paid_amount,
                SUM(ot.total - o.payment_amount) as outstanding
            FROM clients c
            JOIN orders o ON c.id = o.client_id
            JOIN (
                SELECT order_id, SUM(subtotal) as total 
                FROM order_items 
                GROUP BY order_id
            ) ot ON o.id = ot.order_id
            WHERE o.payment_status IN ('pending', 'partial')
            GROUP BY c.id
            HAVING outstanding > 0
            ORDER BY outstanding DESC
        `).all();

        const summary = db.prepare(`
            SELECT 
                SUM(ot.total - o.payment_amount) as total_outstanding,
                COUNT(DISTINCT o.client_id) as clients_with_debt,
                COUNT(o.id) as orders_with_debt
            FROM orders o
            JOIN (
                SELECT order_id, SUM(subtotal) as total 
                FROM order_items 
                GROUP BY order_id
            ) ot ON o.id = ot.order_id
            WHERE o.payment_status IN ('pending', 'partial')
            AND (ot.total - o.payment_amount) > 0
        `).get();

        res.json({ clients: clientsWithDebt, summary });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching debt data' });
    }
});

// @route   GET api/reports/productivity
router.get('/productivity', auth, hasPermission('reports'), (req, res) => {
    try {
        const db = getDb(req);

        // Productividad por día de la semana
        const byWeekdayRaw = db.prepare(`
            SELECT 
                strftime('%w', created_at) as weekday,
                COUNT(*) as opened,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as closed
            FROM orders
            WHERE created_at >= date('now', '-3 months')
            GROUP BY weekday
        `).all();

        const weekMap = { '0': 'Dom', '1': 'Lun', '2': 'Mar', '3': 'Mie', '4': 'Jue', '5': 'Vie', '6': 'Sab' };
        const byWeekday = Object.keys(weekMap).map(w => {
            const match = byWeekdayRaw.find(r => r.weekday === w);
            return {
                day: weekMap[w],
                opened: match ? match.opened : 0,
                closed: match ? match.closed : 0
            };
        });

        const busiestDay = byWeekday.reduce((prev, current) => (prev.opened > current.opened) ? prev : current).day;

        // Órdenes por hora del día
        const byHour = db.prepare(`
            SELECT 
                strftime('%H', created_at) as hour,
                COUNT(*) as count
            FROM orders
            WHERE created_at >= date('now', '-6 months')
            GROUP BY hour
            ORDER BY hour ASC
        `).all();

        res.json({ byWeekday, byHour, busiestDay });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching productivity data' });
    }
});

// @route   GET api/reports/service-duration
router.get('/service-duration', auth, hasPermission('reports'), (req, res) => {
    try {
        const db = getDb(req);

        const byService = db.prepare(`
            SELECT 
                oi.description as name,
                ROUND(AVG(JULIANDAY(o.delivered_at) - JULIANDAY(o.created_at)), 1) as avg_days
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.delivered_at IS NOT NULL
            GROUP BY name
            HAVING COUNT(*) > 2
            ORDER BY avg_days DESC
            LIMIT 15
        `).all();

        const overall = db.prepare(`
            SELECT ROUND(AVG(JULIANDAY(delivered_at) - JULIANDAY(created_at)), 1) as avg_days
            FROM orders
            WHERE delivered_at IS NOT NULL
        `).get();

        res.json({ byService, overallAvgDays: overall.avg_days || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching service duration data' });
    }
});

// @route   GET api/reports/yoy
router.get('/yoy', auth, hasPermission('reports'), (req, res) => {
    try {
        const db = getDb(req);

        const currentYear = db.prepare(`
            SELECT 
                strftime('%m', o.updated_at) as month,
                SUM(oi.subtotal) as income
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.payment_status = 'paid'
            AND strftime('%Y', o.updated_at) = strftime('%Y', 'now')
            GROUP BY month
        `).all();

        const prevYear = db.prepare(`
            SELECT 
                strftime('%m', o.updated_at) as month,
                SUM(oi.subtotal) as income
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.payment_status = 'paid'
            AND strftime('%Y', o.updated_at) = strftime('%Y', 'now', '-1 year')
            GROUP BY month
        `).all();

        const monthMap = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' };

        const comparison = Object.keys(monthMap).map(m => {
            const current = currentYear.find(r => r.month === m);
            const prev = prevYear.find(r => r.month === m);
            return {
                month: monthMap[m],
                current_income: current ? current.income : 0,
                prev_income: prev ? prev.income : 0
            };
        });

        const totalCurrent = currentYear.reduce((acc, curr) => acc + curr.income, 0);
        const totalPrev = prevYear.reduce((acc, curr) => acc + curr.income, 0);
        let totalPctChange = 0;
        if (totalPrev > 0) {
            totalPctChange = Math.round(((totalCurrent - totalPrev) / totalPrev) * 100);
        }

        res.json({ comparison, totalPctChange });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching YOY data' });
    }
});

module.exports = router;
