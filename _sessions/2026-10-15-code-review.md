---
title: "ทบทวนเงื่อนไข if ที่อาจทำให้เกิดข้อผิดพลาดใน my_mis2018"
date: 2026-10-15
topics: [Python, Logic, Security, Code Review, Staff Leave, Academic Services, OT, Continuing Education]
repository: "my_mis2018"
summary: "ตรวจสอบ 7 ตัวอย่างเงื่อนไขที่อาจนับวันลาผิด อัปเดตสถานะดาวน์โหลดผิด แสดงคำเตือน OT ผิด และปล่อยผู้ใช้ผ่านเมื่อรายชื่อผู้ดูแลว่าง พร้อมแนวทางปรับปรุง"
---

## ขอบเขตการตรวจสอบ

ตรวจโค้ดใน `my_mis2018` ณ วันที่ 15 ตุลาคม 2026 โดยอ้างอิง commit `e4b70440c5692d1f43038db77304e8905db498d4` ตัวอย่างด้านล่างมาจากไฟล์ที่ตรวจจริง ส่วนโค้ดที่เสนอเป็นแนวทางให้พิจารณา ยังไม่ได้แก้ในระบบหรือยืนยันกติกาทางธุรกิจทั้งหมด

หลักสำคัญ: Python ประเมิน `not` ก่อน `and` และประเมิน `and` ก่อน `or` ดังนั้น `A and B or C` หมายถึง `(A and B) or C` หาก `C` เป็นจริง เงื่อนไขทั้งหมดจะเป็นจริงได้แม้ `A` เป็นเท็จ

## 1. นับวันลาที่ไม่ใช่รายการรออนุมัติ เมื่อไม่ได้ส่งวันเริ่มต้น

ตำแหน่ง: `app/staff/models.py` บรรทัด 351–365 ใน `get_total_pending_leaves_request`

### โค้ดเดิม

```python
if start_date is None or end_date is None and not req.cancelled_at \
        and not req.get_approved and not req.get_unapproved:
    total_leaves.append(req.total_leave_days)
else:
    if req.start_datetime >= start_date and req.end_datetime <= end_date \
            and not req.cancelled_at and not req.get_approved and not req.get_unapproved:
        total_leaves.append(req.total_leave_days)
```

### ปัญหาและตัวอย่าง

Python จัดกลุ่มเงื่อนไขแรกเป็น `start_date is None or (end_date is None and ...)` เมื่อ `start_date` เป็น `None` จะเข้าแขนงแรกทันที โดยไม่ตรวจว่ารายการถูกยกเลิก อนุมัติ หรือไม่อนุมัติแล้วหรือไม่

```python
start_date = None
end_date = None
cancelled_at = True
approved = True
unapproved = False

should_count = (
    start_date is None
    or end_date is None and not cancelled_at
    and not approved and not unapproved
)
print(should_count)  # True ทั้งที่ไม่ควรเป็นรายการรออนุมัติ
```

ผลกระทบ: วันลาของรายการที่สิ้นสุดกระบวนการแล้วอาจถูกรวมในยอดรออนุมัติ นอกจากนี้ หากส่งเฉพาะ `start_date` และรายการไม่อยู่ในสถานะรออนุมัติ จะตกไปแขนง `else` และอาจเปรียบเทียบ `req.end_datetime <= None` จนเกิด `TypeError`

### แนวทางปรับปรุง

แยกสถานะรายการออกจากช่วงวันที่ ตัวอย่างนี้ใช้กติกาว่าเมื่อขาดวันใดวันหนึ่งจะไม่กรองช่วงวันที่ ซึ่งสอดคล้องกับรูปแบบของฟังก์ชัน `get_total_leaves` ที่อยู่ใกล้กัน แต่ต้องยืนยันว่าต้องการกติกานี้หรือให้ปฏิเสธวันที่ไม่ครบ

```python
is_pending = (
    not req.cancelled_at
    and not req.get_approved
    and not req.get_unapproved
)
has_date_range = start_date is not None and end_date is not None

if is_pending:
    if not has_date_range:
        total_leaves.append(req.total_leave_days)
    elif req.start_datetime >= start_date and req.end_datetime <= end_date:
        total_leaves.append(req.total_leave_days)
```

กรณีที่ควรทดสอบ: วันที่ครบ/ไม่ครบ ร่วมกับสถานะรออนุมัติ ยกเลิก อนุมัติ และไม่อนุมัติ ต้องไม่นับรายการที่สิ้นสุดแล้วและต้องไม่เปรียบเทียบวันที่กับ `None`

