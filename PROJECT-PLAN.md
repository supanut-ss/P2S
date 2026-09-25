# แผนงาน: Arbify — ระบบจัดหาสินค้า–เบิกจ่าย–เข้าคลัง (Procure-to-Stock)

> เอกสารนี้สรุปสิ่งที่คุยกันไว้ทั้งหมด **อัปเดตให้ตรงกับของจริงในโค้ดแล้ว** (rev. 2026-09-22 หลัง Phase 0-3 เสร็จ)
> ชื่อโปรเจกต์: **Arbify** (P2S Inventory — Procure-to-Stock / Pay-to-Stock), โฟลเดอร์/repo: **`D:\GitSource\P2S`** (ไม่ใช่ `P2SInventory` ตามที่ร่างไว้ตอนแรก — ใช้ repo ที่มีอยู่แล้วแทน)

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

## 2. Data Model (ของจริงในโค้ด — ต่างจากร่างแรกในหลายจุด)

> Entities ทั้งหมดอยู่ที่ [Backend/P2S.Api/Data/Entities](Backend/P2S.Api/Data/Entities) เป็น EF Core code-first, migration แรก: [InitialCreate](Backend/P2S.Api/Data/Migrations)

### 2.1 Authentication & Master Data

- **users** — `username` (login, **ไม่ใช้ email**), `password_hash` (BCrypt), `full_name`, `role_id`, `is_active`, `card_last4`
  - Login ด้วย username + password เท่านั้น (JWT) — ไม่มี self-serve reset เพราะไม่มี email → **admin reset password ให้แทน** (`POST /api/auth/admin-reset-password`, admin-only)
- **roles** — staff / finance / admin (seed แล้ว)
- **platforms** — SP / TT / AM (seed แล้ว, เป็นตาราง ไม่ hardcode enum)
- **withdrawal_reasons** — ขาย / ชำรุด / โอนย้าย / อื่นๆ (seed แล้ว)
- **products** *(เพิ่มจากร่างแรก)* — มาสเตอร์สินค้า `name`, `sku_code`, `unit` — เหตุผล: ร่างแรกไม่มีตารางนี้ ทำให้สินค้าชิ้นเดิมที่สั่งหลายรอบมีชื่อสะกดไม่ตรงกันในแต่ละ order_item ใช้งานหน้า Inventory จริงไม่ได้ → ตัดสินใจเพิ่มระหว่าง review

### 2.2 Transaction Tables

- **purchase_orders** — platform, `platform_order_no`, `total_amount`, status: `Ordered → PaidByStaff → Reimbursed`
- **order_items** — แตกรายชิ้น ผูก `product_id` และ `received_qty`; รับได้หลายรอบ โดยคง `Pending` จนรับครบแล้วจึงเป็น `Arrived` หรือเป็น `Cancelled`
- **`goods_receipt_events` / `goods_receipt_event_lines`** — บันทึกการรับด้วยเลข Order ทุกครั้ง พร้อมผู้บันทึก เวลา สินค้า และจำนวนที่รับในรอบนั้น; ไม่ใช้ tracking เป็นเงื่อนไขรับของ
- **reimbursements** — แทร็กแยกจาก inventory โดยสมบูรณ์, ผูกกับหลาย purchase_orders (many-to-many), status: `Pending → Approved → Paid`
- **deliveries** — เก็บข้อมูล scan รุ่นเดิมเพื่อรองรับประวัติเดิม; หน้ารับของปัจจุบันไม่ใช้ tracking
- **inventory_items** — **เป็น lot ไม่ใช่ยอดรวมต่อ SKU**: สร้างเมื่อรับครั้งแรกและเพิ่มยอด lot เดิมเมื่อทยอยรับรายการเดิม; `goods_receipt_event_lines` แยกเก็บจำนวนและเวลาของแต่ละรอบ
  - **optimistic concurrency token** (`row_version`, app-managed เพราะ MySQL ไม่มี native rowversion) — กันเบิกพร้อมกัน 2 คนแล้ว `qty_on_hand` ติดลบ
