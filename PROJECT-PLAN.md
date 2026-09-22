# แผนงาน: P2S Inventory — ระบบจัดหาสินค้า–เบิกจ่าย–เข้าคลัง (Procure-to-Stock)

> เอกสารนี้สรุปสิ่งที่คุยกันไว้ทั้งหมด เพื่อใช้เริ่มสร้างโปรเจกต์ใหม่แยกจาก EA (แต่ทำตามแบบแผนโครงสร้าง/สแตกเดียวกัน)
> ชื่อโปรเจกต์: **P2S Inventory** (Procure-to-Stock / Pay-to-Stock), โฟลเดอร์/repo: `D:\GitSource\P2SInventory`

## 1. Requirement เดิม (สรุปจากผู้ใช้)

1. พนักงานกดสั่งของผ่านแอพ Shopee (SP), TikTok Shop (TT), Amazon/Lazada (AM) **ด้วยเงิน/บัตรของตัวเอง เพื่อเอาส่วนลด** — ซื้อมาเพื่อ**ขายต่อ** ไม่ใช่ของใช้ในบริษัท
2. กดสั่งจะใช้บัตรเครดิต/เงินของคนกดก่อน แล้วไปเบิกเงินบริษัทมาจ่ายค่าสินค้าทีหลัง (ปิดยอดที่สำรองจ่ายไป)
3. ต้องติดตามว่าของที่สั่งอันไหนมาส่งแล้ว อันไหนยังไม่มา
4. มีเคสที่จ่ายเงิน+เบิกเงินไปแล้ว แต่ร้านมายกเลิกออเดอร์ทีหลัง → ต้องจัดการคืน/หักยอด
5. ต้องดูได้ว่าสั่งอะไร จำนวนเท่าไหร่ วันไหน เวลาไหน
6. สต๊อก/ยอดการเงินต้องอัพเดททุกวัน
7. ของที่มาส่งต้องยิงเข้าระบบได้ ทั้งที่ใช้โทรศัพท์หลายรุ่น สินค้าหลายแบบ (ต้องไม่ผูกกับอุปกรณ์)
8. **ของที่รับแล้ว → เข้าระบบ Inventory เพื่อเตรียมขายต่อ**; ของที่ยกเลิก/ไม่มาส่ง → **ไม่เข้าคลัง** แต่ต้อง update status ในระบบ (ไม่ลบทิ้ง เก็บ audit trail)
9. **ขอบเขตระบบนี้จบที่ "เข้าคลัง/เบิกออกจากคลัง"** — กระบวนการเบิกเงิน (reimbursement) เป็นแทร็กแยกที่ผูกกับ order/cancellation เท่านั้น
10. ของเข้าคลัง (inventory) เป็น **auto** ทันทีที่ confirm ว่าได้รับของแล้ว (ไม่ต้องกดสร้างซ้ำ) และระบบต้องมี**ฟังก์ชันเบิกของออกจากคลัง** (stock withdrawal) — ส่วนการขายจริง/บันทึกยอดขายเป็นคนละระบบ แต่ "เบิกออก" (ลด qty คงเหลือ พร้อมเหตุผล/ผู้เบิก) อยู่ในสโคปนี้

## 2. Data Model (สรุป)

### 2.1 Authentication & Master Data

- **users** — ผู้ใช้งานระบบ: `username` (login, **ไม่ใช้ email**), `password_hash`, `full_name`, `role` (staff/finance/admin), `is_active`, เลขบัตรท้าย 4 หลัก (สำหรับ staff ที่กดสั่งของ)
  - Login ด้วย username + password เท่านั้น — ไม่มี field email เป็น identifier, ไม่มี email verification/reset flow
  - Session: JWT (ตาม pattern เดียวกับ EA ถ้ามี) หรือ cookie-based ก็ได้ พิจารณาตอน scaffold backend
- **roles** — master data สิทธิ์การเข้าถึง (staff กดสั่งของ/สแกนรับของ, finance อนุมัติเบิก, admin จัดการ master data ทั้งหมด)
- **platforms** — master data enum/table SP / TT / AM (เผื่อเพิ่ม platform ใหม่ในอนาคตโดยไม่ต้อง deploy code ใหม่ — ทำเป็นตาราง ไม่ hardcode enum)
- **withdrawal_reasons** — master data เหตุผลการเบิกออกจากคลัง (ขาย/ชำรุด/โอนย้าย/อื่นๆ) ให้ admin แก้ไขได้

### 2.2 Transaction Tables

- **purchase_orders** — 1 record ต่อ 1 ครั้งกดสั่ง (platform, เลขออเดอร์จากแอพ, ยอดเงิน, สถานะ)
  - status: `ordered → paid_by_staff → reimbursed` (จบที่นี่ — สถานะของว่ามาส่งหรือยังอยู่ระดับ order_item)
- **order_items** — แตกรายชิ้นในออเดอร์เดียว (เพราะของมาไม่พร้อมกัน)
  - item_status: `pending → arrived` (ไปต่อ inventory_items) หรือ `cancelled` (ไม่เข้าคลัง แต่คง record ไว้)