## 2. สถานะคำขอเป็น “ดาวน์โหลดครบ” ทั้งที่ยังมีไฟล์ไม่ได้ดาวน์โหลด

ตำแหน่ง: `app/academic_services/views.py` บรรทัด 124–132 ใน `download_file`

### โค้ดเดิม

```python
download_all = all(item.is_downloaded for item in result_item.result.result_items)
if not result_item.is_downloaded:
    result_item.is_downloaded = True
    db.session.add(result_item)
    db.session.commit()
if download_all and req.is_downloaded == None or req.is_downloaded == False:
    req.is_downloaded = True
    db.session.add(req)
    db.session.commit()
```

### ปัญหาและตัวอย่าง

เงื่อนไขสุดท้ายหมายถึง `(download_all and req.is_downloaded == None) or req.is_downloaded == False` เมื่อสถานะคำขอเป็น `False` จะอัปเดตเป็น `True` แม้ `download_all` จะเป็น `False`

```python
download_all = False
request_is_downloaded = False

mark_complete = (
    download_all and request_is_downloaded == None
    or request_is_downloaded == False
)
print(mark_complete)  # True แม้ยังดาวน์โหลดไม่ครบ
```

อีกปัญหาคือคำนวณ `download_all` ก่อนเปลี่ยนสถานะไฟล์ปัจจุบัน เช่น `[True, False]` จะได้ `False` ก่อนเปลี่ยนไฟล์สุดท้ายเป็น `True` หากสถานะคำขอเดิมเป็น `None` เงื่อนไขเดิมจะไม่อัปเดตคำขอ แม้ไฟล์ครบแล้ว

### แนวทางปรับปรุง

เปลี่ยนสถานะไฟล์ปัจจุบันก่อนคำนวณ แล้วจัดกลุ่มเงื่อนไขให้ชัดเจน:

```python
if not result_item.is_downloaded:
    result_item.is_downloaded = True
    db.session.add(result_item)

download_all = all(
    item.is_downloaded for item in result_item.result.result_items
)
if download_all and (
    req.is_downloaded is None or req.is_downloaded is False
):
    req.is_downloaded = True
    db.session.add(req)

db.session.commit()
```

ตัวอย่างนี้แก้เฉพาะการจัดกลุ่มและลำดับคำนวณ ยังต้องตรวจว่าคำขอหนึ่งมีหลายชุดผลลัพธ์หรือไม่ เพราะ `all(...)` ปัจจุบันตรวจเฉพาะ `result_items` ของชุดผลลัพธ์นี้ และการบันทึกสถานะยังเกิดก่อน `s3_client.download_fileobj` หาก S3 ล้มเหลวอาจบันทึกว่าดาวน์โหลดแล้วทั้งที่ยังส่งไฟล์ไม่สำเร็จ

กรณีที่ควรทดสอบ: ดาวน์โหลดไฟล์แรกจากหลายไฟล์ต้องไม่ครบ ดาวน์โหลดไฟล์สุดท้ายต้องครบ ทั้งสถานะคำขอเดิม `None` และ `False` รวมถึงดาวน์โหลดซ้ำและ S3 ล้มเหลว

## 3. คำเตือน OT ระบุว่าเวลาทับซ้อน ทั้งที่เพียงไม่มีเวลาออกงาน

ตำแหน่ง: `app/ot/views.py` บรรทัด 1272 และ 1391 พบเงื่อนไขรูปแบบเดียวกันสองจุด

### โค้ดเดิม

```python
elif shift_schedule_overlaps and not work_login_checkin or not work_login_checkout:
    ot_record["condition"] = (
        u'เวลาปฏิบัติงานปกติตรงกับเวลาที่ขอเบิกค่าล่วงเวลา '
        u'และไม่พบบันทึกเวลาสแกนเข้า-ออกงาน'
    )
```

### ปัญหาและตัวอย่าง

เงื่อนไขหมายถึง `(shift_schedule_overlaps and not work_login_checkin) or not work_login_checkout` ดังนั้นแค่ไม่มี checkout ก็เข้าแขนงนี้ แม้ไม่พบเวลาทับซ้อน เมื่อมีตารางงานและ check-in แขนงแรกของชุด `if` ไม่ทำงาน แต่แขนงนี้จะทำงานและบังคำเตือนเรื่องการสแกนที่อยู่ด้านล่าง