- **inventory_withdrawals** — `inventory_item_id`, `qty`, `withdrawal_reason_id`, `withdrawn_by`, `withdrawn_at`
- **cancellations** — ผูก order_item + reimbursement (nullable — null ถ้ายังไม่เคยเบิกตอนถูกยกเลิก), status: `RefundPending → Refunded / Adjusted`
- **staff_ledger_entries** *(เพิ่มจากร่างแรก — จุดสำคัญที่สุดที่แก้)* — บันทึกทุกรายการเคลื่อนไหวยอดของพนักงานแต่ละคนกับบริษัท: `entry_type` (AdvancePaid / Reimbursed / RefundDue / RefundSettled / Adjustment), `amount`, ผูก related purchase_order/reimbursement/cancellation ได้
  - เหตุผล: ร่างแรกมีแค่ `cancellations.status` ตอบไม่ได้ว่า "ตอนนี้พนักงานคนไหนติดหนี้บริษัทเท่าไหร่" (เคสร้านยกเลิกหลังเบิกเงินแล้ว เงินเข้าบัตรพนักงานแทน = พนักงานเป็นหนี้บริษัท) — `SUM(amount)` ต่อ user คือยอดค้างจริง
- **daily_finance_snapshots** — รันทุกวัน **23:59 เวลาไทย (Asia/Bangkok, UTC+7 fixed offset)** ผ่าน `DailyFinanceSnapshotBackgroundService`: `total_ordered_amount` (ยอดสั่งของวันนั้น), `total_reimbursement_pending` (ยอดเบิกค้างสะสม ไม่ scope ตามวัน), `total_inventory_value_today` (มูลค่าที่รับเข้าคลังวันนั้น), `open_cancellations_count` (เคสยกเลิกที่ยังไม่เคลียร์สะสม)

**ตารางที่ร่างแรกวางแผนไว้แต่ตัดออกจากการ implement จริง**: ไม่มี — ครบตามแผน มีแค่ปรับ/เพิ่มตามข้างบน

## 3. Workflow หลัก (ตรงกับร่างแรก มีจุดต่างเรื่อง delivery)

```
1. พนักงานกดสั่งของ (SP/TT/AM) ด้วยเงิน/บัตรตัวเอง
        → purchase_order + order_items, status = Ordered

2. จ่ายเงินแล้ว → status = PaidByStaff
        → staff_ledger_entries: entry_type = AdvancePaid (+)

3. รวมยอดขอเบิกเงินจากบริษัท (แทร็กแยก)
        → reimbursement (Pending → Approved → Paid)
        → purchase_order.status = Reimbursed
        → staff_ledger_entries: entry_type = Reimbursed (-)

4. รับของ — พนักงานกรอกเลข Order เพื่อค้นหารายการที่ตรงกัน
   → เลือกสินค้าและระบุจำนวนที่มาถึงในรอบนี้ (ค่าเริ่มต้นเป็นจำนวนที่ยังรอรับ)
     มี fallback ค้นด้วยเลขออเดอร์เสมอ (สแกนไม่ติดทุกกล่อง)
        ├─ ยืนยันรับเข้าคลัง → เพิ่ม received_qty และบันทึก goods_receipt_event/lines
        │        → **auto** เพิ่ม/สร้าง inventory_item lot ของรายการนั้นตามจำนวนที่มาถึง
        │
        └─ ร้านยกเลิก / ของไม่มา → order_item.status = Cancelled
                 → ไม่สร้าง inventory_item, แต่คง record ไว้ (audit)
                 → ถ้าจ่าย+เบิกไปแล้ว → cancellation ผูกกับ reimbursement เดิม
                     → refund_pending → refunded/adjusted (ฝ่ายการเงิน action)
                     → staff_ledger_entries: entry_type = RefundDue (-) ตอน flag,
                       RefundSettled (+) ตอนเคลียร์

5. เบิกของออกจากคลัง (inventory_withdrawal)
        → เลือก inventory_item (lot) + จำนวน + เหตุผล → บันทึก inventory_withdrawals
        → qty_on_hand ลดลงใน transaction เดียวกัน (concurrency token กันชนกัน), ถ้า =0 → status = Depleted

6. daily_finance_snapshot รันอัตโนมัติทุกวัน 23:59 เวลาไทย
   (หรือ trigger มือผ่าน POST /api/finance/snapshot/run สำหรับ admin)
```