- **reimbursements** — คำขอเบิกเงินสด ผูกกับหลาย purchase_orders, สถานะ pending/approved/paid
  - **เป็นแทร็กแยกจากการเข้าคลังโดยสมบูรณ์** — ผูกกับ purchase_order/cancellation เท่านั้น ไม่ผูกกับ inventory
- **deliveries** — บันทึกการรับของจริง ผูก QR code ที่ระบบ generate เอง (ไม่พึ่งบาร์โค้ดร้าน กันปัญหาโทรศัพท์หลายรุ่น)
- **inventory_items** — **auto สร้างทันทีที่ order_item ถูก confirm ว่า arrived** (ไม่ต้องมีคนกดสร้างซ้ำ): sku_name, qty_received, qty_on_hand (ลดลงเมื่อมีการเบิกออก), cost_per_unit (= ราคาที่จ่ายจริงต่อชิ้น, ไว้คิดต้นทุน), received_at, status (`in_stock` / `depleted` เมื่อ qty_on_hand=0)
- **inventory_withdrawals** — ฟังก์ชันเบิกของออกจากคลัง: inventory_item_id, qty, withdrawn_by, withdrawn_at, reason (เช่น "ขาย", "ชำรุด", "โอนย้าย") — บันทึกทุกครั้งที่เบิกออก, ตัด qty_on_hand ของ inventory_item ที่ผูกอยู่ (ส่วนระบบขาย/POS จริงเป็นคนละระบบ แค่เรียกฟังก์ชันนี้เพื่อตัดสต๊อก)
- **cancellations** — เคสร้านยกเลิกหลังจ่าย/เบิกไปแล้ว, ผูกกับ order_item + reimbursement เดิม, flag ให้ฝ่ายการเงินหักยอด/ขอคืนรอบถัดไป (`refund_pending → refunded / adjusted`)
- **daily_finance_snapshot** — สรุปยอดรายวัน: ยอดสั่ง, ยอดเบิกค้าง, มูลค่าที่เข้าคลังวันนี้, เคสยกเลิกที่ยังไม่เคลียร์ — รันผ่าน scheduled job

รายละเอียด field ระดับตารางอยู่ในข้อความแชทก่อนหน้า (จะย้ายไปทำเป็น EF Core entities ในขั้นตอนถัดไป)

## 3. Workflow หลัก

```
1. พนักงานกดสั่งของ (SP/TT/AM) ด้วยเงิน/บัตรตัวเอง (เพื่อเอาส่วนลด)
        → purchase_order + order_items, status = ordered

2. จ่ายเงินแล้ว (บัตร/เงินสดพนักงาน)
        → status = paid_by_staff

3. รวมยอดขอเบิกเงินจากบริษัท (แทร็กแยก ไม่ยุ่งกับ process เข้าคลัง)
        → reimbursement (pending → approved → paid)
        → purchase_order.status = reimbursed

4. ติดตามสถานะพัสดุ (ต่อ order_item เพราะของมาไม่พร้อมกัน) — สแกน QR (เว็บ, ไม่ผูกอุปกรณ์)
        ├─ Confirm ว่าได้รับของแล้ว → order_item.status = arrived
        │        → **auto** สร้าง inventory_item (sku, qty, cost/unit) → เข้าคลังทันที ไม่ต้องกดซ้ำ
        │
        └─ ร้านยกเลิก / ของไม่มา → order_item.status = cancelled
                 → ไม่สร้าง inventory_item, แต่คง record ไว้ (audit)
                 → ถ้าจ่าย+เบิกไปแล้ว → cancellations ผูกกับ reimbursement เดิม
                     → refund_pending → refunded/adjusted (ฝ่ายการเงิน action)

5. เบิกของออกจากคลัง (inventory_withdrawal) — เมื่อจะเอาของไปขาย/ใช้งาน
        → เลือก inventory_item + จำนวน + เหตุผล → บันทึก inventory_withdrawals
        → qty_on_hand ของ inventory_item ลดลง, ถ้า =0 → status=depleted
        (การบันทึกยอดขาย/รายได้จริง เป็นคนละระบบ นอกสโคปนี้)

6. daily_finance_snapshot รันทุกวัน สรุปยอดข้อ 2 ด้านบน
```

**หลักการสำคัญ:** เบิกเงิน (reimbursement) กับ เข้าคลัง (inventory) เป็นสองแทร็กที่**เดินคู่ขนานกัน** ไม่ block กัน — เบิกเงินได้แม้ของยังไม่มา, ของเข้าคลังได้แม้เบิกเงินยังไม่อนุมัติ เชื่อมกันแค่ผ่าน purchase_order/order_item เพื่อ audit เท่านั้น

## 4. หน้าจอหลัก