```python
shift_schedule_overlaps = []  # ไม่มีช่วงเวลาทับซ้อน
work_login_checkin = ["check-in"]
work_login_checkout = []

wrong_warning = (
    shift_schedule_overlaps and not work_login_checkin
    or not work_login_checkout
)
print(wrong_warning)  # True แต่ข้อความแจ้งว่ามีเวลาทับซ้อน
```

### แนวทางปรับปรุง

หากกติกาต้องการ “เวลาทับซ้อน และขาดสแกนอย่างน้อยหนึ่งรายการ” ควรเขียน:

```python
has_overlap = bool(shift_schedule_overlaps)
missing_checkin = not work_login_checkin
missing_checkout = not work_login_checkout

# แขนงหนึ่งในชุด if/elif เดิม
if has_overlap and (missing_checkin or missing_checkout):
    warning = "เวลาปฏิบัติงานปกติทับซ้อนกับ OT และขาดบันทึกการสแกน"
```

ต้องยืนยันว่าต้องการขาดสแกน “อย่างน้อยหนึ่งรายการ” (`or`) หรือ “ทั้งเข้าและออก” (`and`) และเลือกข้อความให้ตรงกัน นอกจากนี้ query ที่สร้าง `shift_schedule_overlaps` ในสองจุดมีเงื่อนไขช่วงเวลาต่างกัน จึงควรตรวจนิยาม “ทับซ้อน” แยกจากการแก้วงเล็บด้วย

กรณีที่ควรทดสอบ: ทับซ้อน/ไม่ทับซ้อน × มี/ไม่มี check-in × มี/ไม่มี checkout ให้ครบ 8 ชุด และตรวจว่าเลือกข้อความเตือนแขนงใดจริง

## 4. รายชื่อผู้ดูแลว่าง แต่ผู้ใช้ทั่วไปกลับผ่านการตรวจสิทธิ์

ตำแหน่ง: `app/continuing_edu/views.py` บรรทัด 2698–2713 ใน `admin_test_payment` ซึ่งมีคำอธิบายว่าเป็นหน้าสำหรับผู้ดูแล และใช้ `DEV_PAYMENT_ADMINS` กำหนดรายชื่ออีเมลที่อนุญาต

### โค้ดเดิม

```python
user = get_current_user()
allowed_env = os.environ.get('DEV_PAYMENT_ADMINS')
allowed = []
if allowed_env:
    allowed = [e.strip().lower() for e in allowed_env.split(',') if e.strip()]

if not user or (allowed and (not getattr(user, 'email', '').lower() in allowed)):
    flash('Not allowed', 'danger')
    return redirect(url_for('continuing_edu.index', lang=lang))
```

### ปัญหา

เมื่อไม่ได้ตั้ง `DEV_PAYMENT_ADMINS` หรือตั้งเป็นช่องว่าง รายการ `allowed` จะเป็น `[]` ถ้ามีผู้ใช้ล็อกอินอยู่ `not user` จะเป็น `False` ส่วน `allowed and ...` จะหยุดประเมินทันทีและคืน `[]` ซึ่งเป็นค่าเท็จ ดังนั้นทั้งเงื่อนไขปฏิเสธสิทธิ์จึงเป็นเท็จ และผู้ใช้ผ่านไปยังโค้ดถัดไป

ปัญหานี้ไม่ได้เกิดจากลำดับความสำคัญของ `and`/`or` เพราะมีวงเล็บอยู่แล้ว แต่เกิดจากการใช้ “รายชื่อไม่ว่าง” เป็นเงื่อนไขก่อนตรวจสมาชิก ทำให้รายชื่อว่างมีความหมายว่าไม่ต้องตรวจสิทธิ์ แทนที่จะหมายถึงไม่มีผู้ได้รับอนุญาต

### ตัวอย่างที่รันได้ทันที

ตัวอย่างนี้ใช้ผู้ใช้จำลองและพิมพ์ผลเท่านั้น ไม่เรียก route หรือเปลี่ยนสถานะการชำระเงิน:

```python
from types import SimpleNamespace

user = SimpleNamespace(email="member@example.com")
allowed = []  # จำลองกรณีไม่ได้ตั้ง DEV_PAYMENT_ADMINS

if not user or (allowed and (not getattr(user, 'email', '').lower() in allowed)):
    print("ปฏิเสธสิทธิ์")
else:
    print("ผ่านการตรวจสิทธิ์")

# ผลจริง: ผ่านการตรวจสิทธิ์
# หากหน้านี้อนุญาตเฉพาะผู้มีชื่อในรายชื่อผู้ดูแล ควรได้: ปฏิเสธสิทธิ์
```