**หลักการสำคัญ (คงเดิม):** เบิกเงิน (reimbursement) กับ เข้าคลัง (inventory) เป็นสองแทร็กที่เดินคู่ขนานกัน ไม่ block กัน — เชื่อมกันแค่ผ่าน purchase_order/order_item เพื่อ audit และผ่าน staff_ledger_entries เพื่อยอดค้างเท่านั้น

## 4. หน้าจอหลัก (สถานะ implementation)

| # | หน้าจอ | สถานะ |
|---|---|---|
| 0 | Login — username + password | ✅ ทำงานจริง ต่อ JWT backend แล้ว |
| 0.1 | Master data (admin) — users, platforms, withdrawal_reasons | 🔲 placeholder (รอ controller) |
| 1 | Dashboard — สรุปวันนี้ | 🔲 โครง UI พร้อม รอผูก `/api/finance/snapshot/latest` |
| 2 | Order list — filter/ค้นหา | 🔲 placeholder (รอ controller) |
| 3 | Reimbursement queue | 🔲 placeholder (รอ controller) |
| 4 | หน้ารับของด้วยเลข Order — รองรับมือถือ/แท็บเล็ต/เดสก์ท็อป | ✅ ค้นเลข Order ตรงตัว เลือกสินค้าและจำนวนรับต่อรอบ |
| 5 | Inventory list + ปุ่มเบิกออก | 🔲 placeholder (รอ controller) — มี mockup อ้างอิงที่ [design/mockup-inventory.html](design/mockup-inventory.html) |
| 6 | Withdraw dialog | 🔲 รวมอยู่ในหน้า Inventory list |
| 7 | Cancellation report | 🔲 placeholder (รอ controller) |

App shell (routing, layout, auth, nav) ทำงานจริงและ verify ในเบราว์เซอร์แล้วที่ [Frontend/src](Frontend/src)

## 5. Design System

> ย้ายมาจาก `D:\GitSource\EA\` (ถูกสร้างไว้ผิด repo ตอนแรก) แก้แล้วอยู่ที่ [design/](design/)

- [design/tokens.json](design/tokens.json) — primitive → semantic → component → dark tokens
- [design/tokens.css](design/tokens.css) — CSS variables (ก็อปมาผูกใน `Frontend/src/theme/tokens.css` ด้วย)
- [design/style-guide.html](design/style-guide.html) — component จริงพร้อม status badge ครบ 8 สถานะ
- [design/mockup-inventory.html](design/mockup-inventory.html) — mockup หน้า Inventory list
- [design/design-system-spec.md](design/design-system-spec.md) — เหตุผลการเลือกสี/shape (รวมประวัติการเปลี่ยนสี)

**สรุปการตัดสินใจ (อัปเดต):**
- **สี anchor เปลี่ยนจาก teal → gold** (`#C9A227` primary, hover `#A67C24`) ตามที่ผู้ใช้ขอโทนทอง/เหลืองอ่อนแบบพรีเมียม — ตัวหนังสือบนปุ่มเป็นสีเข้มแทนขาว (luxury branding look)
- **`warning` ขยับจาก amber → orange** (`#C2660F`) เพราะ primary เดิมก็เป็นโทนทอง/เหลืองอยู่แล้ว จะแยกปุ่ม action กับ badge เตือนไม่ออก
- **teal เดิมไม่ทิ้ง** — ย้ายไปทำหน้าที่สี status `reimbursed` แทน
- เพิ่ม status token `in-stock` (เขียว) / `depleted` (เทา) ที่ร่างแรกไม่มี (ต้องใช้กับ `inventory_item.status`)
- ปุ่ม/input ขนาดใหญ่กว่าเว็บทั่วไป (padding-y 12px) เพราะใช้สแกนของหน้างานด้วยนิ้ว, รองรับ dark mode

## 6. Tech Stack (ยืนยันจริงในโค้ดแล้ว)

