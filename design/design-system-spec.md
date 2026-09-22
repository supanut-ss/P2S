# Design System — Procurement & Reimbursement Tracker

## Brief
ระบบภายในสำหรับทีม ops: บันทึกการสั่งของผ่าน Shopee/TikTok/Amazon-Lazada ด้วยบัตรพนักงาน, ติดตามการเบิกเงินคืนบริษัท, ติดตามสถานะพัสดุ (สแกนรับของหน้างานด้วยมือถือ/แท็บเล็ตหลายรุ่น), และจัดการเคสร้านยกเลิกออเดอร์หลังจ่าย/เบิกไปแล้ว ต้องอัพเดทสต๊อก-การเงินทุกวัน

## Key decisions

- **สี anchor: Gold (#C9A227)** — เปลี่ยนจาก teal ตามที่ผู้ใช้ขอโทนทอง-เหลืองอ่อนแบบพรีเมียม (ปรับสว่างขึ้นจาก brass เข้ม `#A67C24` รอบแรก ไปเป็น gold-500 `#C9A227` ตามที่ขอ) + ตัวอักษรบนปุ่มเป็นสีเข้ม (`gray.900`) แทนขาว ให้ความรู้สึกหรู/prestige แบบ luxury branding (ตัวหนังสือเข้มบนพื้นทอง), hover ใช้ gold-600 `#A67C24` (เข้มขึ้นอีกขั้น)
- **Neutral: cool gray อมเขียว** — เข้าชุดกับ gold ได้ (โทนกลางไม่ฉูดฉาด), อ่านง่ายบนจอมือถือกลางแดด (contrast สูง)
- **⚠️ ปรับ `warning` จาก amber → orange (#C2660F)** เพราะ primary เดิมก็เป็นโทนทอง/เหลืองอยู่แล้ว ถ้าใช้ amber ต่อจะแยกปุ่ม action กับ badge เตือนไม่ออก — เปลี่ยนไปโทนส้มไหม้แทนเพื่อให้ยังแยกจาก primary ชัดเจน
- **teal เดิมไม่ทิ้ง** — ย้ายไปทำหน้าที่สี status `reimbursed` แทน (เดิม hardcode เป็น teal.600 อยู่แล้ว) ยังสื่อความหมาย "การเงินเคลียร์แล้ว" ได้ดี
- **Status colors แยกจาก brand color โดยเจตนา** — เพราะหน้างานหลักคือการอ่านสถานะเร็วๆ (ordered=ฟ้า, paid_by_staff=ส้ม/warning, reimbursed=teal, delivered=เขียว, cancelled=แดง, refund_pending=ส้ม, in_stock=เขียว, depleted=เทา/muted) กันสับสนกับปุ่ม primary — `in_stock`/`depleted` เพิ่มเข้ามาสำหรับสถานะ `inventory_items.status` ที่ไม่มีในชุดเดิม (ชุดเดิมมีแค่ purchase_order/order_item status)
- **Radius: md-lg (0.5–0.75rem)** — โทนเป็นมิตร ไม่แข็งเกินไป แต่ยังดูเป็นงาน ops ที่จริงจัง
- **Spacing/touch target ใหญ่กว่าเว็บทั่วไป** (ปุ่ม padding-y = spacing.3 = 12px) — เพราะใช้งานจริงคือสแกนของหน้างานด้วยนิ้ว ไม่ใช่นั่งพิมพ์ที่โต๊ะ
- **Dark mode รองรับ** ไว้สำหรับใช้งานในโกดัง/แสงน้อย

## Semantic tokens

| Token | ใช้สำหรับ |
|---|---|
| `--color-primary` (teal-600) | ปุ่มหลัก, ลิงก์, ไอคอน active |
| `--color-success` / `--color-success-bg` | delivered, reimbursement paid |
| `--color-warning` / `--color-warning-bg` | paid_by_staff (รอเบิก), refund_pending |
| `--color-destructive` / `--color-destructive-bg` | cancelled, error |
| `--color-info` / `--color-info-bg` | ordered (ยังไม่จ่าย) |
| `--status-*` | ผูกตรงกับ purchase_order.status / order_item.status / inventory_item.status แต่ละค่า ใช้กับ badge |

## Component spec (หลัก)

| Component | State | Token ที่ใช้ |
|---|---|---|
| Button (primary) | default / hover / disabled | `component.button.bg/hover-bg`, opacity 0.5 เมื่อ disabled |
| Input (สแกน/ค้นหา order no.) | default / focus / error | `component.input.border`, `focus-ring` → `semantic.color.destructive` เมื่อ error |
| Card (order item) | default | `component.card.*`, แถบสีซ้ายใช้ `semantic.status.*` ตามสถานะ |
| Badge (status pill) | ordered/paid/reimbursed/delivered/cancelled/refund-pending/in-stock/depleted | `component.badge.*` + สี status ที่ตรงกัน |

## ไฟล์ในชุดนี้
- [tokens.json](tokens.json) — token source (primitive → semantic → component → dark)
- [tokens.css](tokens.css) — CSS variables พร้อมใช้
- [style-guide.html](style-guide.html) — ดูภาพรวมสี/ฟอนต์/component จริง (รวม Status Badges showcase ครบทั้ง 8 สถานะ)

## ประวัติ
ชุดนี้ย้ายมาจาก `D:\GitSource\EA\` (ถูกสร้างไว้ที่นั่นโดยผิดที่ตั้งแต่แรก เนื้อหาตรงกับ P2S Inventory) — ต้นฉบับใน EA ถูกลบแล้ว, เพิ่ม status token `in-stock`/`depleted` ที่ขาดไปสำหรับ inventory_item.status