| ผู้ใช้ | รายชื่อที่อนุญาต | ผลของโค้ดเดิม | ผลที่ควรได้สำหรับหน้าเฉพาะผู้ดูแล |
| --- | --- | --- | --- |
| ไม่ได้ล็อกอิน | ว่าง | ปฏิเสธ | ปฏิเสธ |
| ล็อกอินเป็น member@example.com | ว่าง | **ผ่าน** | **ปฏิเสธ** |
| ล็อกอินเป็น member@example.com | admin@example.com | ปฏิเสธ | ปฏิเสธ |
| ล็อกอินเป็น admin@example.com | admin@example.com | ผ่าน | ผ่าน |

ผลกระทบที่เห็นจากโค้ดรอบข้าง: เมื่อผ่านเงื่อนไขนี้และส่ง `POST` ฟังก์ชันจะนำข้อมูลอ้างอิงการชำระเงินไปเรียก `_mark_payment_paid_and_notify` จึงเป็นการตรวจสิทธิ์ก่อนการดำเนินการที่เปลี่ยนสถานะการชำระเงิน ไม่ใช่เพียงการเปิดดูหน้าเว็บ อย่างไรก็ตาม ยังไม่ได้ทดสอบการเข้าถึงในระบบที่ deploy จริงหรือยืนยันค่า environment ของระบบนั้น

### แนวทางปรับปรุง

หากกติกาคืออนุญาตเฉพาะผู้ใช้ที่มีอีเมลอยู่ในรายชื่อ ให้ปฏิเสธเมื่อรายชื่อว่าง และแยกชื่อเงื่อนไขให้สื่อความหมาย:

```python
email = (getattr(user, 'email', None) or '').strip().lower()
is_allowed_admin = bool(user) and bool(allowed) and email in allowed

if not is_allowed_admin:
    flash('Not allowed', 'danger')
    return redirect(url_for('continuing_edu.index', lang=lang))
```

ตัวอย่างนี้ยังรองรับกรณี `email` เป็น `None` ซึ่งโค้ดเดิมอาจเกิด `AttributeError` เมื่อเรียก `.lower()` หากรายชื่อไม่ว่าง ต้องยืนยันกติกากรณี environment ไม่ถูกตั้งด้วย หากต้องการเปิดให้ใช้ในโหมดพัฒนาควรกำหนดโหมดนั้นอย่างชัดเจน แทนการอาศัยรายชื่อว่าง

กรณีที่ควรทดสอบ: ผู้ใช้ทั้ง 4 ชุดในตาราง รวมถึง environment เป็นช่องว่าง อีเมลเป็น `None` และอีเมลตัวพิมพ์ใหญ่ โดยกรณีที่ปฏิเสธต้องไม่เรียกฟังก์ชันเปลี่ยนสถานะการชำระเงิน

## ตัวอย่างเพิ่มเติม: เงื่อนไขที่ไม่มีโอกาสถูกใช้

ในส่วนนี้ “เงื่อนไขที่ไม่ถูกใช้” หมายถึงแขนงที่ไม่มีทางถูกเลือก (`unreachable branch`) เพราะเงื่อนไขก่อนหน้าครอบคลุมกรณีนั้นแล้ว ไม่ใช่เพียงโค้ดที่ยังไม่มีผู้ใช้งาน

## 5. คำเตือน “ไม่พบสแกนเข้างาน” ถูกแขนงรวมดักไว้ก่อน

ตำแหน่ง: `app/ot/views.py` บรรทัด 1399 และ 1404–1405

### โค้ดเดิมที่เกี่ยวข้อง

```python
elif not work_login_checkin or not work_login_checkout:
    ot_record["condition"] = u'ไม่พบบันทึกเวลาสแกนเข้า-ออกงาน'
elif not shift_schedules:
    ot_record["condition"] = u'ไม่พบเวลาปฏิบัติงาน'
elif shift_schedule_overlaps:
    ot_record["condition"] = u'เวลาปฏิบัติงานปกติตรงกับเวลาที่ขอเบิกค่าล่วงเวลา'
elif not work_login_checkin:
    ot_record["condition"] = u'ไม่พบบันทึกเวลาสแกนเข้างาน'
```

ถ้าไม่มี check-in เงื่อนไข `not work_login_checkin or not work_login_checkout` จะเป็นจริงเสมอ จึงไม่สามารถมาถึงแขนง `elif not work_login_checkin` ด้านล่างได้ แม้จะผ่านแขนงอื่นก่อนหน้านี้มาแล้วก็ตาม