| ส่วน | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Backend | ASP.NET Core **8** (net8.0 **pinned** ผ่าน [global.json](global.json)) | เครื่องมี SDK 10.0.401 ด้วย ต้อง pin ไม่งั้น `dotnet new` จะได้ net10 เงียบๆ ซึ่งอาจ deploy ไม่ขึ้น Plesk ที่รองรับแค่ 8 |
| ORM | Pomelo.EntityFrameworkCore.MySql 8.0.2 | ตรงกับเวอร์ชันที่ EA deploy ได้จริงบน Plesk |
| Auth | JWT (Microsoft.AspNetCore.Authentication.JwtBearer) + BCrypt.Net-Next | **เขียนใหม่ทั้งชุด** — EA ไม่มี auth เลยให้ลอก |
| Database | MySQL 8.0 | dev: container local; prod: Plesk |
| Frontend | React 18 + Vite + TypeScript + MUI 9 | ผูก design tokens เข้า MUI theme แล้ว |
| Scheduled job | `BackgroundService` ในตัว (ไม่ใช้ Hangfire) | งานเดียว (daily snapshot) ไม่คุ้มที่จะเพิ่ม dependency + ตารางของตัวเอง |
| Deploy | Single-host: React build เข้า `wwwroot` ของ API, FTP ไป Plesk | ปรับจาก `deploy-single-host.core.ps1` ของ EA — **ยังไม่เคยรันจริง** (ไม่มี FTP/DB จริงให้ทดสอบ) |
| Hosting | Plesk (`ns37.1baht.net:8443`) — เดาว่าเหมือนโดเมน ea.thaipesleague.com | **win-x86 publish RID ที่ลอกจาก EA ยังไม่ยืนยันว่าตรงกับ P2S host** |

## 7. โครงสร้างโปรเจกต์ (ของจริง)

```
P2S/                                    ← D:\GitSource\P2S (ไม่ใช่ P2SInventory)
├── Backend/
│   ├── P2S.Api/
│   │   ├── Controllers/       AuthController, FinanceController
│   │   ├── Data/
│   │   │   ├── Entities/      14 entities ครบตามข้อ 2
│   │   │   ├── Migrations/    InitialCreate (seed: admin/platforms/withdrawal_reasons)
│   │   │   ├── P2SDbContext.cs
│   │   │   ├── P2SDbContextFactory.cs   (design-time factory — EF CLI ไม่ต้องต่อ DB จริงตอน gen migration)
│   │   │   └── SeedData.cs
│   │   ├── Dtos/
│   │   ├── Services/           JwtTokenService, DailyFinanceSnapshot(Background)Service, BangkokClock
│   │   ├── Program.cs
│   │   └── wwwroot/            ← React build ถูก copy มาที่นี่ตอน deploy (git-ignored)
│   └── P2S.Api.Tests/          xUnit, 8 tests ผ่านจริง (รวม timezone edge case)
├── Frontend/
│   └── src/
│       ├── api/                axios client + JWT interceptor, dev proxy → :5080
│       ├── auth/                AuthContext, ProtectedRoute
│       ├── components/          PageHeader, StatusBadge
│       ├── layout/               AppLayout (responsive nav)
│       ├── pages/                 LoginPage, DashboardPage, PlaceholderPage x6
│       ├── theme/                 theme.ts (MUI ผูก tokens), tokens.ts, tokens.css
│       └── types/                  models.ts (mirror backend entities)
├── design/                      design system (ย้ายมาจาก EA แล้วแก้)
├── global.json                  pin .NET SDK 8.0.206
├── P2S.sln
├── deploy-single-host.core.ps1  (ปรับจาก EA — ยังไม่เคยรันจริง)
├── deploy-single-host.example.ps1
├── DEPLOYMENT-SINGLE-HOST.md
└── upload-ftp.ps1               (ก็อปจาก EA ตรงๆ — generic ไม่มีจุดต้องแก้)
```

## 8. ขั้นตอนถัดไป