0. Login — username + password (ไม่มีช่อง email)
0.1 Master data (admin) — จัดการ users, platforms, withdrawal_reasons
1. Dashboard — สรุปวันนี้ (ยอดสั่ง/ยอดเบิก/ของค้างมา/มูลค่าที่เข้าคลังวันนี้/เคสถูกยกเลิก)
2. Order list — filter platform/user/status, ค้นหาเลขออเดอร์
3. Reimbursement queue — ฝ่ายการเงินอนุมัติ/จ่ายเป็นชุด (แยกอิสระจากหน้าที่ 4-5)
4. หน้าสแกนรับของ — mobile-first, สแกน QR แล้ว confirm รับของ → auto สร้าง inventory_item ทันที
5. Inventory list — รายการของในคลัง (sku, qty_on_hand, cost/unit, received_at) พร้อมปุ่ม "เบิกออก"
6. Withdraw dialog/หน้าเบิกของ — เลือกจำนวน + เหตุผล → บันทึก inventory_withdrawals, ตัด qty_on_hand
7. Cancellation report — รายการรอ action ฝ่ายการเงิน (ของที่ไม่เข้าคลังแต่จ่าย/เบิกไปแล้ว)

## 5. Design System (ทำเสร็จแล้ว)

ไฟล์ที่ generate ไว้แล้ว (อยู่ที่ root ของ repo นี้ชั่วคราว รอย้ายเข้าโปรเจกต์ใหม่):
- [tokens.json](tokens.json) — primitive → semantic → component → dark tokens
- [tokens.css](tokens.css) — CSS variables
- [style-guide.html](style-guide.html) — ตัวอย่าง component จริง
- [design-system-spec.md](design-system-spec.md) — เหตุผลการเลือกสี/shape

สรุปการตัดสินใจ: สี anchor = teal (#0B7F74, น่าเชื่อถือ ไม่ชนสี status), status color แยกจาก brand color โดยเจตนา, ปุ่ม/input ขนาดใหญ่กว่าเว็บทั่วไปเพราะใช้สแกนของหน้างานด้วยนิ้ว, รองรับ dark mode สำหรับใช้ในโกดัง/แสงน้อย

## 6. Tech Stack (อ้างอิงจากโปรเจกต์ EA)

| ส่วน | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Backend | ASP.NET Core 8 Web API | ตาม `Backend/EaConsole.Api` |
| ORM | Pomelo.EntityFrameworkCore.MySql | MySQL provider |
| Database | MySQL | host บน Plesk |
| Frontend | React 18 + Vite + TypeScript + MUI | ตาม `Frontend/` |
| Deploy | Single-host: React build เข้า `wwwroot` ของ API, upload ผ่าน FTP ไป Plesk | ใช้แนวทางเดียวกับ `deploy-single-host.core.ps1` |
| Hosting | Plesk (`ns37.1baht.net:8443`) | เหมือนโดเมน ea.thaipesleague.com |

## 7. โครงสร้างโปรเจกต์ใหม่ (แผน)

```
P2SInventory/
├── Backend/
│   └── P2SInventory.Api/
│       ├── Controllers/       (OrdersController, ReimbursementsController, DeliveriesController, InventoryController, ...)
│       ├── Data/Entities/     (PurchaseOrder, OrderItem, Reimbursement, Delivery, InventoryItem, InventoryWithdrawal, Cancellation, ...)
│       ├── Dtos/
│       ├── Services/
│       └── wwwroot/           ← React build ถูก copy มาที่นี่ตอน deploy
├── Frontend/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── utils/
├── deploy-single-host.core.ps1   (ปรับจาก EA)
├── deploy-single-host.example.ps1
├── DEPLOYMENT-SINGLE-HOST.md
└── docs/
```

## 8. ขั้นตอนถัดไป (ยังไม่ได้ทำ)

- [x] ยืนยันชื่อโปรเจกต์: **P2SInventory** → `D:\GitSource\P2SInventory`
- [ ] Scaffold `dotnet new webapi` + เพิ่ม Pomelo EF Core MySQL, Swashbuckle
- [ ] ทำ Auth: username/password login (JWT), ไม่มี email field เป็น identifier
- [ ] เขียน EF Core entities + DbContext ตาม data model ข้อ 2 (รวม master data: users/roles/platforms/withdrawal_reasons, `InventoryItem`, `InventoryWithdrawal`, แยก reimbursement ออกจาก inventory flow ชัดเจนในระดับ service/controller ด้วย)
- [ ] เขียน migration แรก + ทดสอบต่อ MySQL บน Plesk
- [ ] Scaffold `Frontend` ด้วย Vite + React + TS + MUI, ผูก tokens.css ที่ทำไว้แล้ว
- [ ] ทำหน้าสแกนรับของ (ต้องเลือกไลบรารีสแกน QR ฝั่งเว็บ เช่น `html5-qrcode`)
- [ ] ทำ scheduled job สำหรับ daily_finance_snapshot (Hangfire หรือ BackgroundService)
- [ ] ปรับ deploy script จาก EA ให้ใช้กับโปรเจกต์ใหม่ (FTP path, connection string, CORS origin)
- [ ] ตั้งค่า `/health` endpoint ตาม pattern เดียวกับ EA