### ตัวอย่างจำลองเฉพาะส่วนที่ครอบคลุมกัน

```python
work_login_checkin = []
work_login_checkout = ["checkout"]

if not work_login_checkin or not work_login_checkout:
    print("คำเตือนรวม: ไม่พบสแกนเข้า-ออกงาน")
elif not work_login_checkin:
    print("คำเตือนเฉพาะ: ไม่พบสแกนเข้างาน")  # ไม่มีทางถูกเลือก

# ผล: คำเตือนรวม: ไม่พบสแกนเข้า-ออกงาน
```

ผลกระทบ: ข้อความเฉพาะเรื่อง check-in ที่เขียนไว้ไม่ได้ถูกใช้ ผู้ดูแลอาจเข้าใจว่าระบบแยกกรณีนี้แล้ว ทั้งที่ผู้ใช้ยังได้รับข้อความรวม

## 6. คำเตือน “ไม่พบสแกนสิ้นสุดงาน” ก็ไม่มีทางถูกเลือก

ตำแหน่ง: `app/ot/views.py` บรรทัด 1391, 1399 และ 1406–1407

### โค้ดเดิมที่เกี่ยวข้อง

```python
elif shift_schedule_overlaps and not work_login_checkin or not work_login_checkout:
    # กำหนดคำเตือนเวลาทับซ้อนและขาดสแกน
    ...
# มีแขนงอื่นคั่นอยู่
elif not work_login_checkin or not work_login_checkout:
    ot_record["condition"] = u'ไม่พบบันทึกเวลาสแกนเข้า-ออกงาน'
# มีแขนงอื่นคั่นอยู่
elif not work_login_checkout:
    ot_record["condition"] = u'ไม่พบบันทึกเวลาสแกนสิ้นสุดงาน'
```

ข้อความนี้ถูกบังสองชั้น: โค้ดปัจจุบันจะเข้าแขนงบรรทัด 1391 เมื่อไม่มี checkout ตามปัญหาในข้อ 3 และแม้แก้วงเล็บของแขนงนั้นแล้ว แขนงรวมบรรทัด 1399 ก็ยังครอบคลุมการไม่มี checkout อยู่ ดังนั้นการแก้ข้อ 3 เพียงอย่างเดียวยังไม่ทำให้ข้อความเฉพาะนี้ถูกใช้

### ตัวอย่างที่แสดงว่าหลังแก้วงเล็บก็ยังมีปัญหา

```python
has_overlap = False
work_login_checkin = ["checkin"]
work_login_checkout = []

if has_overlap and (not work_login_checkin or not work_login_checkout):
    print("เวลาทับซ้อนและขาดสแกน")
elif not work_login_checkin or not work_login_checkout:
    print("คำเตือนรวม: ไม่พบสแกนเข้า-ออกงาน")
elif not work_login_checkout:
    print("คำเตือนเฉพาะ: ไม่พบสแกนสิ้นสุดงาน")  # ยังไม่มีทางถูกเลือก

# ผล: คำเตือนรวม: ไม่พบสแกนเข้า-ออกงาน
```

### แนวทางปรับปรุงข้อ 5–6

หากต้องการแยกข้อความเมื่อขาดทั้งสองรายการหรือขาดเพียงรายการเดียว ให้ใช้ `and` สำหรับกรณีขาดทั้งคู่ก่อน แล้วจึงตรวจแต่ละรายการ:

```python
missing_checkin = not work_login_checkin
missing_checkout = not work_login_checkout

if missing_checkin and missing_checkout:
    warning = "ไม่พบบันทึกเวลาสแกนเข้า-ออกงาน"
elif missing_checkin:
    warning = "ไม่พบบันทึกเวลาสแกนเข้างาน"
elif missing_checkout:
    warning = "ไม่พบบันทึกเวลาสแกนสิ้นสุดงาน"
else:
    warning = None
```

นี่เป็นตัวอย่างเฉพาะส่วนการสแกน ก่อนนำไปใช้จริงต้องจัดลำดับร่วมกับคำเตือนตารางงานและเวลาทับซ้อนทั้งชุด หรือเก็บคำเตือนหลายรายการแทนการเลือกเพียงแขนงเดียว

กรณีที่ควรทดสอบ: มีสแกนทั้งคู่ ขาดเฉพาะเข้า ขาดเฉพาะออก และขาดทั้งคู่ ต้องได้ข้อความแตกต่างกันตามกติกาที่เลือก

## 7. สถานะ “ยังไม่ดำเนินการทดสอบ” เป็น else ที่ไม่มีทางถึง