- [x] ยืนยันชื่อโปรเจกต์และ repo: ใช้ `D:\GitSource\P2S` ที่มีอยู่แล้ว (ไม่สร้าง `P2SInventory` ใหม่)
- [x] Design system: ย้ายจาก EA + เติม token ที่ขาด + เปลี่ยนโทนเป็น gold ตามที่ขอ
- [x] Scaffold `dotnet new webapi` (net8.0 pinned) + Pomelo EF Core MySQL + Swashbuckle
- [x] Auth: username/password login (JWT) + BCrypt + admin reset password endpoint
- [x] EF Core entities + DbContext ครบ 14 ตาราง (รวม products, staff_ledger_entries, concurrency token)
- [x] Migration แรก + **ทดสอบจริงกับ MySQL** (container local) — apply สำเร็จ, seed ถูกต้อง, login/authorize ทำงานจริง
- [x] Scaffold `Frontend` ด้วย Vite + React + TS + MUI, ผูก tokens.css แล้ว, **verify end-to-end ในเบราว์เซอร์จริง** (login/logout/nav/route protection)
- [x] Scheduled job `daily_finance_snapshot` ผ่าน `BackgroundService` — **verify จริงกับ MySQL**, เจอและแก้บั๊ก decimal precision ระหว่างทดสอบ
- [x] ปรับ deploy script จาก EA (FTP path, connection string, CORS origin ผ่าน env var, JWT signing key) — **ยังไม่เคยรันจริง**
- [x] `/health` endpoint ตาม pattern เดียวกับ EA
- [x] ทำหน้ารับของด้วยเลข Order; เลือกสินค้าและจำนวนที่มาถึงได้ รองรับรับหลายรอบ และไม่บังคับ Tracking
- [ ] เขียน business controllers: Orders, Reimbursements, Deliveries, Inventory, Cancellations, Master data (users/platforms/withdrawal_reasons/products)
- [ ] ผูก 6 หน้าจอ placeholder เข้ากับ controllers จริงด้านบน
- [ ] รัน deploy script จริงครั้งแรก — ต้องยืนยัน win-x86 RID กับ Plesk host ก่อน, ต้องมี FTP credentials + connection string จริง + JWT signing key production (ห้ามใช้ค่า dev ซ้ำ)
- [ ] ตั้งค่า auto-merge/CI ถ้าต้องการ (ยังไม่ได้ตั้ง)

## 10. Financial controls and returns update (2026-09-24)

- An order number is unique within its platform; the same number may exist on another platform. Startup checks existing data before applying the unique index and reports duplicates without deleting records.
- Payment records retain the actual paid amount, payment source, payer, recorder, timestamp, and optional receipt. Staff advances are distinguished from company-direct payments, and reimbursement claims use actual paid amounts less settled refunds.
- Finance can correct an order's actual paid amount while its reimbursement is Pending or Approved. Each correction stores the previous and new amount, actor, timestamp, and reason, adjusts the staff ledger, and returns an Approved request to Pending for re-approval; paid requests are locked.
- Refund cases support partial quantities and amounts, retain reporter/resolver audit data, and block reimbursement while unresolved. Returning goods to a supplier reduces the inventory lot and order-line available quantity; returned stock can never exceed the quantity still on hand.
- A purchase order can be claimed by only one reimbursement. Optimistic concurrency and database unique indexes protect parallel payment, return, and reimbursement actions.

## 11. Order-number goods receiving update (2026-09-25)

- Staff enter an exact platform Order number; if the same number exists on multiple platforms, the UI shows each platform so the correct order can be selected.
- Each line defaults to its remaining quantity. Staff can set a line to zero to skip it or enter a smaller whole number; the API rejects quantities above the remaining amount and commits the selected lines as one receipt.
- An order line stays Pending while partially received and becomes Arrived when `received_qty` reaches `qty`. Repeated receipt events update its inventory lot and append an actor/time/quantity audit record.
- Historical Arrived and Returned lines are backfilled to `received_qty = qty`. Finance snapshots continue counting legacy lots without receipt events and use receipt/reversal events for new activity.
- Admins can reverse a receipt event with a reason only while its stock remains untouched and has not been returned; the reversal is retained as a separate audit event.
- The receiving form uses responsive mobile, tablet, and desktop layouts, keyboard order entry, and touch targets of at least 44px. Tracking numbers and camera scanning are not part of this workflow.
- Order lines store package label name, model, shop, and freeform description. The Order list shows these fields alongside tracking and the read-only first-received date; that date is set by the receipt workflow, never entered when ordering.
- Tracking is displayed when present and remains outside the order-entry form. The repository has no upstream shipment-notification connector yet, so automatic notification-to-tracking updates still require that integration.