ตำแหน่ง: `app/academic_services/models.py` บรรทัด 1435–1454 ใน property `customer_status`

### โค้ดเดิมที่เกี่ยวข้อง

```python
uploaded_all = all(item.draft_file for item in self.result_items)
# มี if/elif ตรวจสถานะอื่นก่อนหน้านี้
# ส่วนท้ายของชุดเงื่อนไข:
elif uploaded_all and self.sent_at:
    status = 'รอยืนยันใบรายงานผล'
    color = 'is-warning'
elif not uploaded_all or (uploaded_all and not self.sent_at):
    status = 'กำลังออกรายงานผล'
    color = 'is-light'
else:
    status = 'ยังไม่ดำเนินการทดสอบ'
    color = 'is-danger'
```

สองแขนงก่อน `else` ครอบคลุมทุกค่าความจริงของ `uploaded_all` และ `self.sent_at` แล้ว หากอัปโหลดครบและส่งแล้วจะเข้าแขนงแรก กรณีอื่นทั้งหมดเข้าแขนงที่สอง จึงไม่มีข้อมูลชุดใดเหลือให้ `else` ทำงาน

### ตัวอย่างตรวจทุกกรณี

```python
from itertools import product

for uploaded_all, sent_at in product([False, True], repeat=2):
    if uploaded_all and sent_at:
        status = "รอยืนยันใบรายงานผล"
    elif not uploaded_all or (uploaded_all and not sent_at):
        status = "กำลังออกรายงานผล"
    else:
        status = "ยังไม่ดำเนินการทดสอบ"
    print(uploaded_all, sent_at, status)
```

ผลลัพธ์:

```text
False False กำลังออกรายงานผล
False True กำลังออกรายงานผล
True False กำลังออกรายงานผล
True True รอยืนยันใบรายงานผล
```

ผลกระทบ: สถานะเริ่มต้นที่ระบุใน `else` ไม่เคยแสดงจาก property นี้ อีกจุดที่ควรระวังคือ `all(...)` ของรายการว่างให้ `True` ดังนั้นหากยังไม่มี `result_items` และยังไม่ส่งรายงาน จะถูกจัดเป็น “กำลังออกรายงานผล” หากผ่านแขนงสถานะก่อนหน้ามาถึงส่วนนี้

### แนวทางปรับปรุง

ต้องกำหนดให้ชัดว่าอะไรคือ “ยังไม่ดำเนินการทดสอบ” เช่น หากกติกาหมายถึงยังไม่มีรายการผลลัพธ์ ให้ตรวจกรณีนั้นก่อนส่วนอัปโหลด ไม่วางไว้หลังเงื่อนไขที่ครอบคลุมทุกกรณีแล้ว:

```python
# ตัวอย่างเฉพาะส่วนท้าย ต้องรักษาลำดับสถานะสำคัญก่อนหน้าไว้
if not self.result_items:
    status = "ยังไม่ดำเนินการทดสอบ"
elif uploaded_all and self.sent_at:
    status = "รอยืนยันใบรายงานผล"
else:
    status = "กำลังออกรายงานผล"
```

ข้อเสนอนี้ต้องยืนยันความหมายของสถานะก่อนใช้งานจริง การไม่มีรายการผลลัพธ์อาจไม่ใช่เกณฑ์การเริ่มทดสอบของระบบนี้ หากไม่ต้องการสถานะเริ่มต้นแล้ว ควรลบแขนงที่ไม่มีทางถึงและใช้ `else` สำหรับ “กำลังออกรายงานผล” โดยตรง

กรณีที่ควรทดสอบ: รายการว่าง อัปโหลดบางส่วน อัปโหลดครบแต่ยังไม่ส่ง และอัปโหลดครบพร้อมส่งแล้ว รวมถึงสถานะสำคัญในแขนงก่อนหน้า

## ผลการตรวจสอบและข้อจำกัด

- อ่านเงื่อนไขและโค้ดรอบข้างจากไฟล์ปัจจุบันโดยตรง
- ทดลองนิพจน์ Python แยกจากระบบ ยืนยันกรณีนับใบลาที่ไม่ควรนับ สถานะดาวน์โหลดครบก่อนเวลา ค่าสรุปดาวน์โหลดที่ค้าง และคำเตือน OT ที่ไม่ตรงกับข้อมูล
- ทดลองเงื่อนไขสิทธิ์หน้าทดสอบชำระเงินครบ 4 ชุดตามตาราง และยืนยันว่ารายชื่อว่างทำให้ผู้ใช้ที่ล็อกอินผ่านเงื่อนไขเดิม
- ทดลองเปรียบเทียบวันสิ้นสุดกับ `None` และพบ `TypeError` ตามกรณีในข้อ 1
- ตรวจค่าความจริงครบทุกชุดของตัวอย่างข้อ 5–7 ยืนยันว่าแขนงเฉพาะเรื่องการสแกนและสถานะเริ่มต้นไม่มีทางถูกเลือก
- ยังไม่ได้เรียก route จริง ใช้ฐานข้อมูลจริง หรือรัน integration tests ผลนี้จึงยืนยันพฤติกรรมของนิพจน์ ไม่ใช่ผลกระทบทั้งหมดในระบบที่ใช้งานจริง
- บันทึกนี้ไม่เปลี่ยนโค้ด `my_mis2018` และยังไม่ได้เผยแพร่ขึ้น GitHub Pages

## งานติดตาม

- [ ] ยืนยันกติกาวันที่ไม่ครบและสถานะใบลากับผู้ดูแลระบบ
- [ ] เพิ่ม regression tests ตามกรณีตัวอย่างก่อนแก้เงื่อนไข
- [ ] แก้ลำดับการคำนวณสถานะดาวน์โหลดและตรวจขอบเขตชุดผลลัพธ์
- [ ] รวมกติกาคำเตือน OT ที่ซ้ำกันและตรวจลำดับความสำคัญของข้อความ
- [ ] ตรวจผลของ S3 ล้มเหลวต่อสถานะดาวน์โหลด

- [ ] กำหนดให้หน้าทดสอบชำระเงินปฏิเสธสิทธิ์เมื่อรายชื่อผู้ดูแลว่าง และทดสอบว่าไม่เปลี่ยนสถานะการชำระเงินเมื่อถูกปฏิเสธ
- [ ] ตรวจแขนงที่ไม่มีทางถึงในคำเตือนการสแกนและกำหนดเกณฑ์สถานะเริ่มต้นของรายงานผล

## สรุป: Python ประเมินนิพจน์ Boolean อย่างไร

### 1. ลำดับความสำคัญของตัวดำเนินการ

สำหรับตัวดำเนินการที่ใช้ในตัวอย่างนี้ Python จัดกลุ่มตามลำดับ: วงเล็บ → การเปรียบเทียบ เช่น `==`, `is`, `in` → `not` → `and` → `or` ลำดับนี้กำหนดการจัดกลุ่มนิพจน์ ส่วนการประเมิน `and` และ `or` จะเริ่มจากตัวถูกดำเนินการด้านซ้ายและอาจหยุดก่อนประเมินด้านขวา

```python
A = False
B = True
C = True

print(A and B or C)    # True: เท่ากับ (A and B) or C
print(A and (B or C))  # False: วงเล็บเปลี่ยนการจัดกลุ่ม
```

หากเขียน `A and B or C` ค่า `C` ที่เป็นจริงสามารถทำให้ผลรวมเป็นจริงได้ แม้ `A` เป็นเท็จ จึงควรใส่วงเล็บให้ตรงกับกติกาที่ต้องการ โดยเฉพาะเมื่อใช้ `and` และ `or` ร่วมกัน

### 2. Short-circuit: บางส่วนของนิพจน์อาจไม่ถูกประเมิน

- `A and B`: ถ้า `A` เป็นค่าเท็จ จะไม่ประเมิน `B`
- `A or B`: ถ้า `A` เป็นค่าจริง จะไม่ประเมิน `B`

```python
def check_permission():
    print("ตรวจสิทธิ์แล้ว")
    return True

print(False and check_permission())  # False และไม่เรียกฟังก์ชัน
print(True or check_permission())    # True และไม่เรียกฟังก์ชัน
```

พฤติกรรมนี้ช่วยป้องกันการเข้าถึงข้อมูลที่ไม่มีอยู่ เช่น `user is not None and user.email` แต่หากใช้ผิดตำแหน่งก็อาจข้ามการตรวจสำคัญได้ เช่น `allowed and email in allowed` จะไม่ตรวจสมาชิกเมื่อ `allowed` ว่าง ดังที่พบในข้อ 4

### 3. Truthiness: if ไม่ได้ตรวจเฉพาะ True และ False

`if` ประเมินค่าความจริงของผลลัพธ์ ค่าอย่าง `None`, `False`, เลขศูนย์, `""`, `[]`, `{}` และ `set()` เป็นค่าเท็จ ส่วนข้อความและ collection ที่ไม่ว่างโดยทั่วไปเป็นค่าจริง

```python
print(bool([]))       # False
print(bool(["x"]))  # True
print(bool("False")) # True: เป็นข้อความที่ไม่ว่าง ไม่ใช่ Boolean False
```

การตรวจ `not items` จึงหมายถึงตรวจว่ารายการว่าง แต่ `value is False` ตรวจว่าเป็นค่า Boolean `False` จริง ๆ และ `value is None` ตรวจว่าไม่มีค่า ทั้งสามรูปแบบมีความหมายต่างกัน ควรเลือกให้ตรงกับชนิดข้อมูลและกติกา

### 4. and และ or คืนค่าตัวถูกดำเนินการ ไม่จำเป็นต้องเป็น Boolean

`and` คืนค่าตัวแรกที่เป็นค่าเท็จ หรือค่าตัวสุดท้ายหากทุกตัวเป็นค่าจริง ส่วน `or` คืนค่าตัวแรกที่เป็นค่าจริง หรือค่าตัวสุดท้ายหากทุกตัวเป็นค่าเท็จ ต่างจาก `not` ซึ่งคืน `True` หรือ `False` เสมอ

```python
print([] and "ตรวจสมาชิก")  # []
print("" or "ค่าเริ่มต้น")  # ค่าเริ่มต้น
print("พร้อม" and 42)      # 42
print(not [])              # True
```

แม้ผลลัพธ์เป็น `[]` ก็ใช้กับ `if` ได้และจะถือเป็นเท็จ นอกจากนี้ `value or default` จะเลือกค่าเริ่มต้นเมื่อ `value` เป็นค่าเท็จทุกชนิด รวมถึง `0` และ `False` ไม่ใช่เฉพาะ `None`

### 5. if/elif/else เลือกเพียงแขนงแรกที่เป็นจริง

Python ตรวจจากบนลงล่าง เมื่อพบเงื่อนไขที่เป็นจริงจะทำแขนงนั้นและข้าม `elif` ที่เหลือ ส่วน `else` ทำงานเมื่อเงื่อนไขก่อนหน้าทั้งหมดเป็นเท็จเท่านั้น

```python
missing_checkin = True
missing_checkout = False

if missing_checkin or missing_checkout:
    print("ขาดสแกนอย่างน้อยหนึ่งรายการ")
elif missing_checkin:
    print("ขาดเฉพาะสแกนเข้า")  # ไม่มีทางถึง เพราะแขนงแรกครอบคลุมแล้ว
```

หากต้องการแยกกรณีเฉพาะ ควรวางเงื่อนไขเฉพาะก่อนเงื่อนไขทั่วไป หรือทำให้แต่ละแขนงครอบคลุมคนละกรณี หากต้องการแสดงหลายผลพร้อมกัน อาจใช้ `if` แยกกันแทน `elif` โดยต้องพิจารณาว่ากรณีเหล่านั้นสามารถเกิดร่วมกันได้หรือไม่

### 6. all และ any มีผลลัพธ์พิเศษเมื่อข้อมูลว่าง

`all(...)` เป็นจริงเมื่อทุกค่าเป็นค่าจริง และหยุดเมื่อพบค่าเท็จ ส่วน `any(...)` เป็นจริงเมื่อมีอย่างน้อยหนึ่งค่าจริงและหยุดเมื่อพบค่านั้น สำหรับ iterable ว่าง:

```python
print(all([]))  # True: ไม่มีสมาชิกที่เป็นค่าเท็จ
print(any([]))  # False: ไม่มีสมาชิกที่เป็นค่าจริง
```

ดังนั้น “ทุกรายการเสร็จแล้ว” อาจไม่เท่ากับ “มีรายการ และทุกรายการเสร็จแล้ว” หากต้องการอย่างหลังสำหรับรายการแบบ list ให้ตรวจว่ามีข้อมูลก่อน:

```python
items = []
completed = bool(items) and all(item["done"] for item in items)
print(completed)  # False
```

เวลา review เงื่อนไข ให้จัดกลุ่มด้วยวงเล็บตามกติกา แยกชื่อเงื่อนไขที่สื่อความหมาย และลองค่าที่ขอบเขต เช่น `None`, รายการว่าง และกรณีที่มีเพียงเงื่อนไขเดียวเป็นจริง สำหรับ Boolean ไม่กี่ตัว การไล่ตารางค่าความจริงทุกชุดช่วยตรวจทั้งการจัดกลุ่มผิดและแขนงที่ไม่มีทางถึงได้
